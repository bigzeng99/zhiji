<template>
  <div class="editor-overlay" @click.self="$emit('close')">
    <div class="editor-panel">
      <div class="editor-header">
        <h3>{{ point ? '编辑知识点' : '添加知识点' }}</h3>
        <span class="close-btn" @click="$emit('close')">✕</span>
      </div>
      <form @submit.prevent="save">
        <div class="field">
          <label>标题 *</label>
          <input v-model="form.title" placeholder="如：马斯洛需求层次理论" required />
        </div>
        <div class="field">
          <label>分类</label>
          <input v-model="form.category" placeholder="如：动机理论" />
        </div>
        <div class="field">
          <label>问题 *</label>
          <textarea v-model="form.question" placeholder="用来记忆的问题..." rows="3" required></textarea>
        </div>
        <div class="field">
          <label>答案 *</label>
          <textarea v-model="form.answer" placeholder="问题的详细答案..." rows="5" required></textarea>
        </div>
        <button type="submit" class="save-btn" :disabled="saving">{{ saving ? '保存中...' : '保存' }}</button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '../db'

const props = defineProps<{ point: any; subjectId: string }>()
const emit = defineEmits(['close', 'saved'])
const saving = ref(false)
const form = ref({ title: '', category: '', question: '', answer: '' })

onMounted(() => {
  if (props.point) {
    form.value = {
      title: props.point.title,
      category: props.point.category,
      question: props.point.question,
      answer: props.point.answer
    }
  }
})

async function save() {
  saving.value = true
  try {
    if (props.point) {
      await api.updatePoint(props.point.id, form.value)
    } else {
      await api.createPoint({ subject_id: props.subjectId, ...form.value })
    }
    emit('saved')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.editor-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 300; display: flex; align-items: center; justify-content: center; }
.editor-panel { background: white; width: 90%; max-width: 400px; border-radius: var(--radius-lg); padding: 24px; max-height: 90vh; overflow-y: auto; }
.editor-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.editor-header h3 { font-size: 18px; }
.close-btn { font-size: 20px; cursor: pointer; color: var(--gray-400); }
.field { margin-bottom: 16px; }
.field label { display: block; font-size: 14px; font-weight: 600; color: var(--gray-700); margin-bottom: 6px; }
.field input, .field textarea { width: 100%; padding: 10px 12px; border: 1px solid var(--gray-200); border-radius: var(--radius-sm); font-size: 14px; font-family: inherit; resize: vertical; }
.field input:focus, .field textarea:focus { outline: none; border-color: var(--primary); }
.save-btn { width: 100%; padding: 14px; background: var(--primary); color: white; border: none; border-radius: var(--radius); font-size: 16px; font-weight: 600; cursor: pointer; }
.save-btn:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
