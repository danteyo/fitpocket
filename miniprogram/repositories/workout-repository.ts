import { WorkoutRecord } from '../domain/workout'

export interface WorkoutRepository {
  get(date: string): Promise<WorkoutRecord | null>
  upsert(record: WorkoutRecord): Promise<void>
  remove(date: string): Promise<void>
  list(start: string, end: string): Promise<WorkoutRecord[]>
}
