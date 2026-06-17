<template>
  <div class="page library-page">
    <div class="page-header">
      <h1 class="page-title">知识库</h1>
      <div class="header-actions">
        <span class="header-icon">🔍</span>
        <span class="header-icon">☰</span>
      </div>
    </div>

    <div class="review-card card">
      <div class="review-stats">
        <div class="rs-item"><span class="rs-value highlight">{{ overview.due_today }}</span><span class="rs-label">待复习</span></div>
        <div class="rs-divider"></div>
        <div class="rs-item"><span class="rs-value">{{ overview.reviewed_today }}</span><span class="rs-label">今日已复习</span></div>
        <div class="rs-divider"></div>
        <div class="rs-item"><span class="rs-value">{{ overview.new_today }}</span><span class="rs-label">今日新学</span></div>
        <div class="rs-divider"></div>
        <div class="rs-item"><span class="rs-value">{{ overview.total_points }}</span><span class="rs-label">总知识点</span></div>
      </div>
      <div class="limit-row">
        <span class="limit-label">每日复习数量</span>
        <div class="limit-control">
          <button class="limit-btn" @click="adjustLimit(-5)">−</button>
          <div class="limit-presets">
            <span v-for="n in presets" :key="n" class="preset-chip" :class="{ active: store.dailyLimit === n }" @click="setLimit(n)">{{ n === 0 ? '全部' : n }}</span>
          </div>
          <button class="limit-btn" @click="adjustLimit(5)">+</button>
        </div>
      </div>
      <button class="start-review-btn" @click="startReview" :disabled="overview.due_today === 0">
        {{ overview.due_today === 0 ? '暂无待复习内容' : `开始复习（${reviewCount}题）` }}
      </button>
    </div>

    <div class="section-title">我的知识库</div>
    <div class="current-book card" v-if="mastery">
      <div class="book-progress-row">
        <span>已学习 {{ overview.learned_points }} / {{ overview.total_points }}</span>
        <span>{{ overview.total_points > 0 ? Math.round(overview.learned_points / overview.total_points * 100) : 0 }}%</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: (overview.total_points > 0 ? overview.learned_points / overview.total_points * 100 : 0) + '%' }"></div>
      </div>
      <div class="mastery-tags">
        <span class="tag" style="background:#1B6B3A;color:#fff">标熟 {{ mastery.mastered_count }}</span>
        <span class="tag" style="background:#27AE60;color:#fff">熟悉 {{ mastery.familiar_count }}</span>
        <span class="tag" style="background:#F39C12;color:#fff">一般 {{ mastery.normal_count }}</span>
        <span class="tag" style="background:#E74C3C;color:#fff">不熟 {{ mastery.unfamiliar_count }}</span>
        <span class="tag" style="background:#E5E7EB;color:#6B7280">未学 {{ mastery.unlearned_count }}</span>
      </div>
    </div>

    <div class="list-header">
      <span class="section-title" style="margin:0">选择学科</span>
      <div class="list-actions">
        <span class="select-all-btn" @click="toggleAllSubjects">{{ allSelected ? '取消全选' : '全选' }}</span>
      </div>
    </div>

    <div class="subject-list">
      <div v-for="subject in subjects" :key="subject.id" class="subject-item" @click="toggleSelect(subject.id)">
        <div class="checkbox" :class="{ checked: selected.has(subject.id) }">
          <span v-if="selected.has(subject.id)">✓</span>
        </div>
        <div class="icon-circle" :style="{ background: subject.color }">{{ subject.icon }}</div>
        <div class="subject-info">
          <div class="subject-name">{{ subject.name }}</div>
          <div class="subject-meta">{{ subject.learned_count }} / {{ subject.point_count }} 已学习</div>
        </div>
        <span class="arrow" @click.stop="openSubjectDetail(subject)">›</span>
      </div>
    </div>

    <div v-if="showPoints" class="points-overlay" @click.self="showPoints = false">
      <div class="points-panel">
        <div class="points-header">
          <h3>{{ activeSubject?.name }} · 知识点</h3>
          <span class="close-btn" @click="showPoints = false">✕</span>
        </div>
        <div class="points-actions">
          <button class="add-point-btn" @click="openEditor(null)">+ 添加知识点</button>
          <button class="review-btn" @click="startSubjectReview">复习该学科</button>
        </div>
        <div class="points-list">
          <div v-for="p in subjectPoints" :key="p.id" class="point-item">
            <div class="point-main" @click="openEditor(p)">
              <div class="point-title">{{ p.title }}</div>
              <div class="point-category">{{ p.category }}</div>
            </div>
            <div class="point-status">
              <span class="interval-badge" v-if="p.repetitions > 0">{{ p.interval }}天</span>
              <span class="new-badge" v-else>新</span>
            </div>
            <span class="delete-btn" @click.stop="deletePoint(p)">🗑</span>
          </div>
          <div v-if="subjectPoints.length === 0" class="empty-state">暂无知识点，点击上方添加</div>
        </div>
      </div>
    </div>

    <PointEditor v-if="editorVisible" :point="editingPoint" :subject-id="activeSubject?.id" @close="editorVisible = false" @saved="onPointSaved" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../db'
import { store } from '../store'
import PointEditor from '../components/PointEditor.vue'

const router = useRouter()
const subjects = ref<any[]>([])
const overview = ref({ total_points: 0, learned_points: 0, due_today: 0, new_today: 0, reviewed_today: 0 })
const mastery = ref<any>(null)
const selected = reactive(new Set<string>())
const showPoints = ref(false)
const activeSubject = ref<any>(null)
const subjectPoints = ref<any[]>([])
const editorVisible = ref(false)
const editingPoint = ref<any>(null)
const presets = [10, 20, 30, 50, 0]

const reviewCount = computed(() => {
  if (store.dailyLimit === 0) return overview.value.due_today
  return Math.min(store.dailyLimit, overview.value.due_today)
})

const allSelected = computed(() => subjects.value.length > 0 && selected.size === subjects.value.length)

async function loadData() {
  const [subs, ov, mas] = await Promise.all([
    api.getSubjects(),
    api.getOverview(),
    api.getMastery()
  ])
  subjects.value = subs
  overview.value = ov
  mastery.value = mas
  store.overview = ov
  if (selected.size === 0) {
    subs.forEach((s: any) => selected.add(s.id))
  }
}

onMounted(loadData)

function toggleSelect(id: string) {
  if (selected.has(id)) selected.delete(id)
  else selected.add(id)
}

function toggleAllSubjects() {
  if (allSelected.value) {
    selected.clear()
  } else {
    subjects.value.forEach(s => selected.add(s.id))
  }
}

function setLimit(n: number) {
  store.setDailyLimit(n)
}

function adjustLimit(delta: number) {
  const next = store.dailyLimit + delta
  if (next <= 0) store.setDailyLimit(0)
  else if (next > 200) store.setDailyLimit(200)
  else store.setDailyLimit(next)
}

async function startReview() {
  const subjectIds = selected.size === subjects.value.length ? undefined : [...selected]
  const limit = store.dailyLimit > 0 ? store.dailyLimit : undefined
  await store.loadReviewQueue(subjectIds, limit)
  if (store.reviewQueue.length === 0) {
    alert('所选学科暂无待复习的知识点')
    return
  }
  router.push('/review')
}

async function openSubjectDetail(subject: any) {
  activeSubject.value = subject
  subjectPoints.value = await api.getSubjectPoints(subject.id)
  showPoints.value = true
}

async function startSubjectReview() {
  if (!activeSubject.value) return
  const limit = store.dailyLimit > 0 ? store.dailyLimit : undefined
  await store.loadReviewQueue([activeSubject.value.id], limit)
  showPoints.value = false
  if (store.reviewQueue.length === 0) {
    alert('该学科暂无待复习的知识点')
    return
  }
  router.push('/review')
}

function openEditor(point: any) {
  editingPoint.value = point
  editorVisible.value = true
}

async function onPointSaved() {
  editorVisible.value = false
  if (activeSubject.value) {
    subjectPoints.value = await api.getSubjectPoints(activeSubject.value.id)
  }
  loadData()
}

async function deletePoint(p: any) {
  if (!confirm(`确定删除「${p.title}」？`)) return
  await api.deletePoint(p.id)
  subjectPoints.value = subjectPoints.value.filter(x => x.id !== p.id)
  loadData()
}
</script>

<style scoped>
.library-page { background: var(--white); }
.page-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 0 4px; }
.header-actions { display: flex; gap: 16px; font-size: 20px; }
.header-icon { cursor: pointer; opacity: 0.6; }

.review-card { background: var(--gray-50); border: 1px solid var(--gray-200); }
.review-stats { display: flex; align-items: center; padding-bottom: 14px; border-bottom: 1px solid var(--gray-200); margin-bottom: 14px; }
.rs-item { flex: 1; text-align: center; }
.rs-value { display: block; font-size: 20px; font-weight: 700; color: var(--gray-900); }
.rs-value.highlight { color: var(--primary); }
.rs-label { font-size: 11px; color: var(--gray-500); }
.rs-divider { width: 1px; height: 32px; background: var(--gray-200); }

.limit-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.limit-label { font-size: 14px; font-weight: 600; color: var(--gray-700); }
.limit-control { display: flex; align-items: center; gap: 6px; }
.limit-btn { width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--gray-300); background: white; font-size: 16px; font-weight: 600; color: var(--gray-600); cursor: pointer; display: flex; align-items: center; justify-content: center; }
.limit-btn:active { background: var(--gray-100); }
.limit-presets { display: flex; gap: 4px; }
.preset-chip { padding: 4px 10px; border-radius: 14px; font-size: 13px; font-weight: 500; color: var(--gray-500); background: white; border: 1px solid var(--gray-200); cursor: pointer; transition: all 0.2s; }
.preset-chip.active { background: var(--primary); color: white; border-color: var(--primary); }

.start-review-btn { width: 100%; padding: 13px; background: var(--primary); color: white; border: none; border-radius: var(--radius); font-size: 16px; font-weight: 600; cursor: pointer; }
.start-review-btn:active { opacity: 0.85; }
.start-review-btn:disabled { background: var(--gray-300); cursor: not-allowed; }

.section-title { font-size: 16px; font-weight: 700; color: var(--gray-900); margin: 16px 0 8px; }

.current-book { background: var(--gray-50); border: 1px solid var(--gray-200); }
.book-progress-row { display: flex; justify-content: space-between; font-size: 13px; color: var(--gray-500); margin-bottom: 6px; }
.progress-bar { height: 6px; background: var(--gray-200); border-radius: 3px; overflow: hidden; margin-bottom: 10px; }
.progress-fill { height: 100%; background: var(--primary); border-radius: 3px; transition: width 0.5s; }
.mastery-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.tag { font-size: 11px; padding: 2px 8px; border-radius: 4px; white-space: nowrap; }

.list-header { display: flex; justify-content: space-between; align-items: center; margin: 8px 0; }
.list-actions { display: flex; gap: 12px; }
.select-all-btn { font-size: 14px; color: var(--primary); cursor: pointer; font-weight: 600; }

.subject-list { display: flex; flex-direction: column; }
.subject-item { display: flex; align-items: center; gap: 12px; padding: 14px 0; border-bottom: 1px solid var(--gray-100); cursor: pointer; }
.subject-item:active { background: var(--gray-50); }
.subject-info { flex: 1; }
.subject-name { font-size: 16px; font-weight: 500; }
.subject-meta { font-size: 12px; color: var(--gray-400); margin-top: 2px; }
.arrow { font-size: 18px; color: var(--gray-300); padding: 4px 0 4px 8px; }

.checkbox { width: 24px; height: 24px; border-radius: 50%; border: 2px solid var(--gray-300); display: flex; align-items: center; justify-content: center; font-size: 14px; color: white; flex-shrink: 0; }
.checkbox.checked { background: var(--primary); border-color: var(--primary); }

.points-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 200; display: flex; align-items: flex-end; }
.points-panel { background: white; width: 100%; max-width: 430px; margin: 0 auto; border-radius: 16px 16px 0 0; max-height: 80vh; overflow-y: auto; padding: 20px 16px; }
.points-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.points-header h3 { font-size: 18px; }
.close-btn { font-size: 20px; cursor: pointer; color: var(--gray-400); padding: 4px; }
.points-actions { display: flex; gap: 10px; margin-bottom: 16px; }
.add-point-btn { flex: 1; padding: 10px; background: var(--primary-bg); color: var(--primary); border: 1px solid var(--primary); border-radius: var(--radius-sm); font-size: 14px; font-weight: 600; cursor: pointer; }
.review-btn { flex: 1; padding: 10px; font-size: 14px; background: var(--primary); color: white; border: none; border-radius: var(--radius); font-weight: 600; cursor: pointer; }

.point-item { display: flex; align-items: center; gap: 10px; padding: 12px 0; border-bottom: 1px solid var(--gray-100); }
.point-main { flex: 1; cursor: pointer; }
.point-title { font-size: 15px; font-weight: 500; }
.point-category { font-size: 12px; color: var(--gray-400); margin-top: 2px; }
.point-status { flex-shrink: 0; }
.interval-badge { font-size: 11px; background: #E8F5E9; color: #27AE60; padding: 2px 8px; border-radius: 4px; }
.new-badge { font-size: 11px; background: var(--primary-bg); color: var(--primary); padding: 2px 8px; border-radius: 4px; }
.delete-btn { font-size: 16px; cursor: pointer; opacity: 0.5; padding: 4px; }
.delete-btn:hover { opacity: 1; }
.empty-state { text-align: center; padding: 32px; color: var(--gray-400); font-size: 14px; }

.icon-circle { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; color: var(--white); flex-shrink: 0; }
</style>
