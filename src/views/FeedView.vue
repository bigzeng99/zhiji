<template>
  <div class="page feed-page">
    <div class="feed-title-bar">
      <span class="title-menu-btn" @click="showDrawer = true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </span>
      <div class="feed-mode-seg">
        <span class="seg-item" :class="{ active: feedMode === 'smart' }" @click="setFeedMode('smart')">推荐</span>
        <span class="seg-item" :class="{ active: feedMode === 'random' }" @click="setFeedMode('random')">随机</span>
        <span class="seg-item" :class="{ active: feedMode === 'mine' }" @click="setFeedMode('mine')">我的</span>
      </div>
      <span class="search-btn" @click="onSearch">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      </span>
    </div>

    <!-- 左侧科目抽屉 -->
    <div v-if="showDrawer" class="drawer-overlay" @click="showDrawer = false">
      <div class="drawer-panel" @click.stop>
        <div class="drawer-header">
          <span class="drawer-title">科目筛选</span>
          <span class="drawer-close" @click="showDrawer = false">✕</span>
        </div>
        <div class="drawer-filter-list">
          <div class="drawer-item" :class="{ active: selectedAll }" @click="toggleAll">
            <span class="drawer-icon">🌐</span>
            <span class="drawer-name">全部</span>
            <span v-if="selectedAll" class="drawer-check">✓</span>
          </div>
          <div v-for="s in visibleSubjects" :key="s.id" class="drawer-item" :class="{ active: selectedIds.has(s.id) }" @click="toggleSubject(s.id)">
            <span class="drawer-icon">{{ s.icon }}</span>
            <span class="drawer-name">{{ s.name }}</span>
            <span v-if="selectedIds.has(s.id)" class="drawer-check">✓</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="loading" class="skeleton-wrap">
      <div class="skeleton-masonry">
        <div class="skeleton-col">
          <div class="skeleton-card" style="height:180px"></div>
          <div class="skeleton-card" style="height:140px"></div>
          <div class="skeleton-card" style="height:160px"></div>
        </div>
        <div class="skeleton-col">
          <div class="skeleton-card" style="height:150px"></div>
          <div class="skeleton-card" style="height:170px"></div>
          <div class="skeleton-card" style="height:130px"></div>
        </div>
      </div>
    </div>

    <template v-else>
    <div class="masonry">
      <div class="masonry-col">
        <div v-for="p in leftCol" :key="p.id" class="feed-card" @click="handleCardTap(p.id)">
          <div class="menu-btn" @click.stop="toggleMenu(p)">⋯</div>
          <div v-if="menuPointId === p.id" class="bubble-menu" @click.stop>
            <span class="bubble-btn" @click="doFavorite" :title="p.favorited ? '取消重点' : '标记重点'">{{ p.favorited ? '★' : '☆' }}</span>
            <span class="bubble-btn bubble-danger" @click="doSuspend" title="不再显示">🚫</span>
            <span class="bubble-btn bubble-warn" @click="doReport" title="举报">⚠️</span>
          </div>
          <div v-if="!flippedIds.has(p.id)" class="feed-card-front">
            <div class="card-subject" :style="{ background: p.subject_color + '18', color: p.subject_color }">{{ p.subject_icon }} {{ p.subject_name }}</div>
            <h3 class="card-title">{{ p.title }}</h3>
            <p class="card-question md-content" v-html="renderMd(p.question)"></p>
            <div class="card-bottom"><span class="card-category">{{ p.category }}</span><span v-if="p.creator_name" class="card-creator">{{ p.creator_name }}</span></div>
          </div>
          <div v-else class="feed-card-back">
            <div class="card-subject" :style="{ background: p.subject_color + '18', color: p.subject_color }">{{ p.subject_icon }} {{ p.subject_name }}</div>
            <h3 class="card-title">{{ p.title }}</h3>
            <p class="card-short-answer"><RichTextSpan :rich="parseShortAnswer(p.answer)" /></p>
            <ul v-if="parseTopBullets(p.answer, 2).length" class="card-mini-bullets">
              <li v-for="(b, i) in parseTopBullets(p.answer, 2)" :key="i">
                <strong v-if="b.term">{{ b.term }}</strong><template v-if="b.term">：</template>{{ truncateBullet(b.explanation?.text ?? '') }}
              </li>
            </ul>
            <div class="card-bottom card-bottom-back">
              <span class="card-tap-back">点击收起</span>
              <button class="card-detail-btn" @click.stop="detailPoint = allPoints.find(x => x.id === p.id) || null">查看完整解释</button>
            </div>
          </div>
        </div>
      </div>
      <div class="masonry-col">
        <div v-for="p in rightCol" :key="p.id" class="feed-card" @click="handleCardTap(p.id)">
          <div class="menu-btn" @click.stop="toggleMenu(p)">⋯</div>
          <div v-if="menuPointId === p.id" class="bubble-menu" @click.stop>
            <span class="bubble-btn" @click="doFavorite" :title="p.favorited ? '取消重点' : '标记重点'">{{ p.favorited ? '★' : '☆' }}</span>
            <span class="bubble-btn bubble-danger" @click="doSuspend" title="不再显示">🚫</span>
            <span class="bubble-btn bubble-warn" @click="doReport" title="举报">⚠️</span>
          </div>
          <div v-if="!flippedIds.has(p.id)" class="feed-card-front">
            <div class="card-subject" :style="{ background: p.subject_color + '18', color: p.subject_color }">{{ p.subject_icon }} {{ p.subject_name }}</div>
            <h3 class="card-title">{{ p.title }}</h3>
            <p class="card-question md-content" v-html="renderMd(p.question)"></p>
            <div class="card-bottom"><span class="card-category">{{ p.category }}</span><span v-if="p.creator_name" class="card-creator">{{ p.creator_name }}</span></div>
          </div>
          <div v-else class="feed-card-back">
            <div class="card-subject" :style="{ background: p.subject_color + '18', color: p.subject_color }">{{ p.subject_icon }} {{ p.subject_name }}</div>
            <h3 class="card-title">{{ p.title }}</h3>
            <p class="card-short-answer"><RichTextSpan :rich="parseShortAnswer(p.answer)" /></p>
            <ul v-if="parseTopBullets(p.answer, 2).length" class="card-mini-bullets">
              <li v-for="(b, i) in parseTopBullets(p.answer, 2)" :key="i">
                <strong v-if="b.term">{{ b.term }}</strong><template v-if="b.term">：</template>{{ truncateBullet(b.explanation?.text ?? '') }}
              </li>
            </ul>
            <div class="card-bottom card-bottom-back">
              <span class="card-tap-back">点击收起</span>
              <button class="card-detail-btn" @click.stop="detailPoint = allPoints.find(x => x.id === p.id) || null">查看完整解释</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="hasMore" class="load-more">加载中...</div>
    <div v-if="filteredPoints.length === 0 && !hasMore" class="empty-state">暂无知识点</div>
    </template>

    <div v-if="detailPoint" class="detail-overlay" @click.self="detailPoint = null">
      <div class="detail-panel">
        <div class="detail-header">
          <span class="detail-close" @click="detailPoint = null">✕</span>
        </div>
        <div class="detail-subject" :style="{ background: detailPoint.subject_color + '18', color: detailPoint.subject_color }">{{ detailPoint.subject_icon }} {{ detailPoint.subject_name }} · {{ detailPoint.category }}</div>
        <h2 class="detail-title">{{ detailPoint.title }}</h2>
        <div class="detail-section">
          <div class="detail-label">问题</div>
          <div class="detail-text md-content" v-html="renderMd(detailPoint.question)"></div>
        </div>
        <div class="detail-section">
          <div class="detail-label">答案</div>
          <AnswerRenderer class="detail-text" :answer="detailPoint.answer" />
        </div>
        <div v-if="parseDetailAnswer(detailPoint.answer)" class="detail-section">
          <div class="detail-label">深入解读</div>
          <p class="detail-text"><RichTextSpan :rich="parseDetailAnswer(detailPoint.answer)!" /></p>
        </div>
      </div>
    </div>

    <SearchPanel v-if="showSearch" @close="showSearch = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onActivated, onDeactivated, onErrorCaptured, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { getApi } from '../apiSwitch'
import SearchPanel from '../components/SearchPanel.vue'
import { store } from '../store'
import { auth } from '../auth'
import { supabase } from '../supabase'
import { renderMd } from '../utils/markdown'
import { parseShortAnswer, parseTopBullets, parseDetailAnswer } from '../utils/answerFormat'
import AnswerRenderer from '../components/AnswerRenderer.vue'
import RichTextSpan from '../components/RichTextSpan.vue'

defineOptions({ name: 'FeedView' })

function truncateBullet(text: string, max = 30): string {
  if (!text) return ''
  return text.length > max ? text.slice(0, max - 1) + '…' : text
}

onErrorCaptured((err) => {
  console.error('[FeedView] render error caught:', err)
  return false
})

const router = useRouter()
const showSearch = ref(false)

interface FeedPoint {
  id: string
  title: string
  category: string
  question: string
  answer: string
  favorited: number
  subject_id: string
  subject_name: string
  subject_icon: string
  subject_color: string
  repetitions: number
  interval: number
  next_review: string
  creator_name: string
  owner_id: string
  subject_team_id: string | null
}

const PAGE_SIZE = 30
let cachedPoints: FeedPoint[] | null = null
let cachedSubjects: any[] | null = null

const subjects = ref<any[]>([])
const allPoints = ref<FeedPoint[]>([])
const displayCount = ref(PAGE_SIZE)
const selectedIds = reactive(new Set<string>())
const flippedIds = reactive(new Set<string>())
const menuPointId = ref<string | null>(null)
const loading = ref(false)
const showDrawer = ref(false)
const feedMode = ref<'smart' | 'random' | 'mine'>(localStorage.getItem('zhiji_feed_mode') as any || 'random')

const visibleSubjects = computed(() => {
  const seen = new Set<string>()
  return subjects.value.filter(s => {
    if (store.hiddenSubjects.includes(s.id)) return false
    if (seen.has(s.name)) return false
    seen.add(s.name)
    return true
  })
})

const selectedAll = computed(() => selectedIds.size === 0 || selectedIds.size === visibleSubjects.value.length)

const allFiltered = computed(() => {
  let pts = allPoints.value.filter(p => !store.hiddenSubjects.includes(p.subject_id))
  pts = pts.filter(p => {
    try {
      if (p.question?.trimStart().startsWith('{')) {
        const q = JSON.parse(p.question)
        if (q?.type === 'choice' && q.image) return false
      }
    } catch {}
    return true
  })
  if (!selectedAll.value) pts = pts.filter(p => selectedIds.has(p.subject_id))
  if (feedMode.value === 'mine' && auth.isLoggedIn.value) {
    const userId = auth.currentUser.value?.id
    pts = pts.filter(p => p.owner_id === userId && !p.subject_team_id)
  }
  const userId = auth.currentUser.value?.id
  pts.sort((a, b) => {
    const aOwn = a.owner_id === userId && !a.subject_team_id ? 0 : 1
    const bOwn = b.owner_id === userId && !b.subject_team_id ? 0 : 1
    return aOwn - bOwn
  })
  const seen = new Set<string>()
  pts = pts.filter(p => {
    if (seen.has(p.title)) return false
    seen.add(p.title)
    return true
  })
  return pts
})

const filteredPoints = computed(() => allFiltered.value.slice(0, displayCount.value))
const hasMore = computed(() => displayCount.value < allFiltered.value.length)

const leftCol = computed(() => filteredPoints.value.filter((_, i) => i % 2 === 0))
const rightCol = computed(() => filteredPoints.value.filter((_, i) => i % 2 === 1))

function onScroll() {
  const scrollTop = window.scrollY || document.documentElement.scrollTop
  if (!hasMore.value) return
  const windowHeight = window.innerHeight
  const docHeight = document.documentElement.scrollHeight
  if (scrollTop + windowHeight >= docHeight - 800) {
    displayCount.value += PAGE_SIZE
  }
}

const FEED_SUBJECTS_KEY = 'zhiji_feed_subjects'

function saveFeedSubjects() {
  if (selectedIds.size > 0) {
    localStorage.setItem(FEED_SUBJECTS_KEY, JSON.stringify([...selectedIds]))
  } else {
    localStorage.removeItem(FEED_SUBJECTS_KEY)
  }
}

function restoreFeedSubjects() {
  const raw = localStorage.getItem(FEED_SUBJECTS_KEY)
  if (!raw) return
  try {
    const ids: string[] = JSON.parse(raw)
    const validIds = new Set(subjects.value.map(s => s.id))
    for (const id of ids) {
      if (validIds.has(id)) selectedIds.add(id)
    }
  } catch {}
}

function toggleAll() {
  selectedIds.clear()
  saveFeedSubjects()
  displayCount.value = PAGE_SIZE
}

function toggleSubject(id: string) {
  if (selectedIds.has(id)) selectedIds.delete(id)
  else selectedIds.add(id)
  saveFeedSubjects()
  displayCount.value = PAGE_SIZE
}

const detailPoint = ref<any>(null)

function handleCardTap(id: string) {
  if (flippedIds.has(id)) {
    flippedIds.delete(id)
  } else {
    flippedIds.add(id)
    const p = allPoints.value.find(x => x.id === id)
    if (p) trackView(p.subject_id)
  }
}

// toggleFlip kept for feedNeedsRefresh compatibility

function toggleMenu(p: FeedPoint) {
  menuPointId.value = menuPointId.value === p.id ? null : p.id
}

function closeMenu() {
  menuPointId.value = null
}

function onSearch() {
  showSearch.value = true
}

async function doFavorite() {
  const id = menuPointId.value
  if (!id) return
  if (!auth.isLoggedIn.value) {
    menuPointId.value = null
    if (confirm('登录后才能标记重点，是否前往登录？')) router.push('/auth')
    return
  }

  const point = allPoints.value.find(x => x.id === id)
  if (!point) { menuPointId.value = null; return }

  const userId = auth.currentUser.value?.id
  const isPublic = !point.subject_team_id && (!point.owner_id || point.owner_id !== userId)

  if (isPublic) {
    if (!confirm('该知识点来自公开库，是否克隆到我的库？')) {
      menuPointId.value = null
      return
    }
    try {
      const allSubs = store.subjects.length > 0 ? store.subjects : await getApi().getSubjects()
      const srcSubject = allSubs.find((s: any) => s.id === point.subject_id)
      const mySubjects = allSubs.filter((s: any) => !s.team_id && s.owner_id === userId)
      let targetId: string
      const match = mySubjects.find((s: any) => s.name === srcSubject?.name)
      if (match) {
        targetId = match.id
      } else {
        const newSub = await getApi().createSubject({
          name: srcSubject?.name || '收藏',
          icon: srcSubject?.icon || '📚',
          color: srcSubject?.color || '#3B82F6'
        })
        targetId = newSub.id
        store.subjects = []
        store._subjectsLoadedAt = 0
      }
      const cloned = await getApi().clonePointToMine(id, targetId)
      if (cloned?.id) {
        await getApi().toggleFavorite(cloned.id).catch(() => {})
      }
      const idx = allPoints.value.findIndex(x => x.id === id)
      if (idx >= 0) {
        allPoints.value[idx] = { ...allPoints.value[idx], favorited: 1 }
        if (cachedPoints) cachedPoints[idx] = allPoints.value[idx]
      }
      alert('已克隆并标记星标')
    } catch (e: any) {
      alert(e.message || '克隆失败')
    }
    menuPointId.value = null
    return
  }

  const res = await getApi().toggleFavorite(id)
  const idx = allPoints.value.findIndex(x => x.id === id)
  if (idx >= 0) {
    allPoints.value[idx] = { ...allPoints.value[idx], favorited: res.favorited ? 1 : 0 }
    if (cachedPoints) cachedPoints[idx] = allPoints.value[idx]
  }
  if (res.favorited && point) trackFav(point.subject_id)
  menuPointId.value = null
}

async function doSuspend() {
  const id = menuPointId.value
  if (!id) return
  if (!auth.isLoggedIn.value) {
    menuPointId.value = null
    if (confirm('登录后才能隐藏知识点，是否前往登录？')) router.push('/auth')
    return
  }
  const point = allPoints.value.find(x => x.id === id)
  await getApi().suspendPoint(id)
  if (point) trackHide(point.subject_id)
  allPoints.value = allPoints.value.filter(x => x.id !== id)
  if (cachedPoints) cachedPoints = allPoints.value
  menuPointId.value = null
}

async function doReport() {
  const id = menuPointId.value
  if (!id) return
  if (!auth.isLoggedIn.value) {
    alert('请先登录后再举报')
    menuPointId.value = null
    return
  }
  const reason = prompt('请输入举报原因（可选）') ?? ''
  await supabase.from('reports').insert({
    reporter_id: auth.currentUser.value!.id,
    point_id: id,
    reason
  })
  menuPointId.value = null
  alert('举报已提交，感谢反馈')
}

async function loadDataLocal() {
  const { api: localApi } = await import('../db')
  const subs = await localApi.getSubjects()
  const activeSubs = subs.filter((s: any) => !store.hiddenSubjects.includes(s.id))
  const subMap = new Map(activeSubs.map((s: any) => [s.id, s]))
  const allPts: any[] = await localApi.getAllActivePoints()
  const points: FeedPoint[] = []
  for (const p of allPts) {
    if (p.suspended) continue
    const s = subMap.get(p.subject_id)
    if (!s) continue
    points.push({
      id: p.id, title: p.title, category: p.category,
      question: p.question, answer: p.answer, favorited: p.favorited ?? 0,
      subject_id: p.subject_id, subject_name: s.name,
      subject_icon: s.icon, subject_color: s.color,
      repetitions: p.repetitions ?? 0, interval: p.interval ?? 0,
      next_review: p.next_review ?? '', creator_name: p.creator_name || '',
      owner_id: '', subject_team_id: null
    })
  }
  sortPoints(points)
  subjects.value = activeSubs
  allPoints.value = points
  displayCount.value = PAGE_SIZE
  restoreFeedSubjects()
}

async function loadData(showSkeleton = true) {
  if (showSkeleton) loading.value = true
  try {
  let subs: any[]
  const cacheLooksCloudShaped = store.subjects.length > 0 && store.subjects.every((s: any) => 'owner_id' in s)
  if (store.subjects.length > 0 && (!auth.isLoggedIn.value || cacheLooksCloudShaped)) {
    subs = store.subjects
  } else {
    subs = await getApi().getSubjects()
    store.subjects = subs
    store._subjectsLoadedAt = Date.now()
  }
  const activeSubs = subs.filter((s: any) => !store.hiddenSubjects.includes(s.id))
  subjects.value = activeSubs
  cachedSubjects = activeSubs

  const subMap = new Map(activeSubs.map((s: any) => [s.id, s]))
  const activeSubIds = new Set(activeSubs.map((s: any) => s.id))
  const api = getApi()
  const allPts: any[] = 'getAllActivePoints' in api ? await (api as any).getAllActivePoints() : []
  const points: FeedPoint[] = []
  for (const p of allPts) {
    if (p.suspended) continue
    if (!activeSubIds.has(p.subject_id)) continue
    const s = subMap.get(p.subject_id)
    if (!s) continue
    points.push({
      id: p.id, title: p.title, category: p.category,
      question: p.question, answer: p.answer, favorited: p.favorited ?? 0,
      subject_id: p.subject_id, subject_name: s.name,
      subject_icon: s.icon, subject_color: s.color,
      repetitions: p.repetitions ?? 0,
      interval: p.interval ?? 0,
      next_review: p.next_review ?? '',
      creator_name: p.creator_name || '',
      owner_id: s.owner_id || '',
      subject_team_id: s.team_id || null
    })
  }
  sortPoints(points)
  allPoints.value = points
  cachedPoints = points
  displayCount.value = PAGE_SIZE
  restoreFeedSubjects()
  } finally {
    loading.value = false
  }
}

function sortPoints(points: FeedPoint[]) {
  if (feedMode.value === 'random' || feedMode.value === 'mine') {
    for (let i = points.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [points[i], points[j]] = [points[j], points[i]]
    }
  } else {
    const prefs = loadPrefs()
    points.sort((a, b) => smartScore(b, prefs) - smartScore(a, prefs))
    interleave(points)
  }
}

function interleave(points: FeedPoint[]) {
  const maxConsecutive = 2
  const result: FeedPoint[] = []
  const remaining = [...points]

  while (remaining.length > 0) {
    let placed = false
    for (let i = 0; i < remaining.length; i++) {
      const tail = result.slice(-maxConsecutive)
      if (tail.length >= maxConsecutive && tail.every(t => t.subject_id === remaining[i].subject_id)) {
        continue
      }
      result.push(remaining.splice(i, 1)[0])
      placed = true
      break
    }
    if (!placed) {
      result.push(remaining.shift()!)
    }
  }

  points.length = 0
  points.push(...result)
}

interface FeedPrefs {
  views: Record<string, number>
  favs: Record<string, number>
  hides: Record<string, number>
  lastSeen: Record<string, number>
}

function loadPrefs(): FeedPrefs {
  try {
    return JSON.parse(localStorage.getItem('zhiji_feed_prefs') || '{}') as FeedPrefs
  } catch { return { views: {}, favs: {}, hides: {}, lastSeen: {} } }
}

function savePrefs(prefs: FeedPrefs) {
  localStorage.setItem('zhiji_feed_prefs', JSON.stringify(prefs))
}

function smartScore(p: FeedPoint, prefs: FeedPrefs): number {
  const views = prefs.views?.[p.subject_id] || 0
  const favs = prefs.favs?.[p.subject_id] || 0
  const hides = prefs.hides?.[p.subject_id] || 0

  // 1. 兴趣分：收藏权重最高，浏览次数正向但边际递减
  const interestScore = Math.log1p(favs) * 6 + Math.log1p(views) * 1.5 - hides * 8

  // 2. 新鲜度惩罚：最近刚刚看过的科目降权（避免连续刷同一科目）
  const lastSeen = prefs.lastSeen?.[p.subject_id] || 0
  const minsSince = lastSeen ? (Date.now() - lastSeen) / 60000 : 999
  const freshnessBonus = Math.min(minsSince / 30, 1) * 3  // 30分钟恢复满分

  // 3. 多样性随机因子（抖音的"探索"）— 幅度大一些保证多样性
  const randomBoost = Math.random() * 5

  // 4. 冷门科目加权（让小科目有机会出现）
  const diversityBoost = views < 3 ? 2 : 0

  // 5. 收藏的知识点本身加分（不只是科目）
  const favPointBonus = p.favorited ? 3 : 0

  return interestScore + freshnessBonus + randomBoost + diversityBoost + favPointBonus
}

function trackView(subjectId: string) {
  const prefs = loadPrefs()
  if (!prefs.views) prefs.views = {}
  if (!prefs.lastSeen) prefs.lastSeen = {}
  prefs.views[subjectId] = (prefs.views[subjectId] || 0) + 1
  prefs.lastSeen[subjectId] = Date.now()
  savePrefs(prefs)
}

function trackFav(subjectId: string) {
  const prefs = loadPrefs()
  if (!prefs.favs) prefs.favs = {}
  prefs.favs[subjectId] = (prefs.favs[subjectId] || 0) + 1
  savePrefs(prefs)
}

function trackHide(subjectId: string) {
  const prefs = loadPrefs()
  if (!prefs.hides) prefs.hides = {}
  prefs.hides[subjectId] = (prefs.hides[subjectId] || 0) + 1
  savePrefs(prefs)
}

function setFeedMode(mode: 'smart' | 'random' | 'mine') {
  if (feedMode.value === mode) return
  feedMode.value = mode
  localStorage.setItem('zhiji_feed_mode', mode)
  if (cachedPoints) {
    const points = [...cachedPoints]
    sortPoints(points)
    allPoints.value = points
    cachedPoints = points
  }
  displayCount.value = PAGE_SIZE
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  document.addEventListener('click', closeMenu)
  if (store.feedNeedsRefresh) {
    store.feedNeedsRefresh = false
    flippedIds.clear()
    loadData()
  } else if (cachedPoints && cachedSubjects) {
    allPoints.value = cachedPoints
    subjects.value = cachedSubjects
    restoreFeedSubjects()
  } else if (auth.isLoggedIn.value) {
    loadDataLocal().then(() => {
      loadData(false).catch(() => {})
    })
  } else {
    loadData()
  }
})

onActivated(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  document.addEventListener('click', closeMenu)
  if (store.feedNeedsRefresh) {
    store.feedNeedsRefresh = false
    flippedIds.clear()
    displayCount.value = PAGE_SIZE
    loadData()
  }
})

onDeactivated(() => {
  window.removeEventListener('scroll', onScroll)
  document.removeEventListener('click', closeMenu)
})
</script>

<style scoped>
.feed-page { background: transparent; min-height: 100vh; }
.feed-title-bar { position: sticky; top: 0; z-index: 21; background: var(--glass); -webkit-backdrop-filter: var(--glass-blur); backdrop-filter: var(--glass-blur); margin: 0 -16px; padding: 8px 16px 6px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); }
.title-menu-btn { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; color: var(--gray-600); cursor: pointer; border-radius: 50%; transition: background 0.2s; flex-shrink: 0; }
.title-menu-btn:active { background: var(--gray-100); }
.search-btn { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; color: var(--gray-500); cursor: pointer; border-radius: 50%; transition: background 0.2s; }
.search-btn:active { background: var(--gray-100); }

.feed-mode-seg { display: flex; background: var(--gray-100); border-radius: 20px; padding: 3px; gap: 2px; }
.seg-item { padding: 5px 14px; border-radius: 18px; font-size: 13px; font-weight: 600; color: var(--gray-500); cursor: pointer; transition: all 0.25s; user-select: none; }
.seg-item.active { background: var(--primary); color: white; box-shadow: 0 2px 8px rgba(37,99,235,0.25); }

.drawer-overlay { position: fixed; inset: 0; z-index: 300; background: var(--overlay); display: flex; }
.drawer-panel { width: 72%; max-width: 280px; background: var(--card-bg); height: 100%; display: flex; flex-direction: column; box-shadow: 4px 0 24px rgba(0,0,0,0.12); animation: slideInLeft 0.22s ease; }
@keyframes slideInLeft { from { transform: translateX(-100%); } to { transform: translateX(0); } }
.drawer-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px 12px; border-bottom: 1px solid var(--border-color); }
.drawer-title { font-size: 16px; font-weight: 700; color: var(--gray-900); }
.drawer-close { font-size: 20px; color: var(--gray-400); cursor: pointer; padding: 4px; }
.drawer-filter-list { flex: 1; overflow-y: auto; padding: 8px 0; -webkit-overflow-scrolling: touch; }
.drawer-item { display: flex; align-items: center; gap: 12px; padding: 13px 20px; cursor: pointer; transition: background 0.15s; }
.drawer-item:active { background: var(--gray-50); }
.drawer-item.active { background: var(--primary-bg); }
.drawer-icon { font-size: 20px; flex-shrink: 0; width: 28px; text-align: center; }
.drawer-name { flex: 1; font-size: 15px; font-weight: 500; color: var(--gray-800); }
.drawer-item.active .drawer-name { color: var(--primary); font-weight: 600; }
.drawer-check { font-size: 14px; color: var(--primary); font-weight: 700; }

.masonry { display: flex; gap: 10px; }
.masonry-col { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px; }

.feed-card { position: relative; cursor: pointer; }
.feed-card-front, .feed-card-back { background: var(--card-bg); border-radius: 16px; padding: 18px; border: 1px solid var(--border-color); box-shadow: var(--shadow); }

.menu-btn { position: absolute; top: 10px; right: 10px; font-size: 20px; color: var(--gray-400); z-index: 5; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 50%; letter-spacing: 1px; font-weight: 700; }
.menu-btn:active { background: rgba(0,0,0,0.05); }

.bubble-menu { position: absolute; top: 38px; right: 6px; z-index: 10; display: flex; gap: 2px; background: var(--glass-strong); -webkit-backdrop-filter: var(--glass-blur); backdrop-filter: var(--glass-blur); border: 1px solid var(--glass-border); border-radius: 16px; padding: 4px 6px; box-shadow: 0 4px 16px rgba(0,0,0,0.12); }
.bubble-btn { width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 18px; cursor: pointer; transition: background 0.15s; }
.bubble-btn:active { background: rgba(0,0,0,0.08); }
.bubble-danger { font-size: 16px; }

.card-subject { display: inline-block; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 6px; margin-bottom: 12px; }
.card-title { font-size: 16px; font-weight: 700; color: var(--gray-900); margin-bottom: 12px; line-height: 1.4; padding-right: 28px; }
.card-question { font-size: 13px; color: var(--gray-600); line-height: 1.7; }
.card-answer { font-size: 13px; color: var(--gray-700); line-height: 1.8; }
.card-short-answer { font-size: 14px; color: var(--gray-800); line-height: 1.7; font-weight: 500; }
.card-mini-bullets { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.card-mini-bullets li { font-size: 12px; color: var(--gray-500); line-height: 1.6; }
.card-mini-bullets li strong { color: var(--gray-700); font-weight: 600; }
.card-category { font-size: 12px; color: var(--gray-400); }
.card-bottom { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; }
.card-creator { font-size: 11px; color: var(--gray-400); max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-shrink: 0; }
.card-tap-back { font-size: 12px; color: var(--gray-400); }
.card-bottom-back { justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--gray-100); }
.card-detail-btn { font-size: 12px; font-weight: 600; color: var(--primary); background: var(--primary-bg); border: none; border-radius: 999px; padding: 4px 14px; cursor: pointer; }

.detail-overlay { position: fixed; inset: 0; z-index: 200; background: var(--overlay); display: flex; align-items: flex-end; }
.detail-panel { background: var(--card-bg); width: 100%; max-width: 430px; margin: 0 auto; border-radius: var(--radius-modal) var(--radius-modal) 0 0; padding: 0 20px 40px; max-height: 85vh; overflow-y: auto; -webkit-overflow-scrolling: touch; animation: slideUp 0.25s ease; }
.detail-header { display: flex; justify-content: flex-end; padding: 16px 0 8px; }
.detail-close { font-size: 20px; color: var(--gray-400); cursor: pointer; padding: 4px; }
.detail-subject { display: inline-block; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 999px; margin-bottom: 12px; }
.detail-title { font-size: 22px; font-weight: 700; color: var(--gray-900); margin-bottom: 20px; line-height: 1.3; }
.detail-section { margin-bottom: 20px; }
.detail-label { font-size: 11px; font-weight: 700; color: var(--primary); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
.detail-text { font-size: 15px; color: var(--gray-700); line-height: 1.8; }
.load-more { text-align: center; padding: 20px; color: var(--gray-400); font-size: 14px; }
.empty-state { text-align: center; padding: 60px 20px; color: var(--gray-400); font-size: 15px; }

.skeleton-wrap { padding-top: 4px; }
.skeleton-masonry { display: flex; gap: 10px; }
.skeleton-col { flex: 1; display: flex; flex-direction: column; gap: 10px; }
.skeleton-card { border-radius: 14px; background: linear-gradient(110deg, var(--gray-100) 30%, var(--gray-50) 50%, var(--gray-100) 70%); background-size: 200% 100%; animation: shimmer 1.5s ease-in-out infinite; }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
</style>
