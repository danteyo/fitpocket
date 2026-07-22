import { getBeijingDayKey } from '../../domain/date-rules'
import { getBodyAreaFeedback } from '../../domain/body-feedback'
import { AREA_LABEL, BodyArea, INTENSITY_LABEL, Intensity, WorkoutRecord } from '../../domain/workout'
import { calculateWorkoutGrowth, CriticalMultiplier, getCriticalMultiplier } from '../../domain/growth-rate'
import { getCriticalQuip } from '../../domain/critical-quips'
import { getWorkoutRepository } from '../../repositories/repository-provider'
import { CloudUserRepository } from '../../repositories/cloud-user-repository'
import { WechatAuthService } from '../../services/wechat-auth-service'

const repository = getWorkoutRepository()
const userRepository = new CloudUserRepository()
const authService = new WechatAuthService()
const ONBOARDING_DAY_KEY = 'fitpocket.onboarding.day.v1'
const CRITICAL_FEEDBACK: Record<CriticalMultiplier, string> = {
  1: '稳稳拿下',
  1.5: '小暴击！',
  2: '暴击！',
  5: '超级暴击！',
}
let feedbackTimer: number | undefined
let savedRecord: WorkoutRecord | null = null
let unchangedFinishClicks: number[] = []
const REPLAY_CLICK_WINDOW_MS = 10000
const REPLAY_CLICK_LIMIT = 3

Component({
  data: {
    bodyArea: '' as BodyArea | '', intensity: 0 as Intensity | 0, celebratingIntensity: 0 as Intensity | 0, saved: false,
    areaLabel: '', intensityLabel: '', recordSummary: '', bodyFeedback: '', feedback: '', showFeedback: false,
    criticalMultiplier: 0 as CriticalMultiplier | 0, criticalLevel: '', criticalGrowth: 0, criticalQuip: '', criticalVisible: false, draftDirty: false,
    upperSelected: false, lowerSelected: false, saving: false, loginVisible: false, loginLoading: false,
    loginStep: 'welcome' as 'welcome' | 'profile', loginReturnToView: false, loginAvatarUrl: '', loginNickname: '',
    userLoggedIn: false, userAvatarUrl: '', userNickname: '',
    onboardingVisible: false,
  },
  lifetimes: { attached() { unchangedFinishClicks = []; void this.initializePage() } },
  methods: {
    onShareAppMessage() {
      return { title: '练哪儿了，秀秀你的大肌肉', path: '/pages/today/today' }
    },
    onShareTimeline() {
      return { title: '练哪儿了，秀秀你的大肌肉' }
    },
    async initializePage() {
      const profile = authService.getProfile()
      const loginRequested = authService.consumeLoginRequest()
      const today = getBeijingDayKey()
      const showOnboarding = wx.getStorageSync(ONBOARDING_DAY_KEY) !== today && !loginRequested
      if (showOnboarding) wx.setStorageSync(ONBOARDING_DAY_KEY, today)
      this.setData({
        loginVisible: !authService.hasLocalSession() && loginRequested,
        loginStep: 'welcome',
        loginReturnToView: loginRequested,
        loginAvatarUrl: profile ? profile.avatarUrl : '',
        loginNickname: profile ? profile.nickname : '',
        userLoggedIn: authService.hasLocalSession(),
        userAvatarUrl: profile ? profile.avatarUrl : '',
        userNickname: profile ? profile.nickname : '',
        onboardingVisible: showOnboarding,
      })
      await this.loadToday()
      void this.refreshTodayFromCloud(profile, loginRequested)
    },
    finishOnboarding() {
      this.setData({ onboardingVisible: false })
    },
    beginWechatLogin() {
      this.setData({ loginStep: 'profile' })
    },
    backToLoginWelcome() {
      if (this.data.loginLoading) return
      this.setData({ loginStep: 'welcome' })
    },
    closeLogin() {
      if (this.data.loginLoading) return
      this.setData({ loginVisible: false, loginStep: 'welcome', loginReturnToView: false })
    },
    async loginWithWechat() {
      if (this.data.loginLoading) return
      const nickname = this.data.loginNickname.trim()
      if (!this.data.loginAvatarUrl || !nickname) {
        wx.showToast({ title: '先选头像，再填昵称', icon: 'none' })
        return
      }
      this.setData({ loginLoading: true })
      try {
        const profile = { avatarUrl: this.data.loginAvatarUrl, nickname }
        await authService.login(profile)
        const cloudAvatarUrl = await userRepository.upsert(profile)
        if (cloudAvatarUrl !== profile.avatarUrl) authService.updateAvatarUrl(cloudAvatarUrl)
        await repository.sync()
        const returnToView = this.data.loginReturnToView
        this.setData({ loginVisible: false, loginReturnToView: false, userLoggedIn: true, userAvatarUrl: cloudAvatarUrl, userNickname: nickname })
        wx.showToast({ title: '微信登录成功', icon: 'success' })
        if (returnToView) wx.redirectTo({ url: '../history/history' })
      } catch (_error) {
        wx.showToast({ title: '登录没成功，再试一次', icon: 'none' })
      }
      this.setData({ loginLoading: false })
    },
    chooseLoginAvatar(event: WechatMiniprogram.CustomEvent<{ avatarUrl: string }>) {
      const avatarUrl = authService.saveAvatar(event.detail.avatarUrl)
      this.setData({ loginAvatarUrl: avatarUrl })
    },
    changeLoginNickname(event: WechatMiniprogram.Input) {
      this.setData({ loginNickname: event.detail.value })
    },
    async loadToday(preserveDraft = false) {
      if (preserveDraft && this.data.draftDirty) return
      const record = await repository.get(getBeijingDayKey())
      if (preserveDraft && this.data.draftDirty) return
      if (record) this.applyRecord(record)
      else {
        savedRecord = null
        this.setData({ bodyArea: '', intensity: 0, celebratingIntensity: 0, saved: false, areaLabel: '', intensityLabel: '', recordSummary: '', bodyFeedback: '', upperSelected: false, lowerSelected: false, draftDirty: false, criticalVisible: false })
      }
    },
    async refreshTodayFromCloud(profile: ReturnType<WechatAuthService['getProfile']>, loginRequested: boolean) {
      const sessionValid = await authService.checkSession()
      if (!sessionValid) {
        this.setData({ userLoggedIn: false })
        if (loginRequested) this.setData({ loginVisible: true, loginStep: 'welcome', loginReturnToView: false })
        return
      }
      if (profile) {
        try {
          const cloudAvatarUrl = await userRepository.upsert(profile)
          if (cloudAvatarUrl !== profile.avatarUrl) authService.updateAvatarUrl(cloudAvatarUrl)
        } catch (_error) { /* Retry on the next page open when the network is available. */ }
      }
      try {
        await repository.sync()
        await this.loadToday(true)
      } catch (_error) { /* The local first paint remains usable offline. */ }
    },
    applyRecord(record: WorkoutRecord) {
      savedRecord = record
      const bodyArea = record.bodyArea || ''
      const intensity = record.intensity || 0
      const areaLabel = record.bodyArea ? AREA_LABEL[record.bodyArea] : ''
      const intensityLabel = record.intensity ? INTENSITY_LABEL[record.intensity] : ''
      const bodyFeedback = this.data.bodyArea === bodyArea && this.data.bodyFeedback
        ? this.data.bodyFeedback
        : getBodyAreaFeedback(bodyArea, record.date)
      this.setData({ bodyArea, intensity, celebratingIntensity: intensity, saved: true,
        areaLabel, intensityLabel, recordSummary: [areaLabel, intensityLabel].filter(Boolean).join(' · '), bodyFeedback,
        upperSelected: bodyArea === 'upper' || bodyArea === 'full',
        lowerSelected: bodyArea === 'lower' || bodyArea === 'full', draftDirty: false, criticalVisible: false })
    },
    chooseUpper() { this.toggleArea('upper') },
    chooseLower() { this.toggleArea('lower') },
    toggleArea(area: 'upper' | 'lower') {
      unchangedFinishClicks = []
      const upper = area === 'upper' ? !this.data.upperSelected : this.data.upperSelected
      const lower = area === 'lower' ? !this.data.lowerSelected : this.data.lowerSelected
      const bodyArea: BodyArea | '' = upper && lower ? 'full' : upper ? 'upper' : lower ? 'lower' : ''
      this.setData({ upperSelected: upper, lowerSelected: lower, bodyArea, areaLabel: bodyArea ? AREA_LABEL[bodyArea] : '', draftDirty: true, criticalVisible: false })
      if (bodyArea) wx.vibrateShort({ type: 'light' })
      this.setData({ bodyFeedback: getBodyAreaFeedback(bodyArea, getBeijingDayKey()) })
    },
    chooseIntensity(event: WechatMiniprogram.TouchEvent) {
      if (this.data.saving) return
      unchangedFinishClicks = []
      const intensity = Number(event.currentTarget.dataset.value) as Intensity
      this.setData({ intensity, celebratingIntensity: intensity, draftDirty: true, criticalVisible: false })
      wx.vibrateShort({ type: 'light' })
    },
    async finishWorkout() {
      if (this.data.saving) return
      if (!await authService.checkSession()) {
        this.setData({ loginVisible: true, loginStep: 'welcome', loginReturnToView: false })
        return
      }
      if (!this.data.bodyArea) {
        wx.showToast({ title: '先选身体', icon: 'none' })
        return
      }
      if (!this.data.intensity) {
        wx.showToast({ title: '先选难度', icon: 'none' })
        return
      }
      if (savedRecord && !this.data.draftDirty) {
        const now = Date.now()
        unchangedFinishClicks = unchangedFinishClicks.filter(clickedAt => now - clickedAt < REPLAY_CLICK_WINDOW_MS)
        if (unchangedFinishClicks.length >= REPLAY_CLICK_LIMIT) {
          wx.showToast({ title: '别点了，今天的肌肉已经加啦', icon: 'none' })
          return
        }
        unchangedFinishClicks.push(now)
      } else {
        unchangedFinishClicks = []
      }
      this.setData({ saving: true })
      try {
        let record = savedRecord
        if (!record || this.data.draftDirty) {
          const date = getBeijingDayKey()
          const now = new Date().toISOString()
          record = {
            date,
            bodyArea: this.data.bodyArea,
            intensity: this.data.intensity,
            createdAt: savedRecord ? savedRecord.createdAt : now,
            updatedAt: now,
          }
          await repository.upsert(record)
          this.applyRecord(record)
        }
        this.revealCritical(record)
      } catch (_error) {
        this.setData({ feedback: '这次没记住，再点一下', showFeedback: true })
      }
      this.setData({ saving: false })
    },
    revealCritical(record: WorkoutRecord) {
      const multiplier = getCriticalMultiplier(record)
      const growth = calculateWorkoutGrowth(record)
      const feedback = `${CRITICAL_FEEDBACK[multiplier]} ×${multiplier} · 增长 ${growth}`
      const criticalLevel = multiplier === 5 ? 'max' : multiplier === 2 ? 'strong' : multiplier === 1.5 ? 'mini' : 'normal'
      const criticalQuip = getCriticalQuip(record, multiplier)
      this.setData({ criticalVisible: false, criticalMultiplier: multiplier, criticalLevel, criticalGrowth: growth, criticalQuip, feedback, showFeedback: true })
      setTimeout(() => this.setData({ criticalVisible: true }), 20)
      if (multiplier >= 5) wx.vibrateLong()
      else wx.vibrateShort({ type: multiplier >= 2 ? 'heavy' : multiplier > 1 ? 'medium' : 'light' })
      if (feedbackTimer) clearTimeout(feedbackTimer)
      feedbackTimer = setTimeout(() => this.setData({ showFeedback: false, criticalVisible: false }), 3200) as unknown as number
    },
    goToday() {},
    goHistory() { wx.redirectTo({ url: '../history/history' }) },
  },
})
