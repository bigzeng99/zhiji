import { supabase } from './supabase'
import { auth } from './auth'
import { getUserCache, setSyncMeta, getSyncMeta, hasCachedData, hasCachedPoints, type CachedSubject, type CachedUserPoint, type CachedPoint } from './userCache'
import { store } from './store'
import { serverNowISOString } from './utils/serverClock'

const QUICK_SYNC_INTERVAL = 30_000
const FULL_SYNC_INTERVAL = 300_000

let _syncPromise: Promise<void> | null = null
let _lastQuickSync = 0

function uid(): string {
  return auth.currentUser.value!.id
}

function fetchAllRows(queryFn: () => any): Promise<any[]> {
  return (async () => {
    const rows: any[] = []
    let from = 0
    const size = 1000
    while (true) {
      const { data } = await queryFn().range(from, from + size - 1)
      if (!data || data.length === 0) break
      rows.push(...data)
      if (data.length < size) break
      from += size
    }
    return rows
  })()
}

export async function syncAll(): Promise<void> {
  if (!auth.isLoggedIn.value) return
  if (_syncPromise) return _syncPromise
  _syncPromise = _doSyncAll()
  try { await _syncPromise } finally { _syncPromise = null }
}

async function _doSyncAll(): Promise<void> {
  const cache = getUserCache()
  if (!cache) return

  store.syncStatus = 'syncing'
  try {
    const [hasSubjects, hasPoints] = await Promise.all([hasCachedData(), hasCachedPoints()])
    const lastFullSyncStr = await getSyncMeta('lastFullSync')
    const lastFullSyncTime = lastFullSyncStr ? parseInt(lastFullSyncStr) : 0
    const needsFull = !hasSubjects || !hasPoints || Date.now() - lastFullSyncTime > FULL_SYNC_INTERVAL

    if (needsFull) {
      await fullSync()
      _lastQuickSync = Date.now()
    } else {
      await quickSync()
      _lastQuickSync = Date.now()
    }

    store.syncStatus = 'done'
    store.lastSyncAt = Date.now()
    setTimeout(() => { if (store.syncStatus === 'done') store.syncStatus = 'idle' }, 2000)
  } catch (e) {
    console.warn('Sync failed:', e)
    store.syncStatus = 'error'
    setTimeout(() => { if (store.syncStatus === 'error') store.syncStatus = 'idle' }, 3000)
  }
}

async function quickSync(): Promise<void> {
  const cache = getUserCache()
  if (!cache) return

  const lastSyncStr = await getSyncMeta('lastSync')
  const userId = uid()

  const [updatedUP] = await Promise.allSettled([
    lastSyncStr
      ? fetchAllRows(() =>
          supabase.from('user_points').select('*').eq('user_id', userId).gt('updated_at', lastSyncStr)
        )
      : fetchAllRows(() =>
          supabase.from('user_points').select('*').eq('user_id', userId)
        )
  ])

  if (updatedUP.status === 'fulfilled' && updatedUP.value.length > 0) {
    const rows: CachedUserPoint[] = updatedUP.value.map(mapUserPoint)
    await cache.userPoints.bulkPut(rows)
  }

  await syncProfile().catch(() => {})

  const nowStr = serverNowISOString()
  await setSyncMeta('lastSync', nowStr)

  await refreshStoreFromCache()
}

async function fullSync(): Promise<void> {
  const cache = getUserCache()
  if (!cache) return

  const userId = uid()

  const [subjectsResult, userPointsResult, dailyStatsResult, pointsResult] = await Promise.allSettled([
    supabase.from('subjects').select('*').order('sort_order'),
    fetchAllRows(() => supabase.from('user_points').select('*').eq('user_id', userId)),
    fetchAllRows(() => supabase.from('daily_stats').select('*').eq('user_id', userId)),
    fetchAllRows(() => supabase.from('points').select('*').eq('status', 'active'))
  ])
  if (subjectsResult.status === 'rejected') console.warn('[sync] subjects fetch failed:', subjectsResult.reason)
  if (userPointsResult.status === 'rejected') console.warn('[sync] user_points fetch failed:', userPointsResult.reason)
  if (dailyStatsResult.status === 'rejected') console.warn('[sync] daily_stats fetch failed:', dailyStatsResult.reason)
  if (pointsResult.status === 'rejected') console.warn('[sync] points fetch failed:', pointsResult.reason)

  let upItems: CachedUserPoint[] = []
  if (userPointsResult.status === 'fulfilled') {
    upItems = userPointsResult.value.map(mapUserPoint)
  }

  if (pointsResult.status === 'fulfilled') {
    const points = pointsResult.value
    const approved = points.filter((p: any) => !p.review_status || p.review_status === 'approved')
    await cache.points.clear()
    if (approved.length > 0) {
      const cachedPoints: CachedPoint[] = approved.map((p: any) => ({
        id: p.id,
        subject_id: p.subject_id,
        title: p.title,
        category: p.category,
        question: p.question,
        answer: p.answer,
        status: p.status,
        review_status: p.review_status,
        owner_id: p.owner_id,
        creator_name: p.creator_name,
        source_id: p.source_id,
        created_at: p.created_at,
        updated_at: p.updated_at
      }))
      await cache.points.bulkPut(cachedPoints)
    }
  }

  if (subjectsResult.status === 'fulfilled' && pointsResult.status === 'fulfilled') {
    const subs = subjectsResult.value.data || []
    await cache.subjects.clear()
    if (subs.length > 0) {
      const todayStr = new Date().toISOString().slice(0, 10)
      const learnedSet = new Set(upItems.filter(u => u.repetitions > 0).map(u => u.point_id))
      const dueSet = new Set(upItems.filter(u => u.next_review <= todayStr && !u.suspended).map(u => u.point_id))

      const ptBySubject = new Map<string, string[]>()
      for (const p of pointsResult.value) {
        if (!ptBySubject.has(p.subject_id)) ptBySubject.set(p.subject_id, [])
        ptBySubject.get(p.subject_id)!.push(p.id)
      }

      const cachedSubs: CachedSubject[] = subs.map((s: any) => {
        const pts = ptBySubject.get(s.id) || []
        return {
          ...s,
          point_count: pts.length,
          learned_count: pts.filter(id => learnedSet.has(id)).length,
          due_count: pts.filter(id => dueSet.has(id)).length
        }
      })
      await cache.subjects.bulkPut(cachedSubs)
    }
  }

  if (userPointsResult.status === 'fulfilled') {
    await cache.userPoints.clear()
    if (upItems.length > 0) await cache.userPoints.bulkPut(upItems)
  }

  if (dailyStatsResult.status === 'fulfilled') {
    const stats = dailyStatsResult.value
    await cache.dailyStats.clear()
    if (stats.length > 0) {
      await cache.dailyStats.bulkPut(stats.map((s: any) => ({
        date: s.date,
        new_learned: s.new_learned || 0,
        reviewed: s.reviewed || 0
      })))
    }
  }

  const nowStr = serverNowISOString()
  await setSyncMeta('lastSync', nowStr)
  await setSyncMeta('lastFullSync', String(Date.now()))

  await refreshStoreFromCache()

  await syncProfile().catch(() => {})
}

async function syncProfile(): Promise<void> {
  const cache = getUserCache()
  if (!cache) return

  const userId = uid()
  const [totalRes, learnedRes, dueRes, todayStats, reviewCountRes] = await Promise.allSettled([
    supabase.from('user_points').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('user_points').select('*', { count: 'exact', head: true }).eq('user_id', userId).gt('repetitions', 0),
    supabase.from('user_points').select('*', { count: 'exact', head: true }).eq('user_id', userId).lte('next_review', new Date().toISOString().slice(0, 10)).eq('suspended', false),
    supabase.from('daily_stats').select('*').eq('user_id', userId).eq('date', new Date().toISOString().slice(0, 10)).single(),
    supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('user_id', userId)
  ])

  const overview = {
    total_points: totalRes.status === 'fulfilled' ? (totalRes.value.count || 0) : 0,
    learned_points: learnedRes.status === 'fulfilled' ? (learnedRes.value.count || 0) : 0,
    due_today: dueRes.status === 'fulfilled' ? (dueRes.value.count || 0) : 0,
    new_today: todayStats.status === 'fulfilled' ? (todayStats.value.data?.new_learned || 0) : 0,
    reviewed_today: todayStats.status === 'fulfilled' ? (todayStats.value.data?.reviewed || 0) : 0
  }

  await cache.profile.put({
    key: 'overview',
    data: overview,
    updatedAt: Date.now()
  })

  await cache.profile.put({
    key: 'totalReviews',
    data: reviewCountRes.status === 'fulfilled' ? (reviewCountRes.value.count || 0) : 0,
    updatedAt: Date.now()
  })
}

function mapUserPoint(up: any): CachedUserPoint {
  return {
    point_id: up.point_id,
    repetitions: up.repetitions ?? 0,
    ease_factor: up.ease_factor ?? 2.5,
    interval_days: up.interval_days ?? 0,
    next_review: up.next_review ?? new Date().toISOString().slice(0, 10),
    last_review: up.last_review ?? null,
    suspended: !!up.suspended,
    favorited: !!up.favorited,
    updated_at: up.updated_at
  }
}

async function refreshStoreFromCache(): Promise<void> {
  const cache = getUserCache()
  if (!cache) return

  const [subs, overviewRow] = await Promise.all([
    cache.subjects.orderBy('sort_order').toArray(),
    cache.profile.get('overview')
  ])

  if (subs.length > 0) {
    store.subjects = subs
    store._subjectsLoadedAt = Date.now()
  }

  if (overviewRow?.data) {
    store.overview = overviewRow.data
    store._overviewLoadedAt = Date.now()
  }

  store.feedNeedsRefresh = true
}

export function maybeQuickSync(): void {
  if (!auth.isLoggedIn.value) return
  if (Date.now() - _lastQuickSync < QUICK_SYNC_INTERVAL) return
  syncAll().catch(() => {})
}
