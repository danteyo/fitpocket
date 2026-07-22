export function getBeijingDayKey(now: Date = new Date()): string {
  return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export function monthKey(dayKey: string): string { return dayKey.slice(0, 7) }

export function getMonthRange(key: string): { start: string; end: string } {
  const [year, month] = key.split('-').map(Number)
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return { start: `${key}-01`, end: `${key}-${String(last).padStart(2, '0')}` }
}
