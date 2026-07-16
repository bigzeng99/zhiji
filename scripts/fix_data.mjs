import https from 'https'

const URL_BASE = 'https://joqppofbsptljxdhxcpe.supabase.co'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvcXBwb2Zic3B0bGp4ZGh4Y3BlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjA3OTQ2OCwiZXhwIjoyMDk3NjU1NDY4fQ.0AHtkQem53KuHiS8qGPP1W-Ou7OUr5alWZPAIH5jZpQ'

function supaFetch(path, opts = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, URL_BASE)
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: opts.method || 'GET',
      headers: {
        'apikey': KEY,
        'Authorization': 'Bearer ' + KEY,
        'Content-Type': 'application/json',
        'Prefer': opts.prefer || '',
      }
    }
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        if (res.statusCode >= 400) reject(new Error(res.statusCode + ': ' + data))
        else resolve(JSON.parse(data || '""'))
      })
    })
    req.on('error', reject)
    if (opts.body) req.write(opts.body)
    req.end()
  })
}

function cc(s) {
  return (s.match(/[一-鿿A-Za-z0-9]/g) || []).length
}

function fixAnswer(text) {
  if (!text) return text

  // Pass 1: Fix fake numbered items (e.g. "\n2. 、剪枝" → merge into prev line)
  text = text.replace(/\n(\d+)\.\s*([、，；])/g, (_, _num, punct) => punct)

  // Pass 2: Fix unclosed parenthesis + fake numbered item
  // e.g. "(INT4/INT\n2. " → merge lines
  const lines = text.split('\n')
  let out = [lines[0]]
  for (let i = 1; i < lines.length; i++) {
    const prev = out[out.length - 1]
    const line = lines[i]
    const trimmed = line.trim()

    // Check if prev ends with unclosed paren and current starts with number
    if (/^\d+\./.test(trimmed)) {
      const lastOpen = Math.max(prev.lastIndexOf('('), prev.lastIndexOf('（'))
      const lastClose = Math.max(prev.lastIndexOf(')'), prev.lastIndexOf('）'))
      if (lastOpen > lastClose && lastOpen >= 0) {
        const content = trimmed.replace(/^\d+\.\s*/, '')
        out[out.length - 1] = prev + content
        continue
      }
    }

    out.push(line)
  }

  // Pass 3: Merge short orphan lines (< 10 content chars, between content lines)
  const lines2 = out.join('\n').split('\n')
  const out2 = [lines2[0]]
  for (let i = 1; i < lines2.length; i++) {
    const line = lines2[i].trim()
    if (!line) { out2.push(''); continue }

    // Skip real list items and headings
    if (/^[-•*]\s/.test(line)) { out2.push(line); continue }
    if (/^\d+[\.\)、]\s*\S/.test(line)) { out2.push(line); continue }
    if (/^[#>]/.test(line)) { out2.push(line); continue }

    const charCount = cc(line)
    const prev = out2[out2.length - 1]
    const prevTrimmed = prev.replace(/\s+$/, '')

    // Only merge if short (< 10 content chars) AND between content
    if (charCount > 0 && charCount < 10) {
      if (/[：:]$/.test(prevTrimmed)) {
        out2[out2.length - 1] = prevTrimmed + line
      } else if (/[；;，,、]$/.test(prevTrimmed)) {
        out2[out2.length - 1] = prevTrimmed + line
      } else {
        out2[out2.length - 1] = prevTrimmed + '；' + line
      }
      continue
    }

    out2.push(line)
  }

  return out2.join('\n')
}

async function run() {
  let all = []
  let offset = 0
  while (true) {
    const res = await supaFetch('/rest/v1/points?select=id,question,answer&order=id&offset=' + offset + '&limit=500')
    all = all.concat(res)
    if (res.length < 500) break
    offset += 500
  }
  console.log('Total points:', all.length)

  const toFix = []
  for (const p of all) {
    if (!p.answer) continue
    if (p.question?.trimStart().startsWith('{')) continue
    const fixed = fixAnswer(p.answer)
    if (fixed !== p.answer) {
      toFix.push({ id: p.id, question: p.question, oldAnswer: p.answer, answer: fixed })
    }
  }
  console.log('Points to fix:', toFix.length)

  for (let i = 0; i < Math.min(15, toFix.length); i++) {
    const p = toFix[i]
    console.log('\n--- #' + (i + 1) + ' Q: ' + (p.question || '').substring(0, 50) + ' ---')
    console.log('BEFORE:', JSON.stringify(p.oldAnswer).substring(0, 250))
    console.log('AFTER: ', JSON.stringify(p.answer).substring(0, 250))
  }

  const qFixes = []
  for (const p of all) {
    if (!p.question) continue
    if (p.question.trimStart().startsWith('{')) continue
    const fixed = fixAnswer(p.question)
    if (fixed !== p.question) {
      qFixes.push({ id: p.id, question: fixed })
    }
  }
  console.log('\nQuestion fixes:', qFixes.length)

  if (process.argv.includes('--apply')) {
    console.log('\nApplying fixes...')
    let updated = 0
    for (const p of toFix) {
      await supaFetch('/rest/v1/points?id=eq.' + p.id, {
        method: 'PATCH',
        body: JSON.stringify({ answer: p.answer }),
        prefer: 'return=minimal'
      })
      updated++
      if (updated % 50 === 0) console.log('  ' + updated + '/' + toFix.length)
    }
    for (const p of qFixes) {
      await supaFetch('/rest/v1/points?id=eq.' + p.id, {
        method: 'PATCH',
        body: JSON.stringify({ question: p.question }),
        prefer: 'return=minimal'
      })
    }
    console.log('Done! Updated', updated, 'answers +', qFixes.length, 'questions')
  } else {
    console.log('\nDry run. Use --apply to write changes.')
  }
}

run().catch(e => console.error(e))
