#!/usr/bin/env node
/**
 * 供其他语言（如 Python 迁移脚本）复用「唯一清洗逻辑」的桥接 CLI。
 *
 * 用法：
 *   echo '["文本1", "文本2"]' | node scripts/normalize_stdin.mjs
 * 输出：
 *   ["清洗后文本1", "清洗后文本2"]
 *
 * 存在的意义：Supabase 生产数据的迁移脚本用 Python 写（因为已有的
 * fix_supabase_broken_lines.py 直接用 urllib 调 REST API），但清洗规则
 * 必须与 src/utils/contentNormalize.js 完全一致，不能用正则在 Python 端
 * 重新实现一份。这个 CLI 让 Python 端通过 subprocess 调用，保证两边
 * 用的是同一份 JS 实现。
 */
import { normalizeKnowledgeContent } from '../src/utils/contentNormalize.js'

let input = ''
process.stdin.setEncoding('utf-8')
process.stdin.on('data', chunk => { input += chunk })
process.stdin.on('end', () => {
  const arr = JSON.parse(input)
  if (!Array.isArray(arr)) {
    process.stderr.write('输入必须是 JSON 字符串数组\n')
    process.exit(1)
  }
  const result = arr.map(s => normalizeKnowledgeContent(s))
  process.stdout.write(JSON.stringify(result))
})
