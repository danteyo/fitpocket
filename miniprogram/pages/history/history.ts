import { getBeijingDayKey, getMonthRange, monthKey } from '../../domain/date-rules'
import { getBodyAreaFeedback } from '../../domain/body-feedback'
import { calculateGrowthRate, CriticalMultiplier, getCriticalMultiplier } from '../../domain/growth-rate'
import { WorkoutRecord } from '../../domain/workout'
import { getWorkoutRepository } from '../../repositories/repository-provider'
import { CloudUserRepository } from '../../repositories/cloud-user-repository'
import { WechatAuthService } from '../../services/wechat-auth-service'

interface DayCell {
  key: string
  day: number
  empty: boolean
  future: boolean
  areaClass: string
  stateClass: string
  dots: number[]
  today: boolean
  criticalClass: string
}
const repository = getWorkoutRepository()
const userRepository = new CloudUserRepository()
const authService = new WechatAuthService()
const CRITICAL_LABEL: Record<CriticalMultiplier, string> = {
  1: '平平无奇',
  1.5: '小暴击 ×1.5',
  2: '大暴击 ×2',
  5: '肌肉爆炸 ×5',
}

function recordCriticalMultiplier(record: WorkoutRecord): CriticalMultiplier | null {
  return record.bodyArea && record.intensity ? getCriticalMultiplier(record) : null
}

function criticalClass(multiplier: CriticalMultiplier | null): string {
  if (multiplier === 1.5) return 'critical-mini'
  if (multiplier === 2) return 'critical-strong'
  if (multiplier === 5) return 'critical-max'
  return ''
}
let touchStartX = 0
let touchStartY = 0
let suppressDayTap = false
const CURRENT_YEAR = Number(getBeijingDayKey().slice(0, 4))
const YEAR_OPTIONS = Array.from({ length: CURRENT_YEAR - 2019 }, (_value, index) => `${2020 + index}年`)
const MONTH_OPTIONS = Array.from({ length: 12 }, (_value, index) => `${index + 1}月`)

Component({
  data: { currentMonth: '', monthTitle: '', monthPickerRange: [YEAR_OPTIONS, MONTH_OPTIONS], monthPickerValue: [YEAR_OPTIONS.length - 1, Number(getBeijingDayKey().slice(5, 7)) - 1], calendarMotion: '', calendarAnimating: false, rowClass: 'rows-5', activeDays: 0, upperRate: 0, lowerRate: 0, avatarUrl: '', nickname: '', cells: [] as DayCell[], selected: null as WorkoutRecord | null, sheetTitle: '', sheetCriticalLabel: '', sheetOpen: false },
  pageLifetimes: { show() { void this.initializePage() } },
  methods: {
    onShareAppMessage() {
      return { title: '练哪儿了，秀秀你的大肌肉', path: '/pages/today/today' }
    },
    onShareTimeline() {
      return { title: '练哪儿了，秀秀你的大肌肉' }
    },
    async initializePage() {
      this.loadProfile()
      await this.loadMonth()
      const profile = authService.getProfile()
      void this.refreshHistoryFromCloud(profile)
    },
    async refreshHistoryFromCloud(profile: ReturnType<WechatAuthService['getProfile']>) {
      const sessionValid = await authService.checkSession()
      if (!sessionValid) return
      if (sessionValid && profile) {
        try {
          const cloudAvatarUrl = await userRepository.upsert(profile)
          if (cloudAvatarUrl !== profile.avatarUrl) authService.updateAvatarUrl(cloudAvatarUrl)
        } catch (_error) { /* Retry on the next page show when the network is available. */ }
      }
      if (sessionValid) {
        try { await repository.sync() } catch (_error) { /* Render the local cache when offline. */ }
      }
      await this.loadMonth(this.data.currentMonth || undefined)
    },
    loadProfile() {
      const profile = authService.getProfile()
      this.setData({ avatarUrl: profile ? profile.avatarUrl : '', nickname: profile ? profile.nickname : '' })
    },
    async loadMonth(targetMonth?: string) {
      const today = getBeijingDayKey(); const key = targetMonth || this.data.currentMonth || monthKey(today); const range = getMonthRange(key)
      const records = await repository.list(range.start, range.end); const recordMap: Record<string, WorkoutRecord> = {}
      records.forEach(record => { recordMap[record.date] = record })
      const [year, month] = key.split('-').map(Number); const count = Number(range.end.slice(-2))
      const mondayOffset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7
      const cells: DayCell[] = Array.from({ length: mondayOffset }, () => ({ key: '', day: 0, empty: true, future: false, areaClass: '', stateClass: '', dots: [], today: false, criticalClass: '' }))
      for (let day = 1; day <= count; day += 1) {
        const dayKey = `${key}-${String(day).padStart(2, '0')}`; const record = recordMap[dayKey]
        cells.push({
          key: dayKey,
          day,
          empty: false,
          future: dayKey > today,
          areaClass: record && record.bodyArea ? `area-${record.bodyArea}` : '',
          stateClass: record
            ? record.bodyArea && record.intensity
              ? 'state-combined'
              : record.bodyArea
                ? 'state-area-only'
                : 'state-difficulty-only'
            : 'state-empty',
          dots: record && record.intensity ? Array.from({ length: record.intensity }, (_value, index) => index + 1) : [],
          today: dayKey === today,
          criticalClass: record ? criticalClass(recordCriticalMultiplier(record)) : '',
        })
      }
      const asOf = range.end < today ? range.end : today
      const allRecords = await repository.list('0000-01-01', asOf)
      const upperRate = calculateGrowthRate(allRecords, 'upper', asOf)
      const lowerRate = calculateGrowthRate(allRecords, 'lower', asOf)
      const rowClass = `rows-${Math.ceil(cells.length / 7)}`
      const yearIndex = YEAR_OPTIONS.indexOf(`${year}年`)
      this.setData({ currentMonth: key, monthTitle: `${year}年${month}月`, monthPickerValue: [Math.max(0, yearIndex), month - 1], rowClass, activeDays: allRecords.length, upperRate, lowerRate, cells })
    },
    selectDay(event: WechatMiniprogram.TouchEvent) {
      if (suppressDayTap || this.data.calendarAnimating) return
      const key = String(event.currentTarget.dataset.key); if (!key || key > getBeijingDayKey()) return
      void repository.get(key).then(record => {
        if (record) {
          const multiplier = recordCriticalMultiplier(record)
          this.setData({ selected: record, sheetTitle: getBodyAreaFeedback(record.bodyArea || '', record.date) || '那一天，仅仅是练了罢了...', sheetCriticalLabel: multiplier ? CRITICAL_LABEL[multiplier] : '', sheetOpen: true })
        }
      })
    },
    onCalendarTouchStart(event: WechatMiniprogram.TouchEvent) {
      const touch = event.touches[0]
      touchStartX = touch.clientX
      touchStartY = touch.clientY
    },
    onCalendarTouchEnd(event: WechatMiniprogram.TouchEvent) {
      const touch = event.changedTouches[0]
      const deltaX = touch.clientX - touchStartX
      const deltaY = touch.clientY - touchStartY
      if (Math.abs(deltaX) < 45 || Math.abs(deltaX) <= Math.abs(deltaY)) return
      suppressDayTap = true
      setTimeout(() => { suppressDayTap = false }, 250)
      this.changeMonth(deltaX < 0 ? 1 : -1)
    },
    onMonthPicked(event: WechatMiniprogram.CustomEvent<{ value: number[] }>) {
      const [yearIndex, monthIndex] = event.detail.value
      const year = 2020 + yearIndex
      const target = `${year}-${String(monthIndex + 1).padStart(2, '0')}`
      if (target > monthKey(getBeijingDayKey())) {
        wx.showToast({ title: '还没到这个月', icon: 'none' })
        return
      }
      void this.loadMonth(target)
    },
    changeMonth(offset: number) {
      if (this.data.calendarAnimating) return
      const [year, month] = this.data.currentMonth.split('-').map(Number)
      const targetDate = new Date(Date.UTC(year, month - 1 + offset, 1))
      const target = `${targetDate.getUTCFullYear()}-${String(targetDate.getUTCMonth() + 1).padStart(2, '0')}`
      if (target > monthKey(getBeijingDayKey())) return
      this.setData({ calendarAnimating: true, calendarMotion: offset > 0 ? 'calendar-out-left' : 'calendar-out-right' })
      setTimeout(() => { void this.finishMonthTransition(target, offset) }, 170)
    },
    async finishMonthTransition(target: string, offset: number) {
      await this.loadMonth(target)
      this.setData({ calendarMotion: offset > 0 ? 'calendar-in-right' : 'calendar-in-left' })
      setTimeout(() => this.setData({ calendarMotion: '', calendarAnimating: false }), 230)
    },
    async generateSharePoster() {
      const sessionValid = await authService.checkSession()
      if (!sessionValid) {
        authService.requestLogin()
        wx.showModal({
          title: '登录后再分享',
          content: '先完成微信登录，才能生成你的专属分享图片。',
          confirmText: '去登录',
          showCancel: false,
          success: () => wx.redirectTo({ url: '../today/today' }),
        })
        return
      }
      wx.showLoading({ title: '肌肉膨胀中' })
      const context = wx.createCanvasContext('shareCanvas', this)
      const width = 300
      const height = 480
      context.setFillStyle('#F7F5EF')
      context.fillRect(0, 0, width, height)
      context.setTextAlign('center')
      context.setFillStyle('#FF6B4A')
      context.setFontSize(21)
      context.fillText('练哪儿了', width / 2, 30)
      context.setFillStyle('#242321')
      context.setFontSize(18)
      context.fillText(`${this.data.monthTitle} · 我的锻炼印记`, width / 2, 61)
      const statSegments = [
        { text: '动了 ', size: 10, color: '#78746D' },
        { text: `${this.data.activeDays}天`, size: 13, color: '#FF6B4A' },
        { text: '   上肢 ', size: 10, color: '#78746D' },
        { text: `${this.data.upperRate}%`, size: 13, color: '#FF6B4A' },
        { text: '   下肢 ', size: 10, color: '#78746D' },
        { text: `${this.data.lowerRate}%`, size: 13, color: '#FF6B4A' },
      ]
      const statWidth = statSegments.reduce((total, segment) => {
        context.setFontSize(segment.size)
        return total + context.measureText(segment.text).width
      }, 0)
      let statX = (width - statWidth) / 2
      context.setTextAlign('left')
      statSegments.forEach(segment => {
        context.setFontSize(segment.size)
        context.setFillStyle(segment.color)
        context.fillText(segment.text, statX, 87)
        statX += context.measureText(segment.text).width
      })
      context.setTextAlign('center')

      context.setStrokeStyle('rgba(36,35,33,.08)')
      context.setLineWidth(1)
      context.beginPath()
      context.moveTo(22, 101)
      context.lineTo(278, 101)
      context.stroke()

      const weekLabels = ['一', '二', '三', '四', '五', '六', '日']
      context.setFontSize(11)
      context.setFillStyle('#8F8A82')
      weekLabels.forEach((label, index) => context.fillText(label, 30 + index * 40, 123))
      this.data.cells.forEach((cell, index) => {
        if (cell.empty) return
        const column = index % 7
        const row = Math.floor(index / 7)
        const centerX = 30 + column * 40
        const centerY = 148 + row * 35
        const radius = 13
        context.save()
        context.beginPath()
        context.arc(centerX, centerY, radius, 0, Math.PI * 2)
        context.clip()
        context.setFillStyle('rgba(255,255,255,.78)')
        context.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2)
        if (cell.areaClass) {
          context.setFillStyle('#FF6B4A')
          if (cell.areaClass === 'area-upper') context.fillRect(centerX - radius, centerY - radius, radius * 2, radius)
          else if (cell.areaClass === 'area-lower') context.fillRect(centerX - radius, centerY, radius * 2, radius)
          else context.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2)
        }
        context.restore()
        context.setTextAlign('center')
        context.setFontSize(9)
        context.setFillStyle(cell.areaClass === 'area-upper' || cell.areaClass === 'area-full' ? '#FFFFFF' : '#4D4944')
        context.fillText(String(cell.day), centerX, centerY - 2)
        if (cell.dots.length) {
          const dotWidth = cell.dots.length * 3 + (cell.dots.length - 1) * 2
          context.setFillStyle(cell.areaClass === 'area-lower' || cell.areaClass === 'area-full' ? '#FFFFFF' : '#FF6B4A')
          cell.dots.forEach((_dot, dotIndex) => {
            context.beginPath()
            context.arc(centerX - dotWidth / 2 + 1.5 + dotIndex * 5, centerY + 8, 1.5, 0, Math.PI * 2)
            context.fill()
          })
        }
      })

      context.setStrokeStyle('rgba(36,35,33,.08)')
      context.beginPath()
      context.moveTo(44, 364)
      context.lineTo(256, 364)
      context.stroke()
      context.setFillStyle('#78746D')
      context.setFontSize(16)
      context.fillText('我的大肌肉已经肿了快一倍了', width / 2, 395)
      context.setFillStyle('#FF6B4A')
      context.setFontSize(23)
      context.fillText('还不来一起？', width / 2, 427)
      context.setFillStyle('#AAA59D')
      context.setFontSize(9)
      context.fillText('点两下，记住今天练过', width / 2, 458)
      context.draw(false, () => {
        wx.canvasToTempFilePath({
          canvasId: 'shareCanvas', width, height, destWidth: 900, destHeight: 1440, fileType: 'png',
          success: result => {
            wx.hideLoading()
            wx.showShareImageMenu({ path: result.tempFilePath, fail: () => wx.previewImage({ urls: [result.tempFilePath] }) })
          },
          fail: () => { wx.hideLoading(); wx.showToast({ title: '图片生成失败，再试一次', icon: 'none' }) },
        }, this)
      })
    },
    closeSheet() { this.setData({ sheetOpen: false }) },
    goToday() { wx.redirectTo({ url: '../today/today' }) },
    goHistory() {},
  },
})
