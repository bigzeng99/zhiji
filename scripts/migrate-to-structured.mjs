#!/usr/bin/env node
/**
 * Migrate legacy markdown answers to structured JSON format.
 * Usage:
 *   node scripts/migrate-to-structured.mjs --dry-run          # preview changes
 *   node scripts/migrate-to-structured.mjs --apply-seed       # update seed.json
 *   node scripts/migrate-to-structured.mjs --apply-supabase   # update Supabase
 *   node scripts/migrate-to-structured.mjs --apply-all        # both
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SEED_PATH = resolve(__dirname, '../src/data/seed.json')
const GLOSSARY_PATH = resolve(__dirname, '../src/data/glossary.json')

const SUPABASE_URL = 'https://joqppofbsptljxdhxcpe.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvcXBwb2Zic3B0bGp4ZGh4Y3BlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjA3OTQ2OCwiZXhwIjoyMDk3NjU1NDY4fQ.0AHtkQem53KuHiS8qGPP1W-Ou7OUr5alWZPAIH5jZpQ'

const glossary = JSON.parse(readFileSync(GLOSSARY_PATH, 'utf8'))
const glossaryTerms = glossary
  .map(g => g.term)
  .filter(t => t.length >= 2)
  .sort((a, b) => b.length - a.length)

function isAlreadyStructured(answer) {
  if (!answer || !answer.trimStart().startsWith('{')) return false
  try {
    const o = JSON.parse(answer)
    return o && typeof o === 'object' && 'summary' in o
  } catch { return false }
}

function findConcepts(text) {
  const concepts = []
  const used = new Set()
  for (const term of glossaryTerms) {
    if (used.has(term)) continue
    const idx = text.indexOf(term)
    if (idx !== -1) {
      const entry = glossary.find(g => g.term === term)
      if (entry) {
        concepts.push({ label: term, explanation: entry.definition })
        used.add(term)
      }
    }
  }
  return concepts.length > 0 ? concepts : undefined
}

function richText(text) {
  const cleaned = text.replace(/\[\[([^\]]+)\]\]/g, '$1').trim()
  const concepts = findConcepts(cleaned)
  return concepts ? { text: cleaned, concepts } : { text: cleaned }
}

function stripBold(text) {
  return text.replace(/\*\*([^*]+)\*\*/g, '$1')
}

function convertAnswer(answer) {
  if (!answer) return null
  if (isAlreadyStructured(answer)) return null

  const text = answer.trim()
  const paragraphs = text.split(/\n\n+/).map(p => p.trim()).filter(Boolean)

  if (paragraphs.length === 0) return null

  // Try to parse numbered list pattern: "1.**term** — explanation" or "1. **term**：explanation"
  const listPattern = /^(\d+)[.．、)）]\s*\*{0,2}([^*：:—\n]+?)\*{0,2}\s*[：:—–]\s*(.+)$/s
  const simpleListPattern = /^(\d+)[.．、)）]\s+(.+)$/s

  // Check if the entire answer is a list (possibly with a header)
  const lines = text.split('\n')
  let headerLine = null
  let listLines = []
  let nonListContent = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (listPattern.test(trimmed) || simpleListPattern.test(trimmed)) {
      listLines.push(trimmed)
    } else {
      if (listLines.length === 0) {
        nonListContent.push(trimmed)
      } else {
        nonListContent.push(trimmed)
      }
    }
  }

  // Strategy: first paragraph as summary, detect list items as bullets, rest as content
  let summary = null
  const sections = []

  if (paragraphs.length === 1) {
    // Single paragraph — check if it contains a list
    const singleLines = text.split('\n').map(l => l.trim()).filter(Boolean)
    const bullets = []
    const preamble = []

    for (const line of singleLines) {
      let m = listPattern.exec(line)
      if (m) {
        bullets.push({ term: stripBold(m[2].trim()), explanation: richText(stripBold(m[3])) })
        continue
      }
      m = simpleListPattern.exec(line)
      if (m && bullets.length > 0) {
        bullets.push({ explanation: richText(stripBold(m[2])) })
        continue
      }
      preamble.push(line)
    }

    if (bullets.length >= 2) {
      summary = richText(stripBold(preamble.join(' ') || bullets[0].explanation.text))
      if (preamble.length > 0) {
        sections.push({ heading: '要点', bullets })
      } else {
        const firstBullet = bullets.shift()
        summary = richText(stripBold(preamble.join(' ') || (firstBullet.term ? firstBullet.term + '：' + firstBullet.explanation.text : firstBullet.explanation.text)))
        sections.push({ heading: '要点', bullets })
      }
    } else {
      summary = richText(stripBold(text))
    }
  } else {
    // Multiple paragraphs
    let summaryIdx = 0

    // Check if first paragraph is a heading-like line (short, with bold)
    const firstPara = paragraphs[0]
    if (firstPara.length < 80 && /\*\*/.test(firstPara)) {
      summary = richText(stripBold(firstPara))
      summaryIdx = 1
    } else {
      summary = richText(stripBold(firstPara))
      summaryIdx = 1
    }

    // Process remaining paragraphs
    for (let pi = summaryIdx; pi < paragraphs.length; pi++) {
      const para = paragraphs[pi]
      const paraLines = para.split('\n').map(l => l.trim()).filter(Boolean)

      // Check if this paragraph is a list
      const bullets = []
      const contentLines = []
      let heading = null

      // Check for heading pattern: **Heading**：or bold-only line
      const headingMatch = /^\*\*([^*]+)\*\*[：:]?\s*$/.exec(paraLines[0])
      if (headingMatch && paraLines.length > 1) {
        heading = headingMatch[1].trim()
        paraLines.shift()
      }

      for (const line of paraLines) {
        let m = listPattern.exec(line)
        if (m) {
          bullets.push({ term: stripBold(m[2].trim()), explanation: richText(stripBold(m[3])) })
          continue
        }
        m = simpleListPattern.exec(line)
        if (m) {
          bullets.push({ explanation: richText(stripBold(m[2])) })
          continue
        }
        contentLines.push(line)
      }

      if (bullets.length >= 2) {
        const section = { heading: heading || '要点' }
        if (contentLines.length > 0) {
          section.content = richText(stripBold(contentLines.join(' ')))
        }
        section.bullets = bullets
        sections.push(section)
      } else if (contentLines.length > 0 || bullets.length > 0) {
        const allText = [...contentLines, ...bullets.map(b => b.term ? b.term + '：' + b.explanation.text : b.explanation.text)]
        const section = { heading: heading || (pi === paragraphs.length - 1 ? '补充' : '说明') }
        section.content = richText(stripBold(allText.join(' ')))
        sections.push(section)
      }
    }
  }

  if (!summary) return null

  const result = { summary }
  if (sections.length > 0) result.sections = sections

  return JSON.stringify(result)
}

// --- Main ---

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const applySeed = args.includes('--apply-seed') || args.includes('--apply-all')
const applySupabase = args.includes('--apply-supabase') || args.includes('--apply-all')

if (!dryRun && !applySeed && !applySupabase) {
  console.log('Usage: node migrate-to-structured.mjs [--dry-run | --apply-seed | --apply-supabase | --apply-all]')
  process.exit(0)
}

// Process seed.json
const seed = JSON.parse(readFileSync(SEED_PATH, 'utf8'))
let converted = 0, skipped = 0, failed = 0

for (const point of seed.points) {
  if (isAlreadyStructured(point.answer)) { skipped++; continue }
  const structured = convertAnswer(point.answer)
  if (structured) {
    if (dryRun && converted < 5) {
      console.log(`\n--- ${point.title} ---`)
      console.log('BEFORE:', point.answer.substring(0, 150))
      const parsed = JSON.parse(structured)
      console.log('AFTER:', JSON.stringify(parsed, null, 2).substring(0, 300))
    }
    if (applySeed) {
      point.answer = structured
    }
    converted++
  } else {
    failed++
  }
}

console.log(`\nSeed.json: ${converted} converted, ${skipped} already structured, ${failed} could not convert (total: ${seed.points.length})`)

if (applySeed) {
  writeFileSync(SEED_PATH, JSON.stringify(seed, null, 2))
  console.log('seed.json updated.')
}

// Process Supabase
if (applySupabase || dryRun) {
  console.log('\nFetching Supabase data...')
  const PAGE_SIZE = 1000
  let allPoints = []
  let offset = 0

  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/points?select=id,answer&order=id&offset=${offset}&limit=${PAGE_SIZE}`
    const resp = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    })
    const batch = await resp.json()
    if (!Array.isArray(batch) || batch.length === 0) break
    allPoints.push(...batch)
    if (batch.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  console.log(`Fetched ${allPoints.length} points from Supabase`)

  let sbConverted = 0, sbSkipped = 0, sbFailed = 0

  for (const point of allPoints) {
    if (isAlreadyStructured(point.answer)) { sbSkipped++; continue }
    const structured = convertAnswer(point.answer)
    if (structured) {
      if (applySupabase) {
        const resp = await fetch(`${SUPABASE_URL}/rest/v1/points?id=eq.${point.id}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ answer: structured })
        })
        if (!resp.ok) {
          console.error(`Failed to update ${point.id}: ${resp.status}`)
          sbFailed++
          continue
        }
      }
      sbConverted++
    } else {
      sbFailed++
    }
  }

  console.log(`Supabase: ${sbConverted} converted, ${sbSkipped} already structured, ${sbFailed} could not convert (total: ${allPoints.length})`)
}

console.log('\nDone.')
