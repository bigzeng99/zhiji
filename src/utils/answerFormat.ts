import type { StructuredAnswer, RichText, Bullet, TieredAnswer } from '../types/answer'

function isTieredShape(parsed: unknown): parsed is TieredAnswer {
  if (!parsed || typeof parsed !== 'object') return false
  const o = parsed as Record<string, unknown>
  return !!o.answer && typeof o.answer === 'object' && 'summary' in (o.answer as Record<string, unknown>)
}

function isLegacyShape(parsed: unknown): parsed is StructuredAnswer {
  return !!parsed && typeof parsed === 'object' && 'summary' in (parsed as Record<string, unknown>)
}

export function isStructuredAnswer(answer: string): boolean {
  if (!answer || !answer.trimStart().startsWith('{')) return false
  try {
    const parsed = JSON.parse(answer)
    return isTieredShape(parsed) || isLegacyShape(parsed)
  } catch {
    return false
  }
}

/** 解析出标准层（StructuredAnswer）。新格式（{shortAnswer,answer,detail}）自动解包 answer 子字段；
 * 旧格式（顶层直接是 {summary,sections,note}）原样返回。下游渲染组件因此不需要关心格式差异。 */
export function parseStructuredAnswer(answer: string): StructuredAnswer | null {
  if (!isStructuredAnswer(answer)) return null
  try {
    const parsed = JSON.parse(answer)
    if (isTieredShape(parsed)) return parsed.answer
    return parsed as StructuredAnswer
  } catch {
    return null
  }
}

function truncateText(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1) + '…'
}

/** 取知识流展开用的极简版。新格式直接取 shortAnswer；旧格式或字段缺失时从 summary.text 截断生成兜底版本
 * （丢弃 concepts，避免截断后 label 在文本中找不到对应位置）。 */
export function parseShortAnswer(answer: string): RichText {
  if (!isStructuredAnswer(answer)) return { text: '', concepts: [] }
  try {
    const parsed = JSON.parse(answer)
    if (isTieredShape(parsed) && parsed.shortAnswer?.text) {
      return parsed.shortAnswer
    }
    const standard = isTieredShape(parsed) ? parsed.answer : (parsed as StructuredAnswer)
    return { text: truncateText(standard?.summary?.text || '', 60), concepts: [] }
  } catch {
    return { text: '', concepts: [] }
  }
}

/** 取详情页用的深度扩展内容。只有新格式才可能有，旧格式或字段为空时返回 null。 */
export function parseDetailAnswer(answer: string): RichText | null {
  if (!isStructuredAnswer(answer)) return null
  try {
    const parsed = JSON.parse(answer)
    if (isTieredShape(parsed) && parsed.detail?.text) {
      return parsed.detail
    }
    return null
  } catch {
    return null
  }
}

/** 从标准层 sections 里按顺序取前 N 条 bullet，用于知识流展开的"额外核心要点"。 */
export function parseTopBullets(answer: string, max = 2): Bullet[] {
  const standard = parseStructuredAnswer(answer)
  if (!standard?.sections) return []
  const bullets: Bullet[] = []
  for (const s of standard.sections) {
    if (!s.bullets) continue
    for (const b of s.bullets) {
      bullets.push(b)
      if (bullets.length >= max) return bullets
    }
  }
  return bullets
}

function validateRichText(rt: unknown): rt is RichText {
  if (!rt || typeof rt !== 'object') return false
  const o = rt as Record<string, unknown>
  if (typeof o.text !== 'string') return false
  if (o.concepts === undefined) return true
  if (!Array.isArray(o.concepts)) return false
  return (o.concepts as unknown[]).every(c => {
    if (!c || typeof c !== 'object') return false
    const co = c as Record<string, unknown>
    return typeof co.label === 'string' && typeof co.explanation === 'string' && (o.text as string).includes(co.label)
  })
}

export function validateStructuredAnswer(obj: unknown): StructuredAnswer | null {
  if (!obj || typeof obj !== 'object') return null
  const o = obj as Record<string, unknown>
  if (!o.summary || typeof o.summary !== 'object') return null
  const summary = o.summary as Record<string, unknown>
  if (typeof summary.text !== 'string' || !summary.text) return null
  if (o.sections !== undefined && !Array.isArray(o.sections)) return null
  if (o.sections) {
    for (const s of o.sections as unknown[]) {
      if (!s || typeof s !== 'object') return null
      const sec = s as Record<string, unknown>
      if (typeof sec.heading !== 'string') return null
      if (sec.bullets !== undefined && !Array.isArray(sec.bullets)) return null
    }
  }
  return obj as StructuredAnswer
}

/** 校验完整的三层结构：shortAnswer/answer.summary/detail 都按 RichText 规则校验，
 * concepts.label 必须真实出现在对应 text 里。 */
export function validateTieredAnswer(obj: unknown): TieredAnswer | null {
  if (!obj || typeof obj !== 'object') return null
  const o = obj as Record<string, unknown>
  if (!validateRichText(o.shortAnswer) || !(o.shortAnswer as RichText).text) return null
  if (!validateStructuredAnswer(o.answer)) return null
  if (o.detail !== undefined && o.detail !== null && !validateRichText(o.detail)) return null
  return obj as TieredAnswer
}

export function structuredToPlainText(sa: StructuredAnswer): string {
  const parts: string[] = [sa.summary.text]
  if (sa.sections) {
    for (const s of sa.sections) {
      if (s.heading) parts.push(s.heading)
      if (s.content) parts.push(s.content.text)
      if (s.bullets) {
        for (const b of s.bullets) {
          parts.push(b.term ? b.term + '：' + b.explanation.text : b.explanation.text)
        }
      }
    }
  }
  if (sa.note) parts.push(sa.note.text)
  return parts.join(' ')
}
