import type { Node, Edge } from '@vue-flow/core'
import mapData from '../data/mapCategories.json'

export type KnowledgeStatus = 'unlearned' | 'learning' | 'mastered' | 'review'

export interface KnowledgeMapNodeData {
  title: string
  nodeType: 'subject' | 'group' | 'knowledge'
  subjectId: string
  knowledgeId?: string
  status: KnowledgeStatus
  progress?: number
  count?: number
  totalCount?: number
  icon?: string
  color?: string
}

export interface SubjectInput {
  id: string
  name: string
  icon?: string
  color?: string
}

export interface PointInput {
  id: string
  subject_id: string
  title: string
  category: string
  interval: number
  repetitions: number
  next_review: string
  suspended?: number
  source_id?: string
  updated_at?: string
}

export function getKnowledgeStatus(point: PointInput): KnowledgeStatus {
  if (point.repetitions === 0) return 'unlearned'
  const today = new Date().toISOString().slice(0, 10)
  if (point.next_review <= today) return 'review'
  if (point.interval >= 30) return 'mastered'
  return 'learning'
}

export interface GroupInfo {
  key: string
  label: string
  points: PointInput[]
  learnedCount: number
}

const pointMap = (mapData as any).pointMap as Record<string, { catId: string; catName: string; order: number }>

const DEFAULT_MAX_VISIBLE_CATEGORIES = 10

// Bump this whenever aggregateKnowledgeCategories' rules change (max visible
// count, merge behavior, lookup fallback order, etc). Cached map layouts are
// keyed on this, so a rule change invalidates stale cached groupings without
// touching the underlying knowledge base data.
export const CATEGORY_RULE_VERSION = 3

function lookupCategoryEntry(p: PointInput) {
  return pointMap[p.id] || (p.source_id ? pointMap[p.source_id] : undefined)
}

export interface AggregateCategoriesOptions {
  maxVisibleCategories?: number
  mergeRemaining?: boolean
}

/**
 * Single source of truth for turning a subject's raw points into display
 * categories. Every entry point into the knowledge map (map view, cache
 * rebuild, future embeds) must go through this before generating nodes,
 * edges, or layout — never filter/hide categories after the fact.
 */
export function aggregateKnowledgeCategories(
  points: PointInput[],
  options: AggregateCategoriesOptions = {}
): GroupInfo[] {
  const maxVisibleCategories = options.maxVisibleCategories ?? DEFAULT_MAX_VISIBLE_CATEGORIES
  const mergeRemaining = options.mergeRemaining ?? true

  const catPoints = new Map<string, PointInput[]>()
  const catNames = new Map<string, string>()
  const catOrder = new Map<string, number>()
  let hasMapping = false

  for (const p of points) {
    const entry = lookupCategoryEntry(p)
    if (entry) {
      hasMapping = true
      if (!catPoints.has(entry.catId)) {
        catPoints.set(entry.catId, [])
        catNames.set(entry.catId, entry.catName)
        catOrder.set(entry.catId, entry.order)
      }
      catPoints.get(entry.catId)!.push(p)
    } else {
      const fallback = p.category?.trim() || '未分类'
      if (!catPoints.has('__fb_' + fallback)) {
        catPoints.set('__fb_' + fallback, [])
        catNames.set('__fb_' + fallback, fallback)
        catOrder.set('__fb_' + fallback, 900)
      }
      catPoints.get('__fb_' + fallback)!.push(p)
    }
  }

  let all: GroupInfo[] = []
  if (hasMapping) {
    for (const [key, pts] of catPoints) {
      if (pts.length === 0) continue
      all.push({
        key,
        label: catNames.get(key) || key,
        points: pts,
        learnedCount: pts.filter(p => p.repetitions > 0).length
      })
    }
    all.sort((a, b) => (catOrder.get(a.key) ?? 999) - (catOrder.get(b.key) ?? 999))
  } else {
    for (const [key, pts] of catPoints) {
      all.push({
        key,
        label: catNames.get(key) || key.replace(/^__fb_/, ''),
        points: pts,
        learnedCount: pts.filter(p => p.repetitions > 0).length
      })
    }
    all.sort((a, b) => b.points.length - a.points.length)
  }

  if (!mergeRemaining || all.length <= maxVisibleCategories) return all

  const visible = all.slice(0, maxVisibleCategories - 1)
  const rest = all.slice(maxVisibleCategories - 1)
  const mergedPoints = rest.flatMap(g => g.points)
  visible.push({
    key: '__other__',
    label: `其他（${rest.length} 个分类）`,
    points: mergedPoints,
    learnedCount: mergedPoints.filter(p => p.repetitions > 0).length
  })
  return visible
}

export interface MapData {
  nodes: Node<KnowledgeMapNodeData>[]
  edges: Edge[]
  groups: GroupInfo[]
}

export function buildMapData(
  subject: SubjectInput,
  points: PointInput[],
  expandedGroups: Set<string>,
  precomputedGroups?: GroupInfo[]
): MapData {
  const nodes: Node<KnowledgeMapNodeData>[] = []
  const edges: Edge[] = []
  const activePoints = points.filter(p => !p.suspended)
  const groups = precomputedGroups || aggregateKnowledgeCategories(activePoints)
  const totalLearned = activePoints.filter(p => p.repetitions > 0).length
  const progress = activePoints.length > 0 ? Math.round(totalLearned / activePoints.length * 100) : 0

  const subjectNodeId = `s_${subject.id}`
  nodes.push({
    id: subjectNodeId,
    type: 'subject',
    position: { x: 0, y: 0 },
    data: {
      title: subject.name,
      nodeType: 'subject',
      subjectId: subject.id,
      status: progress >= 80 ? 'mastered' : progress > 0 ? 'learning' : 'unlearned',
      progress,
      count: activePoints.length,
      icon: subject.icon,
      color: subject.color
    }
  })

  if (groups.length <= 1 && groups[0]?.label === '未分类') {
    for (const p of activePoints) {
      const nodeId = `k_${p.id}`
      nodes.push({
        id: nodeId,
        type: 'knowledge',
        position: { x: 0, y: 0 },
        data: {
          title: p.title,
          nodeType: 'knowledge',
          subjectId: subject.id,
          knowledgeId: p.id,
          status: getKnowledgeStatus(p)
        }
      })
      edges.push({
        id: `e_${subjectNodeId}_${nodeId}`,
        source: subjectNodeId,
        target: nodeId,
        type: 'smoothstep'
      })
    }
  } else {
    for (const group of groups) {
      const groupNodeId = `g_${subject.id}_${group.key}`
      const groupProgress = group.points.length > 0
        ? Math.round(group.learnedCount / group.points.length * 100)
        : 0

      nodes.push({
        id: groupNodeId,
        type: 'group',
        position: { x: 0, y: 0 },
        data: {
          title: group.label,
          nodeType: 'group',
          subjectId: subject.id,
          status: groupProgress >= 80 ? 'mastered' : groupProgress > 0 ? 'learning' : 'unlearned',
          progress: groupProgress,
          count: group.learnedCount,
          totalCount: group.points.length,
          color: subject.color
        }
      })

      edges.push({
        id: `e_${subjectNodeId}_${groupNodeId}`,
        source: subjectNodeId,
        target: groupNodeId,
        type: 'smoothstep'
      })

      if (expandedGroups.has(group.key)) {
        for (const p of group.points) {
          const nodeId = `k_${p.id}`
          nodes.push({
            id: nodeId,
            type: 'knowledge',
            position: { x: 0, y: 0 },
            data: {
              title: p.title,
              nodeType: 'knowledge',
              subjectId: subject.id,
              knowledgeId: p.id,
              status: getKnowledgeStatus(p)
            }
          })
          edges.push({
            id: `e_${groupNodeId}_${nodeId}`,
            source: groupNodeId,
            target: nodeId,
            type: 'smoothstep'
          })
        }
      }
    }
  }

  return { nodes, edges, groups }
}

export function computeDataVersion(subjectId: string, points: PointInput[]): string {
  let maxUpdated = ''
  for (const p of points) {
    if (p.updated_at && p.updated_at > maxUpdated) maxUpdated = p.updated_at
  }
  return `${subjectId}|${points.length}|${maxUpdated}|rule${CATEGORY_RULE_VERSION}`
}
