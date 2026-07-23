import { reactive } from 'vue'
import { getApi } from './apiSwitch'
import { auth } from './auth'

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

const MAX_REPEATS: Record<number, number> = { 2: 1, 1: 3, 0: 5 }

export const store = reactive({
  subjects: [] as any[],
  reviewQueue: [] as ReviewPoint[],
  currentIndex: 0,
  totalCount: 0,
  completedCount: 0,
  sessionDone: false,
  feedNeedsRefresh: false,
  dailyLimit: parseInt(localStorage.getItem('zhiji_daily_limit') || '20'),
  hiddenSubjects: JSON.parse(localStorage.getItem('zhiji_hidden_subjects') || '[]') as string[],
  selectedSubjects: JSON.parse(localStorage.getItem('zhiji_selected_subjects') || '[]') as string[],
  overview: { due_today: 0, total_points: 0, learned_points: 0, new_today: 0, reviewed_today: 0 },
  loading: false,
  syncStatus: 'idle' as 'idle' | 'syncing' | 'done' | 'error',
  lastSyncAt: 0,
  _subjectsLoadedAt: 0,
  _overviewLoadedAt: 0,
  _teamsLoadedAt: 0,
  _preloading: null as Promise<void> | null,

  teams: [] as Array<{ id: string; name: string; description: string; invite_code: string; role: string; max_members: number }>,
  currentTeamId: localStorage.getItem('zhiji_current_team') as string | null,

  get currentTeam() {
    return this.teams.find((t: any) => t.id === this.currentTeamId) || null
  },

  async loadTeams() {
    if (this._teamsLoadedAt && Date.now() - this._teamsLoadedAt < 5000) return
    this.teams = await getApi().getMyTeams()
    this._teamsLoadedAt = Date.now()
    if (this.currentTeamId && !this.teams.find(t => t.id === this.currentTeamId)) {
      this.currentTeamId = null
      localStorage.removeItem('zhiji_current_team')
    }
  },

  switchSpace(teamId: string | null) {
    this.currentTeamId = teamId
    if (teamId) localStorage.setItem('zhiji_current_team', teamId)
    else localStorage.removeItem('zhiji_current_team')
  },

  setDailyLimit(n: number) {
    this.dailyLimit = n
    localStorage.setItem('zhiji_daily_limit', String(n))
  },

  toggleHiddenSubject(id: string) {
    const idx = this.hiddenSubjects.indexOf(id)
    if (idx >= 0) this.hiddenSubjects.splice(idx, 1)
    else this.hiddenSubjects.push(id)
    localStorage.setItem('zhiji_hidden_subjects', JSON.stringify(this.hiddenSubjects))
  },

  saveSelectedSubjects(ids: string[]) {
    this.selectedSubjects = ids
    localStorage.setItem('zhiji_selected_subjects', JSON.stringify(ids))
  },

  isSubjectHidden(id: string) {
    return this.hiddenSubjects.includes(id)
  },

  async loadSubjects() {
    if (this._subjectsLoadedAt && Date.now() - this._subjectsLoadedAt < 5000) return
    this.subjects = await getApi().getSubjects()
    this._subjectsLoadedAt = Date.now()
  },

  async loadOverview() {
    if (this._overviewLoadedAt && Date.now() - this._overviewLoadedAt < 5000) return
    this.overview = await getApi().getOverview()
    this._overviewLoadedAt = Date.now()
  },

  preload() {
    if (this._preloading) return
    this._preloading = Promise.all([
      this.loadSubjects().catch(() => {}),
      this.loadOverview().catch(() => {}),
      auth.isLoggedIn.value ? this.loadTeams().catch(() => {}) : Promise.resolve()
    ]).then(() => { this._preloading = null })
  },

  async loadReviewQueue(subjectIds?: string[], limit?: number) {
    let filterIds = subjectIds
    if (this.hiddenSubjects.length > 0 && !filterIds) {
      const allSubs = this.subjects.length > 0 ? this.subjects : await getApi().getSubjects()
      filterIds = allSubs.map((s: any) => s.id).filter((id: string) => !this.hiddenSubjects.includes(id))
    } else if (filterIds && this.hiddenSubjects.length > 0) {
      filterIds = filterIds.filter(id => !this.hiddenSubjects.includes(id))
    }
    const queue = await getApi().getReviewQueue(filterIds, limit)
    queue.forEach((p: ReviewPoint) => { p._sessionCount = 0 })
    this.reviewQueue = queue
    this.currentIndex = 0
    this.totalCount = queue.length
    this.completedCount = 0
    this.sessionDone = false
  },

  submitRating(rating: number): boolean {
    const point = this.reviewQueue[this.currentIndex]
    if (!point) return false

    const count = (point._sessionCount || 0) + 1
    const maxRepeat = MAX_REPEATS[rating] ?? 1

    getApi().submitRating(point.id, rating).catch(() => {})
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

  suspendPoint(): boolean {
    const point = this.reviewQueue[this.currentIndex]
    if (!point) return false
    getApi().suspendPoint(point.id).catch(() => {})
    this.reviewQueue.splice(this.currentIndex, 1)
    this.totalCount--
    if (this.reviewQueue.length === 0) return false
    if (this.currentIndex >= this.reviewQueue.length) this.currentIndex = 0
    return true
  },

  toggleFavorite() {
    const point = this.reviewQueue[this.currentIndex]
    if (!point) return
    point.favorited = point.favorited ? 0 : 1
    getApi().toggleFavorite(point.id).catch(() => {})
  },

  get currentPoint(): ReviewPoint | null {
    return this.reviewQueue[this.currentIndex] || null
  }
})
