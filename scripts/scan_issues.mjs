import https from 'https'

const URL_BASE = 'https://joqppofbsptljxdhxcpe.supabase.co'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvcXBwb2Zic3B0bGp4ZGh4Y3BlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjA3OTQ2OCwiZXhwIjoyMDk3NjU1NDY4fQ.0AHtkQem53KuHiS8qGPP1W-Ou7OUr5alWZPAIH5jZpQ'

function supaFetch(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, URL_BASE)
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY }
    }, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => resolve(JSON.parse(data)))
    })
    req.on('error', reject)
    req.end()
  })
}

async function run() {
  let all = []
  let offset = 0
  while (true) {
    const res = await supaFetch('/rest/v1/points?select=id,question,answer,subject_id&order=id&offset=' + offset + '&limit=500')
    all = all.concat(res)
    if (res.length < 500) break
    offset += 500
  }
  console.log('Total points:', all.length)

  const issues = []
  for (const p of all) {
    if (!p.answer) continue
    if (p.question?.trimStart().startsWith('{')) continue
    const a = p.answer
    const problems = []
    const lines = a.split('\n')

    // Pattern 1: numbered item starting with continuation punct
    if (/\n\d+\.\s*[、，；]/.test(a)) {
      problems.push('假编号(续接标点开头)')
    }

    // Pattern 2: unclosed ( on line, next line starts with number
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i]
      const next = lines[i + 1].trim()
      const opens = (line.match(/[（(]/g) || []).length
      const closes = (line.match(/[)）]/g) || []).length
      if (opens > closes && /^\d+\./.test(next)) {
        problems.push('未闭合括号+假编号')
      }
    }

    // Pattern 3: short orphan line between content
    for (let i = 1; i < lines.length - 1; i++) {
      const line = lines[i].trim()
      if (!line || /^[-•*#>\d]/.test(line)) continue
      const cc = (line.match(/[一-鿿A-Za-z0-9]/g) || []).length
      if (cc > 0 && cc < 8 && lines[i - 1].trim() && lines[i + 1].trim()) {
        problems.push('孤立短行: "' + line + '"')
      }
    }

    if (problems.length > 0) {
      issues.push({ id: p.id, q: (p.question || '').substring(0, 50), subject: p.subject_id, problems, answer: a })
    }
  }

  console.log('\nProblematic points:', issues.length)
  issues.forEach((p, i) => {
    console.log('\n--- #' + (i + 1) + ' [' + p.subject + '] ' + p.q + ' ---')
    p.problems.forEach(pr => console.log('  ' + pr))
    console.log('  DATA:', JSON.stringify(p.answer).substring(0, 250))
  })
}

run().catch(e => console.error(e))
