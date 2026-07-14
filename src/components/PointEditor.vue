<template>
  <div class="editor-overlay" @click.self="$emit('close')">
    <div class="editor-panel">
      <div class="editor-header">
        <h3>{{ point ? '编辑知识点' : '添加知识点' }}</h3>
        <span class="close-btn" @click="$emit('close')">✕</span>
      </div>
      <form @submit.prevent="save">
        <div class="field">
          <label>标题 *</label>
          <input v-model="form.title" placeholder="如：马斯洛需求层次理论" required />
        </div>
        <div class="field">
          <label>分类</label>
          <input v-model="form.category" placeholder="如：动机理论" />
        </div>
        <div class="field">
          <label>问题 *</label>
          <textarea v-model="form.question" placeholder="用来记忆的问题..." rows="3" required></textarea>
        </div>
        <div class="field">
          <label>答案 *</label>
          <div v-if="isStructured" class="structured-preview">
            <AnswerRenderer :answer="form.answer" />
          </div>
          <textarea v-model="form.answer" :placeholder="isStructured ? '结构化 JSON 格式' : '问题的详细答案...'" rows="5" required></textarea>
        </div>
        <div v-if="!point && isLoggedIn" class="field">
          <label>可见性</label>
          <div class="visibility-chips">
            <span class="vis-chip" :class="{ active: form.visibility === 'private' }" @click="form.visibility = 'private'">🔒 私密</span>
            <span class="vis-chip" :class="{ active: form.visibility === 'public' }" @click="form.visibility = 'public'">🌐 公开</span>
            <span v-if="hasTeam" class="vis-chip" :class="{ active: form.visibility === 'team' }" @click="form.visibility = 'team'">👥 小组</span>
          </div>
          <div v-if="quotaInfo" class="quota-hint">
            今日剩余：{{ quotaInfo.remaining }} 次
          </div>
        </div>
        <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>
        <button type="submit" class="save-btn" :disabled="saving">{{ saving ? '保存中...' : '保存' }}</button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { getApi } from '../apiSwitch'
import { auth } from '../auth'
import { normalizeKnowledgeContent } from '../utils/markdown'
import { isStructuredAnswer } from '../utils/answerFormat'
import AnswerRenderer from './AnswerRenderer.vue'

const props = defineProps<{ point: any; subjectId: string; teamId?: string | null }>()
const emit = defineEmits(['close', 'saved'])
const saving = ref(false)
const errorMsg = ref('')
const quotaInfo = ref<any>(null)
const isLoggedIn = auth.isLoggedIn

const hasTeam = computed(() => !!props.teamId)
const isStructured = computed(() => isStructuredAnswer(form.value.answer))

const form = ref({ title: '', category: '', question: '', answer: '', visibility: props.teamId ? 'team' : 'private' })

onMounted(async () => {
  if (props.point) {
    form.value = {
      title: props.point.title,
      category: props.point.category,
      question: props.point.question,
      answer: props.point.answer,
      visibility: props.point.visibility || 'private'
    }
  }
  if (isLoggedIn.value) {
    checkQuota()
  }
})

watch(() => form.value.visibility, () => {
  if (isLoggedIn.value) checkQuota()
})

async function checkQuota() {
  const api = getApi()
  if ('checkUploadQuota' in api) {
    quotaInfo.value = await (api as any).checkUploadQuota(form.value.visibility)
  }
}

async function save() {
  saving.value = true
  errorMsg.value = ''
  try {
    const payload = {
      ...form.value,
      question: normalizeKnowledgeContent(form.value.question),
      answer: normalizeKnowledgeContent(form.value.answer)
    }
    if (props.point) {
      await getApi().updatePoint(props.point.id, payload)
    } else {
      if (isLoggedIn.value && quotaInfo.value && !quotaInfo.value.allowed) {
        errorMsg.value = quotaInfo.value.reason || '上传次数已用完'
        return
      }
      await getApi().createPoint({
        subject_id: props.subjectId,
        ...payload,
        team_id: props.teamId || undefined
      })
    }
    emit('saved')
  } catch (e: any) {
    errorMsg.value = e.message || '保存失败'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.editor-overlay { position: fixed; inset: 0; background: var(--overlay); z-index: 300; display: flex; align-items: center; justify-content: center; }
.editor-panel { background: var(--card-bg); width: 90%; max-width: 400px; border-radius: var(--radius-lg); padding: 24px; max-height: 90vh; overflow-y: auto; }
.editor-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.editor-header h3 { font-size: 18px; }
.close-btn { font-size: 20px; cursor: pointer; color: var(--gray-400); }
.field { margin-bottom: 16px; }
.field label { display: block; font-size: 14px; font-weight: 600; color: var(--gray-700); margin-bottom: 6px; }
.field input, .field textarea { width: 100%; padding: 10px 12px; border: 1px solid var(--gray-200); border-radius: var(--radius-sm); font-size: 14px; font-family: inherit; resize: vertical; box-sizing: border-box; }
.field input:focus, .field textarea:focus { outline: none; border-color: var(--primary); }

.visibility-chips { display: flex; gap: 8px; }
.vis-chip { padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 500; background: var(--glass); border: 1px solid var(--glass-border); color: var(--gray-600); cursor: pointer; transition: all 0.2s; }
.vis-chip.active { background: var(--primary); color: white; border-color: var(--primary); }

.quota-hint { font-size: 12px; color: var(--gray-400); margin-top: 6px; }
.error-msg { color: var(--red); font-size: 13px; text-align: center; margin-bottom: 10px; }

.save-btn { width: 100%; padding: 14px; background: var(--primary); color: white; border: none; border-radius: var(--radius-btn); font-size: 16px; font-weight: 600; cursor: pointer; }
.save-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.structured-preview { background: var(--gray-50); border: 1px solid var(--gray-200); border-radius: var(--radius-sm); padding: 10px 12px; margin-bottom: 8px; max-height: 200px; overflow-y: auto; font-size: 13px; }
</style>
