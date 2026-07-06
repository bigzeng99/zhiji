/**
 * 浏览器控制台版 Supabase 知识内容清洗脚本
 *
 * 用法：
 * 1. 打开 https://bigzeng99.github.io/zhiji/ 并登录（或不登录都行，脚本直接用 service key）
 * 2. 按 F12 打开开发者工具，切到 Console 标签
 * 3. 把这个文件的全部内容粘贴进去，回车执行
 * 4. 脚本会先打印将要改动的条数和前几条对比，不会立即修改数据
 * 5. 确认没问题后，在控制台里执行：await runSupabaseNormalize()
 *    脚本会弹出确认框，点确定才会真正写入数据库
 *
 * 这份清洗逻辑和 src/utils/contentNormalize.js 完全一致（手动同步维护）。
 * 只更新 question/answer 文本内容，不涉及学习进度、复习记录、收藏状态。
 */

const SUPABASE_URL = "https://joqppofbsptljxdhcpe.supabase.co/rest/v1"
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvcXBwb2Zic3B0bGp4ZGh4Y3BlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjA3OTQ2OCwiZXhwIjoyMDk3NjU1NDY4fQ.0AHtkQem53KuHiS8qGPP1W-Ou7OUr5alWZPAIH5jZpQ"

// ===== 以下清洗逻辑与 src/utils/contentNormalize.js 保持一致 =====

function cleanBrokenLines(text) {
  if (!text) return text
  const lines = text.split('\n')
  const out = []
  let i = 0
  while (i < lines.length) {
    let cur = lines[i]
    while (i + 1 < lines.length) {
      const nxt = lines[i + 1].replace(/^\s+/, '')
      const curR = cur.replace(/\s+$/, '')
      if (!curR || !nxt) break
      if (/^[-•*]\s/.test(nxt)) break
      if (/^\d+\./.test(nxt)) break
      if (/[。！？]$/.test(curR)) break
      if (/[，、；：]$/.test(curR)) { cur = curR + nxt; i++; continue }
      if (/[）)」』"'》】]$/.test(curR)) { cur = curR + nxt; i++; continue }
      if (/[一-鿿]$/.test(curR) && /^[一-鿿]/.test(nxt)) { cur = curR + nxt; i++; continue }
      if (/[A-Za-z0-9]$/.test(curR) && /^[一-鿿]/.test(nxt)) { cur = curR + ' ' + nxt; i++; continue }
      break
    }
    out.push(cur)
    i++
  }
  return out.join('\n')
}

function stripLegacyBrackets(text) {
  if (!text) return text
  return text.replace(/\[\[([^\]]+)\]\]/g, '$1')
}

function collapseBlankLines(text) {
  if (!text) return text
  return text.replace(/\n{3,}/g, '\n\n')
}

const MIN_LIST_ITEM_CHARS = 10

function contentCharCount(s) {
  const matches = s.match(/[一-鿿A-Za-z0-9]/g)
  return matches ? matches.length : 0
}

function looksStructured(s) {
  return /\*\*[^*]+\*\*/.test(s) || /[：:]/.test(s)
}

function mergeFragmentedListItems(text) {
  if (!text) return text
  const lines = text.split('\n')
  const out = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const m = /^(\s*)(\d+)\.\s+(.*)$/.exec(line)
    if (!m) {
      out.push(line)
      i++
      continue
    }

    const indent = m[1]
    const items = [m[3]]
    let j = i + 1
    while (j < lines.length) {
      const mm = /^\s*\d+\.\s+(.*)$/.exec(lines[j])
      if (!mm) break
      items.push(mm[1])
      j++
    }

    const merged = [items[0]]
    for (let k = 1; k < items.length; k++) {
      const item = items[k]
      const isFragment = contentCharCount(item) < MIN_LIST_ITEM_CHARS && !looksStructured(item)
      if (isFragment) {
        const prev = merged[merged.length - 1]
        const sep = /[，、；：。！？]$/.test(prev) ? '' : '；'
        merged[merged.length - 1] = prev + sep + item
      } else {
        merged.push(item)
      }
    }

    if (merged.length === 1) {
      out.push(indent + merged[0])
    } else {
      merged.forEach((it, idx) => out.push(`${indent}${idx + 1}. ${it}`))
    }

    i = j
  }

  return out.join('\n')
}

function normalizeKnowledgeContent(text) {
  if (!text) return text
  let result = text
  result = cleanBrokenLines(result)
  result = mergeFragmentedListItems(result)
  result = cleanBrokenLines(result)
  result = stripLegacyBrackets(result)
  result = collapseBlankLines(result)
  return result
}

// ===== Supabase 读写 =====

async function fetchAllPoints() {
  const rows = []
  let offset = 0
  while (true) {
    const url = `${SUPABASE_URL}/points?select=id,title,question,answer&limit=1000&offset=${offset}`
    const res = await fetch(url, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
    })
    if (!res.ok) throw new Error(`拉取失败: ${res.status} ${await res.text()}`)
    const data = await res.json()
    if (!data.length) break
    rows.push(...data)
    if (data.length < 1000) break
    offset += 1000
  }
  return rows
}

async function updatePoint(id, question, answer) {
  const res = await fetch(`${SUPABASE_URL}/points?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify({ question, answer })
  })
  if (!res.ok) throw new Error(`更新失败: ${res.status} ${await res.text()}`)
}

let _pendingFixes = null

async function runSupabaseNormalize() {
  console.log('正在拉取全部知识点...')
  const points = await fetchAllPoints()
  console.log(`共 ${points.length} 条`)

  const toFix = []
  for (const p of points) {
    const newQ = normalizeKnowledgeContent(p.question || '')
    const newA = normalizeKnowledgeContent(p.answer || '')
    const qChanged = newQ !== (p.question || '')
    const aChanged = newA !== (p.answer || '')
    if (qChanged || aChanged) {
      toFix.push({ id: p.id, title: p.title, newQ, newA, oldQ: p.question, oldA: p.answer, qChanged, aChanged })
    }
  }

  console.log(`将改动 ${toFix.length} 条，前 10 条预览：`)
  toFix.slice(0, 10).forEach(f => {
    console.log(`--- [${f.title}] ---`)
    if (f.aChanged) {
      console.log('答案 BEFORE:', f.oldA)
      console.log('答案 AFTER: ', f.newA)
    }
  })

  _pendingFixes = toFix
  console.log(`\n预览完毕。确认无误后执行： await applyFixes()`)
  return toFix
}

async function applyFixes() {
  if (!_pendingFixes) {
    console.log('请先执行 await runSupabaseNormalize() 生成待改列表')
    return
  }
  if (!confirm(`确定要更新 ${_pendingFixes.length} 条知识点吗？此操作会直接写入 Supabase。`)) {
    console.log('已取消')
    return
  }
  let ok = 0, fail = 0
  for (const f of _pendingFixes) {
    try {
      await updatePoint(f.id, f.newQ, f.newA)
      ok++
      if (ok % 50 === 0) console.log(`进度: ${ok}/${_pendingFixes.length}`)
    } catch (e) {
      fail++
      console.error(`失败 [${f.title}]:`, e.message)
    }
  }
  console.log(`完成：成功 ${ok} 条，失败 ${fail} 条`)
}

// 显式挂到 window，避免不同浏览器控制台作用域差异导致函数找不到
window.runSupabaseNormalize = runSupabaseNormalize
window.applyFixes = applyFixes

console.log('脚本已加载。执行 await runSupabaseNormalize() 预览待改动内容。')
