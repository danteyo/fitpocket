export type BodyArea = 'upper' | 'lower' | 'full'
export type Intensity = 1 | 2 | 3 | 4 | 5

export interface WorkoutRecord {
  date: string
  bodyArea?: BodyArea
  intensity?: Intensity
  createdAt: string
  updatedAt: string
}

export const AREA_LABEL: Record<BodyArea, string> = {
  upper: '上半身', lower: '下半身', full: '全身',
}

export const INTENSITY_LABEL: Record<Intensity, string> = {
  1: '算是动了', 2: '有点感觉', 3: '刚刚好', 4: '今天挺狠', 5: '人已练废',
}
