import db from './db.js'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pid = () => 'b_' + crypto.randomUUID().slice(0, 8)

const subjectMap: Record<string, string> = {
  psychology: 'psychology',
  philosophy: 'philosophy',
  thinking: 'thinking',
  communication: 'communication',
  economics: 'economics',
  history: 'history',
  logic: 'logic',
  sociology: 'sociology',
  product: 'product',
  law: 'law',
}

const insertPoint = db.prepare(
  'INSERT INTO points (id, subject_id, title, category, question, answer) VALUES (?, ?, ?, ?, ?, ?)'
)

const files = ['batch1.json', 'batch2.json', 'batch3.json', 'batch4.json']
let totalInserted = 0

const tx = db.transaction(() => {
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', file), 'utf-8'))
    for (const [key, points] of Object.entries(data) as [string, any[]][]) {
      const subjectId = subjectMap[key]
      if (!subjectId) {
        console.log(`[SKIP] Unknown subject key: ${key}`)
        continue
      }
      for (const p of points) {
        insertPoint.run(pid(), subjectId, p.title, p.category, p.question, p.answer)
        totalInserted++
      }
    }
  }
})

tx()
console.log(`[Import] 成功导入 ${totalInserted} 个知识点`)

const subjects = db.prepare(`
  SELECT s.name, s.icon,
    (SELECT COUNT(*) FROM points WHERE subject_id = s.id) as count
  FROM subjects s ORDER BY s.sort_order
`).all() as any[]

let grand = 0
for (const s of subjects) {
  console.log(`  ${s.icon} ${s.name}: ${s.count}`)
  grand += s.count
}
console.log(`  总计: ${grand} 个知识点`)
