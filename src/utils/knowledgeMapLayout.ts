import type { Node, Edge } from '@vue-flow/core'
import type { KnowledgeMapNodeData } from './knowledgeMapAdapter'

const NODE_SIZES: Record<string, { width: number; height: number }> = {
  subject: { width: 160, height: 60 },
  group: { width: 140, height: 52 },
  knowledge: { width: 130, height: 44 }
}

const MIN_NODE_SPACING = 74
const RING_GAP = 100

export function applyRadialLayout(
  nodes: Node<KnowledgeMapNodeData>[],
  edges: Edge[]
): Node<KnowledgeMapNodeData>[] {
  if (nodes.length === 0) return []

  const subjectNode = nodes.find(n => n.data?.nodeType === 'subject')
  if (!subjectNode) return nodes

  const childMap = new Map<string, string[]>()
  for (const e of edges) {
    if (!childMap.has(e.source)) childMap.set(e.source, [])
    childMap.get(e.source)!.push(e.target)
  }

  const nodeMap = new Map<string, Node<KnowledgeMapNodeData>>()
  for (const n of nodes) nodeMap.set(n.id, n)

  const result: Node<KnowledgeMapNodeData>[] = []
  const subjectSize = NODE_SIZES.subject

  result.push({
    ...subjectNode,
    position: { x: -subjectSize.width / 2, y: -subjectSize.height / 2 }
  })

  const groupIds = childMap.get(subjectNode.id) || []
  if (groupIds.length === 0) return result

  const firstChildType = nodeMap.get(groupIds[0])?.data?.nodeType
  const isDirectKnowledge = firstChildType === 'knowledge'

  if (isDirectKnowledge) {
    const r1 = Math.max(180, (groupIds.length * MIN_NODE_SPACING) / (2 * Math.PI))
    placeInCircle(groupIds, r1, 0, nodeMap, result)
    return result
  }

  const hasExpanded = groupIds.some(gid => (childMap.get(gid) || []).length > 0)
  const r1 = hasExpanded
    ? Math.max(220, (groupIds.length * MIN_NODE_SPACING) / (2 * Math.PI))
    : Math.max(180, (groupIds.length * MIN_NODE_SPACING) / (2 * Math.PI))
  placeInCircle(groupIds, r1, 0, nodeMap, result)

  for (let gi = 0; gi < groupIds.length; gi++) {
    const gid = groupIds[gi]
    const knowledgeIds = childMap.get(gid) || []
    if (knowledgeIds.length === 0) continue

    const groupAngle = (2 * Math.PI * gi) / groupIds.length - Math.PI / 2
    const gcx = r1 * Math.cos(groupAngle)
    const gcy = r1 * Math.sin(groupAngle)

    const maxSpread = Math.min(Math.PI * 0.9, (2 * Math.PI) / groupIds.length * 0.9)
    placeKnowledgeFan(gcx, gcy, groupAngle, maxSpread, knowledgeIds, nodeMap, result)
  }

  return result
}

function placeKnowledgeFan(
  cx: number,
  cy: number,
  centerAngle: number,
  allowedSpread: number,
  ids: string[],
  nodeMap: Map<string, Node<KnowledgeMapNodeData>>,
  result: Node<KnowledgeMapNodeData>[]
) {
  const count = ids.length
  const baseRadius = 160

  // Figure out how many nodes fit per ring at baseRadius given the allowed angular spread,
  // then add more rings (further out) for the remainder instead of cramming everything
  // onto a single arc.
  const arcAtBase = baseRadius * allowedSpread
  const maxPerRing = Math.max(1, Math.floor(arcAtBase / MIN_NODE_SPACING) + 1)

  let idx = 0
  let ring = 0
  while (idx < count) {
    const radius = baseRadius + ring * RING_GAP
    const remaining = count - idx
    const thisRingCount = Math.min(maxPerRing, remaining)
    const startAngle = centerAngle - allowedSpread / 2

    for (let i = 0; i < thisRingCount; i++) {
      const id = ids[idx]
      const node = nodeMap.get(id)
      idx++
      if (!node) continue
      const size = NODE_SIZES[node.type || 'knowledge'] || NODE_SIZES.knowledge
      const angle = thisRingCount === 1
        ? centerAngle
        : startAngle + (allowedSpread * i) / (thisRingCount - 1)
      const x = cx + radius * Math.cos(angle)
      const y = cy + radius * Math.sin(angle)
      result.push({
        ...node,
        position: { x: x - size.width / 2, y: y - size.height / 2 }
      })
    }
    ring++
  }
}

function placeInCircle(
  ids: string[],
  radius: number,
  offsetAngle: number,
  nodeMap: Map<string, Node<KnowledgeMapNodeData>>,
  result: Node<KnowledgeMapNodeData>[]
) {
  const count = ids.length
  for (let i = 0; i < count; i++) {
    const id = ids[i]
    const node = nodeMap.get(id)
    if (!node) continue
    const size = NODE_SIZES[node.type || 'knowledge'] || NODE_SIZES.knowledge
    const angle = (2 * Math.PI * i) / count - Math.PI / 2 + offsetAngle
    const x = radius * Math.cos(angle)
    const y = radius * Math.sin(angle)
    result.push({
      ...node,
      position: { x: x - size.width / 2, y: y - size.height / 2 }
    })
  }
}
