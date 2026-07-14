<template>
  <div class="share-page">
    <div v-if="loading" class="share-loading">
      <div class="share-spinner"></div>
      <p>加载中...</p>
    </div>

    <div v-else-if="error" class="share-error">
      <div class="error-icon">📭</div>
      <h2>内容不存在</h2>
      <p>该知识点可能已被删除或链接无效</p>
      <a href="#/feed" class="share-cta">打开知记</a>
    </div>

    <div v-else-if="point" class="share-content">
      <div class="share-brand">
        <span class="brand-icon">📖</span>
        <span class="brand-name">知记</span>
      </div>

      <div class="share-card">
        <div class="share-subject" :style="{ background: subject.color + '18', color: subject.color }">
          {{ subject.icon }} {{ subject.name }}
        </div>

        <h1 class="share-title">{{ point.title }}</h1>

        <div class="share-section">
          <div class="share-label">问题</div>
          <div class="share-text md-content" v-html="questionHtml"></div>
        </div>

        <div class="share-section">
          <div class="share-label">答案</div>
          <AnswerRenderer class="share-text" :answer="point.answer" />
        </div>
      </div>

      <div class="share-footer">
        <a href="#/feed" class="share-cta">打开知记 App</a>
        <p class="share-slogan">科学记忆，高效学习</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '../supabase'
import { renderMd } from '../utils/markdown'
import AnswerRenderer from '../components/AnswerRenderer.vue'

const route = useRoute()
const loading = ref(true)
const error = ref(false)
const point = ref<any>(null)
const subject = ref<{ name: string; icon: string; color: string }>({ name: '', icon: '📚', color: '#3B82F6' })

const questionHtml = computed(() => point.value ? renderMd(point.value.question) : '')

onMounted(async () => {
  const pointId = route.params.pointId as string
  if (!pointId) { error.value = true; loading.value = false; return }

  try {
    const { data: pt } = await supabase
      .from('points')
      .select('id, title, category, question, answer, subject_id')
      .eq('id', pointId)
      .eq('status', 'active')
      .single()

    if (!pt) { error.value = true; loading.value = false; return }
    point.value = pt

    const { data: sub } = await supabase
      .from('subjects')
      .select('name, icon, color')
      .eq('id', pt.subject_id)
      .single()

    if (sub) subject.value = sub
  } catch {
    error.value = true
  }
  loading.value = false
})
</script>

<style scoped>
.share-page {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--bg, #F7F9FC);
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
}

.share-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  height: 100dvh;
  gap: 12px;
  color: var(--gray-500, #6B7280);
}

.share-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #E8EDF5;
  border-top-color: #3B82F6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg) } }

.share-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  height: 100dvh;
  text-align: center;
  padding: 24px;
}

.error-icon { font-size: 48px; margin-bottom: 16px; }

.share-error h2 {
  font-size: 20px;
  font-weight: 700;
  color: var(--gray-900, #1A2233);
  margin-bottom: 8px;
}

.share-error p {
  font-size: 14px;
  color: var(--gray-500, #6B7280);
  margin-bottom: 24px;
}

.share-content {
  max-width: 640px;
  margin: 0 auto;
  padding: 20px 16px 40px;
}

.share-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 0;
}

.brand-icon { font-size: 28px; }

.brand-name {
  font-size: 20px;
  font-weight: 700;
  color: var(--gray-900, #1A2233);
}

.share-card {
  background: var(--card-bg, #fff);
  border-radius: 16px;
  padding: 24px 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.share-subject {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 16px;
}

.share-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--gray-900, #1A2233);
  line-height: 1.4;
  margin-bottom: 20px;
}

.share-section {
  margin-bottom: 20px;
}

.share-section:last-child {
  margin-bottom: 0;
}

.share-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--gray-400, #9CA3AF);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 8px;
}

.share-text {
  font-size: 15px;
  color: var(--gray-700, #374151);
  line-height: 1.7;
}

.share-footer {
  text-align: center;
  margin-top: 32px;
}

.share-cta {
  display: inline-block;
  padding: 14px 48px;
  background: #3B82F6;
  color: #fff;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.2s;
}

.share-cta:active { background: #2563EB; }

.share-slogan {
  margin-top: 12px;
  font-size: 13px;
  color: var(--gray-400, #9CA3AF);
}
</style>
