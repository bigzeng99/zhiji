<template>
  <div class="km-container" :class="{ 'km-container--mobile': isMobile }">
    <div v-if="loading" class="km-skeleton">
      <div class="km-skeleton-node km-skeleton-lg"></div>
      <div class="km-skeleton-row">
        <div class="km-skeleton-node"></div>
        <div class="km-skeleton-node"></div>
        <div class="km-skeleton-node"></div>
      </div>
    </div>

    <div v-else-if="!subject || pointCount === 0" class="km-empty">
      <div class="km-empty-icon">🗺️</div>
      <div class="km-empty-text">暂无知识点</div>
    </div>

    <template v-else>
      <div class="km-toolbar">
        <button class="km-tool-btn" @click="zoomIn" title="放大">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <button class="km-tool-btn" @click="zoomOut" title="缩小">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <button class="km-tool-btn" @click="doFitView" title="适应视口">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M3 9h18"/></svg>
        </button>
      </div>

      <VueFlow
        :id="flowId"
        :nodes="currentNodes"
        :edges="currentEdges"
        :nodes-draggable="false"
        :nodes-connectable="false"
        :elements-selectable="false"
        :fit-view-on-init="false"
        :min-zoom="0.2"
        :max-zoom="2.5"
        @node-click="onNodeClick"
        @pane-click="onPaneClick"
        @nodes-initialized="onNodesReady"
      >
        <template #node-subject="nodeProps">
          <KnowledgeMapNode
            :data="nodeProps.data"
            :selected="selectedNodeId === nodeProps.id"
            :dimmed="!!selectedNodeId && !highlightedIds.has(nodeProps.id)"
          />
        </template>
        <template #node-group="nodeProps">
          <KnowledgeMapNode
            :data="nodeProps.data"
            :selected="selectedNodeId === nodeProps.id"
            :dimmed="!!selectedNodeId && !highlightedIds.has(nodeProps.id)"
            :expanded="isGroupExpanded(nodeProps.id)"
          />
        </template>
        <template #node-knowledge="nodeProps">
          <KnowledgeMapNode
            :data="nodeProps.data"
            :selected="selectedNodeId === nodeProps.id"
            :dimmed="!!selectedNodeId && !highlightedIds.has(nodeProps.id)"
          />
        </template>
      </VueFlow>

      <div class="km-legend">
        <span class="km-legend-item"><span class="km-legend-dot" style="background:var(--gray-300)"></span>未学</span>
        <span class="km-legend-item"><span class="km-legend-dot" style="background:var(--primary)"></span>学习中</span>
        <span class="km-legend-item"><span class="km-legend-dot" style="background:var(--green)"></span>已掌握</span>
        <span class="km-legend-item"><span class="km-legend-dot" style="background:var(--orange)"></span>待复习</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted, shallowRef, markRaw } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import KnowledgeMapNode from './KnowledgeMapNode.vue'
import {
  buildMapData, aggregateKnowledgeCategories, computeDataVersion,
  type SubjectInput, type PointInput, type KnowledgeMapNodeData, type GroupInfo
} from '../utils/knowledgeMapAdapter'
import { applyRadialLayout } from '../utils/knowledgeMapLayout'
import { getSubjectMapCache, setSubjectMapCache } from '../utils/knowledgeMapCache'
import { perfCount } from '../utils/perfTrace'
import type { Edge, NodeMouseEvent } from '@vue-flow/core'

const props = defineProps<{
  subject: SubjectInput | null
  points: PointInput[]
  loading?: boolean
}>()

const emit = defineEmits<{
  selectKnowledge: [knowledgeId: string]
}>()

const flowId = 'knowledge-map-' + Math.random().toString(36).slice(2, 8)
const { fitView, zoomIn: _zoomIn, zoomOut: _zoomOut } = useVueFlow({ id: flowId })

const expandedGroups = ref(new Set<string>())
const selectedNodeId = ref<string | null>(null)
const isMobile = ref(window.innerWidth < 640)
let resizeTimer: ReturnType<typeof setTimeout> | null = null
let initialFitDone = false

const currentNodes = shallowRef<any[]>([])
const currentEdges = shallowRef<any[]>([])

// Per-subject grouping/layout cache lives in a module-level singleton
// (see knowledgeMapCache.ts) so it survives this component being
// destroyed/recreated on every navigation (KnowledgeMapView isn't kept alive).

const pointCount = computed(() => props.points.filter(p => !p.suspended).length)

// Grouping is independent of expandedGroups — memoize it separately so toggling
// a group doesn't re-run the full category grouping loop over all points.
const groupsCache = computed<{ version: string; groups: GroupInfo[] }>(() => {
  if (!props.subject) return { version: '', groups: [] }
  const version = computeDataVersion(props.subject.id, props.points)
  const cached = getSubjectMapCache(props.subject.id)
  if (cached && cached.version === version) {
    return { version, groups: cached.groups }
  }
  const t0 = performance.now()
  const activePoints = props.points.filter(p => !p.suspended)
  const groups = aggregateKnowledgeCategories(activePoints)
  console.log(`[perf:map-render] group+categorize (${activePoints.length} points): ${(performance.now() - t0).toFixed(1)}ms`)
  return { version, groups }
})

const mapData = computed(() => {
  if (!props.subject) return { nodes: [], edges: [], groups: [] }
  const t0 = performance.now()
  const result = buildMapData(props.subject, props.points, expandedGroups.value, groupsCache.value.groups)
  console.log(`[perf:map-render] build nodes/edges (${result.nodes.length} nodes, ${result.edges.length} edges): ${(performance.now() - t0).toFixed(1)}ms`)
  return result
})

const highlightedIds = computed(() => {
  const ids = new Set<string>()
  if (!selectedNodeId.value) return ids
  ids.add(selectedNodeId.value)
  const edgeMap = new Map<string, string>()
  for (const e of mapData.value.edges) {
    edgeMap.set(e.target, e.source)
  }
  let current = selectedNodeId.value
  while (edgeMap.has(current)) {
    current = edgeMap.get(current)!
    ids.add(current)
  }
  return ids
})

function rebuildGraph(shouldFit: boolean) {
  perfCount('rebuildGraph')
  const subjectId = props.subject?.id
  const version = groupsCache.value.version
  const isDefaultView = expandedGroups.value.size === 0
  const cached = subjectId ? getSubjectMapCache(subjectId) : undefined

  let nodes: any[]
  let edges: Edge[]

  if (isDefaultView && cached && cached.version === version) {
    nodes = cached.defaultNodes
    edges = cached.defaultEdges
  } else {
    const tLayout0 = performance.now()
    const laidOut = applyRadialLayout(mapData.value.nodes, mapData.value.edges)
    console.log(`[perf:map-render] layout computation: ${(performance.now() - tLayout0).toFixed(1)}ms`)

    nodes = laidOut.map(n => markRaw({ ...n, data: markRaw(n.data as any) }))
    edges = mapData.value.edges.map(e => markRaw({
      ...e,
      style: { stroke: 'var(--gray-300)', strokeWidth: 1 },
      animated: false
    }))

    if (isDefaultView && subjectId) {
      setSubjectMapCache(subjectId, { version, groups: groupsCache.value.groups, defaultNodes: nodes, defaultEdges: edges })
    }
  }

  const tAssign0 = performance.now()
  currentNodes.value = nodes
  currentEdges.value = edges
  console.log(`[perf:map-render] reactive assignment: ${(performance.now() - tAssign0).toFixed(1)}ms`)

  if (shouldFit) {
    nextTick(() => {
      setTimeout(() => {
        try { fitView({ padding: 0.15, duration: 250 }) } catch {}
      }, 80)
    })
  }
}

function updateEdgeStyles() {
  currentEdges.value = mapData.value.edges.map(e => markRaw({
    ...e,
    style: {
      stroke: highlightedIds.value.has(e.source) && highlightedIds.value.has(e.target)
        ? 'var(--primary)' : 'var(--gray-300)',
      strokeWidth: highlightedIds.value.has(e.source) && highlightedIds.value.has(e.target) ? 2.5 : 1
    },
    animated: false
  }))
}

function onNodesReady() {
  if (!initialFitDone) {
    initialFitDone = true
    console.log(`[perf:map-render] nodes-initialized fired (first render complete)`)
    setTimeout(() => {
      try { fitView({ padding: 0.15, duration: 0 }) } catch {}
    }, 50)
  }
}

function onNodeClick({ node }: NodeMouseEvent) {
  perfCount('onNodeClick')
  const data = node.data as KnowledgeMapNodeData

  if (data.nodeType === 'knowledge' && data.knowledgeId) {
    selectedNodeId.value = node.id
    updateEdgeStyles()
    emit('selectKnowledge', data.knowledgeId)
    return
  }

  if (data.nodeType === 'group') {
    const groupNodeId = node.id
    const groupKey = findGroupKeyByNodeId(groupNodeId)
    if (!groupKey) return
    console.log('[KnowledgeMap] group clicked', { groupKey, nodeId: groupNodeId })
    const newExpanded = new Set(expandedGroups.value)
    if (newExpanded.has(groupKey)) {
      newExpanded.delete(groupKey)
      selectedNodeId.value = null
    } else {
      const totalVisible = countVisibleKnowledgeNodes(newExpanded) + getGroupPointCount(groupKey)
      if (totalVisible > 80) {
        const toClose = findLargestExpandedGroup(newExpanded, groupKey)
        if (toClose) newExpanded.delete(toClose)
      }
      newExpanded.add(groupKey)
    }
    expandedGroups.value = newExpanded
    return
  }

  if (data.nodeType === 'subject') {
    selectedNodeId.value = selectedNodeId.value === node.id ? null : node.id
    updateEdgeStyles()
  }
}

function onPaneClick() {
  if (selectedNodeId.value) {
    selectedNodeId.value = null
    updateEdgeStyles()
  }
}

function findGroupKeyByNodeId(nodeId: string): string | null {
  for (const g of groupsCache.value.groups) {
    const expectedId = `g_${props.subject?.id}_${g.key}`
    if (expectedId === nodeId) return g.key
  }
  return null
}

function isGroupExpanded(nodeId: string): boolean {
  const key = findGroupKeyByNodeId(nodeId)
  return key ? expandedGroups.value.has(key) : false
}

const groupPointCountMap = computed(() => {
  const m = new Map<string, number>()
  for (const g of groupsCache.value.groups) m.set(g.key, g.points.length)
  return m
})

function countVisibleKnowledgeNodes(expanded: Set<string>): number {
  let count = 0
  for (const key of expanded) {
    count += groupPointCountMap.value.get(key) || 0
  }
  return count
}

function getGroupPointCount(groupKey: string): number {
  return groupPointCountMap.value.get(groupKey) || 0
}

function findLargestExpandedGroup(expanded: Set<string>, exclude: string): string | null {
  let largest: string | null = null
  let max = 0
  for (const key of expanded) {
    if (key === exclude) continue
    const count = getGroupPointCount(key)
    if (count > max) { max = count; largest = key }
  }
  return largest
}

function doFitView() {
  try { fitView({ padding: 0.15, duration: 300 }) } catch {}
}

function zoomIn() { _zoomIn() }
function zoomOut() { _zoomOut() }

function onResize() {
  if (resizeTimer) clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    isMobile.value = window.innerWidth < 640
  }, 200)
}

watch(() => expandedGroups.value, () => {
  rebuildGraph(false)
}, { deep: true })

watch(() => props.subject?.id, () => {
  perfCount('watch:subjectId-change')
  expandedGroups.value = new Set()
  selectedNodeId.value = null
  initialFitDone = false
  rebuildGraph(true)
})

watch(() => props.points, () => {
  perfCount('watch:points-change')
  rebuildGraph(!initialFitDone)
}, { deep: false })

onMounted(() => {
  perfCount('KnowledgeMap:onMounted')
  window.addEventListener('resize', onResize)
  rebuildGraph(false)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  if (resizeTimer) clearTimeout(resizeTimer)
})
</script>

<style scoped>
.km-container {
  position: relative;
  width: 100%;
  height: 560px;
  border-radius: var(--radius);
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  overflow: hidden;
}
.km-container--mobile {
  height: 65vh;
  min-height: 400px;
}

.km-skeleton {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  height: 100%;
  padding: 32px;
}
.km-skeleton-node {
  width: 120px;
  height: 44px;
  border-radius: 12px;
  background: var(--gray-100);
  animation: km-pulse 1.5s ease-in-out infinite;
}
.km-skeleton-lg { width: 160px; height: 56px; }
.km-skeleton-row { display: flex; gap: 16px; }
@keyframes km-pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }

.km-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 8px;
}
.km-empty-icon { font-size: 36px; }
.km-empty-text { font-size: 14px; color: var(--gray-400); }

.km-toolbar {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.km-tool-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--gray-500);
  box-shadow: var(--shadow);
  transition: background 0.15s;
}
.km-tool-btn:active { background: var(--gray-100); }

.km-legend {
  position: absolute;
  bottom: 10px;
  left: 10px;
  z-index: 10;
  display: flex;
  gap: 12px;
  padding: 6px 12px;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: var(--shadow);
}
.km-legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--gray-500);
}
.km-legend-dot { width: 8px; height: 8px; border-radius: 50%; }

:deep(.vue-flow) { background: transparent !important; }
:deep(.vue-flow__pane) { cursor: grab; }
:deep(.vue-flow__pane:active) { cursor: grabbing; }
:deep(.vue-flow__edge-path) { transition: stroke 0.2s, stroke-width 0.2s; }
:deep(.vue-flow__node) { padding: 0; border: none; border-radius: 0; background: transparent; box-shadow: none; }
</style>
