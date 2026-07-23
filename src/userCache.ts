import Dexie, { type Table } from 'dexie'

export interface CachedSubject {
  id: string
  name: string
  icon: string
  color: string
  sort_order: number
  owner_id?: string
  team_id?: string
  is_public?: boolean
  point_count: number
  learned_count: number
  due_count: number
}

export interface CachedUserPoint {
  point_id: string
  repetitions: number
  ease_factor: number
  interval_days: number
  next_review: string
  last_review: string | null
  suspended: boolean
  favorited: boolean
  updated_at?: string
}

export interface CachedPoint {
  id: string
  subject_id: string
  title: string
  category: string
  question: string
  answer: string
  status?: string
  review_status?: string
  owner_id?: string
  creator_name?: string
  source_id?: string
  created_at?: string
  updated_at?: string
}

export interface CachedProfile {
  key: string
  data: any
  updatedAt: number
}

export interface CachedDailyStat {
  date: string
  new_learned: number
  reviewed: number
}

export interface SyncMeta {
  key: string
  value: string
}

class UserCacheDB extends Dexie {
  subjects!: Table<CachedSubject>
  userPoints!: Table<CachedUserPoint>
  points!: Table<CachedPoint>
  profile!: Table<CachedProfile>
  dailyStats!: Table<CachedDailyStat>
  syncMeta!: Table<SyncMeta>

  constructor(userId: string) {
    super(`zhiji_user_${userId}`)
    this.version(1).stores({
      subjects: 'id',
      userPoints: 'point_id',
      points: 'id, subject_id',
      profile: 'key',
      dailyStats: 'date',
      syncMeta: 'key'
    })
  }
}

let _db: UserCacheDB | null = null
let _activeUserId: string | null = null

export function openUserCache(userId: string): UserCacheDB {
  if (_activeUserId === userId && _db) return _db
  if (_db) {
    _db.close()
  }
  _db = new UserCacheDB(userId)
  _activeUserId = userId
  return _db
}

export function getUserCache(): UserCacheDB | null {
  return _db
}

export function getActiveUserId(): string | null {
  return _activeUserId
}

export function closeUserCache() {
  if (_db) {
    _db.close()
    _db = null
  }
  _activeUserId = null
}

export async function getSyncMeta(key: string): Promise<string | null> {
  if (!_db) return null
  const row = await _db.syncMeta.get(key)
  return row?.value ?? null
}

export async function setSyncMeta(key: string, value: string): Promise<void> {
  if (!_db) return
  await _db.syncMeta.put({ key, value })
}

export async function hasCachedData(): Promise<boolean> {
  if (!_db) return false
  const count = await _db.subjects.count()
  return count > 0
}

export async function hasCachedPoints(): Promise<boolean> {
  if (!_db) return false
  const count = await _db.points.count()
  return count > 0
}
