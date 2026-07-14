#!/usr/bin/env node
/**
 * 对 src/data/seed.json 里所有知识点的 question/answer 跑一遍
 * normalizeKnowledgeContent 清洗，并打印改动前后对比。
 *
 * 用法:
 *   node scripts/normalize-seed.mjs --dry-run   仅打印将改动的条目，不写回文件
 *   node scripts/normalize-seed.mjs              实际写回 seed.json
 */
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { normalizeKnowledgeContent } from '../src/utils/contentNormalize.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const seedPath = join(__dirname, '..', 'src', 'data', 'seed.json')
const dryRun = process.argv.includes('--dry-run')

const data = JSON.parse(readFileSync(seedPath, 'utf-8'))
const points = data.points || []

let changedCount = 0
const changes = []

for (const p of points) {
  const newQuestion = normalizeKnowledgeContent(p.question || '')
  const newAnswer = normalizeKnowledgeContent(p.answer || '')
  const qChanged = newQuestion !== p.question
  const aChanged = newAnswer !== p.answer
  if (qChanged || aChanged) {
    changedCount++
    changes.push({
      title: p.title,
      qChanged, aChanged,
      before: { question: p.question, answer: p.answer },
      after: { question: newQuestion, answer: newAnswer }
    })
    p.question = newQuestion
    p.answer = newAnswer
  }
}

console.log(`共 ${points.length} 条知识点，将改动 ${changedCount} 条\n`)
for (const c of changes.slice(0, 30)) {
  console.log(`--- [${c.title}] ---`)
  if (c.qChanged) {
    console.log(`  问题(before): ${c.before.question}`)
    console.log(`  问题(after):  ${c.after.question}`)
  }
  if (c.aChanged) {
    console.log(`  答案(before): ${c.before.answer}`)
    console.log(`  答案(after):  ${c.after.answer}`)
  }
  console.log()
}
if (changes.length > 30) {
  console.log(`... 还有 ${changes.length - 30} 条改动未打印`)
}

if (dryRun) {
  console.log('\n[dry-run] 未写回文件')
} else {
  writeFileSync(seedPath, JSON.stringify(data, null, 2), 'utf-8')
  console.log(`\n已写回 ${seedPath}`)
}
