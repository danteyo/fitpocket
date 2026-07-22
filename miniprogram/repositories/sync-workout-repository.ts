import { mergeRecords } from '../domain/sync-rules'
import { WorkoutRecord } from '../domain/workout'
import { WorkoutRepository } from './workout-repository'

const DELETION_KEY = 'fitpocket.sync.deletions.v1'
const SYNC_COOLDOWN_MS = 30000

type Deletions = Record<string, string>

export class SyncWorkoutRepository implements WorkoutRepository {
  private activeSync: Promise<void> | null = null
  private pendingCloudWork: Promise<void> = Promise.resolve()
  private lastSyncCompletedAt = 0

  constructor(
    private readonly local: WorkoutRepository,
    private readonly cloud: WorkoutRepository,
    private readonly canSync: () => boolean,
  ) {}

  get(date: string): Promise<WorkoutRecord | null> { return this.local.get(date) }
  list(start: string, end: string): Promise<WorkoutRecord[]> { return this.local.list(start, end) }

  async upsert(record: WorkoutRecord): Promise<void> {
    await this.local.upsert(record)
    const deletions = this.readDeletions()
    delete deletions[record.date]
    this.writeDeletions(deletions)
    if (this.canSync()) this.enqueueCloudWork(() => this.cloud.upsert(record))
  }

  async remove(date: string): Promise<void> {
    await this.local.remove(date)
    const deletions = this.readDeletions()
    deletions[date] = new Date().toISOString()
    this.writeDeletions(deletions)
    if (this.canSync()) this.enqueueCloudWork(() => this.pushDeletion(date))
  }

  async sync(start = '0000-01-01', end = '9999-12-31'): Promise<void> {
    if (!this.canSync()) return
    if (this.activeSync) return this.activeSync
    if (Date.now() - this.lastSyncCompletedAt < SYNC_COOLDOWN_MS) return
    this.activeSync = this.performSync(start, end)
      .then(() => { this.lastSyncCompletedAt = Date.now() })
      .finally(() => { this.activeSync = null })
    return this.activeSync
  }

  private async performSync(start: string, end: string): Promise<void> {
    await this.pendingCloudWork
    const [localRecords, cloudRecords] = await Promise.all([
      this.local.list(start, end),
      this.cloud.list(start, end),
    ])
    const deletions = this.readDeletions()
    const deletedDates = new Set<string>()
    for (const cloudRecord of cloudRecords) {
      const deletedAt = deletions[cloudRecord.date]
      if (deletedAt && deletedAt >= cloudRecord.updatedAt) {
        await this.cloud.remove(cloudRecord.date)
        deletedDates.add(cloudRecord.date)
        delete deletions[cloudRecord.date]
      } else if (deletedAt) {
        delete deletions[cloudRecord.date]
      }
    }
    const cloudDates = new Set(cloudRecords.map(record => record.date))
    for (const date of Object.keys(deletions)) {
      if (!cloudDates.has(date)) {
        await this.cloud.remove(date)
        delete deletions[date]
      }
    }
    this.writeDeletions(deletions)
    const activeCloud = cloudRecords.filter(record => !deletedDates.has(record.date))
    const merged = mergeRecords(localRecords, activeCloud)
    for (const record of merged) {
      await this.local.upsert(record)
      await this.cloud.upsert(record)
    }
  }

  private async pushDeletion(date: string): Promise<void> {
    await this.cloud.remove(date)
    const deletions = this.readDeletions()
    delete deletions[date]
    this.writeDeletions(deletions)
  }

  private enqueueCloudWork(work: () => Promise<void>): void {
    this.pendingCloudWork = this.pendingCloudWork.then(work).catch(() => undefined)
  }

  private readDeletions(): Deletions {
    const value: unknown = wx.getStorageSync(DELETION_KEY)
    return typeof value === 'object' && value !== null ? value as Deletions : {}
  }

  private writeDeletions(deletions: Deletions): void {
    wx.setStorageSync(DELETION_KEY, deletions)
  }
}
