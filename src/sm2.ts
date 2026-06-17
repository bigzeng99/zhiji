export interface SM2Result {
  interval: number
  repetitions: number
  easeFactor: number
}

// rating: 0=忘记, 1=模糊, 2=认识
// 映射到 SM-2 quality: 忘记→1, 模糊→3, 认识→5
const QUALITY_MAP: Record<number, number> = { 0: 1, 1: 3, 2: 5 }

export function sm2(
  rating: number,
  repetitions: number,
  easeFactor: number,
  interval: number
): SM2Result {
  const quality = QUALITY_MAP[rating] ?? 1

  if (quality >= 3) {
    if (repetitions === 0) interval = 1
    else if (repetitions === 1) interval = 3
    else interval = Math.round(interval * easeFactor)
    repetitions++
  } else {
    repetitions = 0
    interval = 1
  }

  easeFactor = Math.max(
    1.3,
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  )

  return { interval, repetitions, easeFactor }
}
