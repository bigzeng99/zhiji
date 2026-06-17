import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, 'zhiji.db')

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS subjects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS points (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT DEFAULT '',
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    ease_factor REAL DEFAULT 2.5,
    interval INTEGER DEFAULT 0,
    repetitions INTEGER DEFAULT 0,
    next_review TEXT DEFAULT (date('now')),
    last_review TEXT,
    suspended INTEGER DEFAULT 0,
    favorited INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    point_id TEXT NOT NULL REFERENCES points(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL,
    ease_factor_before REAL,
    ease_factor_after REAL,
    interval_before INTEGER,
    interval_after INTEGER,
    reviewed_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS daily_stats (
    date TEXT PRIMARY KEY,
    new_learned INTEGER DEFAULT 0,
    reviewed INTEGER DEFAULT 0,
    study_seconds INTEGER DEFAULT 0
  );
`)

function seed() {
  const count = db.prepare('SELECT COUNT(*) as c FROM subjects').get() as any
  if (count.c > 0) return

  const jsonPath = path.join(__dirname, '..', 'src', 'data', 'knowledge.json')
  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))

  const insertSubject = db.prepare(
    'INSERT INTO subjects (id, name, icon, color, sort_order) VALUES (?, ?, ?, ?, ?)'
  )
  const insertPoint = db.prepare(
    'INSERT INTO points (id, subject_id, title, category, question, answer) VALUES (?, ?, ?, ?, ?, ?)'
  )

  const tx = db.transaction(() => {
    for (let i = 0; i < raw.subjects.length; i++) {
      const s = raw.subjects[i]
      insertSubject.run(s.id, s.name, s.icon, s.color, i)
      for (const p of s.points) {
        insertPoint.run(p.id, s.id, p.title, p.category, p.question, p.answer)
      }
    }
  })
  tx()
  console.log('[DB] Seeded with', raw.subjects.length, 'subjects')
}

seed()

try { db.exec('ALTER TABLE points ADD COLUMN suspended INTEGER DEFAULT 0') } catch {}
try { db.exec('ALTER TABLE points ADD COLUMN favorited INTEGER DEFAULT 0') } catch {}

export default db
