<template>
  <div
    class="km-node"
    :class="[
      `km-node--${data.nodeType}`,
      `km-node--${data.status}`,
      { 'km-node--selected': selected, 'km-node--dimmed': dimmed }
    ]"
  >
    <div v-if="data.nodeType === 'subject'" class="km-node-inner km-subject">
      <span class="km-subject-icon" :style="{ background: data.color || '#3B82F6' }">{{ data.icon || '📚' }}</span>
      <div class="km-subject-info">
        <span class="km-subject-title">{{ data.title }}</span>
        <span class="km-subject-meta">{{ data.count }} 个知识点 · {{ data.progress }}%</span>
      </div>
    </div>

    <div v-else-if="data.nodeType === 'group'" class="km-node-inner km-group">
      <div class="km-group-bar" :style="{ background: data.color || '#3B82F6', width: (data.progress || 0) + '%' }"></div>
      <span class="km-group-title">{{ data.title }}</span>
      <span class="km-group-meta">{{ data.count }}/{{ data.totalCount }}</span>
      <span class="km-group-arrow">{{ expanded ? '▾' : '▸' }}</span>
    </div>

    <div v-else class="km-node-inner km-knowledge">
      <span class="km-status-dot"></span>
      <span class="km-knowledge-title">{{ truncatedTitle }}</span>
      <span class="km-status-label">{{ statusLabel }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { KnowledgeMapNodeData, KnowledgeStatus } from '../utils/knowledgeMapAdapter'

const props = defineProps<{
  data: KnowledgeMapNodeData
  selected?: boolean
  dimmed?: boolean
  expanded?: boolean
}>()

const STATUS_LABELS: Record<KnowledgeStatus, string> = {
  unlearned: '未学',
  learning: '学习中',
  mastered: '已掌握',
  review: '待复习'
}

const truncatedTitle = computed(() => {
  const t = props.data.title
  return t.length > 10 ? t.slice(0, 10) + '…' : t
})

const statusLabel = computed(() => STATUS_LABELS[props.data.status])
</script>

<style scoped>
.km-node {
  cursor: pointer;
  user-select: none;
  transition: opacity 0.2s, box-shadow 0.2s;
}

.km-node--dimmed {
  opacity: 0.35;
}

.km-node-inner {
  border-radius: 12px;
  background: var(--card-bg);
  border: 1.5px solid var(--border-color);
  box-shadow: var(--shadow);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.km-node--selected .km-node-inner {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.18), var(--shadow);
}

/* ---- Subject node ---- */
.km-subject {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  min-width: 150px;
}
.km-subject-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: white;
  flex-shrink: 0;
}
.km-subject-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.km-subject-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--gray-900);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.km-subject-meta {
  font-size: 11px;
  color: var(--gray-400);
  white-space: nowrap;
}

/* ---- Group node ---- */
.km-group {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  min-width: 120px;
}
.km-group-bar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  opacity: 0.1;
  transition: width 0.3s;
}
.km-group-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--gray-900);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
  position: relative;
}
.km-group-meta {
  font-size: 11px;
  color: var(--gray-400);
  flex-shrink: 0;
  position: relative;
}
.km-group-arrow {
  font-size: 12px;
  color: var(--gray-400);
  flex-shrink: 0;
  position: relative;
}

/* ---- Knowledge node ---- */
.km-knowledge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  min-width: 100px;
}
.km-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.km-knowledge-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--gray-900);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}
.km-status-label {
  font-size: 10px;
  flex-shrink: 0;
  padding: 1px 5px;
  border-radius: 4px;
}

/* ---- Status colors ---- */
.km-node--unlearned .km-status-dot { background: var(--gray-300); }
.km-node--learning .km-status-dot { background: var(--primary); }
.km-node--mastered .km-status-dot { background: var(--green); }
.km-node--review .km-status-dot { background: var(--orange); }

.km-node--unlearned .km-status-label { color: var(--gray-400); background: var(--gray-100); }
.km-node--learning .km-status-label { color: var(--primary); background: rgba(59,130,246,0.1); }
.km-node--mastered .km-status-label { color: var(--green); background: rgba(16,185,129,0.1); }
.km-node--review .km-status-label { color: var(--orange); background: rgba(245,158,11,0.1); }
</style>
