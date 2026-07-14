import { supabase } from './supabase'
import { auth } from './auth'
import { sm2 } from './sm2'
import { moderateContent } from './moderate'

const today = () => new Date().toISOString().slice(0, 10)
const now = () => new Date().toISOString()

function uid() {
  return auth.currentUser.value!.id
}

async function fetchAllRows(queryFn: () => any) {
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
}

type SharedCache = { pointIds: {id: string; subject_id: string}[]; userPoints: any[]; time: number }

let _initPromise: Promise<void> | null = null
let _cache: SharedCache | null = null
let _sharedPromise: Promise<SharedCache> | null = null
const CACHE_TTL = 60000

export function resetUserPointsCache() {
  _initPromise = null
  _cache = null
  _sharedPromise = null
}

async function getSharedData(): Promise<SharedCache> {
  if (_cache && Date.now() - _cache.time < CACHE_TTL) return _cache
  if (_sharedPromise) return _sharedPromise
  _sharedPromise = (async () => {
    const [pointIds, userPoints] = await Promise.all([
      fetchAllRows(() => supabase.from('points').select('id, subject_id').eq('status', 'active')),
      fetchAllRows(() => supabase.from('user_points').select('point_id, repetitions, next_review, suspended, favorited, ease_factor, interval_days, last_review').eq('user_id', uid()))
    ])
    _cache = { pointIds, userPoints, time: Date.now() }
    _sharedPromise = null
    return _cache
  })()
  return _sharedPromise
}

async function ensureUserPoints() {
  if (_initPromise) return _initPromise
  _initPromise = (async () => {
    try {
      const { pointIds, userPoints: existingUP } = await getSharedData()
      if (!pointIds.length) return

      const existingIds = new Set(existingUP.map(up => up.point_id))
      const missing = pointIds.filter(p => !existingIds.has(p.id))
      if (missing.length === 0) return

      const todayStr = today()
      const batch = missing.map(p => ({ user_id: uid(), point_id: p.id, next_review: todayStr }))

      for (let i = 0; i < batch.length; i += 100) {
        await supabase.from('user_points').upsert(batch.slice(i, i + 100), { onConflict: 'user_id,point_id' })
      }
      if (_cache) {
        const newUps = batch.map(b => ({ point_id: b.point_id, repetitions: 0, next_review: b.next_review, suspended: false, favorited: false, ease_factor: 2.5, interval_days: 0, last_review: null }))
        _cache = { ..._cache, userPoints: [..._cache.userPoints, ...newUps], time: Date.now() }
      }
    } catch (e) {
      _initPromise = null
      throw e
    }
  })()
  return _initPromise
}

export const cloudApi = {
  async getSubjects(teamId?: string | null) {
    await ensureUserPoints()

    let query = supabase.from('subjects').select('*').order('sort_order')
    if (teamId === null) {
      query = query.is('team_id', null)
    } else if (teamId) {
      query = query.eq('team_id', teamId)
    }

    const { data: subjects } = await query
    if (!subjects) return []

    const { pointIds, userPoints } = await getSharedData()
    const todayStr = today()
    const learnedSet = new Set(userPoints.filter(up => up.repetitions > 0).map(up => up.point_id))
    const dueSet = new Set(userPoints.filter(up => up.next_review <= todayStr && !up.suspended).map(up => up.point_id))

    return subjects.map(s => {
      const subPts = pointIds.filter(p => p.subject_id === s.id)
      const subPtIds = subPts.map(p => p.id)
      return {
        ...s,
        point_count: subPts.length,
        learned_count: subPtIds.filter(id => learnedSet.has(id)).length,
        due_count: subPtIds.filter(id => dueSet.has(id)).length
      }
    })
  },

  async getSubjectPoints(subjectId: string) {
    const { data: points } = await supabase
      .from('points')
      .select('*')
      .eq('subject_id', subjectId)
      .eq('status', 'active')
      .order('created_at')

    if (!points?.length) return []

    const approved = points.filter((p: any) => !p.review_status || p.review_status === 'approved')
    if (!approved.length) return []

    const { data: userPoints } = await supabase
      .from('user_points')
      .select('*')
      .eq('user_id', uid())
      .in('point_id', approved.map(p => p.id))

    const upMap = new Map((userPoints || []).map(up => [up.point_id, up]))

    return approved.map(p => {
      const up = upMap.get(p.id)
      return {
        ...p,
        ease_factor: up?.ease_factor ?? 2.5,
        interval: up?.interval_days ?? 0,
        repetitions: up?.repetitions ?? 0,
        next_review: up?.next_review ?? today(),
        last_review: up?.last_review ?? null,
        suspended: up?.suspended ? 1 : 0,
        favorited: up?.favorited ? 1 : 0
      }
    })
  },

  async getAllActivePoints() {
    await ensureUserPoints()
    const { userPoints } = await getSharedData()

    const points = await fetchAllRows(() =>
      supabase.from('points').select('*').eq('status', 'active')
    )
    if (!points.length) return []

    const approved = points.filter((p: any) => !p.review_status || p.review_status === 'approved')
    const upMap = new Map(userPoints.map(up => [up.point_id, up]))

    return approved.map(p => {
      const up = upMap.get(p.id)
      return {
        ...p,
        ease_factor: up?.ease_factor ?? 2.5,
        interval: up?.interval_days ?? 0,
        repetitions: up?.repetitions ?? 0,
        next_review: up?.next_review ?? today(),
        last_review: up?.last_review ?? null,
        suspended: up?.suspended ? 1 : 0,
        favorited: up?.favorited ? 1 : 0
      }
    })
  },

  async createPoint(data: { subject_id: string; title: string; category: string; question: string; answer: string; visibility?: string; team_id?: string }) {
    const creatorName = auth.profile.value?.nickname
      || auth.currentUser.value?.user_metadata?.name
      || auth.currentUser.value?.user_metadata?.full_name
      || auth.currentUser.value?.email?.split('@')[0]
      || '匿名'

    const baseRow: any = {
      subject_id: data.subject_id,
      owner_id: uid(),
      visibility: data.visibility || 'private',
      team_id: data.team_id || null,
      title: data.title,
      category: data.category || '',
      question: data.question,
      answer: data.answer
    }

    let { data: point, error } = await supabase
      .from('points')
      .insert({ ...baseRow, review_status: 'pending', creator_name: creatorName })
      .select()
      .single()

    if (error) {
      const retry = await supabase.from('points').insert(baseRow).select().single()
      if (retry.error) throw retry.error
      point = retry.data
    }

    await supabase.from('user_points').insert({
      user_id: uid(),
      point_id: point.id,
      next_review: today()
    })

    await this._incrementUploadCount(data.visibility || 'private')

    if (point.review_status === 'pending') {
      const result = await moderateContent(data.title, data.question, data.answer)
      const { data: updated } = await supabase
        .from('points')
        .update({
          review_status: result.approved ? 'approved' : 'rejected',
          reject_reason: result.reason || ''
        })
        .eq('id', point.id)
        .select()
        .single()
      return updated || point
    }

    return point
  },

  async updatePoint(id: string, data: { title: string; category: string; question: string; answer: string }) {
    const { data: point, error } = await supabase
      .from('points')
      .update({ ...data, category: data.category || '', updated_at: now() })
      .eq('id', id)
      .eq('owner_id', uid())
      .select()
      .single()
    if (error) throw error
    return point
  },

  async deletePoint(id: string) {
    await supabase.from('points').delete().eq('id', id).eq('owner_id', uid())
    return { ok: true }
  },

  async deleteSubject(id: string) {
    const { error } = await supabase.from('subjects').delete().eq('id', id).eq('owner_id', uid())
    if (error) throw error
    return { ok: true }
  },

  async deleteTeam(teamId: string) {
    const { error } = await supabase.from('teams').delete().eq('id', teamId).eq('owner_id', uid())
    if (error) throw error
    return { ok: true }
  },

  async getReviewQueue(subjects?: string[], limit?: number) {
    const todayStr = today()
    const { pointIds, userPoints: allUserPoints } = await getSharedData()

    const subjectSet = subjects?.length ? new Set(subjects) : null
    const targetPointIds = new Set(
      subjectSet ? pointIds.filter(p => subjectSet.has(p.subject_id)).map(p => p.id)
                 : pointIds.map(p => p.id)
    )

    let dueUP = allUserPoints.filter(up =>
      targetPointIds.has(up.point_id) && up.next_review <= todayStr && !up.suspended
    )
    if (dueUP.length === 0) return []

    dueUP.sort((a, b) => {
      if ((b.favorited ? 1 : 0) !== (a.favorited ? 1 : 0)) return (b.favorited ? 1 : 0) - (a.favorited ? 1 : 0)
      return Math.random() - 0.5
    })
    if (limit && limit > 0) dueUP = dueUP.slice(0, limit)

    const duePointIds = dueUP.map(up => up.point_id)
    const [{ data: pointsData }, { data: allSubjects }] = await Promise.all([
      supabase.from('points').select('id, title, category, question, answer, subject_id, status, review_status, source_id').in('id', duePointIds),
      supabase.from('subjects').select('id, name, icon, color')
    ])

    const pointMap = new Map((pointsData || []).map(p => [p.id, p]))
    const subjectMap = new Map((allSubjects || []).map(s => [s.id, s]))

    const validUP = dueUP.filter(up => {
      const p = pointMap.get(up.point_id)
      return p?.status === 'active' && (!p.review_status || p.review_status === 'approved')
    })

    const clonedSourceIds = new Set(validUP.map(up => pointMap.get(up.point_id)?.source_id).filter(Boolean))
    const finalUP = validUP.filter(up => !clonedSourceIds.has(up.point_id))

    return finalUP.map(up => {
      const p = pointMap.get(up.point_id)!
      const s = subjectMap.get(p.subject_id)
      return {
        id: p.id,
        title: p.title,
        category: p.category,
        question: p.question,
        answer: p.answer,
        subject_id: p.subject_id,
        subject_name: s?.name || '',
        subject_icon: s?.icon || '',
        subject_color: s?.color || '',
        ease_factor: up.ease_factor,
        interval: up.interval_days,
        repetitions: up.repetitions,
        next_review: up.next_review,
        last_review: up.last_review,
        favorited: up.favorited ? 1 : 0
      }
    })
  },

  async submitRating(pointId: string, rating: number) {
    // Use cached user_points data instead of re-querying
    const { userPoints } = await getSharedData()
    const up = userPoints.find(u => u.point_id === pointId)
    if (!up) {
      // Fallback to direct query if not in cache
      const { data } = await supabase.from('user_points').select('*').eq('user_id', uid()).eq('point_id', pointId).single()
      if (!data) throw new Error('知识点不存在')
      return this._doSubmitRating(pointId, rating, data)
    }
    return this._doSubmitRating(pointId, rating, up)
  },

  async _doSubmitRating(pointId: string, rating: number, up: any) {
    const result = sm2(rating, up.repetitions, up.ease_factor, up.interval_days)
    let interval = result.interval
    if (up.favorited && interval > 1) {
      interval = Math.max(1, Math.round(interval * 0.7))
    }
    const nextReview = new Date()
    nextReview.setDate(nextReview.getDate() + interval)
    const nextReviewStr = nextReview.toISOString().slice(0, 10)
    const isNew = up.repetitions === 0

    // Fire all writes in parallel
    const todayNow = now()
    await Promise.all([
      supabase.from('user_points').update({
        ease_factor: result.easeFactor, interval_days: interval,
        repetitions: result.repetitions, next_review: nextReviewStr,
        last_review: todayNow, updated_at: todayNow
      }).eq('user_id', uid()).eq('point_id', pointId),

      supabase.from('reviews').insert({
        user_id: uid(), point_id: pointId, rating,
        ease_factor_before: up.ease_factor, ease_factor_after: result.easeFactor,
        interval_before: up.interval_days, interval_after: interval
      }),

      this._updateDailyStats(isNew)
    ])

    _cache = null
    return { id: pointId }
  },

  async _updateDailyStats(isNew: boolean) {
    const todayStr = today()
    const { data: existing } = await supabase
      .from('daily_stats').select('*').eq('user_id', uid()).eq('date', todayStr).single()
    if (existing) {
      await supabase.from('daily_stats').update({
        new_learned: existing.new_learned + (isNew ? 1 : 0),
        reviewed: existing.reviewed + 1
      }).eq('user_id', uid()).eq('date', todayStr)
    } else {
      await supabase.from('daily_stats').insert({
        user_id: uid(), date: todayStr,
        new_learned: isNew ? 1 : 0, reviewed: 1
      })
    }
  },

  async getReviewHistory(pointId: string) {
    const { data } = await supabase
      .from('reviews')
      .select('*')
      .eq('user_id', uid())
      .eq('point_id', pointId)
      .order('reviewed_at', { ascending: false })
      .limit(20)
    return data || []
  },

  async suspendPoint(id: string) {
    await this._ensureUserPoint(id)
    await supabase.from('user_points')
      .update({ suspended: true, updated_at: now() })
      .eq('user_id', uid())
      .eq('point_id', id)
    return { ok: true }
  },

  async unsuspendPoint(id: string) {
    await supabase.from('user_points')
      .update({ suspended: false, updated_at: now() })
      .eq('user_id', uid())
      .eq('point_id', id)
    return { ok: true }
  },

  async toggleFavorite(id: string) {
    await this._ensureUserPoint(id)
    const { data: up } = await supabase
      .from('user_points')
      .select('favorited')
      .eq('user_id', uid())
      .eq('point_id', id)
      .single()

    const newVal = !(up?.favorited)
    await supabase.from('user_points')
      .update({ favorited: newVal, updated_at: now() })
      .eq('user_id', uid())
      .eq('point_id', id)
    return { favorited: newVal }
  },

  async getOverview() {
    await ensureUserPoints()
    const todayStr = today()

    const [totalRes, dueRes, learnedRes, todayStats] = await Promise.all([
      supabase.from('user_points').select('*', { count: 'exact', head: true }).eq('user_id', uid()),
      supabase.from('user_points').select('*', { count: 'exact', head: true }).eq('user_id', uid()).lte('next_review', todayStr).eq('suspended', false),
      supabase.from('user_points').select('*', { count: 'exact', head: true }).eq('user_id', uid()).gt('repetitions', 0),
      supabase.from('daily_stats').select('*').eq('user_id', uid()).eq('date', todayStr).single()
    ])

    return {
      due_today: dueRes.count || 0,
      total_points: totalRes.count || 0,
      learned_points: learnedRes.count || 0,
      new_today: todayStats.data?.new_learned || 0,
      reviewed_today: todayStats.data?.reviewed || 0
    }
  },

  async getMastery(subject?: string) {
    let query = supabase
      .from('user_points')
      .select('interval_days, repetitions')
      .eq('user_id', uid())

    if (subject && subject !== 'all') {
      const { data: pts } = await supabase.from('points').select('id').eq('subject_id', subject)
      if (!pts?.length) return { mastered: 0, familiar: 0, normal: 0, unfamiliar: 0, unlearned: 0, mastered_count: 0, familiar_count: 0, normal_count: 0, unfamiliar_count: 0, unlearned_count: 0, total: 0 }
      query = query.in('point_id', pts.map(p => p.id))
    }

    const { data: items } = await query
    const total = items?.length || 0
    if (total === 0) return { mastered: 0, familiar: 0, normal: 0, unfamiliar: 0, unlearned: 0, mastered_count: 0, familiar_count: 0, normal_count: 0, unfamiliar_count: 0, unlearned_count: 0, total: 0 }

    const mastered = items!.filter(p => p.interval_days >= 30).length
    const familiar = items!.filter(p => p.interval_days >= 7 && p.interval_days < 30).length
    const normal = items!.filter(p => p.interval_days >= 1 && p.interval_days < 7).length
    const unfamiliar = items!.filter(p => p.repetitions > 0 && p.interval_days < 1).length
    const unlearned = items!.filter(p => p.repetitions === 0).length

    return {
      total,
      mastered: Math.round(mastered / total * 100),
      familiar: Math.round(familiar / total * 100),
      normal: Math.round(normal / total * 100),
      unfamiliar: Math.round(unfamiliar / total * 100),
      unlearned: Math.round(unlearned / total * 100),
      mastered_count: mastered, familiar_count: familiar,
      normal_count: normal, unfamiliar_count: unfamiliar,
      unlearned_count: unlearned
    }
  },

  async getWeekly() {
    const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const dates: string[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      dates.push(d.toISOString().slice(0, 10))
    }

    const { data: stats } = await supabase
      .from('daily_stats')
      .select('*')
      .eq('user_id', uid())
      .in('date', dates)

    const statsMap = new Map((stats || []).map(s => [s.date, s]))

    return dates.map(dateStr => {
      const d = new Date(dateStr)
      const s = statsMap.get(dateStr)
      return {
        date: dateStr,
        day: dayNames[d.getDay()],
        reviewed: s?.reviewed || 0,
        new_learned: s?.new_learned || 0
      }
    })
  },

  async getHeatmap() {
    const year = new Date().getFullYear()
    const startDate = `${year}-01-01`
    const endDate = `${year}-12-31`
    const { data: stats } = await supabase
      .from('daily_stats')
      .select('date, reviewed')
      .eq('user_id', uid())
      .gte('date', startDate)
      .lte('date', endDate)

    const map = new Map((stats || []).map(s => [s.date, s.reviewed]))
    const result = []
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
      const { data: pts } = await supabase.from('points').select('id').eq('subject_id', subject)
      pointIds = new Set((pts || []).map(p => p.id))
    }

    const dates: string[] = []
    for (let i = 0; i < 10; i++) {
      const d = new Date()
      d.setDate(d.getDate() - (9 - i))
      dates.push(d.toISOString().slice(0, 10))
    }

    const { data: allReviews } = await supabase
      .from('reviews')
      .select('point_id, rating, reviewed_at')
      .eq('user_id', uid())
      .gte('reviewed_at', dates[0] + 'T00:00:00')

    const retentionData = dates.map(dateStr => {
      const dayReviews = (allReviews || []).filter(r => {
        if (!r.reviewed_at.startsWith(dateStr)) return false
        if (pointIds && !pointIds.has(r.point_id)) return false
        return true
      })
      const total = dayReviews.length
      const correct = dayReviews.filter(r => r.rating >= 1).length
      return {
        date: dateStr,
        retention: total > 0 ? Math.round(correct / total * 100) : null
      }
    })

    const ebbinghaus = [100, 58, 44, 36, 33, 28, 25, 23, 21, 20]
    return { user: retentionData, ebbinghaus }
  },

  async getProfile() {
    const { count: totalReviews } = await supabase
      .from('reviews')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', uid())

    const { userPoints, pointIds } = await getSharedData()
    const ptSubjectMap = new Map(pointIds.map(p => [p.id, p.subject_id]))
    const items = userPoints

    const { data: subjects } = await supabase.from('subjects').select('*').order('sort_order')
    const mySubjectIds = new Set(
      (subjects || []).filter(s => s.owner_id === uid() || s.team_id).map(s => s.id)
    )
    const myItems = items.filter((p: any) => mySubjectIds.has(ptSubjectMap.get(p.point_id)))
    const totalPoints = myItems.length
    const learnedPoints = myItems.filter(p => p.repetitions > 0).length

    const { data: allDaysRaw } = await supabase
      .from('daily_stats')
      .select('*')
      .eq('user_id', uid())

    const allDays = (allDaysRaw || []).filter(d => d.reviewed > 0)
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
      } else break
      checkDate.setDate(checkDate.getDate() - 1)
    }

    let maxStreak = 0, tempStreak = 0
    for (let i = 0; i < allDates.length; i++) {
      if (i === 0) { tempStreak = 1 }
      else {
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

    const subjectStats = (subjects || []).map(s => {
      const pts = items.filter((p: any) => ptSubjectMap.get(p.point_id) === s.id)
      const total = pts.length
      const learned = pts.filter(p => p.repetitions > 0).length
      return { ...s, total, learned, progress: total > 0 ? Math.round(learned / total * 100) : 0 }
    })

    return {
      total_reviews: totalReviews || 0,
      total_points: totalPoints,
      learned_points: learnedPoints,
      streak, max_streak: maxStreak,
      total_study_days: totalStudyDays,
      avg_new_per_day: avgNew,
      avg_review_per_day: avgReview,
      subjects: subjectStats
    }
  },

  async getFavorites() {
    const { data: userPoints } = await supabase
      .from('user_points')
      .select('*, points(*, subjects:subject_id(name, icon, color))')
      .eq('user_id', uid())
      .eq('favorited', true)

    return (userPoints || []).map(up => ({
      ...up.points,
      ease_factor: up.ease_factor,
      interval: up.interval_days,
      repetitions: up.repetitions,
      favorited: 1,
      subject_name: up.points?.subjects?.name || '',
      subject_icon: up.points?.subjects?.icon || '',
      subject_color: up.points?.subjects?.color || ''
    }))
  },

  async getSuspended() {
    const { data: userPoints } = await supabase
      .from('user_points')
      .select('*, points(*, subjects:subject_id(name, icon, color))')
      .eq('user_id', uid())
      .eq('suspended', true)

    return (userPoints || []).map(up => ({
      ...up.points,
      suspended: 1,
      subject_name: up.points?.subjects?.name || '',
      subject_icon: up.points?.subjects?.icon || '',
      subject_color: up.points?.subjects?.color || ''
    }))
  },

  async getMyUploads() {
    const { data: points } = await supabase
      .from('points')
      .select('*, subjects:subject_id(name, icon, color)')
      .eq('owner_id', uid())
      .eq('status', 'active')
      .is('source_id', null)
      .order('created_at', { ascending: false })

    return (points || []).map((p: any) => ({
      ...p,
      subject_name: p.subjects?.name || '',
      subject_icon: p.subjects?.icon || '',
      subject_color: p.subjects?.color || ''
    }))
  },

  async getRecentActivity(limit = 10) {
    const { data } = await supabase
      .from('reviews')
      .select('rating, reviewed_at, points!inner(title, question, answer, subjects:subject_id(name, icon, color))')
      .eq('user_id', uid())
      .order('reviewed_at', { ascending: false })
      .limit(limit)
    return (data || []).map((r: any) => ({
      title: r.points?.title || '',
      question: r.points?.question || '',
      answer: r.points?.answer || '',
      subject_name: r.points?.subjects?.name || '',
      subject_icon: r.points?.subjects?.icon || '',
      subject_color: r.points?.subjects?.color || '',
      rating: r.rating,
      reviewed_at: r.reviewed_at
    }))
  },

  async searchPoints(keyword: string) {
    if (!keyword.trim()) return []
    const pattern = `%${keyword.replace(/[%_\\]/g, c => '\\' + c)}%`
    const { data: points } = await supabase
      .from('points')
      .select('*, subjects:subject_id(name, icon, color)')
      .or(`title.ilike.${pattern},question.ilike.${pattern},answer.ilike.${pattern},category.ilike.${pattern}`)
      .limit(100)
    const results = (points || []).map((p: any) => ({
      ...p,
      subject_name: p.subjects?.name || '',
      subject_icon: p.subjects?.icon || '',
      subject_color: p.subjects?.color || ''
    }))
    // Dedup: if a clone exists (source_id set), keep the clone, skip the original
    const clonedSourceIds = new Set(results.filter(p => p.source_id).map(p => p.source_id))
    return results.filter(p => !clonedSourceIds.has(p.id)).slice(0, 50)
  },

  async getMyTeams() {
    const { data } = await supabase
      .from('team_members')
      .select('role, teams(*)')
      .eq('user_id', uid())
    return (data || []).map((d: any) => ({ ...d.teams, role: d.role }))
  },

  async createTeam(name: string) {
    const existing = await this.getMyTeams()
    const ownedCount = existing.filter((t: any) => t.role === 'owner').length
    if (ownedCount >= 3) throw new Error('每人最多创建 3 个知识库')
    const { data: team, error } = await supabase
      .from('teams')
      .insert({ name, owner_id: uid() })
      .select()
      .single()
    if (error) throw error
    await supabase.from('team_members').insert({ team_id: team.id, user_id: uid(), role: 'owner' })
    return team
  },

  async joinTeam(inviteCode: string) {
    const { data: team } = await supabase
      .from('teams')
      .select('*')
      .eq('invite_code', inviteCode.trim())
      .single()
    if (!team) throw new Error('邀请码无效')

    const { count } = await supabase
      .from('team_members')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', team.id)
    if (count && count >= team.max_members) throw new Error('知识库已满')

    const { error } = await supabase
      .from('team_members')
      .insert({ team_id: team.id, user_id: uid(), role: 'member' })
    if (error) {
      if (error.code === '23505') throw new Error('你已在该知识库中')
      throw error
    }
    resetUserPointsCache()
    return team
  },

  async getTeamMembers(teamId: string) {
    const { data } = await supabase
      .from('team_members')
      .select('*, profiles:user_id(nickname, avatar_url)')
      .eq('team_id', teamId)
      .order('joined_at')
    return (data || []).map((d: any) => ({
      user_id: d.user_id,
      role: d.role,
      joined_at: d.joined_at,
      nickname: d.profiles?.nickname || '未知',
      avatar_url: d.profiles?.avatar_url || ''
    }))
  },

  async leaveTeam(teamId: string) {
    const { data: membership } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', uid())
      .single()
    if (membership?.role === 'owner') throw new Error('知识库创建者无法退出，请先转让或解散知识库')
    await supabase.from('team_members').delete().eq('team_id', teamId).eq('user_id', uid())
    return { ok: true }
  },

  async updateTeam(teamId: string, data: { name: string }) {
    const { error } = await supabase
      .from('teams')
      .update({ name: data.name })
      .eq('id', teamId)
    if (error) throw error
    return { ok: true }
  },

  async createSubject(data: { name: string; icon?: string; color?: string; team_id?: string; is_public?: boolean }) {
    const { data: subject, error } = await supabase
      .from('subjects')
      .insert({
        name: data.name,
        icon: data.icon || '📚',
        color: data.color || '#3B82F6',
        owner_id: data.is_public ? null : uid(),
        team_id: data.team_id || null
      })
      .select()
      .single()
    if (error) throw error
    return subject
  },

  async cloneSubjectToMine(subjectId: string, subjectInfo?: { name: string; icon: string; color: string; sort_order?: number }) {
    let srcName = subjectInfo?.name
    let srcIcon = subjectInfo?.icon
    let srcColor = subjectInfo?.color
    let srcSortOrder = subjectInfo?.sort_order ?? 999

    if (!srcName) {
      const { data: srcSubject } = await supabase.from('subjects').select('*').eq('id', subjectId).single()
      if (!srcSubject) throw new Error('科目不存在')
      srcName = srcSubject.name
      srcIcon = srcSubject.icon
      srcColor = srcSubject.color
      srcSortOrder = srcSubject.sort_order
    }

    const { data: existingSubjects } = await supabase
      .from('subjects')
      .select('id')
      .eq('name', srcName)
      .eq('owner_id', uid())
      .is('team_id', null)

    let targetSubjectId: string

    if (existingSubjects && existingSubjects.length > 0) {
      targetSubjectId = existingSubjects[0].id
    } else {
      const { data: newSubject, error } = await supabase
        .from('subjects')
        .insert({ name: srcName, icon: srcIcon, color: srcColor, owner_id: uid(), team_id: null, sort_order: srcSortOrder })
        .select().single()
      if (error) throw error
      targetSubjectId = newSubject.id
    }

    const { data: srcPoints } = await supabase
      .from('points')
      .select('id, title, category, question, answer')
      .eq('subject_id', subjectId)
      .eq('status', 'active')

    if (srcPoints?.length) {
      const { data: existingPoints } = await supabase
        .from('points')
        .select('source_id, title')
        .eq('subject_id', targetSubjectId)
        .eq('owner_id', uid())

      const existingSourceIds = new Set((existingPoints || []).filter((p: any) => p.source_id).map((p: any) => p.source_id))
      const existingTitles = new Set((existingPoints || []).map((p: any) => p.title))

      const newPoints = srcPoints.filter(p => !existingSourceIds.has(p.id) && !existingTitles.has(p.title))
      const updatePoints = srcPoints.filter(p => existingSourceIds.has(p.id) || existingTitles.has(p.title))

      if (newPoints.length > 0) {
        const rows = newPoints.map(p => ({
          subject_id: targetSubjectId,
          owner_id: uid(),
          visibility: 'private' as const,
          team_id: null,
          source_id: p.id,
          title: p.title,
          category: p.category || '',
          question: p.question,
          answer: p.answer
        }))
        await supabase.from('points').insert(rows)
      }

      for (const p of updatePoints) {
        const matchBySource = existingSourceIds.has(p.id)
        let query = supabase.from('points')
          .update({ question: p.question, answer: p.answer, category: p.category || '' })
          .eq('subject_id', targetSubjectId)
          .eq('owner_id', uid())
        if (matchBySource) {
          query = query.eq('source_id', p.id)
        } else {
          query = query.eq('title', p.title)
        }
        await query
      }

      resetUserPointsCache()
    }
    return { id: targetSubjectId }
  },

  async clonePointToMine(pointId: string, targetSubjectId: string) {
    const { data: src } = await supabase.from('points').select('title, category, question, answer').eq('id', pointId).single()
    if (!src) throw new Error('知识点不存在')

    const { data: existing } = await supabase
      .from('points')
      .select('id')
      .eq('subject_id', targetSubjectId)
      .eq('owner_id', uid())
      .eq('source_id', pointId)
      .maybeSingle()

    if (existing) {
      await supabase.from('points')
        .update({ title: src.title, question: src.question, answer: src.answer, category: src.category || '' })
        .eq('id', existing.id)
      resetUserPointsCache()
      return existing
    }

    const { data: point, error } = await supabase
      .from('points')
      .insert({
        subject_id: targetSubjectId,
        owner_id: uid(),
        visibility: 'private',
        team_id: null,
        source_id: pointId,
        title: src.title,
        category: src.category || '',
        question: src.question,
        answer: src.answer
      })
      .select().single()
    if (error) throw error
    resetUserPointsCache()
    return point
  },

  async checkUploadQuota(visibility: string) {
    const { data } = await supabase.rpc('check_upload_quota', {
      p_user_id: uid(),
      p_visibility: visibility
    })
    return data
  },

  async _ensureUserPoint(pointId: string) {
    const { data } = await supabase
      .from('user_points')
      .select('point_id')
      .eq('user_id', uid())
      .eq('point_id', pointId)
      .single()

    if (!data) {
      await supabase.from('user_points').insert({
        user_id: uid(),
        point_id: pointId,
        next_review: today()
      })
    }
  },

  async _incrementUploadCount(visibility: string) {
    const todayStr = today()
    const { data: existing } = await supabase
      .from('daily_upload_counts')
      .select('*')
      .eq('user_id', uid())
      .eq('date', todayStr)
      .single()

    const field = visibility === 'private' ? 'private_count' : visibility === 'public' ? 'public_count' : 'team_count'

    if (existing) {
      await supabase.from('daily_upload_counts')
        .update({ [field]: (existing as any)[field] + 1 })
        .eq('user_id', uid())
        .eq('date', todayStr)
    } else {
      await supabase.from('daily_upload_counts')
        .insert({ user_id: uid(), date: todayStr, [field]: 1 })
    }
  }
}
