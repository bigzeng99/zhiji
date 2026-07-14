/**
 * 知识内容清洗逻辑 —— 纯 JS 模块，无 TypeScript 语法，无浏览器/Vue API 依赖。
 *
 * 原则：只合并、只清理，绝不按标点/字数做任何「拆分」或「插入换行」。
 * 视觉换行/分段完全交给 CSS 和浏览器自然换行。
 */

/**
 * 统一换行符并清理空白行。
 * - \r\n / \r → \n
 * - 行尾空格移除
 * - 纯空白行（只含空格/Tab）直接删除（不保留为空行），
 *   因为这类行在 AI 生成内容中几乎总是格式噪声而非有意义的段落分隔符。
 *   真正的段落分隔用 \n\n（真空行），不会被影响。
 * - 连续 3+ 个换行压缩为 2 个（最多保留一个空行）
 * @param {string} text
 * @returns {string}
 */
export function normalizeWhitespace(text) {
  if (!text) return text
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .reduce((acc, line) => {
      if (/^[ \t]+$/.test(line)) return acc
      acc.push(line.replace(/\s+$/, ''))
      return acc
    }, [])
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
}

/**
 * 合并被换行意外拆断的词句。
 * 只在「当前行末非句末标点 + 下一行是续接字符」时合并，
 * 遇到空行或列表项标记绝不合并，保留真正的分段/列表结构。
 * @param {string} text
 * @returns {string}
 */
export function cleanBrokenLines(text) {
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
      if (/^[、，；：]/.test(nxt)) { cur = curR + nxt; i++; continue }
      if ((curR.split('(').length + curR.split('（').length) > (curR.split(')').length + curR.split('）').length)) { cur = curR + nxt; i++; continue }
      if (/[，、；：]$/.test(curR)) { cur = curR + nxt; i++; continue }
      break
    }
    out.push(cur)
    i++
  }
  return out.join('\n')
}

/**
 * 移除历史遗留的 [[term]] 方括号高亮标记。
 * @param {string} text
 * @returns {string}
 */
export function stripLegacyBrackets(text) {
  if (!text) return text
  return text.replace(/\[\[([^\]]+)\]\]/g, '$1')
}

const MIN_LIST_ITEM_CHARS = 10

function contentCharCount(s) {
  const matches = s.match(/[一-鿿A-Za-z0-9]/g)
  return matches ? matches.length : 0
}

function looksStructured(s) {
  return /\*\*[^*]+\*\*/.test(s) || /[：:]/.test(s)
}

/**
 * 合并「假分裂」的编号列表项：只做合并，绝不拆分任何内容。
 * @param {string} text
 * @returns {string}
 */
export function mergeFragmentedListItems(text) {
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

/**
 * 知识内容清洗的唯一入口。
 * @param {string} text
 * @returns {string}
 */
export function normalizeKnowledgeContent(text) {
  if (!text) return text
  if (text.trimStart().startsWith('{')) {
    try {
      const parsed = JSON.parse(text)
      if (parsed && typeof parsed === 'object') {
        if ('summary' in parsed) return text
        if (parsed.answer && typeof parsed.answer === 'object' && 'summary' in parsed.answer) return text
      }
    } catch { /* not structured JSON, continue cleaning */ }
  }
  let result = text
  result = normalizeWhitespace(result)
  result = cleanBrokenLines(result)
  result = mergeFragmentedListItems(result)
  result = cleanBrokenLines(result)
  result = stripLegacyBrackets(result)
  result = normalizeWhitespace(result)
  return result
}
