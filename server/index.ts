import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import db from './db.js'
import { sm2 } from './sm2.js'
import crypto from 'crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
app.use(cors())
app.use(express.json())

const today = () => new Date().toISOString().slice(0, 10)
const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ')

// ===== SUBJECTS =====

app.get('/api/subjects', (req, res) => {
  const subjects = db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM points WHERE subject_id = s.id) as point_count,
      (SELECT COUNT(*) FROM points WHERE subject_id = s.id AND repetitions > 0) as learned_count
    FROM subjects s ORDER BY s.sort_order
  `).all()
  res.json(subjects)
})

app.get('/api/subjects/:id/points', (req, res) => {
  const points = db.prepare(
    'SELECT * FROM points WHERE subject_id = ? ORDER BY created_at'
  ).all(req.params.id)
  res.json(points)
})

// ===== POINTS CRUD =====

app.post('/api/points', (req, res) => {
  const { subject_id, title, category, question, answer } = req.body
  if (!subject_id || !title || !question || !answer) {
    return res.status(400).json({ error: '缺少必填字段' })
  }
  const id = 'p_' + crypto.randomUUID().slice(0, 8)
  db.prepare(
    'INSERT INTO points (id, subject_id, title, category, question, answer) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, subject_id, title, category || '', question, answer)
  const point = db.prepare('SELECT * FROM points WHERE id = ?').get(id)
  res.json(point)
})

app.put('/api/points/:id', (req, res) => {
  const { title, category, question, answer } = req.body
  db.prepare(
    `UPDATE points SET title = ?, category = ?, question = ?, answer = ?, updated_at = ? WHERE id = ?`
  ).run(title, category || '', question, answer, now(), req.params.id)
  const point = db.prepare('SELECT * FROM points WHERE id = ?').get(req.params.id)
  res.json(point)
})

app.delete('/api/points/:id', (req, res) => {
  db.prepare('DELETE FROM points WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ===== REVIEW =====

app.get('/api/review/queue', (req, res) => {
  const subjectIds = req.query.subjects
    ? (req.query.subjects as string).split(',')
    : null

  let sql = `
    SELECT p.*, s.name as subject_name, s.icon as subject_icon, s.color as subject_color
    FROM points p JOIN subjects s ON p.subject_id = s.id
    WHERE p.next_review <= ? AND p.suspended = 0
  `
  const params: any[] = [today()]

  if (subjectIds) {
    sql += ` AND p.subject_id IN (${subjectIds.map(() => '?').join(',')})`
    params.push(...subjectIds)
  }
  sql += ' ORDER BY p.favorited DESC, RANDOM()'

  const limit = req.query.limit ? parseInt(req.query.limit as string) : 0
  if (limit > 0) {
    sql += ' LIMIT ?'
    params.push(limit)
  }

  const queue = db.prepare(sql).all(...params)
  res.json(queue)
})

app.post('/api/review/rate', (req, res) => {
  const { pointId, rating } = req.body
  if (!pointId || rating === undefined) {
    return res.status(400).json({ error: '缺少 pointId 或 rating' })
  }

  const point = db.prepare('SELECT * FROM points WHERE id = ?').get(pointId) as any
  if (!point) return res.status(404).json({ error: '知识点不存在' })

  const result = sm2(rating, point.repetitions, point.ease_factor, point.interval)

  if (point.favorited && result.interval > 1) {
    result.interval = Math.max(1, Math.round(result.interval * 0.7))
  }

  const nextReview = new Date()
  nextReview.setDate(nextReview.getDate() + result.interval)
  const nextReviewStr = nextReview.toISOString().slice(0, 10)

  db.prepare(`
    UPDATE points SET
      ease_factor = ?, interval = ?, repetitions = ?,
      next_review = ?, last_review = ?, updated_at = ?
    WHERE id = ?
  `).run(result.easeFactor, result.interval, result.repetitions, nextReviewStr, now(), now(), pointId)

  db.prepare(`
    INSERT INTO reviews (point_id, rating, ease_factor_before, ease_factor_after, interval_before, interval_after, reviewed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(pointId, rating, point.ease_factor, result.easeFactor, point.interval, result.interval, now())

  const todayStr = today()
  const isNew = point.repetitions === 0
  db.prepare(`
    INSERT INTO daily_stats (date, new_learned, reviewed) VALUES (?, ?, 1)
    ON CONFLICT(date) DO UPDATE SET
      new_learned = new_learned + ?,
      reviewed = reviewed + 1
  `).run(todayStr, isNew ? 1 : 0, isNew ? 1 : 0)

  const updated = db.prepare('SELECT * FROM points WHERE id = ?').get(pointId)
  res.json(updated)
})

app.get('/api/review/history/:pointId', (req, res) => {
  const reviews = db.prepare(
    'SELECT * FROM reviews WHERE point_id = ? ORDER BY reviewed_at DESC LIMIT 20'
  ).all(req.params.pointId)
  res.json(reviews)
})

app.post('/api/points/:id/suspend', (req, res) => {
  db.prepare('UPDATE points SET suspended = 1, updated_at = ? WHERE id = ?').run(now(), req.params.id)
  res.json({ ok: true })
})

app.post('/api/points/:id/toggle-favorite', (req, res) => {
  const point = db.prepare('SELECT favorited FROM points WHERE id = ?').get(req.params.id) as any
  if (!point) return res.status(404).json({ error: '知识点不存在' })
  const newVal = point.favorited ? 0 : 1
  db.prepare('UPDATE points SET favorited = ?, updated_at = ? WHERE id = ?').run(newVal, now(), req.params.id)
  res.json({ favorited: newVal === 1 })
})

// ===== STATS =====

app.get('/api/stats/overview', (req, res) => {
  const dueToday = (db.prepare(
    'SELECT COUNT(*) as c FROM points WHERE next_review <= ?'
  ).get(today()) as any).c

  const totalPoints = (db.prepare('SELECT COUNT(*) as c FROM points').get() as any).c

  const learnedPoints = (db.prepare(
    'SELECT COUNT(*) as c FROM points WHERE repetitions > 0'
  ).get() as any).c

  const todayStats = db.prepare(
    'SELECT * FROM daily_stats WHERE date = ?'
  ).get(today()) as any

  res.json({
    due_today: dueToday,
    total_points: totalPoints,
    learned_points: learnedPoints,
    new_today: todayStats?.new_learned || 0,
    reviewed_today: todayStats?.reviewed || 0
  })
})

app.get('/api/stats/mastery', (req, res) => {
  const subjectId = req.query.subject as string | undefined

  let where = ''
  const params: any[] = []
  if (subjectId && subjectId !== 'all') {
    where = 'WHERE subject_id = ?'
    params.push(subjectId)
  }

  const total = (db.prepare(`SELECT COUNT(*) as c FROM points ${where}`).get(...params) as any).c
  if (total === 0) return res.json({ mastered: 0, familiar: 0, normal: 0, unfamiliar: 0, unlearned: 0 })

  const mastered = (db.prepare(`SELECT COUNT(*) as c FROM points ${where ? where + ' AND' : 'WHERE'} interval >= 30`).get(...params) as any).c
  const familiar = (db.prepare(`SELECT COUNT(*) as c FROM points ${where ? where + ' AND' : 'WHERE'} interval >= 7 AND interval < 30`).get(...params) as any).c
  const normal = (db.prepare(`SELECT COUNT(*) as c FROM points ${where ? where + ' AND' : 'WHERE'} interval >= 1 AND interval < 7`).get(...params) as any).c
  const unfamiliar = (db.prepare(`SELECT COUNT(*) as c FROM points ${where ? where + ' AND' : 'WHERE'} repetitions > 0 AND interval < 1`).get(...params) as any).c
  const unlearned = (db.prepare(`SELECT COUNT(*) as c FROM points ${where ? where + ' AND' : 'WHERE'} repetitions = 0`).get(...params) as any).c

  res.json({
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
  })
})

app.get('/api/stats/weekly', (req, res) => {
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }

  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const result = days.map(date => {
    const stats = db.prepare('SELECT * FROM daily_stats WHERE date = ?').get(date) as any
    const dow = new Date(date).getDay()
    return {
      date,
      day: dayNames[dow],
      reviewed: stats?.reviewed || 0,
      new_learned: stats?.new_learned || 0
    }
  })
  res.json(result)
})

app.get('/api/stats/curve', (req, res) => {
  const subjectId = req.query.subject as string | undefined

  let where = ''
  const params: any[] = []
  if (subjectId && subjectId !== 'all') {
    where = 'AND p.subject_id = ?'
    params.push(subjectId)
  }

  const retentionData = []
  for (let i = 0; i < 10; i++) {
    const d = new Date()
    d.setDate(d.getDate() - (9 - i))
    const dateStr = d.toISOString().slice(0, 10)

    const total = (db.prepare(`
      SELECT COUNT(*) as c FROM reviews r JOIN points p ON r.point_id = p.id
      WHERE date(r.reviewed_at) = ? ${where}
    `).get(dateStr, ...params) as any).c

    const correct = (db.prepare(`
      SELECT COUNT(*) as c FROM reviews r JOIN points p ON r.point_id = p.id
      WHERE date(r.reviewed_at) = ? AND r.rating >= 1 ${where}
    `).get(dateStr, ...params) as any).c

    retentionData.push({
      date: dateStr,
      retention: total > 0 ? Math.round(correct / total * 100) : null
    })
  }

  const ebbinghaus = [100, 58, 44, 36, 33, 28, 25, 23, 21, 20]

  res.json({ user: retentionData, ebbinghaus })
})

app.get('/api/stats/profile', (req, res) => {
  const totalReviews = (db.prepare('SELECT COUNT(*) as c FROM reviews').get() as any).c
  const totalPoints = (db.prepare('SELECT COUNT(*) as c FROM points').get() as any).c
  const learnedPoints = (db.prepare('SELECT COUNT(*) as c FROM points WHERE repetitions > 0').get() as any).c

  const allDays = db.prepare('SELECT date FROM daily_stats WHERE reviewed > 0 ORDER BY date DESC').all() as any[]
  let streak = 0
  let maxStreak = 0
  const todayStr = today()
  let checkDate = new Date(todayStr)

  for (let i = 0; i < 365; i++) {
    const ds = checkDate.toISOString().slice(0, 10)
    const has = allDays.find((d: any) => d.date === ds)
    if (has || (i === 0 && !has)) {
      if (has) streak++
      else if (i === 0) { /* today not started yet, still count */ }
    } else break
    checkDate.setDate(checkDate.getDate() - 1)
  }

  let tempStreak = 0
  const sortedDays = allDays.map((d: any) => d.date).sort()
  for (let i = 0; i < sortedDays.length; i++) {
    if (i === 0) { tempStreak = 1 }
    else {
      const prev = new Date(sortedDays[i - 1])
      const curr = new Date(sortedDays[i])
      const diff = (curr.getTime() - prev.getTime()) / 86400000
      if (diff === 1) tempStreak++
      else tempStreak = 1
    }
    if (tempStreak > maxStreak) maxStreak = tempStreak
  }
  if (streak > maxStreak) maxStreak = streak

  const totalStudyDays = allDays.length

  const avgNew = totalStudyDays > 0
    ? (db.prepare('SELECT SUM(new_learned) as s FROM daily_stats').get() as any).s / totalStudyDays
    : 0
  const avgReview = totalStudyDays > 0
    ? (db.prepare('SELECT SUM(reviewed) as s FROM daily_stats').get() as any).s / totalStudyDays
    : 0

  const subjects = db.prepare(`
    SELECT s.id, s.name, s.icon, s.color,
      (SELECT COUNT(*) FROM points WHERE subject_id = s.id) as total,
      (SELECT COUNT(*) FROM points WHERE subject_id = s.id AND repetitions > 0) as learned
    FROM subjects s ORDER BY s.sort_order
  `).all() as any[]

  res.json({
    total_reviews: totalReviews,
    total_points: totalPoints,
    learned_points: learnedPoints,
    streak,
    max_streak: maxStreak,
    total_study_days: totalStudyDays,
    avg_new_per_day: Math.round(avgNew * 10) / 10,
    avg_review_per_day: Math.round(avgReview * 10) / 10,
    subjects: subjects.map(s => ({
      ...s,
      progress: s.total > 0 ? Math.round(s.learned / s.total * 100) : 0
    }))
  })
})

const distPath = path.resolve(__dirname, '../dist')
app.use(express.static(distPath))
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

const PORT = 3001
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] 知记运行在 http://localhost:${PORT}`)
})
