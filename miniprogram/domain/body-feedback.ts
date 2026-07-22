import type { BodyArea } from './workout'

const BODY_FEEDBACK: Record<BodyArea, string[]> = {
  upper: ['胸肌大大的', '手臂粗得不得了', '肩膀支棱起来了', '背影都变宽了', '上半身火力全开', '袖口快撑不住了'],
  lower: ['钢铁大腿', '精装大小腿', '腿部力量拉满', '下盘稳得很', '走路都带力量', '今天腿练到位了'],
  full: ['全身都练到了', '浑身都是大肌肉', '从头到脚都安排了', '今天主打一个全面', '全身火力全开', '每块肌肉都有参与感'],
}

export function getBodyAreaFeedback(bodyArea: BodyArea | '', dayKey: string): string {
  if (!bodyArea) return ''
  const messages = BODY_FEEDBACK[bodyArea]
  const seed = `${dayKey}|${bodyArea}|body-feedback`
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return messages[(hash >>> 0) % messages.length]
}
