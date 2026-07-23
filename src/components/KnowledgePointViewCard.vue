<template>
  <div class="kpv-overlay" @click.self="$emit('close')">
    <div class="kpv-panel">
      <div class="kpv-header">
        <span class="kpv-close" @click="$emit('close')">✕</span>
      </div>
      <div class="kpv-subject" :style="{ background: (subjectColor || '#3B82F6') + '18', color: subjectColor || '#3B82F6' }">
        {{ subjectIcon }} {{ subjectName }}<template v-if="point.category"> · {{ point.category }}</template>
      </div>
      <h2 class="kpv-title">{{ point.title }}</h2>

      <div class="kpv-status-row">
        <span class="kpv-status-dot" :class="'kpv-status--' + status"></span>
        <span class="kpv-status-label">{{ statusLabel }}</span>
        <span v-if="point.repetitions > 0" class="kpv-status-meta">复习间隔 {{ point.interval }} 天</span>
      </div>

      <div class="kpv-section">
        <div class="kpv-label">问题</div>
        <div class="kpv-text md-content" v-html="renderMd(point.question)"></div>
      </div>
      <div class="kpv-section">
        <div class="kpv-label">答案</div>
        <AnswerRenderer class="kpv-text" :answer="point.answer" />
      </div>
      <div v-if="detailRich" class="kpv-section">
        <div class="kpv-label">深入解读</div>
        <p class="kpv-text"><RichTextSpan :rich="detailRich" /></p>
      </div>

      <button class="kpv-edit-btn" @click.stop="$emit('edit')">编辑</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { renderMd } from '../utils/markdown'
import { parseDetailAnswer } from '../utils/answerFormat'
import { getKnowledgeStatus } from '../utils/knowledgeMapAdapter'
import AnswerRenderer from './AnswerRenderer.vue'
import RichTextSpan from './RichTextSpan.vue'

const props = defineProps<{
  point: any
  subjectName?: string
  subjectIcon?: string
  subjectColor?: string
}>()

defineEmits<{ close: []; edit: [] }>()

const detailRich = computed(() => parseDetailAnswer(props.point.answer))

const status = computed(() => getKnowledgeStatus(props.point))

const STATUS_LABELS: Record<string, string> = {
  unlearned: '未学',
  learning: '学习中',
  mastered: '已掌握',
  review: '待复习'
}
const statusLabel = computed(() => STATUS_LABELS[status.value] || '')
</script>

<style scoped>
.kpv-overlay { position: fixed; inset: 0; background: var(--overlay); z-index: 300; display: flex; align-items: flex-end; justify-content: center; }
.kpv-panel { background: var(--card-bg); width: 100%; max-width: 430px; margin: 0 auto; border-radius: var(--radius-modal) var(--radius-modal) 0 0; padding: 0 20px 32px; max-height: 85vh; overflow-y: auto; -webkit-overflow-scrolling: touch; }
.kpv-header { display: flex; justify-content: flex-end; padding: 16px 0 8px; }
.kpv-close { font-size: 20px; cursor: pointer; color: var(--gray-400); padding: 4px; }
.kpv-subject { display: inline-block; padding: 3px 10px; border-radius: 16px; font-size: 12px; font-weight: 600; margin-bottom: 10px; }
.kpv-title { font-size: 20px; font-weight: 700; color: var(--gray-900); line-height: 1.4; margin: 0 0 12px; }

.kpv-status-row { display: flex; align-items: center; gap: 6px; margin-bottom: 18px; }
.kpv-status-dot { width: 8px; height: 8px; border-radius: 50%; }
.kpv-status--unlearned { background: var(--gray-300); }
.kpv-status--learning { background: var(--primary); }
.kpv-status--mastered { background: var(--green); }
.kpv-status--review { background: var(--orange); }
.kpv-status-label { font-size: 12px; font-weight: 600; color: var(--gray-600); }
.kpv-status-meta { font-size: 12px; color: var(--gray-400); margin-left: 4px; }

.kpv-section { margin-bottom: 18px; }
.kpv-label { font-size: 12px; font-weight: 600; color: var(--gray-400); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
.kpv-text { font-size: 15px; color: var(--gray-700); line-height: 1.7; }

.kpv-edit-btn { width: 100%; padding: 13px; background: var(--primary-bg); color: var(--primary); border: 1px solid var(--primary); border-radius: var(--radius-btn); font-size: 15px; font-weight: 600; cursor: pointer; }
.kpv-edit-btn:active { background: rgba(59,130,246,0.15); }
</style>
