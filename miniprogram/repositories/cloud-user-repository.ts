import { WechatUserProfile } from '../services/wechat-auth-service'

interface CloudUserDocument { _id: string }

export class CloudUserRepository {
  private readonly collection = wx.cloud.database().collection('users')

  async upsert(profile: WechatUserProfile): Promise<string> {
    const result = await this.collection.limit(1).get()
    const current = result.data[0] as CloudUserDocument | undefined
    const now = new Date().toISOString()
    const avatarUrl = await this.uploadAvatar(profile.avatarUrl)
    const data = { nickname: profile.nickname, avatarUrl, updatedAt: now }
    if (current) await this.collection.doc(current._id).update({ data })
    else await this.collection.add({ data: { ...data, createdAt: now } })
    return avatarUrl
  }

  private async uploadAvatar(localPath: string): Promise<string> {
    if (!localPath || localPath.startsWith('cloud://') || localPath.startsWith('https://')) return localPath
    const suffixMatch = localPath.match(/\.([a-zA-Z0-9]+)$/)
    const suffix = suffixMatch ? suffixMatch[1] : 'jpg'
    const cloudPath = `avatars/${Date.now()}-${Math.random().toString(36).slice(2)}.${suffix}`
    const result = await wx.cloud.uploadFile({ cloudPath, filePath: localPath })
    return result.fileID
  }
}
