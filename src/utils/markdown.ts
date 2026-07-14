import { marked } from 'marked'
import glossaryData from '../data/glossary.json'
import { normalizeKnowledgeContent } from './contentNormalize.js'
import { isStructuredAnswer, parseStructuredAnswer, structuredToPlainText } from './answerFormat'

marked.setOptions({
  breaks: false,
  gfm: true
})

const glossaryTerms = (glossaryData as Array<{ term: string }>)
  .map(g => g.term)
  .filter(t => t.length >= 3)
  .sort((a, b) => b.length - a.length)

// 每次 renderMd() 调用重置：保证一段文本里同一个术语只高亮第一次出现。
// marked.parse 是同步单线程调用，模块级可变状态在这里是安全的。
let usedTerms = new Set<string>()

// 术语高亮完全是渲染时行为：直接注册为 marked 的原生 inline token，
// 与 marked 自身的 **加粗**、列表等解析在同一次 tokenize 过程中正确共存。
//
// 为什么不能像以前那样「先把 [[term]] 替换成 <mark> 字符串，再丢给 marked.parse」：
// 术语高亮标记以 `[` 开头，CommonMark 的 emphasis 左侵定界符规则要求——
// 如果 ** 后面紧跟的字符是标点（如 `[`），那么 ** 前面必须是空白/行首/标点才能生效。
// 中文行文里 "...了**[[术语]]**..." 前面紧跟普通汉字，不满足该规则，
// marked 会判定这不是合法的加粗开启符，导致整段 ** 原样保留成裸字符。
// 直接扫描纯文本术语（不含方括号）注册为 token，从根本上绕开这个冲突，
// 已用真实案例验证：**斯多葛直接催生了认知行为疗法（CBT）** 这类内容能正确渲染。
marked.use({
  extensions: [{
    name: 'glossaryTerm',
    level: 'inline',
    start(src: string) {
      let minIdx = -1
      for (const term of glossaryTerms) {
        if (usedTerms.has(term)) continue
        const idx = src.indexOf(term)
        if (idx !== -1 && (minIdx === -1 || idx < minIdx)) minIdx = idx
      }
      return minIdx === -1 ? undefined : minIdx
    },
    tokenizer(src: string) {
      for (const term of glossaryTerms) {
        if (usedTerms.has(term)) continue
        if (src.startsWith(term)) {
          usedTerms.add(term)
          return { type: 'glossaryTerm', raw: term, term }
        }
      }
      return undefined
    },
    renderer(token: any) {
      return `<mark class="kw-link" data-term="${token.term}">${token.term}</mark>`
    }
  }]
})

export function renderMd(text: string): string {
  if (!text) return ''
  usedTerms = new Set<string>()
  return marked.parse(text, { async: false }) as string
}

/**
 * 给列表预览（截断显示）用的纯文本裁剪：去掉所有 markdown 标记符号，
 * 返回干净的纯文本，用于 {{ }} 插值场景，不生成 HTML。
 */
export function toPlainPreview(text: string): string {
  if (!text) return ''
  if (isStructuredAnswer(text)) {
    const sa = parseStructuredAnswer(text)
    if (sa) return structuredToPlainText(sa)
  }
  return text
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-•*]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\n+/g, ' ')
    .trim()
}

// 知识内容清洗的唯一入口，供所有写入路径（AI 生成/手动录入/批量导入/编辑保存）调用。
export { normalizeKnowledgeContent }
