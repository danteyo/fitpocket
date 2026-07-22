import { BodyArea, WorkoutRecord } from './workout'

function dayNumber(dayKey: string): number {
  const [year, month, day] = dayKey.split('-').map(Number)
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000)
}

function includesArea(record: WorkoutRecord, area: 'upper' | 'lower'): boolean {
  return record.bodyArea === area || record.bodyArea === 'full'
}

function applyIdleDecay(rate: number, idleDays: number): number {
  if (idleDays >= 30) return 0
  return Math.max(0, rate - Math.floor(idleDays / 7))
}

export type CriticalMultiplier = 1 | 1.5 | 2 | 5

/** Maps a 0..9999 roll to the product probability bands. */
export function criticalMultiplierForRoll(roll: number): CriticalMultiplier {
  if (roll < 0 || roll >= 10000 || !Number.isInteger(roll)) throw new RangeError('roll must be an integer from 0 to 9999')
  if (roll < 8000) return 1
  if (roll < 9500) return 1.5
  if (roll < 9900) return 2
  return 5
}

/** Stable FNV-1a hash. The persisted date and creation time are the seed. */
export function deterministicCriticalRoll(record: Pick<WorkoutRecord, 'date' | 'createdAt'>): number {
  const seed = `${record.date}|${record.createdAt}`
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) % 10000
}

export function getCriticalMultiplier(record: Pick<WorkoutRecord, 'date' | 'createdAt'>): CriticalMultiplier {
  return criticalMultiplierForRoll(deterministicCriticalRoll(record))
}

export function calculateGrowthWithMultiplier(intensity: number, multiplier: CriticalMultiplier): number {
  return Math.round((0.5 + intensity * 0.1) * multiplier * 1000) / 1000
}

export function calculateWorkoutGrowth(record: Pick<WorkoutRecord, 'date' | 'createdAt' | 'intensity'>): number {
  const intensity = record.intensity || 1
  return calculateGrowthWithMultiplier(intensity, getCriticalMultiplier(record))
}

export function calculateGrowthRate(records: WorkoutRecord[], area: Extract<BodyArea, 'upper' | 'lower'>, asOf: string): number {
  const activity = records
    .filter(record => record.date <= asOf)
    .sort((left, right) => left.date.localeCompare(right.date))

  let rate = 0
  let lastActivityDay: number | null = null
  activity.forEach(record => {
    const currentDay = dayNumber(record.date)
    if (lastActivityDay !== null) rate = applyIdleDecay(rate, currentDay - lastActivityDay - 1)
    if (includesArea(record, area)) {
      rate += calculateWorkoutGrowth(record)
    }
    lastActivityDay = currentDay
  })

  if (lastActivityDay !== null) rate = applyIdleDecay(rate, dayNumber(asOf) - lastActivityDay)
  return Math.round(Math.min(100, Math.max(0, rate)) * 10) / 10
}
