<template>
  <div class="page review-page">
    <div v-if="store.currentPoint" class="review-content">
      <div class="review-header">
        <span class="suspend-btn" @click="suspend">不再出现</span>
        <div class="review-counter">{{ store.completedCount + 1 }} / {{ store.totalCount }}</div>
        <div class="review-actions">
          <span class="action-icon" :class="{ favorited: store.currentPoint.favorited }" @click="toggleFav"><span class="fav-label">{{ store.currentPoint.favorited ? '已标重点' : '标为重点' }}</span></span>
        </div>
      </div>

      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>

      <div class="review-body" :class="{ switching }">
        <div class="concept-info">
          <h1 class="concept-title">{{ store.currentPoint.title }}</h1>
          <p class="concept-category">
            <span class="subject-dot" :style="{ background: store.currentPoint.subject_color }"></span>
            {{ store.currentPoint.subject_name }} · {{ store.currentPoint.category }}
          </p>
        </div>

        <!-- 选择题模式 -->
        <template v-if="choiceData">
          <div class="choice-card">
            <img v-if="choiceData.image" :src="choiceImageUrl" class="choice-image" />
            <p class="choice-text">{{ choiceData.text }}</p>
          </div>
          <div class="choice-options">
            <button v-for="(opt, idx) in choiceData.choices" :key="idx"
              class="choice-btn"
              :class="{
                correct: choiceAnswered && idx === choiceData.correctIdx,
                wrong: choiceAnswered && idx === choiceSelected && idx !== choiceData.correctIdx,
                dim: choiceAnswered && idx !== choiceData.correctIdx && idx !== choiceSelected
              }"
              :disabled="choiceAnswered"
              @click="selectChoice(Number(idx))">
              <span class="choice-label">{{ ['A','B','C','D'][Number(idx)] }}</span>
              <span class="choice-content">{{ opt }}</span>
            </button>
          </div>
          <div v-if="choiceAnswered" class="choice-explain">
            <div class="choice-result" :class="choiceCorrect ? 'correct' : 'wrong'">
              {{ choiceCorrect ? '回答正确' : '回答错误' }}
            </div>
            <p class="choice-explanation">{{ choiceData.explanation }}</p>
            <button class="choice-next-btn" @click="choiceNext">下一题 →</button>
          </div>
        </template>

        <!-- 翻卡片模式（普通文字题） -->
        <template v-else>
        <div class="flash-card" @click="handleFlip"
          @pointerdown="onSwipeStart" @pointerup="onSwipeEnd">
          <div class="card-wrap" :class="flipStage" @animationend="onAnimEnd">
            <div v-if="!flipped" class="card-front">
              <div class="card-question md-content" v-html="renderMd(store.currentPoint.question)"></div>
              <p class="card-hint">点击显示答案</p>
              <p v-if="prevStack.length > 0" class="swipe-hint">→ 右滑查看上一题</p>
            </div>
            <div v-else class="card-back">
              <AnswerRenderer class="card-answer" :answer="store.currentPoint.answer" />
              <p class="card-hint-back">点击收起答案</p>
            </div>
          </div>
        </div>

        <div v-if="!flipped" class="memory-history">
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
        </template>
      </div>

      <div v-if="!choiceData" class="rating-buttons" :class="{ visible: flipped }">
        <button class="rate-btn rate-forgot" @click="rate(0)">忘记</button>
        <button class="rate-btn rate-fuzzy" @click="rate(1)">模糊</button>
        <button class="rate-btn rate-known" @click="rate(2)">认识</button>
      </div>

      <div v-if="showingPrev && prevPoint" class="prev-overlay" @click="hidePrev"
        @pointerdown="onSwipeStart" @pointerup="onSwipeEnd">
        <div class="prev-card" @click.stop>
          <div class="prev-header">
            <span class="prev-label">上一题</span>
            <span class="prev-rating" :style="{ background: ratingColors[prevPoint._rating] }">{{ ratingLabels[prevPoint._rating] }}</span>
            <span class="prev-close" @click="hidePrev">✕</span>
          </div>
          <h3 class="prev-title">{{ prevPoint.title }}</h3>
          <p class="prev-subject">{{ prevPoint.subject_name }} · {{ prevPoint.category }}</p>
          <div class="prev-section">
            <div class="prev-section-label">问题</div>
            <div class="md-content" v-html="renderMd(prevPoint.question)"></div>
          </div>
          <div class="prev-section">
            <div class="prev-section-label">答案</div>
            <AnswerRenderer :answer="prevPoint.answer" />
          </div>
          <p class="prev-hint">左滑返回当前题</p>
        </div>
      </div>
    </div>

    <div v-else-if="store.sessionDone" class="done-page">
      <div class="done-content">
        <div class="done-icon">🎉</div>
        <h2 class="done-title">复习完成！</h2>

        <div class="done-stats">
          <div class="done-stat">
            <span class="done-stat-value">{{ sessionStats.total }}</span>
            <span class="done-stat-label">总题数</span>
          </div>
          <div class="done-stat">
            <span class="done-stat-value done-green">{{ sessionStats.known }}</span>
            <span class="done-stat-label">认识</span>
          </div>
          <div class="done-stat">
            <span class="done-stat-value done-orange">{{ sessionStats.fuzzy }}</span>
            <span class="done-stat-label">模糊</span>
          </div>
          <div class="done-stat">
            <span class="done-stat-value done-red">{{ sessionStats.forgot }}</span>
            <span class="done-stat-label">忘记</span>
          </div>
        </div>

        <div class="done-accuracy">
          <div class="accuracy-bar">
            <div class="accuracy-fill accuracy-green" :style="{ width: sessionStats.knownPct + '%' }"></div>
            <div class="accuracy-fill accuracy-orange" :style="{ width: sessionStats.fuzzyPct + '%' }"></div>
            <div class="accuracy-fill accuracy-red" :style="{ width: sessionStats.forgotPct + '%' }"></div>
          </div>
          <div class="accuracy-label">正确率 {{ sessionStats.knownPct }}%</div>
        </div>

        <div class="done-actions">
          <button class="done-btn done-primary" @click="$router.push('/library')">返回知识库</button>
          <button class="done-btn done-share" @click="shareResult">分享成绩</button>
        </div>
      </div>

      <canvas ref="shareCanvas" style="display:none" width="640" height="480"></canvas>
    </div>

    <div v-else class="empty-review">
      <img src="/logo.png" class="empty-logo" />
      <h2>开始今日复习</h2>
      <p>前往知识库选择想复习的学科和数量，开始你的复习之旅吧。</p>
      <button class="back-library-btn" @click="$router.push('/library')">前往知识库选择</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { store } from '../store'
import { getApi } from '../apiSwitch'
import { renderMd } from '../utils/markdown'
import AnswerRenderer from '../components/AnswerRenderer.vue'
// @ts-ignore
import QRCode from 'qrcode'

defineOptions({ name: 'ReviewView' })

const flipped = ref(false)
const flipStage = ref<'' | 'flip-out' | 'flip-in'>('')
const switching = ref(false)
const showHistory = ref(true)
const reviewHistory = ref<any[]>([])
const shareCanvas = ref<HTMLCanvasElement | null>(null)
const sessionRatings = reactive(new Map<string, number>())
const prevStack = reactive<any[]>([])
const showingPrev = ref(false)
const prevPoint = ref<any>(null)

const ratingColors: Record<number, string> = { 0: '#E74C3C', 1: '#F39C12', 2: '#27AE60' }
const ratingLabels: Record<number, string> = { 0: '忘记', 1: '模糊', 2: '认识' }

// 选择题模式
const choiceSelected = ref(-1)
const choiceAnswered = ref(false)
const choiceCorrect = ref(false)

const choiceData = computed(() => {
  const q = store.currentPoint?.question
  if (!q) return null
  try {
    if (q.trimStart().startsWith('{')) {
      const parsed = JSON.parse(q)
      if (parsed?.type === 'choice') return parsed
    }
  } catch {}
  return null
})

const choiceImageUrl = computed(() => {
  if (!choiceData.value?.image) return ''
  const img = choiceData.value.image
  if (img.startsWith('http')) return img
  const base = import.meta.env.BASE_URL || '/'
  return base + img
})

function selectChoice(idx: number) {
  if (choiceAnswered.value) return
  choiceSelected.value = idx
  choiceAnswered.value = true
  choiceCorrect.value = idx === choiceData.value!.correctIdx
  if (store.currentPoint) {
    sessionRatings.set(store.currentPoint.id, choiceCorrect.value ? 1 : 0)
  }
}

function choiceNext() {
  const rating = choiceCorrect.value ? 1 : 0
  choiceSelected.value = -1
  choiceAnswered.value = false
  choiceCorrect.value = false
  const hasMore = store.submitRating(rating)
  if (!hasMore) {
    store.sessionDone = true
  }
}

const progressPercent = computed(() => {
  if (store.totalCount === 0) return 0
  return Math.round(store.completedCount / store.totalCount * 100)
})

const sessionStats = computed(() => {
  const ratings = [...sessionRatings.values()]
  const known = ratings.filter(r => r === 2).length
  const fuzzy = ratings.filter(r => r === 1).length
  const forgot = ratings.filter(r => r === 0).length
  const total = ratings.length || 1
  return {
    total: ratings.length,
    known, fuzzy, forgot,
    knownPct: Math.round(known / total * 100),
    fuzzyPct: Math.round(fuzzy / total * 100),
    forgotPct: Math.round(forgot / total * 100)
  }
})

let swipeStartX = 0
let swipeStartTime = 0
let swiping = false

function onSwipeStart(e: PointerEvent) {
  swipeStartX = e.clientX
  swipeStartTime = Date.now()
  swiping = false
  try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch {}
}

function onSwipeEnd(e: PointerEvent) {
  const dx = e.clientX - swipeStartX
  const dt = Date.now() - swipeStartTime
  if (dt > 800 || Math.abs(dx) < 40) return
  swiping = true
  if (dx > 40 && !showingPrev.value && prevStack.length > 0) {
    showPrev()
  } else if (dx < -40 && showingPrev.value) {
    hidePrev()
  }
}

function showPrev() {
  prevPoint.value = prevStack[prevStack.length - 1]
  showingPrev.value = true
}

function hidePrev() {
  showingPrev.value = false
  prevPoint.value = null
}

function handleFlip() {
  if (flipStage.value || swiping) { swiping = false; return }
  flipStage.value = 'flip-out'
}

function onAnimEnd() {
  if (flipStage.value === 'flip-out') {
    flipped.value = !flipped.value
    flipStage.value = 'flip-in'
  } else {
    flipStage.value = ''
  }
}

let historyTimer: ReturnType<typeof setTimeout> | null = null

function loadHistory() {
  reviewHistory.value = []
  if (historyTimer) clearTimeout(historyTimer)
  historyTimer = setTimeout(() => {
    if (store.currentPoint) {
      getApi().getReviewHistory(store.currentPoint.id).then(h => { reviewHistory.value = h }).catch(() => {})
    }
  }, 300)
}

onMounted(() => {
  loadHistory()
})

onUnmounted(() => {
  if (historyTimer) clearTimeout(historyTimer)
})

watch(() => store.currentIndex, loadHistory)

async function switchCard(advanceFn: () => boolean) {
  switching.value = true
  await new Promise(r => setTimeout(r, 120))
  const hasMore = advanceFn()
  flipped.value = false
  flipStage.value = ''
  await nextTick()
  switching.value = false
  if (hasMore) {
    loadHistory()
  } else {
    store.sessionDone = true
    store.loadOverview()
  }
}

function rate(rating: number) {
  if (store.currentPoint) {
    prevStack.push({ ...store.currentPoint, _rating: rating })
    if (prevStack.length > 20) prevStack.shift()
    sessionRatings.set(store.currentPoint.id, rating)
  }
  switchCard(() => store.submitRating(rating))
}

function suspend() {
  switchCard(() => store.suspendPoint())
}

function toggleFav() {
  store.toggleFavorite()
}

async function shareResult() {
  const canvas = shareCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')!
  const w = 640, h = 400
  canvas.width = w
  canvas.height = h
  ctx.clearRect(0, 0, w, h)

  // 背景：白色卡片感
  ctx.fillStyle = '#F7F9FC'
  ctx.fillRect(0, 0, w, h)

  // 顶部蓝色条
  const topH = 100
  const topGrad = ctx.createLinearGradient(0, 0, w, topH)
  topGrad.addColorStop(0, '#3B82F6')
  topGrad.addColorStop(1, '#60A5FA')
  ctx.fillStyle = topGrad
  roundRectTop(ctx, 0, 0, w, topH, 0)
  ctx.fill()

  // 标题
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 26px -apple-system, PingFang SC, sans-serif'
  ctx.fillText('知记 · 今日复习', 40, 46)

  const dateStr = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
  ctx.font = '15px -apple-system, PingFang SC, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.fillText(dateStr, 40, 74)

  // 四个数据卡片
  const s = sessionStats.value
  const cards = [
    { label: '总题数', value: String(s.total), accent: '#3B82F6' },
    { label: '认识', value: String(s.known), accent: '#10B981' },
    { label: '模糊', value: String(s.fuzzy), accent: '#F59E0B' },
    { label: '忘记', value: String(s.forgot), accent: '#EF4444' }
  ]
  const cardW = 130, cardH = 100, cardGap = 12
  const cardsTotal = cards.length * cardW + (cards.length - 1) * cardGap
  const startX = (w - cardsTotal) / 2
  const cardY = topH + 24

  for (let i = 0; i < cards.length; i++) {
    const x = startX + i * (cardW + cardGap)
    // card bg
    ctx.fillStyle = '#FFFFFF'
    ctx.shadowColor = 'rgba(0,0,0,0.06)'
    ctx.shadowBlur = 12
    ctx.shadowOffsetY = 4
    roundRect(ctx, x, cardY, cardW, cardH, 14)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0

    // accent top bar
    ctx.fillStyle = cards[i].accent
    roundRectTop(ctx, x, cardY, cardW, 4, 14)
    ctx.fill()

    // value
    ctx.fillStyle = cards[i].accent
    ctx.font = `bold 38px -apple-system, PingFang SC, sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(cards[i].value, x + cardW / 2, cardY + 58)

    // label
    ctx.fillStyle = '#9BA8BA'
    ctx.font = '13px -apple-system, PingFang SC, sans-serif'
    ctx.fillText(cards[i].label, x + cardW / 2, cardY + 82)
    ctx.textAlign = 'left'
  }

  // 正确率区域
  const rateY = cardY + cardH + 24
  ctx.fillStyle = '#FFFFFF'
  ctx.shadowColor = 'rgba(0,0,0,0.05)'
  ctx.shadowBlur = 10
  ctx.shadowOffsetY = 3
  roundRect(ctx, 40, rateY, w - 80, 72, 14)
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0

  // 正确率标签
  ctx.fillStyle = '#6B7A92'
  ctx.font = '13px -apple-system, PingFang SC, sans-serif'
  ctx.fillText('正确率', 64, rateY + 26)

  ctx.fillStyle = '#3B82F6'
  ctx.font = 'bold 20px -apple-system, PingFang SC, sans-serif'
  ctx.fillText(`${s.knownPct}%`, 120, rateY + 26)

  // 进度条背景
  const barX = 64, barY2 = rateY + 40, barW = w - 80 - 48, barH = 10
  ctx.fillStyle = '#EFF2F7'
  roundRect(ctx, barX, barY2, barW, barH, 5)
  ctx.fill()

  if (s.total > 0) {
    const gw = Math.round(s.knownPct / 100 * barW)
    const ow = Math.round(s.fuzzyPct / 100 * barW)
    if (gw > 0) {
      ctx.fillStyle = '#10B981'
      roundRect(ctx, barX, barY2, gw, barH, 5)
      ctx.fill()
    }
    if (ow > 0) {
      ctx.fillStyle = '#F59E0B'
      ctx.fillRect(barX + gw, barY2, ow, barH)
    }
  }

  // 底部署名
  ctx.fillStyle = '#9BA8BA'
  ctx.font = '12px -apple-system, PingFang SC, sans-serif'
  ctx.fillText('知记 — 科学记忆，高效学习', 40, h - 18)

  // QR code
  const siteUrl = 'https://bigzeng99.github.io/zhiji/'
  try {
    const qrDataUrl = await QRCode.toDataURL(siteUrl, { width: 80, margin: 1, color: { dark: '#3B82F6', light: '#ffffff' } })
    const qrImg = new Image()
    qrImg.onload = () => {
      const qrSize = 64
      const qrX = w - 40 - qrSize
      const qrY2 = h - 20 - qrSize
      ctx.fillStyle = '#fff'
      ctx.shadowColor = 'rgba(0,0,0,0.08)'
      ctx.shadowBlur = 8
      roundRect(ctx, qrX - 6, qrY2 - 6, qrSize + 12, qrSize + 12, 10)
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.drawImage(qrImg, qrX, qrY2, qrSize, qrSize)

      ctx.fillStyle = '#9BA8BA'
      ctx.font = '11px -apple-system, PingFang SC, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('扫码体验', qrX + qrSize / 2, h - 8)
      ctx.textAlign = 'left'

      doShareCanvas(canvas)
    }
    qrImg.src = qrDataUrl
  } catch {
    doShareCanvas(canvas)
  }
}

function roundRectTop(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h)
  ctx.lineTo(x, y + h)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function doShareCanvas(canvas: HTMLCanvasElement) {
  canvas.toBlob(async (blob) => {
    if (!blob) return
    if (navigator.share && 'canShare' in navigator) {
      const file = new File([blob], 'zhiji-review.png', { type: 'image/png' })
      try {
        await navigator.share({ title: '知记复习报告', files: [file] })
      } catch { downloadBlob(blob) }
    } else {
      downloadBlob(blob)
    }
  }, 'image/png')
}

function downloadBlob(blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `zhiji-review-${new Date().toISOString().slice(0, 10)}.png`
  a.click()
  URL.revokeObjectURL(url)
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
</script>

<style scoped>
.review-page { background: transparent; position: fixed; top: 0; bottom: 0; left: 0; right: 0; overflow: hidden; padding: 0 16px; display: flex; justify-content: center; }
.review-content { display: flex; flex-direction: column; width: 100%; max-width: 430px; height: calc(100% - calc(56px + env(safe-area-inset-bottom, 16px))); overflow: hidden; padding-top: env(safe-area-inset-top, 8px); }
.review-body { display: flex; flex-direction: column; flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; transition: opacity 0.12s ease; padding-bottom: 4px; }
.review-body.switching { opacity: 0; }
.review-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; flex-shrink: 0; gap: 8px; }
.suspend-btn { font-size: 13px; color: var(--gray-500); cursor: pointer; padding: 6px 12px; border: 1px solid var(--glass-border); border-radius: 20px; background: var(--glass); -webkit-backdrop-filter: var(--glass-blur); backdrop-filter: var(--glass-blur); transition: all 0.2s; white-space: nowrap; flex-shrink: 0; box-shadow: var(--glass-glow); height: 34px; display: flex; align-items: center; }
.suspend-btn:active { background: #FDECEA; color: #EF4444; border-color: #EF4444; }
.review-counter { font-size: 14px; color: var(--gray-500); font-weight: 600; white-space: nowrap; }

.progress-bar { height: 4px; background: var(--gray-200); border-radius: 2px; margin-bottom: 4px; overflow: hidden; flex-shrink: 0; }
.progress-fill { height: 100%; background: var(--primary); border-radius: 2px; transition: width 0.3s ease; }
.review-actions { display: flex; gap: 8px; flex-shrink: 0; }
.action-icon { cursor: pointer; transition: all 0.2s; font-size: 16px; color: var(--gray-400); display: flex; align-items: center; gap: 4px; padding: 6px 12px; border-radius: 20px; background: var(--glass); -webkit-backdrop-filter: var(--glass-blur); backdrop-filter: var(--glass-blur); border: 1px solid var(--glass-border); white-space: nowrap; box-shadow: var(--glass-glow); height: 34px; }
.action-icon.favorited { color: #F59E0B; background: rgba(245, 158, 11, 0.1); border-color: rgba(245, 158, 11, 0.3); }
.fav-label { font-size: 12px; font-weight: 500; }

.concept-info { text-align: center; padding: 4px 0 12px; flex-shrink: 0; }
.concept-title { font-size: 26px; font-weight: 700; color: var(--gray-900); margin-bottom: 8px; }
.concept-category { font-size: 14px; color: var(--gray-400); display: flex; align-items: center; justify-content: center; gap: 6px; }
.subject-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }

.flash-card { perspective: 800px; cursor: pointer; margin-bottom: 16px; }
.card-wrap { transform-style: preserve-3d; }
.card-wrap.flip-out { animation: flip-out 0.2s ease-in forwards; }
.card-wrap.flip-in { animation: flip-in 0.25s ease-out forwards; }
@keyframes flip-out { from { transform: rotateY(0deg); } to { transform: rotateY(90deg); } }
@keyframes flip-in { from { transform: rotateY(-90deg); } to { transform: rotateY(0deg); } }
.card-front, .card-back { border-radius: var(--radius-lg); padding: 28px; background: var(--card-bg); border: 1px solid var(--border-color); box-shadow: var(--shadow); }
.card-front { min-height: 180px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.card-back { }
.card-question { font-size: 16px; font-weight: 600; color: var(--gray-700); margin-bottom: 12px; line-height: 1.6; text-align: center; }
.card-hint { font-size: 14px; color: var(--gray-400); }
.swipe-hint { font-size: 11px; color: var(--gray-300); margin-top: 8px; }
.card-hint-back { font-size: 13px; color: var(--gray-400); text-align: center; margin-top: 16px; }
.card-answer { font-size: 14px; color: var(--gray-700); line-height: 1.7; text-align: left; }

.rating-buttons { display: flex; gap: 10px; flex-shrink: 0; padding: 10px 0 12px; background: var(--bg); visibility: hidden; pointer-events: none; }
.rating-buttons.visible { visibility: visible; pointer-events: auto; }
.rate-btn { flex: 1; padding: 14px 8px; border: none; border-radius: var(--radius-btn); font-size: 15px; font-weight: 600; cursor: pointer; transition: transform 0.15s; height: 48px; box-sizing: border-box; }
.rate-btn:active { transform: scale(0.95); }
.rate-forgot { background: rgba(239, 68, 68, 0.12); color: var(--red); }
.rate-fuzzy { background: rgba(245, 158, 11, 0.12); color: var(--orange); }
.rate-known { background: rgba(16, 185, 129, 0.12); color: var(--green); }

.memory-history { background: var(--card-bg); border-radius: var(--radius); border: 1px solid var(--border-color); overflow: hidden; flex-shrink: 0; box-shadow: var(--shadow); }
.history-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; cursor: pointer; font-size: 15px; font-weight: 600; }
.expand-icon { color: var(--gray-400); }
.history-content { padding: 0 16px 14px; }
.history-date { font-size: 13px; color: var(--gray-500); margin-bottom: 10px; }
.history-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.htag { font-size: 11px; padding: 3px 10px; border-radius: 4px; font-weight: 500; }
.history-empty { font-size: 13px; color: var(--gray-400); }

.empty-review { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; min-height: 60dvh; text-align: center; padding: 32px; }
.empty-logo { width: 80px; height: 80px; margin-bottom: 16px; }
.empty-review h2 { font-size: 22px; color: var(--gray-900); margin-bottom: 8px; }
.empty-review p { font-size: 14px; color: var(--gray-500); margin-bottom: 24px; }
.back-library-btn { padding: 12px 32px; background: var(--primary); color: white; border: none; border-radius: var(--radius-btn); font-size: 16px; font-weight: 600; cursor: pointer; }

.done-page { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 70vh; padding: 24px; }
.done-content { width: 100%; max-width: 380px; text-align: center; }
.done-icon { font-size: 56px; margin-bottom: 8px; }
.done-title { font-size: 24px; font-weight: 700; color: var(--gray-900); margin-bottom: 24px; }

.done-stats { display: flex; gap: 12px; margin-bottom: 20px; }
.done-stat { flex: 1; background: var(--gray-50); border: 1px solid var(--border-color); border-radius: var(--radius-btn); padding: 16px 8px; box-shadow: none; }
.done-stat-value { display: block; font-size: 28px; font-weight: 700; color: var(--gray-900); }
.done-stat-label { font-size: 12px; color: var(--gray-500); }
.done-green { color: var(--green); }
.done-orange { color: var(--orange); }
.done-red { color: var(--red); }

.done-accuracy { margin-bottom: 28px; width: 100%; }
.accuracy-bar { height: 12px; background: var(--gray-200); border-radius: 6px; overflow: hidden; display: flex; margin-bottom: 8px; }
.accuracy-fill { height: 100%; transition: width 0.5s ease; }
.accuracy-green { background: var(--green); }
.accuracy-orange { background: var(--orange); }
.accuracy-red { background: var(--red); }
.accuracy-label { font-size: 14px; color: var(--gray-500); font-weight: 600; }

.done-actions { display: flex; gap: 12px; width: 100%; }
.done-btn { padding: 14px; border: none; border-radius: var(--radius-btn); font-size: 15px; font-weight: 600; cursor: pointer; height: 48px; box-sizing: border-box; white-space: nowrap; }
.done-primary { flex: 1; }
.done-share { flex: 1; }
.done-primary { background: var(--primary); color: white; }
.done-share { background: var(--gray-100); color: var(--gray-700); }
.done-btn:active { opacity: 0.85; }

.prev-overlay { position: fixed; inset: 0; z-index: 50; background: var(--overlay); display: flex; align-items: center; justify-content: center; padding: 24px; animation: fadeIn 0.2s ease; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.prev-card { background: var(--card-bg); border-radius: var(--radius-lg); padding: 24px; max-width: 400px; width: 100%; max-height: 80vh; overflow-y: auto; box-shadow: var(--shadow-lg); animation: slideUp 0.25s ease; }
@keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
.prev-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.prev-label { font-size: 13px; color: var(--gray-400); font-weight: 600; }
.prev-rating { font-size: 11px; color: white; padding: 2px 10px; border-radius: 999px; font-weight: 600; }
.prev-close { margin-left: auto; font-size: 18px; color: var(--gray-400); cursor: pointer; padding: 4px; }
.prev-title { font-size: 20px; font-weight: 700; color: var(--gray-900); margin-bottom: 6px; }
.prev-subject { font-size: 13px; color: var(--gray-400); margin-bottom: 16px; }
.prev-section { margin-bottom: 14px; }
.prev-section-label { font-size: 12px; font-weight: 600; color: var(--primary); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
.prev-hint { text-align: center; font-size: 12px; color: var(--gray-400); margin-top: 12px; }

/* 选择题模式 */
.choice-card { background: var(--card-bg); border-radius: var(--radius-lg); border: 1px solid var(--border-color); box-shadow: var(--shadow); overflow: hidden; margin-bottom: 16px; }
.choice-image { width: 100%; aspect-ratio: 1; object-fit: contain; background: var(--gray-100); display: block; padding: 24px 32px; max-height: 50vh; }
.choice-text { font-size: 16px; font-weight: 600; color: var(--gray-900); padding: 16px 20px; line-height: 1.6; }

.choice-options { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
.choice-btn { display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: var(--card-bg); border: 2px solid var(--border-color); border-radius: var(--radius-btn); cursor: pointer; text-align: left; transition: all 0.15s; font-size: 15px; }
.choice-btn:active:not(:disabled) { transform: scale(0.98); }
.choice-btn.correct { border-color: var(--green); background: rgba(16, 185, 129, 0.08); }
.choice-btn.wrong { border-color: var(--red); background: rgba(239, 68, 68, 0.08); }
.choice-btn.dim { opacity: 0.4; }
.choice-label { width: 28px; height: 28px; border-radius: 50%; background: var(--gray-100); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: var(--gray-600); flex-shrink: 0; }
.choice-btn.correct .choice-label { background: var(--green); color: white; }
.choice-btn.wrong .choice-label { background: var(--red); color: white; }
.choice-content { flex: 1; color: var(--gray-700); font-weight: 500; }

.choice-explain { background: var(--card-bg); border-radius: var(--radius); border: 1px solid var(--border-color); padding: 16px; }
.choice-result { font-size: 16px; font-weight: 700; margin-bottom: 10px; }
.choice-result.correct { color: var(--green); }
.choice-result.wrong { color: var(--red); }
.choice-explanation { font-size: 14px; color: var(--gray-600); line-height: 1.7; margin-bottom: 16px; }
.choice-next-btn { width: 100%; padding: 12px; background: var(--primary); color: white; border: none; border-radius: var(--radius-btn); font-size: 15px; font-weight: 600; cursor: pointer; }
</style>
