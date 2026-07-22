const AUTH_KEY = 'fitpocket.auth.v1'
const LOGIN_REQUEST_KEY = 'fitpocket.login.requested.v1'

interface LocalAuthState {
  loggedIn: boolean
  loggedInAt: string
  avatarUrl: string
  nickname: string
}

export interface WechatUserProfile {
  avatarUrl: string
  nickname: string
}

export class WechatAuthService {
  requestLogin(): void {
    wx.setStorageSync(LOGIN_REQUEST_KEY, true)
  }

  consumeLoginRequest(): boolean {
    const requested = Boolean(wx.getStorageSync(LOGIN_REQUEST_KEY))
    if (requested) wx.removeStorageSync(LOGIN_REQUEST_KEY)
    return requested
  }

  hasLocalSession(): boolean {
    const state: unknown = wx.getStorageSync(AUTH_KEY)
    return typeof state === 'object' && state !== null
      && 'loggedIn' in state && 'avatarUrl' in state && 'nickname' in state
      && Boolean((state as LocalAuthState).loggedIn)
      && Boolean((state as LocalAuthState).avatarUrl)
      && Boolean((state as LocalAuthState).nickname)
  }

  checkSession(): Promise<boolean> {
    if (!this.hasLocalSession()) return Promise.resolve(false)
    return new Promise(resolve => {
      wx.checkSession({ success: () => resolve(true), fail: () => resolve(false) })
    })
  }

  saveAvatar(tempFilePath: string): string {
    if (!tempFilePath) return ''
    if (!tempFilePath.startsWith('http') && !tempFilePath.startsWith('wxfile://')) return tempFilePath
    try {
      return wx.getFileSystemManager().saveFileSync(tempFilePath)
    } catch (_error) {
      return tempFilePath
    }
  }

  getProfile(): WechatUserProfile | null {
    const state: unknown = wx.getStorageSync(AUTH_KEY)
    if (typeof state !== 'object' || state === null || !('nickname' in state) || !('avatarUrl' in state)) return null
    const profile = state as LocalAuthState
    return { avatarUrl: profile.avatarUrl, nickname: profile.nickname }
  }

  updateAvatarUrl(avatarUrl: string): void {
    const state: unknown = wx.getStorageSync(AUTH_KEY)
    if (typeof state !== 'object' || state === null || !('loggedIn' in state)) return
    wx.setStorageSync(AUTH_KEY, { ...(state as LocalAuthState), avatarUrl })
  }

  login(profile: WechatUserProfile): Promise<string> {
    return new Promise((resolve, reject) => {
      wx.login({
        success: result => {
          if (!result.code) {
            reject(new Error('微信未返回登录凭证'))
            return
          }
          // The code is intentionally not persisted. A future backend must exchange it
          // for a server-side session and stable user identity.
          wx.setStorageSync(AUTH_KEY, {
            loggedIn: true,
            loggedInAt: new Date().toISOString(),
            avatarUrl: profile.avatarUrl,
            nickname: profile.nickname,
          } as LocalAuthState)
          resolve(result.code)
        },
        fail: reject,
      })
    })
  }
}
