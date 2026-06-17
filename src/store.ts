import { reactive } from 'vue'
import { api } from './db'

export interface ReviewPoint {
  id: string
  title: string
  category: string
  question: string
  answer: string
  subject_id: string
  subject_name: string
  subject_icon: string
  subject_color: string
  ease_factor: number
  interval: number
  repetitions: number
  next_review: string
  last_review: string | null
  favorited: number
  _sessionCount?: number
}

// 认识：直接移除，不再出现
// 模糊：最多再出现 2 次（共 3 次）
// 忘记：最多再出现 4 次（共 5 次）
const MAX_REPEATS: Record<number, number> = { 2: 1, 1: 3, 0: 5 }

export const store = reactive({
  subjects: [] as any[],
  reviewQueue: [] as ReviewPoint[],
  currentIndex: 0,
  totalCount: 0,
  completedCount: 0,
  dailyLimit: parseInt(localStorage.getItem('zhiji_daily_limit') || '20'),
  overview: { due_today: 0, total_points: 0, learned_points: 0, new_today: 0, reviewed_today: 0 },
  loading: false,

  setDailyLimit(n: number) {
    this.dailyLimit = n
    localStorage.setItem('zhiji_daily_limit', String(n))
  },

  async loadSubjects() {
    this.subjects = await api.getSubjects()
  },

  async loadOverview() {
    this.overview = await api.getOverview()
  },

  async loadReviewQueue(subjectIds?: string[], limit?: number) {
    const queue = await api.getReviewQueue(subjectIds, limit)
    queue.forEach((p: ReviewPoint) => { p._sessionCount = 0 })
    this.reviewQueue = queue
    this.currentIndex = 0
    this.totalCount = queue.length
    this.completedCount = 0
  },

  async submitRating(rating: number) {
    const point = this.reviewQueue[this.currentIndex]
    if (!point) return false

    const count = (point._sessionCount || 0) + 1
    const maxRepeat = MAX_REPEATS[rating] ?? 1

    await api.submitRating(point.id, rating)
    this.reviewQueue.splice(this.currentIndex, 1)

    if (count < maxRepeat) {
      const copy = { ...point, _sessionCount: count }
      const remaining = this.reviewQueue.length
      const offset = Math.min(remaining, 3 + Math.floor(Math.random() * 5))
      const insertAt = Math.min(this.currentIndex + offset, remaining)
      this.reviewQueue.splice(insertAt, 0, copy as ReviewPoint)
    } else {
      this.completedCount++
    }

    if (this.reviewQueue.length === 0) return false
    if (this.currentIndex >= this.reviewQueue.length) this.currentIndex = 0
    return true
  },

  async suspendPoint() {
    const point = this.reviewQueue[this.currentIndex]
    if (!point) return false
    await api.suspendPoint(point.id)
    this.reviewQueue.splice(this.currentIndex, 1)
    this.totalCount--
    if (this.reviewQueue.length === 0) return false
    if (this.currentIndex >= this.reviewQueue.length) this.currentIndex = 0
    return true
  },

  async toggleFavorite() {
    const point = this.reviewQueue[this.currentIndex]
    if (!point) return
    const res = await api.toggleFavorite(point.id)
    point.favorited = res.favorited ? 1 : 0
  },

  get currentPoint(): ReviewPoint | null {
    return this.reviewQueue[this.currentIndex] || null
  }
})
