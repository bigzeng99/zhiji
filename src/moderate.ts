import { getAiEndpoint, getAiKey, getAiModel } from './aiConfig'

export async function moderateContent(
  title: string, question: string, answer: string
): Promise<{ approved: boolean; reason: string }> {
  const systemPrompt = `你是一个内容审核专家。请判断以下教育知识点是否包含违规内容。
检查项：
1. 违法犯罪、政治敏感内容
2. 色情、暴力内容
3. 明显虚假或误导性信息
4. 垃圾广告、无意义内容
5. 侮辱歧视、仇恨言论

请以JSON格式返回，不要包含其他文本：
{"pass":true} 或 {"pass":false,"reason":"具体原因"}`

  const userPrompt = `标题：${title}\n问题：${question}\n答案：${answer}`

  try {
    const resp = await fetch(getAiEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAiKey()}`
      },
      body: JSON.stringify({
        model: getAiModel(),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1
      })
    })

    if (!resp.ok) return { approved: true, reason: '' }

    const data = await resp.json()
    const content = data.choices?.[0]?.message?.content || ''
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { approved: true, reason: '' }

    const parsed = JSON.parse(jsonMatch[0])
    return { approved: parsed.pass !== false, reason: parsed.reason || '' }
  } catch {
    return { approved: true, reason: '' }
  }
}
