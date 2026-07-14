<template>
  <Teleport to="body">
    <div v-if="visible" class="kw-overlay" @click.self="close">
      <div class="kw-sheet">
        <div class="kw-sheet-handle"></div>
        <div class="kw-sheet-header">
          <span class="kw-sheet-term">{{ currentEntry?.term }}</span>
          <span class="kw-close" @click="close">✕</span>
        </div>
        <p class="kw-sheet-def">{{ currentEntry?.definition }}</p>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import glossaryData from '../data/glossary.json'

const glossary = glossaryData as Array<{ term: string; definition: string; link_point_id: string | null }>

const visible = ref(false)
const currentEntry = ref<typeof glossary[0] | null>(null)

function handleClick(e: MouseEvent) {
  const target = (e.target as HTMLElement).closest('.kw-link') as HTMLElement
  if (!target) return
  const term = target.dataset.term
  if (!term) return
  e.preventDefault()
  e.stopPropagation()
  e.stopImmediatePropagation()
  const entry = glossary.find(g => g.term === term)
  const inlineExplanation = target.dataset.explanation
  if (inlineExplanation) {
    currentEntry.value = { term, definition: inlineExplanation, link_point_id: null }
  } else if (!entry) {
    currentEntry.value = { term, definition: '暂无释义', link_point_id: null }
  } else {
    currentEntry.value = entry
  }
  visible.value = true
}

function close() {
  visible.value = false
  currentEntry.value = null
}

onMounted(() => {
  document.addEventListener('click', handleClick, true)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClick, true)
})
</script>

<style scoped>
.kw-overlay { position: fixed; inset: 0; z-index: 500; background: rgba(0,0,0,0.3); display: flex; align-items: flex-end; justify-content: center; }
.kw-sheet {
  background: var(--card-bg);
  border-radius: 20px 20px 0 0;
  padding: 8px 20px 32px;
  width: 100%;
  max-width: 430px;
  box-shadow: 0 -4px 24px rgba(0,0,0,0.12);
  animation: sheetUp 0.25s ease;
}
@keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
.kw-sheet-handle { width: 36px; height: 4px; border-radius: 2px; background: var(--gray-300); margin: 0 auto 12px; }
.kw-sheet-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.kw-sheet-term { font-size: 18px; font-weight: 700; color: var(--primary); }
.kw-close { font-size: 20px; color: var(--gray-400); cursor: pointer; padding: 4px; }
.kw-sheet-def { font-size: 15px; color: var(--gray-700); line-height: 1.8; margin: 0; }
</style>
