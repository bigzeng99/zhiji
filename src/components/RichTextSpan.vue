<template>
  <template v-for="(seg, i) in segments" :key="i">
    <mark
      v-if="seg.concept"
      class="kw-link"
      :data-term="seg.concept.label"
      :data-explanation="seg.concept.explanation"
    >{{ seg.text }}</mark>
    <template v-else>{{ seg.text }}</template>
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { RichText, ConceptRef } from '../types/answer'

const props = defineProps<{ rich: RichText }>()

interface Segment {
  text: string
  concept?: ConceptRef
}

const segments = computed<Segment[]>(() => {
  const { text, concepts } = props.rich
  if (!concepts || concepts.length === 0) return [{ text }]

  const sorted = [...concepts]
    .map(c => ({ ...c, idx: text.indexOf(c.label) }))
    .filter(c => c.idx !== -1)
    .sort((a, b) => a.idx - b.idx || b.label.length - a.label.length)

  if (sorted.length === 0) return [{ text }]

  const result: Segment[] = []
  let cursor = 0
  const used = new Set<string>()

  for (const c of sorted) {
    if (used.has(c.label)) continue
    const idx = text.indexOf(c.label, cursor)
    if (idx === -1) continue
    if (idx > cursor) result.push({ text: text.slice(cursor, idx) })
    result.push({ text: c.label, concept: c })
    cursor = idx + c.label.length
    used.add(c.label)
  }
  if (cursor < text.length) result.push({ text: text.slice(cursor) })
  return result
})
</script>
