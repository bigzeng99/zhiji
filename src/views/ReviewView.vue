<template>
  <div class="page review-page">
    <div v-if="store.currentPoint" class="review-content">
      <div class="review-header">
        <span class="suspend-btn" @click="suspend">🚫 不再出现</span>
        <div class="review-counter">{{ store.completedCount + 1 }} / {{ store.totalCount }}</div>
        <div class="review-actions">
          <span class="action-icon" :class="{ favorited: store.currentPoint.favorited }" @click="toggleFav">{{ store.currentPoint.favorited ? '★' : '☆' }}</span>
        </div>
      </div>

      <div class="concept-info">
        <h1 class="concept-title">{{ store.currentPoint.title }}</h1>
        <p class="concept-category">
          <span class="subject-dot" :style="{ background: store.currentPoint.subject_color }"></span>
          {{ store.currentPoint.subject_name }} · {{ store.currentPoint.category }}
        </p>
      </div>

      <div class="flash-card" :class="{ flipped }" @click="flipped = !flipped">
        <div class="card-inner">
          <div class="card-front">
            <p class="card-question">{{ store.currentPoint.question }}</p>
            <p class="card-hint">点击屏幕显示答案</p>
          </div>
          <div class="card-back">
            <p class="card-answer">{{ store.currentPoint.answer }}</p>
          </div>
        </div>
      </div>

      <div v-if="flipped" class="rating-buttons">
        <button class="rate-btn rate-forgot" @click="rate(0)">😕 忘记</button>
        <button class="rate-btn rate-fuzzy" @click="rate(1)">🤔 模糊</button>
        <button class="rate-btn rate-known" @click="rate(2)">😊 认识</button>
      </div>

      <div class="memory-history">
        <div class="history-header" @click="showHistory = !showHistory">
          <span>📌 记忆历史</span>
          <span class="expand-icon">{{ showHistory ? '∧' : '∨' }}</span>
        </div>
        <div v-if="showHistory" class="history-content">
          <div v-if="reviewHistory.length > 0">
            <p class="history-date">共复习 {{ reviewHistory.length }} 次 · 当前间隔 {{ store.currentPoint.interval }} 天</p>
            <div class="history-tags">
              <span v-for="(r, i) in reviewHistory.slice(0, 8)" :key="r.id" class="htag"
                :style="{ background: ratingColors[r.rating], color: '#fff' }">
                第{{ reviewHistory.length - i }}次 · {{ ratingLabels[r.rating] }}
              </span>
            </div>
          </div>
          <p v-else class="history-empty">首次学习此知识点</p>
        </div>
      </div>
    </div>

    <div v-else class="empty-review">
      <div class="empty-icon">🎉</div>
      <h2>今日复习已完成！</h2>
      <p>太棒了，所有待复习的知识点都已完成。</p>
      <button class="back-library-btn" @click="$router.push('/library')">返回知识库</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { store } from '../store'
import { api } from '../db'

const flipped = ref(false)
const showHistory = ref(true)
const reviewHistory = ref<any[]>([])

const ratingColors: Record<number, string> = { 0: '#E74C3C', 1: '#F39C12', 2: '#27AE60' }
const ratingLabels: Record<number, string> = { 0: '忘记', 1: '模糊', 2: '认识' }

async function loadHistory() {
  if (store.currentPoint) {
    reviewHistory.value = await api.getReviewHistory(store.currentPoint.id)
  }
}

onMounted(async () => {
  if (store.reviewQueue.length === 0) {
    const limit = store.dailyLimit > 0 ? store.dailyLimit : undefined
    await store.loadReviewQueue(undefined, limit)
  }
  loadHistory()
})

watch(() => store.currentIndex, loadHistory)
watch(() => store.completedCount, loadHistory)

async function rate(rating: number) {
  flipped.value = false
  const hasMore = await store.submitRating(rating)
  if (hasMore) {
    loadHistory()
  }
  store.loadOverview()
}

async function suspend() {
  flipped.value = false
  const hasMore = await store.suspendPoint()
  if (hasMore) {
    loadHistory()
  }
  store.loadOverview()
}

async function toggleFav() {
  await store.toggleFavorite()
}
</script>

<style scoped>
.review-page { background: var(--white); }
.review-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; }
.suspend-btn { font-size: 13px; color: var(--gray-500); cursor: pointer; padding: 4px 10px; border: 1px solid var(--gray-200); border-radius: 16px; background: var(--gray-50); transition: all 0.2s; }
.suspend-btn:active { background: #FDECEA; color: #C0392B; border-color: #E74C3C; }
.review-counter { font-size: 14px; color: var(--gray-500); font-weight: 600; }
.review-actions { display: flex; gap: 16px; font-size: 22px; color: var(--gray-400); }
.action-icon { cursor: pointer; transition: color 0.2s; }
.action-icon.favorited { color: #F39C12; }

.concept-info { text-align: center; padding: 8px 0 20px; }
.concept-title { font-size: 24px; font-weight: 700; color: var(--gray-900); margin-bottom: 6px; }
.concept-category { font-size: 14px; color: var(--gray-400); display: flex; align-items: center; justify-content: center; gap: 6px; }
.subject-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }

.flash-card { perspective: 1000px; cursor: pointer; margin-bottom: 20px; min-height: 220px; }
.card-inner { position: relative; width: 100%; min-height: 220px; transition: transform 0.6s; transform-style: preserve-3d; }
.flash-card.flipped .card-inner { transform: rotateY(180deg); }
.card-front, .card-back { position: absolute; inset: 0; backface-visibility: hidden; border-radius: var(--radius-lg); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; }
.card-front { background: var(--gray-50); border: 1px solid var(--gray-200); }
.card-back { background: var(--primary-bg); border: 1px solid #C5D5E8; transform: rotateY(180deg); }
.card-question { font-size: 17px; font-weight: 600; color: var(--gray-700); margin-bottom: 12px; line-height: 1.6; text-align: center; }
.card-hint { font-size: 14px; color: var(--gray-400); }
.card-answer { font-size: 15px; color: var(--gray-700); line-height: 1.7; text-align: left; }

.rating-buttons { display: flex; gap: 10px; margin-bottom: 20px; }
.rate-btn { flex: 1; padding: 12px 8px; border: none; border-radius: var(--radius); font-size: 14px; font-weight: 600; cursor: pointer; transition: transform 0.15s; }
.rate-btn:active { transform: scale(0.95); }
.rate-forgot { background: #FDECEA; color: #C0392B; }
.rate-fuzzy { background: #FEF3E2; color: #E67E22; }
.rate-known { background: #E8F5E9; color: #27AE60; }

.memory-history { background: var(--gray-50); border-radius: var(--radius); border: 1px solid var(--gray-200); overflow: hidden; }
.history-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; cursor: pointer; font-size: 15px; font-weight: 600; }
.expand-icon { color: var(--gray-400); }
.history-content { padding: 0 16px 14px; }
.history-date { font-size: 13px; color: var(--gray-500); margin-bottom: 10px; }
.history-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.htag { font-size: 11px; padding: 3px 10px; border-radius: 4px; font-weight: 500; }
.history-empty { font-size: 13px; color: var(--gray-400); }

.empty-review { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; text-align: center; padding: 32px; }
.empty-icon { font-size: 64px; margin-bottom: 16px; }
.empty-review h2 { font-size: 22px; color: var(--gray-900); margin-bottom: 8px; }
.empty-review p { font-size: 14px; color: var(--gray-500); margin-bottom: 24px; }
.back-library-btn { padding: 12px 32px; background: var(--primary); color: white; border: none; border-radius: var(--radius); font-size: 16px; font-weight: 600; cursor: pointer; }
</style>
