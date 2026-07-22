import type { WorkoutRecord } from './workout'

export function newerRecord(local: WorkoutRecord, cloud: WorkoutRecord): WorkoutRecord {
  return local.updatedAt >= cloud.updatedAt ? local : cloud
}

export function mergeRecords(local: WorkoutRecord[], cloud: WorkoutRecord[]): WorkoutRecord[] {
  const merged: Record<string, WorkoutRecord> = {}
  cloud.forEach(record => { merged[record.date] = record })
  local.forEach(record => {
    const current = merged[record.date]
    merged[record.date] = current ? newerRecord(record, current) : record
  })
  return Object.values(merged).sort((left, right) => left.date.localeCompare(right.date))
}
