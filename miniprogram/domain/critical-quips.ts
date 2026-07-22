import type { CriticalMultiplier } from './growth-rate'
import type { WorkoutRecord } from './workout'

export interface WeightedCriticalQuip {
  text: string
  weight: number
}

export const CRITICAL_QUIPS: Record<Exclude<CriticalMultiplier, 1>, WeightedCriticalQuip[]> = {
  1.5: [
    { text: '别怕，只是肌肉暴击 1.5 倍而已', weight: 50 },
    { text: '肌肉偷偷加了半份狠劲', weight: 30 },
    { text: '今天的汗，一滴顶一滴半', weight: 20 },
    { text: '小小暴击，身材先膨胀一下', weight: 10 },
    { text: '普通训练？今天偏要超常发挥', weight: 2 },
  ],
  2: [
    { text: '注意！你的肌肉正在双倍施工', weight: 50 },
    { text: '这一练，昨天和今天都值了', weight: 30 },
    { text: '双倍暴击，袖口开始紧张了', weight: 20 },
    { text: '肌肉表示：这波必须翻倍', weight: 10 },
    { text: '别眨眼，力量正在复制粘贴', weight: 2 },
  ],
  5: [
    { text: '五倍暴击！肌肉要冲出屏幕了', weight: 50 },
    { text: '传说级训练，今天被你撞上了', weight: 30 },
    { text: '全身警报：肌肉正在疯狂加载', weight: 20 },
    { text: '这一练，直接把狠劲拉满五格', weight: 10 },
    { text: '恭喜，今天的你强得有点离谱', weight: 2 },
  ],
}

export function weightedQuipForRoll(quips: WeightedCriticalQuip[], roll: number): string {
  const totalWeight = quips.reduce((total, quip) => total + quip.weight, 0)
  if (!Number.isInteger(roll) || roll < 0 || roll >= totalWeight) throw new RangeError('roll is outside the quip weight range')
  let boundary = 0
  for (const quip of quips) {
    boundary += quip.weight
    if (roll < boundary) return quip.text
  }
  return quips[quips.length - 1].text
}

function deterministicQuipRoll(seed: string, modulus: number): number {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) % modulus
}

export function getCriticalQuip(record: Pick<WorkoutRecord, 'date' | 'createdAt'>, multiplier: CriticalMultiplier): string {
  if (multiplier === 1) return ''
  const quips = CRITICAL_QUIPS[multiplier]
  const totalWeight = quips.reduce((total, quip) => total + quip.weight, 0)
  const roll = deterministicQuipRoll(`${record.date}|${record.createdAt}|quip|${multiplier}`, totalWeight)
  return weightedQuipForRoll(quips, roll)
}
