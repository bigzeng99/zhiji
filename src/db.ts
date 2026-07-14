import Dexie, { type Table } from 'dexie'
import { sm2 } from './sm2'

export interface Subject {
  id: string
  name: string
  icon: string
  color: string
  sort_order: number
}

export interface Point {
  id: string
  subject_id: string
  title: string
  category: string
  question: string
  answer: string
  ease_factor: number
  interval: number
  repetitions: number
  next_review: string
  last_review: string | null
  suspended: number
  favorited: number
  source_id?: string
  creator_name?: string
  created_at: string
  updated_at: string
}

export interface Review {
  id?: number
  point_id: string
  rating: number
  ease_factor_before: number
  ease_factor_after: number
  interval_before: number
  interval_after: number
  reviewed_at: string
}

export interface DailyStat {
  date: string
  new_learned: number
  reviewed: number
}

class ZhijiDB extends Dexie {
  subjects!: Table<Subject>
  points!: Table<Point>
  reviews!: Table<Review>
  dailyStats!: Table<DailyStat>

  constructor() {
    super('zhiji')
    this.version(1).stores({
      subjects: 'id, sort_order',
      points: 'id, subject_id, next_review, suspended, favorited, repetitions, interval, created_at',
      reviews: '++id, point_id, reviewed_at',
      dailyStats: 'date'
    })
    this.version(2).stores({
      points: 'id, subject_id, source_id, next_review, suspended, favorited, repetitions, interval, created_at'
    })
  }
}

const db = new ZhijiDB()

const today = () => new Date().toISOString().slice(0, 10)
const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ')

export async function initDB() {
  const seed = await import('./data/seed.json')
  const todayStr = today()
  const nowStr = now()

  const existingSubjects = await db.subjects.count()
  if (existingSubjects === 0) {
    await db.transaction('rw', db.subjects, db.points, async () => {
      await db.subjects.bulkAdd(seed.subjects as Subject[])
      const points = (seed.points as any[]).map(p => ({
        ...p,
        ease_factor: 2.5,
        interval: 0,
        repetitions: 0,
        next_review: todayStr,
        last_review: null,
        suspended: 0,
        favorited: 0,
        created_at: nowStr,
        updated_at: nowStr
      }))
      await db.points.bulkAdd(points)
    })
  } else {
    await db.transaction('rw', db.subjects, db.points, async () => {
      for (const s of seed.subjects as Subject[]) {
        const exists = await db.subjects.get(s.id)
        if (!exists) await db.subjects.add(s)
      }
      const existingIds = new Set((await db.points.toArray()).map(p => p.id))
      const newPoints = (seed.points as any[])
        .filter(p => !existingIds.has(p.id))
        .map(p => ({
          ...p,
          ease_factor: 2.5, interval: 0, repetitions: 0,
          next_review: todayStr, last_review: null,
          suspended: 0, favorited: 0,
          created_at: nowStr, updated_at: nowStr
        }))
      if (newPoints.length > 0) await db.points.bulkAdd(newPoints)
    })
  }
}

export async function exportData() {
  const points = await db.points.toArray()
  const reviews = await db.reviews.toArray()
  const dailyStats = await db.dailyStats.toArray()
  const data = {
    version: 1,
    exported_at: new Date().toISOString(),
    points: points.map(p => ({
      id: p.id,
      ease_factor: p.ease_factor,
      interval: p.interval,
      repetitions: p.repetitions,
      next_review: p.next_review,
      last_review: p.last_review,
      suspended: p.suspended,
      favorited: p.favorited
    })),
    reviews,
    dailyStats
  }
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `zhiji-backup-${today()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importData(file: File) {
  const text = await file.text()
  const data = JSON.parse(text)
  if (!data.version || !data.points) throw new Error('无效的备份文件')

  await db.transaction('rw', db.points, db.reviews, db.dailyStats, async () => {
    for (const p of data.points) {
      const existing = await db.points.get(p.id)
      if (existing) {
        await db.points.update(p.id, {
          ease_factor: p.ease_factor,
          interval: p.interval,
          repetitions: p.repetitions,
          next_review: p.next_review,
          last_review: p.last_review,
          suspended: p.suspended,
          favorited: p.favorited
        })
      }
    }
    if (data.reviews?.length) {
      await db.reviews.clear()
      await db.reviews.bulkAdd(data.reviews)
    }
    if (data.dailyStats?.length) {
      await db.dailyStats.clear()
      await db.dailyStats.bulkAdd(data.dailyStats)
    }
  })
}

export const api = {
  async getSubjects(_teamId?: string | null) {
    const subjects = await db.subjects.orderBy('sort_order').toArray()
    const todayStr = today()
    const result = []
    for (const s of subjects) {
      const pts = await db.points.where('subject_id').equals(s.id).toArray()
      const point_count = pts.length
      const learned_count = pts.filter(p => p.repetitions > 0).length
      const due_count = pts.filter(p => p.next_review <= todayStr && !p.suspended).length
      result.push({ ...s, point_count, learned_count, due_count })
    }
    return result
  },

  async getSubjectPoints(id: string) {
    return db.points.where('subject_id').equals(id).sortBy('created_at')
  },

  async getAllActivePoints() {
    return db.points.toArray()
  },

  async createPoint(data: { subject_id: string; title: string; category: string; question: string; answer: string }) {
    const id = 'p_' + crypto.randomUUID().slice(0, 8)
    const point: Point = {
      id,
      subject_id: data.subject_id,
      title: data.title,
      category: data.category || '',
      question: data.question,
      answer: data.answer,
      ease_factor: 2.5,
      interval: 0,
      repetitions: 0,
      next_review: today(),
      last_review: null,
      suspended: 0,
      favorited: 0,
      creator_name: '我',
      created_at: now(),
      updated_at: now()
    }
    await db.points.add(point)
    return point
  },

  async updatePoint(id: string, data: { title: string; category: string; question: string; answer: string }) {
    await db.points.update(id, { ...data, category: data.category || '', updated_at: now() })
    return db.points.get(id)
  },

  async deletePoint(id: string) {
    await db.points.delete(id)
    await db.reviews.where('point_id').equals(id).delete()
    return { ok: true }
  },

  async deleteSubject(id: string) {
    await db.transaction('rw', db.subjects, db.points, db.reviews, async () => {
      const points = await db.points.where('subject_id').equals(id).toArray()
      for (const p of points) {
        await db.reviews.where('point_id').equals(p.id).delete()
      }
      await db.points.where('subject_id').equals(id).delete()
      await db.subjects.delete(id)
    })
    return { ok: true }
  },

  async deleteTeam(_teamId: string): Promise<any> { throw new Error('请先登录') },

  async getReviewQueue(subjects?: string[], limit?: number) {
    const todayStr = today()
    const subjectMap = new Map<string, Subject>()
    for (const s of await db.subjects.toArray()) {
      subjectMap.set(s.id, s)
    }

    let points = await db.points.where('next_review').belowOrEqual(todayStr).toArray()
    points = points.filter(p => !p.suspended)

    if (subjects?.length) {
      const set = new Set(subjects)
      points = points.filter(p => set.has(p.subject_id))
    }

    points.sort((a, b) => {
      if (b.favorited !== a.favorited) return b.favorited - a.favorited
      return Math.random() - 0.5
    })

    if (limit && limit > 0) {
      points = points.slice(0, limit)
    }

    return points.map(p => {
      const s = subjectMap.get(p.subject_id)
      return {
        ...p,
        subject_name: s?.name || '',
        subject_icon: s?.icon || '',
        subject_color: s?.color || ''
      }
    })
  },

  async submitRating(pointId: string, rating: number) {
    return db.transaction('rw', db.points, db.reviews, db.dailyStats, async () => {
      const point = await db.points.get(pointId)
      if (!point) throw new Error('知识点不存在')

      const result = sm2(rating, point.repetitions, point.ease_factor, point.interval)

      if (point.favorited && result.interval > 1) {
        result.interval = Math.max(1, Math.round(result.interval * 0.7))
      }

      const nextReview = new Date()
      nextReview.setDate(nextReview.getDate() + result.interval)
      const nextReviewStr = nextReview.toISOString().slice(0, 10)
      const nowStr = now()

      await db.points.update(pointId, {
        ease_factor: result.easeFactor,
        interval: result.interval,
        repetitions: result.repetitions,
        next_review: nextReviewStr,
        last_review: nowStr,
        updated_at: nowStr
      })

      await db.reviews.add({
        point_id: pointId,
        rating,
        ease_factor_before: point.ease_factor,
        ease_factor_after: result.easeFactor,
        interval_before: point.interval,
        interval_after: result.interval,
        reviewed_at: nowStr
      })

      const todayStr = today()
      const isNew = point.repetitions === 0
      const existing = await db.dailyStats.get(todayStr)
      if (existing) {
        await db.dailyStats.update(todayStr, {
          new_learned: existing.new_learned + (isNew ? 1 : 0),
          reviewed: existing.reviewed + 1
        })
      } else {
        await db.dailyStats.add({
          date: todayStr,
          new_learned: isNew ? 1 : 0,
          reviewed: 1
        })
      }

      return db.points.get(pointId)
    })
  },

  async getReviewHistory(pointId: string) {
    const reviews = await db.reviews.where('point_id').equals(pointId).toArray()
    reviews.sort((a, b) => b.reviewed_at.localeCompare(a.reviewed_at))
    return reviews.slice(0, 20)
  },

  async suspendPoint(id: string) {
    await db.points.update(id, { suspended: 1, updated_at: now() })
    return { ok: true }
  },

  async toggleFavorite(id: string) {
    const point = await db.points.get(id)
    if (!point) throw new Error('知识点不存在')
    const newVal = point.favorited ? 0 : 1
    await db.points.update(id, { favorited: newVal, updated_at: now() })
    return { favorited: newVal === 1 }
  },

  async getOverview() {
    const todayStr = today()
    const allPoints = await db.points.toArray()
    const dueToday = allPoints.filter(p => p.next_review <= todayStr && !p.suspended).length
    const totalPoints = allPoints.length
    const learnedPoints = allPoints.filter(p => p.repetitions > 0).length
    const todayStats = await db.dailyStats.get(todayStr)

    return {
      due_today: dueToday,
      total_points: totalPoints,
      learned_points: learnedPoints,
      new_today: todayStats?.new_learned || 0,
      reviewed_today: todayStats?.reviewed || 0
    }
  },

  async getMastery(subject?: string) {
    let points: Point[]
    if (subject && subject !== 'all') {
      points = await db.points.where('subject_id').equals(subject).toArray()
    } else {
      points = await db.points.toArray()
    }

    const total = points.length
    if (total === 0) return { mastered: 0, familiar: 0, normal: 0, unfamiliar: 0, unlearned: 0, mastered_count: 0, familiar_count: 0, normal_count: 0, unfamiliar_count: 0, unlearned_count: 0, total: 0 }

    const mastered = points.filter(p => p.interval >= 30).length
    const familiar = points.filter(p => p.interval >= 7 && p.interval < 30).length
    const normal = points.filter(p => p.interval >= 1 && p.interval < 7).length
    const unfamiliar = points.filter(p => p.repetitions > 0 && p.interval < 1).length
    const unlearned = points.filter(p => p.repetitions === 0).length

    return {
      total,
      mastered: Math.round(mastered / total * 100),
      familiar: Math.round(familiar / total * 100),
      normal: Math.round(normal / total * 100),
      unfamiliar: Math.round(unfamiliar / total * 100),
      unlearned: Math.round(unlearned / total * 100),
      mastered_count: mastered,
      familiar_count: familiar,
      normal_count: normal,
      unfamiliar_count: unfamiliar,
      unlearned_count: unlearned
    }
  },

  async getWeekly() {
    const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const result = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().slice(0, 10)
      const stats = await db.dailyStats.get(dateStr)
      result.push({
        date: dateStr,
        day: dayNames[d.getDay()],
        reviewed: stats?.reviewed || 0,
        new_learned: stats?.new_learned || 0
      })
    }
    return result
  },

  async getHeatmap() {
    const allStats = await db.dailyStats.toArray()
    const map = new Map(allStats.map(s => [s.date, s.reviewed]))
    const result = []
    const year = new Date().getFullYear()
    const start = new Date(year, 0, 1)
    const end = new Date(year, 11, 31)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10)
      result.push({ date: dateStr, count: map.get(dateStr) || 0 })
    }
    return result
  },

  async getCurve(subject?: string) {
    let pointIds: Set<string> | null = null
    if (subject && subject !== 'all') {
      const pts = await db.points.where('subject_id').equals(subject).toArray()
      pointIds = new Set(pts.map(p => p.id))
    }

    const allReviews = await db.reviews.toArray()

    const retentionData = []
    for (let i = 0; i < 10; i++) {
      const d = new Date()
      d.setDate(d.getDate() - (9 - i))
      const dateStr = d.toISOString().slice(0, 10)

      const dayReviews = allReviews.filter(r => {
        if (!r.reviewed_at.startsWith(dateStr)) return false
        if (pointIds && !pointIds.has(r.point_id)) return false
        return true
      })

      const total = dayReviews.length
      const correct = dayReviews.filter(r => r.rating >= 1).length

      retentionData.push({
        date: dateStr,
        retention: total > 0 ? Math.round(correct / total * 100) : null
      })
    }

    const ebbinghaus = [100, 58, 44, 36, 33, 28, 25, 23, 21, 20]
    return { user: retentionData, ebbinghaus }
  },

  async getProfile() {
    const totalReviews = await db.reviews.count()
    const allPoints = await db.points.toArray()
    const totalPoints = allPoints.length
    const learnedPoints = allPoints.filter(p => p.repetitions > 0).length

    const allDaysRaw = await db.dailyStats.toArray()
    const allDays = allDaysRaw.filter(d => d.reviewed > 0)
    const allDates = allDays.map(d => d.date).sort()

    const todayStr = today()
    let streak = 0
    const checkDate = new Date(todayStr)
    const dateSet = new Set(allDates)

    for (let i = 0; i < 365; i++) {
      const ds = checkDate.toISOString().slice(0, 10)
      const has = dateSet.has(ds)
      if (has || (i === 0 && !has)) {
        if (has) streak++
        // today not started yet, still count
      } else break
      checkDate.setDate(checkDate.getDate() - 1)
    }

    let maxStreak = 0
    let tempStreak = 0
    for (let i = 0; i < allDates.length; i++) {
      if (i === 0) {
        tempStreak = 1
      } else {
        const prev = new Date(allDates[i - 1])
        const curr = new Date(allDates[i])
        const diff = (curr.getTime() - prev.getTime()) / 86400000
        if (diff === 1) tempStreak++
        else tempStreak = 1
      }
      if (tempStreak > maxStreak) maxStreak = tempStreak
    }
    if (streak > maxStreak) maxStreak = streak

    const totalStudyDays = allDays.length
    let totalNew = 0, totalReviewed = 0
    allDays.forEach(d => { totalNew += d.new_learned; totalReviewed += d.reviewed })

    const avgNew = totalStudyDays > 0 ? Math.round(totalNew / totalStudyDays * 10) / 10 : 0
    const avgReview = totalStudyDays > 0 ? Math.round(totalReviewed / totalStudyDays * 10) / 10 : 0

    const subjects = await db.subjects.orderBy('sort_order').toArray()
    const subjectStats = subjects.map(s => {
      const pts = allPoints.filter(p => p.subject_id === s.id)
      const total = pts.length
      const learned = pts.filter(p => p.repetitions > 0).length
      return {
        ...s,
        total,
        learned,
        progress: total > 0 ? Math.round(learned / total * 100) : 0
      }
    })

    return {
      total_reviews: totalReviews,
      total_points: totalPoints,
      learned_points: learnedPoints,
      streak,
      max_streak: maxStreak,
      total_study_days: totalStudyDays,
      avg_new_per_day: avgNew,
      avg_review_per_day: avgReview,
      subjects: subjectStats
    }
  },

  async getFavorites() {
    const subjectMap = new Map<string, Subject>()
    for (const s of await db.subjects.toArray()) {
      subjectMap.set(s.id, s)
    }
    const allPts = await db.points.toArray()
    const points = allPts.filter(p => p.favorited === 1)
    return points.map(p => {
      const s = subjectMap.get(p.subject_id)
      return {
        ...p,
        subject_name: s?.name || '',
        subject_icon: s?.icon || '',
        subject_color: s?.color || ''
      }
    })
  },

  async getSuspended() {
    const subjectMap = new Map<string, Subject>()
    for (const s of await db.subjects.toArray()) {
      subjectMap.set(s.id, s)
    }
    const allPts = await db.points.toArray()
    const points = allPts.filter(p => p.suspended === 1)
    return points.map(p => {
      const s = subjectMap.get(p.subject_id)
      return {
        ...p,
        subject_name: s?.name || '',
        subject_icon: s?.icon || '',
        subject_color: s?.color || ''
      }
    })
  },

  async unsuspendPoint(id: string) {
    await db.points.update(id, { suspended: 0, updated_at: now() })
    return { ok: true }
  },

  async getMyUploads() {
    return []
  },

  async getRecentActivity(limit = 10) {
    const reviews = await db.reviews.orderBy('reviewed_at').reverse().limit(limit).toArray()
    const result = []
    for (const r of reviews) {
      const point = await db.points.get(r.point_id)
      const subject = point ? await db.subjects.get(point.subject_id) : null
      result.push({
        title: point?.title || '',
        subject_name: subject?.name || '',
        subject_icon: subject?.icon || '',
        subject_color: subject?.color || '',
        rating: r.rating,
        reviewed_at: r.reviewed_at
      })
    }
    return result
  },

  async getMyTeams() { return [] },
  async createTeam(_name: string): Promise<any> { throw new Error('请先登录') },
  async joinTeam(_code: string): Promise<any> { throw new Error('请先登录') },
  async getTeamMembers(_teamId: string) { return [] },
  async leaveTeam(_teamId: string): Promise<any> { throw new Error('请先登录') },
  async updateTeam(_teamId: string, _data: { name: string }): Promise<any> { throw new Error('请先登录') },
  async createSubject(data: { name: string; icon?: string; color?: string; team_id?: string; is_public?: boolean }) {
    const subject: Subject = {
      id: 's_' + crypto.randomUUID().slice(0, 8),
      name: data.name,
      icon: data.icon || '📚',
      color: data.color || '#3B82F6',
      sort_order: 999
    }
    await db.subjects.add(subject)
    return subject
  },

  async cloneSubjectToMine(_subjectId: string, _subjectInfo?: any): Promise<any> { throw new Error('本地模式无需克隆') },
  async clonePointToMine(_pointId: string, _targetSubjectId: string): Promise<any> { throw new Error('本地模式无需克隆') },

  async searchPoints(keyword: string) {
    if (!keyword.trim()) return []
    const kw = keyword.toLowerCase()
    const subjectMap = new Map<string, Subject>()
    for (const s of await db.subjects.toArray()) {
      subjectMap.set(s.id, s)
    }
    const allPts = await db.points.toArray()
    const matches = allPts.filter(p =>
      p.title.toLowerCase().includes(kw) ||
      p.question.toLowerCase().includes(kw) ||
      p.answer.toLowerCase().includes(kw) ||
      (p.category || '').toLowerCase().includes(kw)
    )
    return matches.map(p => {
      const s = subjectMap.get(p.subject_id)
      return {
        ...p,
        subject_name: s?.name || '',
        subject_icon: s?.icon || '',
        subject_color: s?.color || ''
      }
    })
  }
}
