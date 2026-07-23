import { getUserCache, hasCachedData, hasCachedPoints } from './userCache'
import { cloudApi } from './cloudApi'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

async function mergePointsWithProgress(points: any[]) {
  const cache = getUserCache()
  if (!cache) return points

  if (points.length === 0) return []

  const ids = points.map(p => p.id)
  const userPoints = await cache.userPoints.bulkGet(ids)
  const upMap = new Map<string, any>()
  ids.forEach((id, i) => { if (userPoints[i]) upMap.set(id, userPoints[i]) })

  return points.map(p => {
    const up = upMap.get(p.id)
    return {
      ...p,
      creator_name: p.creator_name || '知记',
      ease_factor: up?.ease_factor ?? 2.5,
      interval: up?.interval_days ?? 0,
      repetitions: up?.repetitions ?? 0,
      next_review: up?.next_review ?? today(),
      last_review: up?.last_review ?? null,
      suspended: up?.suspended ? 1 : 0,
      favorited: up?.favorited ? 1 : 0
    }
  })
}

export const cachedApi = {
  async isReady(): Promise<boolean> {
    const [hasSubs, hasPts] = await Promise.all([hasCachedData(), hasCachedPoints()])
    return hasSubs && hasPts
  },

  async getSubjects() {
    const cache = getUserCache()
    if (!cache) return cloudApi.getSubjects()
    const subs = await cache.subjects.orderBy('sort_order').toArray()
    if (subs.length === 0) return cloudApi.getSubjects()
    return subs
  },

  async getAllActivePoints() {
    const cache = getUserCache()
    if (!cache) return cloudApi.getAllActivePoints()
    const points = await cache.points.toArray()
    if (points.length === 0) return cloudApi.getAllActivePoints()
    return mergePointsWithProgress(points)
  },

  async getSubjectPoints(subjectId: string) {
    const cache = getUserCache()
    if (!cache) return cloudApi.getSubjectPoints(subjectId)
    const hasPoints = await hasCachedPoints()
    if (!hasPoints) return cloudApi.getSubjectPoints(subjectId)
    const points = await cache.points.where('subject_id').equals(subjectId).toArray()
    return mergePointsWithProgress(points)
  },

  async getOverview() {
    const cache = getUserCache()
    if (!cache) return cloudApi.getOverview()
    const row = await cache.profile.get('overview')
    if (!row?.data) return cloudApi.getOverview()
    return row.data
  },

  async getProfile() {
    const cache = getUserCache()
    if (!cache) return cloudApi.getProfile()
    const row = await cache.profile.get('profileSnapshot')
    if (!row?.data) return cloudApi.getProfile()
    return row.data
  },

  async getWeekly() {
    const cache = getUserCache()
    if (!cache) return cloudApi.getWeekly()
    const row = await cache.profile.get('weeklySnapshot')
    if (!row?.data) return cloudApi.getWeekly()
    return row.data
  },

  async getRecentActivity(limit = 10) {
    const cache = getUserCache()
    if (!cache) return cloudApi.getRecentActivity(limit)
    const row = await cache.profile.get('activitiesSnapshot')
    if (!row?.data) return cloudApi.getRecentActivity(limit)
    return row.data
  }
}
