<template>
  <div class="page map-page">
    <div class="map-header">
      <span class="map-back" @click="goBack">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </span>
      <h1 class="map-title">{{ subjectName }}</h1>
    </div>
    <KnowledgeMap
      :subject="subjectData"
      :points="points"
      :loading="loading"
      @select-knowledge="handleKnowledgeNodeClick"
    />
    <KnowledgePointViewCard
      v-if="isCardOpen && cardMode === 'view' && selectedPoint"
      :point="selectedPoint"
      :subject-name="subjectData?.name"
      :subject-icon="subjectData?.icon"
      :subject-color="subjectData?.color"
      @close="closeCard"
      @edit="handleEditKnowledgePoint(selectedPoint)"
    />
    <PointEditor
      v-if="isCardOpen && cardMode === 'edit' && selectedPoint"
      :point="selectedPoint"
      :subject-id="subjectId"
      @close="closeCard"
      @saved="onSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getApi } from '../apiSwitch'
import { getUserCache, hasCachedPoints } from '../userCache'
import { auth } from '../auth'
import { store } from '../store'
import KnowledgeMap from '../components/KnowledgeMap.vue'
import KnowledgePointViewCard from '../components/KnowledgePointViewCard.vue'
import PointEditor from '../components/PointEditor.vue'

const route = useRoute()
const router = useRouter()
const subjectId = route.params.subjectId as string

const subjectName = ref('')
const subjectData = ref<any>(null)
const points = ref<any[]>([])
const loading = ref(true)

type KnowledgeCardMode = 'view' | 'edit'
const cardMode = ref<KnowledgeCardMode>('view')
const selectedPoint = ref<any>(null)
const isCardOpen = ref(false)

// single-flight: concurrent loads for the same subjectId reuse the same in-flight promise
const _inflight = new Map<string, Promise<void>>()

function goBack() {
  router.back()
}

async function loadData() {
  if (_inflight.has(subjectId)) return _inflight.get(subjectId)
  const p = _doLoadData()
  _inflight.set(subjectId, p)
  try { await p } finally { _inflight.delete(subjectId) }
}

async function _doLoadData() {
  loading.value = true
  const t0 = performance.now()

  try {
    // 1. Subject info — always from store (already loaded at boot)
    let sub: any = null
    if (store.subjects.length > 0) {
      sub = store.subjects.find((s: any) => s.id === subjectId)
    }
    if (!sub) {
      const { supabase } = await import('../supabase')
      const { data: allSubs } = await supabase.from('subjects').select('*').order('sort_order')
      sub = (allSubs || []).find((s: any) => s.id === subjectId)
    }
    if (sub) {
      subjectName.value = sub.name
      subjectData.value = { id: sub.id, name: sub.name, icon: sub.icon, color: sub.color }
    }

    // 2. Points — try local IndexedDB cache first, fall back to network
    let pts: any[] | null = null

    if (auth.isLoggedIn.value) {
      pts = await loadPointsFromCache()
    }

    if (!pts) {
      const t2 = performance.now()
      pts = await getApi().getSubjectPoints(subjectId)
      console.log(`[perf:map] network getSubjectPoints: ${(performance.now() - t2).toFixed(0)}ms`)
    }

    points.value = pts
    console.log(`[perf:map] total: ${(performance.now() - t0).toFixed(0)}ms, ${pts.length} points`)
  } catch (e) {
    console.error('[KnowledgeMap] loadData failed', e)
  } finally {
    loading.value = false
  }
}

async function loadPointsFromCache(): Promise<any[] | null> {
  const cache = getUserCache()
  if (!cache) return null
  const hasPoints = await hasCachedPoints()
  if (!hasPoints) return null

  const t = performance.now()
  const localPts = await cache.points.where('subject_id').equals(subjectId).toArray()
  const upRows = await cache.userPoints.bulkGet(localPts.map(p => p.id))
  const upMap = new Map<string, any>()
  localPts.forEach((p, i) => { if (upRows[i]) upMap.set(p.id, upRows[i]) })
  const today = new Date().toISOString().slice(0, 10)

  const result = localPts.map(p => {
    const up = upMap.get(p.id)
    return {
      ...p,
      ease_factor: up?.ease_factor ?? 2.5,
      interval: up?.interval_days ?? 0,
      repetitions: up?.repetitions ?? 0,
      next_review: up?.next_review ?? today,
      last_review: up?.last_review ?? null,
      suspended: up?.suspended ? 1 : 0,
      favorited: up?.favorited ? 1 : 0
    }
  })
  console.log(`[perf:map] cache hit: ${(performance.now() - t).toFixed(0)}ms, ${result.length} points`)
  return result
}

// Normal click on a knowledge node opens the read-only view card. It must
// never open the editor directly — escalation to edit only happens via the
// explicit "编辑" button inside the view card (handleEditKnowledgePoint).
function handleKnowledgeNodeClick(knowledgeId: string) {
  const point = points.value.find((p: any) => p.id === knowledgeId)
  if (!point) return
  selectedPoint.value = point
  cardMode.value = 'view'
  isCardOpen.value = true
}

function handleEditKnowledgePoint(point: any) {
  selectedPoint.value = point
  cardMode.value = 'edit'
  isCardOpen.value = true
}

function closeCard() {
  isCardOpen.value = false
  // Reset to 'view' so the next click on any node — even before this ref is
  // reused — always defaults to the view card, never resumes edit mode.
  cardMode.value = 'view'
}

async function onSaved() {
  closeCard()
  points.value = await getApi().getSubjectPoints(subjectId)
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.map-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  padding-bottom: 0 !important;
  overflow: hidden;
}
.map-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px 8px;
  flex-shrink: 0;
}
.map-back {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--gray-500);
  cursor: pointer;
  border-radius: 50%;
  transition: background 0.2s;
}
.map-back:active { background: var(--gray-100); }
.map-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
}
.map-page :deep(.km-container) {
  flex: 1;
  height: auto !important;
  border-radius: 0;
  border-left: none;
  border-right: none;
}
</style>
