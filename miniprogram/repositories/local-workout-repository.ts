import { WorkoutRecord } from '../domain/workout'
import { WorkoutRepository } from './workout-repository'

const STORAGE_KEY = 'fitpocket.records.v1'
interface Store { version: 1; records: Record<string, WorkoutRecord> }

export class LocalWorkoutRepository implements WorkoutRepository {
  private read(): Store {
    const value: unknown = wx.getStorageSync(STORAGE_KEY)
    if (!value) return { version: 1, records: {} }
    if (typeof value === 'object' && value !== null && 'records' in value) return value as Store
    wx.setStorageSync(`fitpocket.records.corrupt.${Date.now()}`, value)
    return { version: 1, records: {} }
  }
  async get(date: string): Promise<WorkoutRecord | null> { return this.read().records[date] || null }
  async upsert(record: WorkoutRecord): Promise<void> {
    const store = this.read(); store.records[record.date] = record; wx.setStorageSync(STORAGE_KEY, store)
  }
  async remove(date: string): Promise<void> {
    const store = this.read(); delete store.records[date]; wx.setStorageSync(STORAGE_KEY, store)
  }
  async list(start: string, end: string): Promise<WorkoutRecord[]> {
    return Object.values(this.read().records).filter(record => record.date >= start && record.date <= end)
  }
}
