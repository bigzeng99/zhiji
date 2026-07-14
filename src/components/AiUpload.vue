<template>
  <div class="upload-overlay" @click.self="$emit('close')">
    <div class="upload-panel">
      <div class="upload-header">
        <h3>添加知识点</h3>
        <span class="close-btn" @click="$emit('close')">✕</span>
      </div>

      <div class="library-selector">
        <label>上传到</label>
        <select v-model="selectedLibrary" class="library-select">
          <option value="mine">我的库</option>
          <option value="public">公开库</option>
          <option v-for="t in (teams || [])" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>
      </div>

      <div class="tab-bar-inner">
        <span class="tab-item" :class="{ active: tab === 'manual' }" @click="tab = 'manual'">手动添加</span>
        <span class="tab-item" :class="{ active: tab === 'ai' }" @click="tab = 'ai'">AI 生成</span>
        <span class="tab-item" :class="{ active: tab === 'batch' }" @click="tab = 'batch'">批量导入</span>
      </div>

      <!-- 手动添加 -->
      <div v-if="tab === 'manual'" class="manual-form">
        <div class="field">
          <label>科目</label>
          <select v-model="manualSubjectId" class="field-select">
            <option v-for="s in filteredSubjects" :key="s.id" :value="s.id">{{ s.icon }} {{ s.name }}</option>
          </select>
        </div>
        <div class="field">
          <label>标题 *</label>
          <input v-model="manualForm.title" placeholder="如：马斯洛需求层次理论" required />
        </div>
        <div class="field">
          <label>分类</label>
          <input v-model="manualForm.category" placeholder="如：动机理论" />
        </div>
        <div class="field">
          <label>问题 *</label>
          <textarea v-model="manualForm.question" placeholder="用来记忆的问题..." rows="3" required></textarea>
        </div>
        <div class="field">
          <label>答案 *</label>
          <textarea v-model="manualForm.answer" placeholder="问题的详细答案..." rows="4" required></textarea>
        </div>
        <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>
        <button class="primary-btn" @click="saveManual" :disabled="saving || !manualForm.title.trim() || !manualForm.question.trim() || !manualForm.answer.trim()">
          {{ saving ? '保存中...' : '保存' }}
        </button>
      </div>

      <!-- 批量导入 -->
      <div v-if="tab === 'batch'" class="batch-form">
        <div class="field">
          <label>科目</label>
          <select v-model="manualSubjectId" class="field-select">
            <option v-for="s in filteredSubjects" :key="s.id" :value="s.id">{{ s.icon }} {{ s.name }}</option>
          </select>
        </div>
        <div class="batch-section">
          <div class="batch-header">
            <span class="batch-title">上传 JSON 文件</span>
            <span class="batch-template" @click="downloadTemplate">下载模板</span>
          </div>
          <div v-if="!batchItems.length" class="batch-drop-zone" @click="triggerBatchInput">
            <input ref="batchInputRef" type="file" accept=".json" class="file-input-hidden" @change="onBatchFileSelected" />
            <div class="batch-icon">📋</div>
            <div class="batch-hint">点击选择 JSON 文件</div>
            <div class="batch-formats">每条需含 title、question、answer 字段</div>
          </div>
          <div v-else class="batch-preview">
            <div class="batch-info">
              <span>已解析 <b>{{ batchItems.length }}</b> 条知识点</span>
              <span class="batch-clear" @click="batchItems = []">清除</span>
            </div>
            <div class="batch-list">
              <div v-for="(item, i) in batchItems.slice(0, 5)" :key="i" class="batch-item">
                <span class="batch-idx">{{ i + 1 }}</span>
                <span class="batch-item-title">{{ item.title }}</span>
              </div>
              <div v-if="batchItems.length > 5" class="batch-more">... 还有 {{ batchItems.length - 5 }} 条</div>
            </div>
            <div v-if="batchError" class="error-msg">{{ batchError }}</div>
            <button class="primary-btn" @click="uploadBatch" :disabled="batchUploading">
              {{ batchUploading ? `上传中 ${batchProgress}/${batchItems.length}...` : `批量上传（${batchItems.length}条）` }}
            </button>
          </div>
        </div>
      </div>

      <!-- AI 生成 -->
      <div v-if="tab === 'ai'" class="ai-form">
        <div class="mode-chips">
          <span class="mode-chip" :class="{ active: aiMode === 'query' }" @click="aiMode = 'query'">提问生成</span>
          <span class="mode-chip" :class="{ active: aiMode === 'topic' }" @click="aiMode = 'topic'">主题添加</span>
          <span class="mode-chip" :class="{ active: aiMode === 'book' }" @click="aiMode = 'book'">书籍提炼</span>
          <span class="mode-chip" :class="{ active: aiMode === 'doc' }" @click="aiMode = 'doc'">文档识别</span>
        </div>
        <div v-if="aiMode === 'doc'" class="doc-upload-area">
          <div v-if="!docFile" class="doc-drop-zone" @click="triggerFileInput">
            <input ref="fileInputRef" type="file" :accept="acceptTypes" class="file-input-hidden" @change="onFileSelected" />
            <div class="doc-icon">📄</div>
            <div class="doc-hint">点击选择文档</div>
            <div class="doc-formats">支持 TXT、Markdown、PDF、DOCX（≤500KB）</div>
            <div class="doc-limit">今日剩余 {{ docRemaining }} 次</div>
          </div>
          <div v-else class="doc-file-info">
            <span class="doc-file-name">{{ docFile.name }}</span>
            <span class="doc-file-size">{{ formatFileSize(docFile.size) }}</span>
            <span class="doc-remove" @click="removeDoc">✕</span>
          </div>
          <textarea
            v-if="docFile"
            v-model="aiInput"
            placeholder="可补充说明，如：重点提取第三章内容（可选）"
            rows="2"
          ></textarea>
        </div>
        <textarea
          v-if="aiMode !== 'doc'"
          v-model="aiInput"
          :placeholder="aiPlaceholder"
          rows="3"
        ></textarea>
        <div class="count-row">
          <span class="count-label">生成数量</span>
          <input type="number" v-model.number="aiCount" class="count-input" min="1" max="20" @blur="clampCount" />
        </div>
        <button class="primary-btn generate-btn" @click="generate" :disabled="generating || (aiMode === 'doc' ? !docFile : !aiInput.trim())">
          {{ generating ? '生成中...' : aiMode === 'query' ? '生成知识点' : '提炼知识点' }}
        </button>
        <button class="bg-btn" @click="generateAndUploadBg" :disabled="generating || (aiMode === 'doc' ? !docFile : !aiInput.trim())">
          ⚡ 后台生成并上传
        </button>

        <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>

        <div v-if="results.length > 0" class="ai-results">
          <div class="results-header">
            <span>生成了 {{ results.length }} 个知识点</span>
            <span class="select-all" @click="toggleSelectAll">{{ allChecked ? '取消全选' : '全选' }}</span>
          </div>
          <div v-for="(r, i) in results" :key="i" class="result-card" :class="{ checked: r.checked }">
            <div class="result-check" @click="r.checked = !r.checked">{{ r.checked ? '✓' : '' }}</div>
            <div class="result-body" @click="r.checked = !r.checked">
              <div class="result-top">
                <span class="result-title">{{ r.title }}</span>
                <select v-model="r.subject_id" class="result-subject-select" @click.stop>
                  <option v-for="s in filteredSubjects" :key="s.id" :value="s.id">{{ s.icon }} {{ s.name }}</option>
                </select>
              </div>
              <div class="result-category">{{ r.category }}</div>
              <div class="result-q">{{ toPlainPreview(r.question) }}</div>
              <AnswerRenderer v-if="expandedIdx === i" class="result-a" :answer="r.answer" />
              <span class="result-toggle" @click.stop="expandedIdx = expandedIdx === i ? -1 : i">
                {{ expandedIdx === i ? '收起答案' : '查看答案' }}
              </span>
            </div>
          </div>
          <button class="primary-btn" @click="uploadSelected" :disabled="uploading || checkedCount === 0">
            {{ uploading ? '上传中...' : `上传选中（${checkedCount}个）` }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { getApi } from '../apiSwitch'
import { auth } from '../auth'
import { runBgUpload } from '../utils/bgUpload'
import { normalizeKnowledgeContent, toPlainPreview } from '../utils/markdown'
import { validateStructuredAnswer, validateTieredAnswer } from '../utils/answerFormat'
import { getAiEndpoint, getAiKey, getAiModel } from '../aiConfig'
import { buildAnswerSystemPrompt } from '../aiPrompts'
import AnswerRenderer from './AnswerRenderer.vue'

const props = defineProps<{ subjects: any[]; teamId?: string | null; teams?: any[] }>()
const emit = defineEmits(['close', 'saved'])

const tab = ref<'manual' | 'ai' | 'batch'>('ai')
const errorMsg = ref('')
const saving = ref(false)

const selectedLibrary = ref<string>(props.teamId || 'public')
const effectiveTeamId = computed(() => {
  if (selectedLibrary.value === 'mine' || selectedLibrary.value === 'public') return null
  return selectedLibrary.value
})
const effectiveVisibility = computed(() => {
  if (selectedLibrary.value === 'public') return 'public'
  if (effectiveTeamId.value) return 'team'
  return 'private'
})
const filteredSubjects = computed(() => {
  const userId = auth.currentUser.value?.id
  if (selectedLibrary.value === 'mine') {
    return props.subjects.filter(s => !s.team_id && s.owner_id === userId)
  }
  if (selectedLibrary.value === 'public') {
    return props.subjects.filter(s => !s.team_id && (!s.owner_id || s.owner_id !== userId))
  }
  return props.subjects.filter(s => s.team_id === selectedLibrary.value)
})

const manualSubjectId = ref(props.subjects[0]?.id || '')
const manualForm = ref({ title: '', category: '', question: '', answer: '' })

const batchInputRef = ref<HTMLInputElement | null>(null)
const batchItems = ref<Array<{ title: string; category: string; question: string; answer: string }>>([])
const batchUploading = ref(false)
const batchProgress = ref(0)
const batchError = ref('')

const aiMode = ref<'query' | 'book' | 'topic' | 'doc'>('query')
const aiInput = ref('')
const aiCount = ref(1)
const generating = ref(false)
const uploading = ref(false)
const expandedIdx = ref(-1)
const docFile = ref<File | null>(null)
const docContent = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)
const acceptTypes = '.txt,.md,.markdown,.pdf,.docx'
const MAX_FILE_SIZE = 500 * 1024
const DOC_DAILY_LIMIT = 5
const DOC_LIMIT_KEY = 'zhiji_doc_upload_count'

function getDocUsageToday(): number {
  const raw = localStorage.getItem(DOC_LIMIT_KEY)
  if (!raw) return 0
  try {
    const { date, count } = JSON.parse(raw)
    if (date === new Date().toDateString()) return count
  } catch {}
  return 0
}

function incrementDocUsage() {
  const today = new Date().toDateString()
  const count = getDocUsageToday() + 1
  localStorage.setItem(DOC_LIMIT_KEY, JSON.stringify({ date: today, count }))
}

const docRemaining = computed(() => DOC_DAILY_LIMIT - getDocUsageToday())

const aiPlaceholder = computed(() => {
  if (aiMode.value === 'query') return '输入问题，如：什么是俄狄浦斯情结？'
  if (aiMode.value === 'topic') return '输入主题，如：各国有趣地理知识'
  if (aiMode.value === 'doc') return '可补充说明（可选）'
  return '输入书名，如：自控力'
})

interface AiResult {
  title: string
  category: string
  question: string
  answer: string
  subject_id: string
  checked: boolean
}

const results = ref<AiResult[]>([])

const aiEndpoint = computed(() => getAiEndpoint())
const aiKey = computed(() => getAiKey())
const aiModel = computed(() => getAiModel())

const checkedCount = computed(() => results.value.filter(r => r.checked).length)
const allChecked = computed(() => results.value.length > 0 && results.value.every(r => r.checked))

function toggleSelectAll() {
  const target = !allChecked.value
  results.value.forEach(r => r.checked = target)
}

function clampCount() {
  if (!aiCount.value || aiCount.value < 1) aiCount.value = 1
  if (aiCount.value > 20) aiCount.value = 20
  aiCount.value = Math.round(aiCount.value)
}

function triggerFileInput() {
  fileInputRef.value?.click()
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + 'B'
  return (bytes / 1024).toFixed(1) + 'KB'
}

function removeDoc() {
  docFile.value = null
  docContent.value = ''
  if (fileInputRef.value) fileInputRef.value.value = ''
}

async function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (file.size > MAX_FILE_SIZE) {
    errorMsg.value = `文件过大（${formatFileSize(file.size)}），最大支持 500KB`
    input.value = ''
    return
  }
  errorMsg.value = ''
  docFile.value = file
  try {
    docContent.value = await readFileContent(file)
  } catch (err: any) {
    errorMsg.value = err.message || '文件读取失败'
    docFile.value = null
    docContent.value = ''
    input.value = ''
  }
}

async function readFileContent(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.markdown')) {
    return file.text()
  }
  if (name.endsWith('.pdf')) {
    return readPdfAsText(file)
  }
  if (name.endsWith('.docx')) {
    return readDocxAsText(file)
  }
  throw new Error('不支持的文件格式')
}

async function readPdfAsText(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./pdf.worker.min.mjs', window.location.href).href
  const arrayBuf = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuf }).promise
  const chunks: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items.map((item: any) => item.str).join('')
    if (pageText.trim()) chunks.push(pageText)
  }
  const result = chunks.join('\n').trim()
  if (!result) throw new Error('PDF 中未找到可提取的文字内容')
  return result.slice(0, 15000)
}

async function readDocxAsText(file: File): Promise<string> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(file)
  const docXml = await zip.file('word/document.xml')?.async('string')
  if (!docXml) throw new Error('无法读取 DOCX 文件内容')
  const chunks: string[] = []
  const tagRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g
  let match
  while ((match = tagRegex.exec(docXml)) !== null) {
    chunks.push(match[1])
  }
  const result = chunks.join('').trim()
  if (!result) throw new Error('DOCX 中未找到文字内容，建议使用 TXT 或 Markdown 格式')
  return result.slice(0, 15000)
}

function matchSubject(title: string, category: string, question: string): string {
  const text = `${title} ${category} ${question}`.toLowerCase()
  const subjectKeywords: Record<string, string[]> = {}
  for (const s of props.subjects) {
    const name = (s.name || '').toLowerCase()
    subjectKeywords[s.id] = [name]
  }
  const keywordMap: Record<string, string[]> = {
    '语文': ['文学', '诗词', '古文', '成语', '修辞', '小说', '散文', '作文', '阅读', '词语', '汉字', '语法', '文言'],
    '数学': ['数学', '方程', '函数', '几何', '概率', '统计', '微积分', '代数', '三角', '向量', '矩阵', '极限'],
    '英语': ['英语', 'english', '语法', '词汇', '单词', 'grammar', 'vocabulary', '时态', '从句'],
    '物理': ['物理', '力学', '电磁', '光学', '热力学', '量子', '相对论', '牛顿', '波动', '能量'],
    '化学': ['化学', '元素', '分子', '反应', '有机', '无机', '酸碱', '氧化', '还原', '化合'],
    '生物': ['生物', '细胞', '基因', 'dna', '遗传', '进化', '生态', '蛋白质', '酶', '光合'],
    '历史': ['历史', '朝代', '战争', '革命', '王朝', '帝国', '文明', '古代', '近代', '现代史'],
    '地理': ['地理', '地形', '气候', '大陆', '海洋', '人口', '城市', '经纬', '板块', '水文'],
    '政治': ['政治', '哲学', '经济学', '法律', '马克思', '辩证', '唯物', '社会主义', '民主', '制度'],
    '心理学': ['心理', '认知', '情绪', '行为', '意识', '人格', '动机', '弗洛伊德', '马斯洛', '记忆', '学习理论']
  }

  let bestId = props.subjects[0]?.id || ''
  let bestScore = 0

  for (const s of props.subjects) {
    let score = 0
    const kws = keywordMap[s.name] || [s.name.toLowerCase()]
    for (const kw of kws) {
      if (text.includes(kw)) score += 2
    }
    if (score > bestScore) {
      bestScore = score
      bestId = s.id
    }
  }
  return bestId
}

function downloadTemplate() {
  const template = [
    { title: '示例标题1', category: '分类', question: '这是问题？', answer: '这是答案。' },
    { title: '示例标题2', category: '分类', question: '第二个问题？', answer: '第二个答案。' }
  ]
  const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'zhiji-batch-template.json'
  a.click()
  URL.revokeObjectURL(url)
}

function triggerBatchInput() {
  batchInputRef.value?.click()
}

async function onBatchFileSelected(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  batchError.value = ''
  try {
    const text = await file.text()
    const data = JSON.parse(text)
    if (!Array.isArray(data)) throw new Error('JSON 文件内容必须是数组')
    const valid = data.filter((item: any) => item.title && item.question && item.answer)
    if (valid.length === 0) throw new Error('未找到有效条目，每条需含 title、question、answer')
    batchItems.value = valid.map((item: any) => ({
      title: String(item.title).trim(),
      category: String(item.category || '').trim(),
      question: String(item.question).trim(),
      answer: String(item.answer).trim()
    }))
  } catch (err: any) {
    batchError.value = err.message || '文件解析失败'
    batchItems.value = []
  }
  if (batchInputRef.value) batchInputRef.value.value = ''
}

async function uploadBatch() {
  if (!batchItems.value.length || !manualSubjectId.value) return
  batchUploading.value = true
  batchProgress.value = 0
  batchError.value = ''
  let success = 0, rejected = 0
  try {
    for (const item of batchItems.value) {
      const point = await getApi().createPoint({
        subject_id: manualSubjectId.value,
        title: item.title,
        category: item.category,
        question: item.question,
        answer: normalizeKnowledgeContent(item.answer),
        visibility: effectiveVisibility.value,
        team_id: effectiveTeamId.value || undefined
      })
      batchProgress.value++
      if (point?.review_status === 'rejected') rejected++
      else { success++; await cloneToMine(point) }
    }
    batchItems.value = []
    const msg = rejected > 0 ? `成功上传 ${success} 条，${rejected} 条未通过审核` : `成功上传 ${success} 条知识点`
    alert(msg)
    emit('saved')
    emit('close')
  } catch (e: any) {
    batchError.value = `上传到第 ${batchProgress.value + 1} 条时失败：${e.message || '未知错误'}`
  } finally {
    batchUploading.value = false
  }
}

async function cloneToMine(point: any) {
  if (!point?.id || selectedLibrary.value !== 'public') return
  try {
    const userId = auth.currentUser.value?.id
    const allSubs = await getApi().getSubjects()
    const srcSubject = allSubs.find((s: any) => s.id === point.subject_id)
    const mySubjects = allSubs.filter((s: any) => !s.team_id && s.owner_id === userId)
    const match = mySubjects.find((s: any) => s.name === srcSubject?.name)
    let targetId: string
    if (match) {
      targetId = match.id
    } else {
      const newSub = await getApi().createSubject({
        name: srcSubject?.name || '我的知识',
        icon: srcSubject?.icon || '📚',
        color: srcSubject?.color || '#3B82F6'
      })
      targetId = newSub.id
    }
    await getApi().clonePointToMine(point.id, targetId)
  } catch {}
}

async function saveManual() {
  saving.value = true
  errorMsg.value = ''
  try {
    const point = await getApi().createPoint({
      subject_id: manualSubjectId.value,
      title: manualForm.value.title,
      category: manualForm.value.category,
      question: manualForm.value.question,
      answer: normalizeKnowledgeContent(manualForm.value.answer),
      visibility: effectiveVisibility.value,
      team_id: effectiveTeamId.value || undefined
    })
    if (point?.review_status === 'rejected') {
      errorMsg.value = `内容未通过审核：${point.reject_reason || '内容不符合规范'}`
      return
    }
    await cloneToMine(point)
    manualForm.value = { title: '', category: '', question: '', answer: '' }
    emit('saved')
    emit('close')
  } catch (e: any) {
    errorMsg.value = e.message || '保存失败'
  } finally {
    saving.value = false
  }
}

async function generateAndUploadBg() {
  if (aiMode.value === 'doc' ? !docFile.value : !aiInput.value.trim()) return
  const input = aiInput.value
  const count = aiCount.value
  const mode = aiMode.value
  const subjectId = manualSubjectId.value || filteredSubjects.value[0]?.id
  const subjectName = filteredSubjects.value.find(s => s.id === subjectId)?.name || '未知科目'
  const vis = effectiveVisibility.value
  const teamId = effectiveTeamId.value || undefined
  const docContent_ = docContent.value
  if (!subjectId) { errorMsg.value = '请先选择科目'; return }
  emit('close')
  const label = `AI 生成到「${subjectName}」`
  runBgUpload(label, async (progress) => {
    const bgSystemPrompt = buildAnswerSystemPrompt()

    const userPrompts: Record<string, string> = {
      query: `请根据以下内容生成 ${count} 个知识点卡片：\n${input}`,
      topic: `请围绕「${input}」这个主题，生成 ${count} 个有趣且有价值的知识点卡片，内容要丰富多样、角度新颖：`,
      book: `请从书籍《${input.replace(/[《》]/g, '')}》中提炼 ${count} 个核心知识点卡片：`,
      doc: `请从以下文档内容中提炼 ${count} 个核心知识点卡片：${input ? '\n补充说明：' + input : ''}\n\n文档内容：\n${docContent_}`
    }
    const resp = await fetch(getAiEndpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAiKey()}` },
      body: JSON.stringify({ model: getAiModel(), messages: [{ role: 'system', content: bgSystemPrompt }, { role: 'user', content: userPrompts[mode] || userPrompts.query }], temperature: 0.7 })
    })
    const data = await resp.json()
    const content = data.choices?.[0]?.message?.content || ''
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('AI返回格式异常')
    const items = JSON.parse(jsonMatch[0])
    let done = 0, failed = 0
    for (const item of items) {
      if (!item.title || !item.question || !item.answer) continue
      let answer = ''
      if (item.answer && typeof item.answer === 'object' && validateTieredAnswer(item.answer)) {
        answer = JSON.stringify(item.answer)
      } else if (typeof item.answer === 'object' && validateStructuredAnswer(item.answer)) {
        answer = JSON.stringify(item.answer)
      } else if (typeof item.answer === 'string') {
        answer = normalizeKnowledgeContent(item.answer)
      } else {
        answer = normalizeKnowledgeContent(JSON.stringify(item.answer))
      }
      const point = await getApi().createPoint({ subject_id: subjectId, title: item.title, category: item.category || '', question: item.question, answer, visibility: vis, team_id: teamId })
      if (point?.review_status === 'rejected') { failed++ } else { done++; await cloneToMine(point) }
      progress(done)
    }
    return { done, failed }
  })
}

async function generate() {
  if (aiMode.value === 'doc') {
    if (getDocUsageToday() >= DOC_DAILY_LIMIT) {
      errorMsg.value = `今日文档识别次数已用完（${DOC_DAILY_LIMIT}次/天）`
      return
    }
  }
  generating.value = true
  errorMsg.value = ''
  results.value = []

  const subjectList = props.subjects.map(s => s.name).join('、')

  const systemPrompt = buildAnswerSystemPrompt(subjectList)

  const userPrompt = aiMode.value === 'query'
    ? `请根据以下问题生成${aiCount.value}个知识点卡片：\n${aiInput.value}`
    : aiMode.value === 'topic'
    ? `请围绕「${aiInput.value}」这个主题，生成${aiCount.value}个有趣且有价值的知识点卡片，内容要丰富多样、角度新颖：`
    : aiMode.value === 'doc'
    ? `请从以下文档内容中提炼${aiCount.value}个核心知识点卡片：${aiInput.value ? '\n补充说明：' + aiInput.value : ''}\n\n文档内容：\n${docContent.value}`
    : `请从《${aiInput.value.replace(/[《》]/g, '')}》这本书中提炼${aiCount.value}个核心知识点卡片：`

  try {
    const resp = await fetch(aiEndpoint.value, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiKey.value}`
      },
      body: JSON.stringify({
        model: aiModel.value,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7
      })
    })

    if (!resp.ok) {
      const errText = await resp.text()
      throw new Error(`API 错误 ${resp.status}: ${errText.slice(0, 100)}`)
    }

    const data = await resp.json()
    const content = data.choices?.[0]?.message?.content || ''

    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('AI 返回格式异常，请重试')

    const parsed = JSON.parse(jsonMatch[0]) as any[]
    const subjectNameMap = new Map(props.subjects.map(s => [s.name, s.id]))

    results.value = parsed.map(p => {
      let subjectId = subjectNameMap.get(p.subject || '') || ''
      if (!subjectId) {
        subjectId = matchSubject(p.title || '', p.category || '', p.question || '')
      }
      let answer = ''
      if (p.answer && typeof p.answer === 'object' && validateTieredAnswer(p.answer)) {
        answer = JSON.stringify(p.answer)
      } else if (p.answer && typeof p.answer === 'object' && validateStructuredAnswer(p.answer)) {
        answer = JSON.stringify(p.answer)
      } else if (typeof p.answer === 'string') {
        answer = normalizeKnowledgeContent(p.answer)
      } else {
        answer = normalizeKnowledgeContent(JSON.stringify(p.answer))
      }
      return {
        title: p.title || '',
        category: p.category || '',
        question: p.question || '',
        answer,
        subject_id: subjectId,
        checked: true
      }
    })
    if (aiMode.value === 'doc') incrementDocUsage()
  } catch (e: any) {
    errorMsg.value = e.message || '生成失败'
  } finally {
    generating.value = false
  }
}

async function uploadSelected() {
  uploading.value = true
  errorMsg.value = ''
  const selected = results.value.filter(r => r.checked)
  let success = 0
  let rejected = 0
  try {
    for (const r of selected) {
      const point = await getApi().createPoint({
        subject_id: r.subject_id,
        title: r.title,
        category: r.category,
        question: r.question,
        answer: normalizeKnowledgeContent(r.answer),
        visibility: effectiveVisibility.value,
        team_id: effectiveTeamId.value || undefined
      })
      if (point?.review_status === 'rejected') {
        rejected++
      } else {
        success++
        await cloneToMine(point)
      }
    }
    results.value = results.value.filter(r => !r.checked)
    if (results.value.length === 0 && rejected === 0) {
      emit('saved')
      emit('close')
    }
    let msg = `成功上传 ${success} 个知识点`
    if (rejected > 0) msg += `，${rejected} 个未通过审核`
    alert(msg)
    if (success > 0) emit('saved')
  } catch (e: any) {
    errorMsg.value = `已上传 ${success} 个，失败：${e.message}`
  } finally {
    uploading.value = false
  }
}
</script>

<style scoped>
.upload-overlay { position: fixed; inset: 0; background: var(--overlay); z-index: 300; display: flex; align-items: flex-end; }
.upload-panel { background: var(--card-bg); width: 100%; max-width: 430px; margin: 0 auto; border-radius: var(--radius-modal) var(--radius-modal) 0 0; padding: 20px 16px 40px; max-height: 90vh; overflow-y: auto; -webkit-overflow-scrolling: touch; }
.upload-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.upload-header h3 { font-size: 18px; font-weight: 700; }
.close-btn { font-size: 20px; cursor: pointer; color: var(--gray-400); }

.tab-bar-inner { display: flex; gap: 0; margin-bottom: 16px; border-bottom: 2px solid var(--gray-200); }

.library-selector { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; padding: 10px 14px; background: var(--gray-50); border-radius: 12px; }
.library-selector label { font-size: 14px; font-weight: 600; color: var(--gray-600); flex-shrink: 0; }
.library-select { flex: 1; padding: 10px 12px; border: 1px solid var(--gray-200); border-radius: var(--radius-sm); font-size: 15px; font-weight: 500; background: var(--card-bg); color: var(--gray-900); }
.tab-item { flex: 1; text-align: center; padding: 10px 0; font-size: 15px; font-weight: 600; color: var(--gray-400); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 0.2s; }
.tab-item.active { color: var(--primary); border-bottom-color: var(--primary); }

.field { margin-bottom: 14px; }
.field label { display: block; font-size: 13px; font-weight: 600; color: var(--gray-600); margin-bottom: 5px; }
.field input, .field textarea { width: 100%; padding: 10px 12px; border: 1px solid var(--gray-200); border-radius: var(--radius-sm); font-size: 14px; font-family: inherit; resize: vertical; box-sizing: border-box; }
.field input:focus, .field textarea:focus { outline: none; border-color: var(--primary); }
.field-select { width: 100%; padding: 10px 12px; border: 1px solid var(--gray-200); border-radius: var(--radius-sm); font-size: 14px; background: var(--card-bg); }

.mode-chips { display: flex; gap: 6px; margin-bottom: 10px; }
.mode-chip { flex: 1; text-align: center; padding: 6px 0; border-radius: 20px; font-size: 13px; font-weight: 500; background: var(--glass); border: 1px solid var(--glass-border); color: var(--gray-600); cursor: pointer; transition: all 0.2s; white-space: nowrap; }
.mode-chip.active { background: var(--primary); color: white; border-color: var(--primary); }

.generate-btn { margin-bottom: 8px; }
.bg-btn { width: 100%; padding: 12px; background: var(--gray-100); color: var(--gray-700); border: 1px solid var(--gray-200); border-radius: var(--radius); font-size: 14px; font-weight: 600; cursor: pointer; margin-bottom: 8px; }
.bg-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.bg-btn:active { background: var(--gray-200); }
.ai-form textarea { width: 100%; padding: 12px; border: 1px solid var(--gray-200); border-radius: var(--radius-sm); font-size: 14px; font-family: inherit; resize: none; box-sizing: border-box; }
.ai-form textarea:focus { outline: none; border-color: var(--primary); }

.generate-btn { margin-top: 10px; }

.doc-upload-area { margin-bottom: 10px; }
.doc-drop-zone { border: 2px dashed var(--gray-300); border-radius: var(--radius-sm); padding: 24px 16px; text-align: center; cursor: pointer; transition: border-color 0.2s; }
.doc-drop-zone:active { border-color: var(--primary); }
.file-input-hidden { display: none; }
.doc-icon { font-size: 36px; margin-bottom: 8px; }
.doc-hint { font-size: 14px; font-weight: 500; color: var(--gray-700); margin-bottom: 4px; }
.doc-formats { font-size: 12px; color: var(--gray-400); }
.doc-limit { font-size: 12px; color: var(--gray-400); margin-top: 4px; }
.doc-file-info { display: flex; align-items: center; gap: 8px; padding: 12px; background: var(--gray-50); border-radius: var(--radius-sm); margin-bottom: 8px; }
.doc-file-name { flex: 1; font-size: 14px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.doc-file-size { font-size: 12px; color: var(--gray-400); flex-shrink: 0; }
.doc-remove { font-size: 16px; color: var(--gray-400); cursor: pointer; padding: 2px 6px; flex-shrink: 0; }
.doc-upload-area textarea { width: 100%; padding: 10px 12px; border: 1px solid var(--gray-200); border-radius: var(--radius-sm); font-size: 14px; font-family: inherit; resize: none; box-sizing: border-box; }
.doc-upload-area textarea:focus { outline: none; border-color: var(--primary); }

.count-row { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding: 10px 0; }
.count-label { font-size: 14px; font-weight: 500; color: var(--gray-700); }
.count-input { width: 64px; padding: 6px 10px; border: 1px solid var(--gray-200); border-radius: var(--radius-sm); font-size: 16px; font-weight: 600; color: var(--primary); text-align: center; font-family: inherit; }
.count-input:focus { outline: none; border-color: var(--primary); }

.error-msg { color: var(--red); font-size: 13px; text-align: center; padding: 8px 0; }

.primary-btn { width: 100%; padding: 14px; background: var(--primary); color: white; border: none; border-radius: var(--radius-btn); font-size: 16px; font-weight: 600; cursor: pointer; }
.primary-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.ai-results { margin-top: 16px; }
.results-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 14px; color: var(--gray-600); }
.select-all { color: var(--primary); font-weight: 600; cursor: pointer; }

.result-card { display: flex; gap: 10px; padding: 14px; background: var(--gray-50); border-radius: 12px; border: 2px solid transparent; margin-bottom: 8px; cursor: pointer; transition: border-color 0.2s; }
.result-card.checked { border-color: var(--primary); background: rgba(37,99,235,0.04); }
.result-check { width: 24px; height: 24px; border-radius: 50%; border: 2px solid var(--gray-300); display: flex; align-items: center; justify-content: center; font-size: 14px; color: white; flex-shrink: 0; margin-top: 2px; }
.result-card.checked .result-check { background: var(--primary); border-color: var(--primary); }
.result-body { flex: 1; min-width: 0; }
.result-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 4px; }
.result-title { font-size: 15px; font-weight: 600; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.result-subject-select { flex-shrink: 0; padding: 3px 6px; border: 1px solid var(--gray-200); border-radius: 6px; font-size: 12px; background: var(--card-bg); color: var(--gray-600); max-width: 100px; }
.result-category { font-size: 12px; color: var(--gray-400); margin-bottom: 6px; }
.result-q { font-size: 14px; color: var(--gray-600); line-height: 1.6; }
.result-a { font-size: 13px; color: var(--gray-500); line-height: 1.7; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--gray-200); }
.result-toggle { font-size: 12px; color: var(--primary); cursor: pointer; display: inline-block; margin-top: 6px; }

.batch-section { margin-bottom: 10px; }
.batch-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.batch-title { font-size: 14px; font-weight: 600; color: var(--gray-700); }
.batch-template { font-size: 13px; color: var(--primary); cursor: pointer; font-weight: 500; }
.batch-template:active { opacity: 0.7; }

.batch-drop-zone { border: 2px dashed var(--gray-300); border-radius: 12px; padding: 24px 16px; text-align: center; cursor: pointer; transition: border-color 0.2s; }
.batch-drop-zone:active { border-color: var(--primary); }
.batch-icon { font-size: 32px; margin-bottom: 8px; }
.batch-hint { font-size: 14px; font-weight: 500; color: var(--gray-700); margin-bottom: 4px; }
.batch-formats { font-size: 12px; color: var(--gray-400); }

.batch-preview { background: var(--gray-50); border-radius: 12px; padding: 14px; }
.batch-info { display: flex; justify-content: space-between; align-items: center; font-size: 14px; color: var(--gray-700); margin-bottom: 10px; }
.batch-clear { font-size: 13px; color: var(--red); cursor: pointer; }
.batch-list { margin-bottom: 12px; }
.batch-item { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--gray-200); }
.batch-idx { font-size: 12px; color: var(--gray-400); width: 20px; text-align: center; flex-shrink: 0; }
.batch-item-title { font-size: 14px; color: var(--gray-700); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.batch-more { font-size: 13px; color: var(--gray-400); text-align: center; padding: 8px 0; }
</style>
