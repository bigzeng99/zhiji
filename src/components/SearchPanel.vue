<template>
  <div class="search-overlay">
    <div class="search-panel">
      <div class="search-header">
        <div class="search-input-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            ref="searchInput"
            v-model="keyword"
            placeholder="搜索知识点..."
            class="search-input"
            @input="onInput"
          />
          <span v-if="keyword" class="clear-btn" @click="clearSearch">✕</span>
        </div>
        <span class="cancel-btn" @click="$emit('close')">取消</span>
      </div>

      <div class="search-body">
        <div v-if="activeResult" class="detail-view">
          <div class="detail-back" @click="activeResult = null">← 返回搜索</div>
          <div class="detail-subject" :style="{ color: activeResult.subject_color }">
            {{ activeResult.subject_icon }} {{ activeResult.subject_name }} · {{ activeResult.category }}
          </div>
          <h2 class="detail-title">{{ activeResult.title }}</h2>
          <button class="detail-fav-btn" :class="{ active: activeResult.favorited }" @click="toggleFav(activeResult)">
            {{ activeResult.favorited ? '★ 已收藏' : '☆ 加入收藏' }}
          </button>
          <div class="detail-section">
            <div class="detail-label">问题</div>
            <div class="detail-text md-content" v-html="renderMd(activeResult.question)"></div>
          </div>
          <div class="detail-section">
            <div class="detail-label">答案</div>
            <AnswerRenderer class="detail-text" :answer="activeResult.answer" />
          </div>
        </div>

        <template v-else>
          <div v-if="searching" class="search-status">搜索中...</div>
          <div v-else-if="keyword && results.length === 0 && searched" class="search-status">未找到相关知识点</div>
          <div v-else-if="!keyword" class="search-status">输入关键词搜索知识点</div>
          <div v-else class="result-list">
            <div class="result-count">找到 {{ results.length }} 个结果</div>
            <div v-for="r in results" :key="r.id" class="result-item" @click="activeResult = r">
              <div class="result-top">
                <span class="result-subject" :style="{ color: r.subject_color }">{{ r.subject_icon }} {{ r.subject_name }}</span>
                <span class="result-fav" :class="{ active: r.favorited }" @click.stop="toggleFav(r)">{{ r.favorited ? '★' : '☆' }}</span>
              </div>
              <div class="result-title">{{ r.title }}</div>
              <div class="result-q">{{ toPlainPreview(r.question) }}</div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { getApi } from '../apiSwitch'
import { auth } from '../auth'
import { renderMd, toPlainPreview } from '../utils/markdown'
import AnswerRenderer from './AnswerRenderer.vue'

defineEmits(['close'])

const keyword = ref('')
const results = ref<any[]>([])
const searching = ref(false)
const searched = ref(false)
const activeResult = ref<any>(null)
const searchInput = ref<HTMLInputElement | null>(null)

let debounceTimer: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  nextTick(() => searchInput.value?.focus())
})

function onInput() {
  if (debounceTimer) clearTimeout(debounceTimer)
  if (!keyword.value.trim()) {
    results.value = []
    searched.value = false
    return
  }
  debounceTimer = setTimeout(() => doSearch(), 300)
}

async function doSearch() {
  const kw = keyword.value.trim()
  if (!kw) return
  searching.value = true
  try {
    results.value = await getApi().searchPoints(kw)
  } catch {
    results.value = []
  } finally {
    searching.value = false
    searched.value = true
  }
}

function clearSearch() {
  keyword.value = ''
  results.value = []
  searched.value = false
  activeResult.value = null
  nextTick(() => searchInput.value?.focus())
}

async function toggleFav(point: any) {
  if (!auth.isLoggedIn.value) {
    alert('请先登录')
    return
  }
  try {
    const res = await getApi().toggleFavorite(point.id)
    point.favorited = res.favorited ? 1 : 0
  } catch (e: any) {
    alert(e.message || '操作失败')
  }
}
</script>

<style scoped>
.search-overlay { position: fixed; inset: 0; background: var(--card-bg); z-index: 200; display: flex; flex-direction: column; max-width: 430px; margin: 0 auto; }
.search-panel { display: flex; flex-direction: column; height: 100%; }

.search-header { display: flex; align-items: center; padding: 12px 16px; gap: 12px; flex-shrink: 0; border-bottom: 1px solid var(--border-color); }
.search-input-wrap { flex: 1; display: flex; align-items: center; background: var(--gray-100); border-radius: 10px; padding: 0 12px; gap: 8px; }
.search-input { flex: 1; border: none; background: transparent; font-size: 16px; padding: 10px 0; outline: none; color: var(--gray-900); }
.search-input::placeholder { color: var(--gray-400); }
.clear-btn { font-size: 16px; color: var(--gray-400); cursor: pointer; padding: 4px; }
.cancel-btn { font-size: 15px; color: var(--primary); cursor: pointer; font-weight: 500; flex-shrink: 0; }

.search-body { overflow-y: auto; padding: 12px 16px 30px; -webkit-overflow-scrolling: touch; flex: 1; overscroll-behavior: contain; }

.search-status { text-align: center; padding: 60px 16px; color: var(--gray-400); font-size: 14px; }

.result-count { font-size: 13px; color: var(--gray-400); margin-bottom: 12px; }
.result-item { cursor: pointer; margin-bottom: 12px; background: var(--gray-50); border-radius: 14px; padding: 16px; border: 1px solid var(--gray-200); transition: background 0.15s; }
.result-item:active { background: var(--gray-100); }
.result-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.result-subject { font-size: 13px; font-weight: 600; }
.result-category { font-size: 12px; color: var(--gray-400); }
.result-title { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
.result-q { font-size: 15px; color: var(--gray-500); line-height: 1.7; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

.detail-view { padding-bottom: 40px; }
.detail-back { font-size: 15px; color: var(--primary); cursor: pointer; padding: 4px 0 16px; }
.detail-subject { font-size: 14px; font-weight: 600; margin-bottom: 8px; }
.detail-title { font-size: 24px; font-weight: 700; margin-bottom: 12px; }
.detail-fav-btn { display: inline-flex; align-items: center; gap: 4px; padding: 6px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; cursor: pointer; border: 1px solid var(--gray-300); background: var(--card-bg); color: var(--gray-500); margin-bottom: 20px; transition: all 0.2s; }
.detail-fav-btn.active { background: rgba(245, 158, 11, 0.1); color: var(--orange); border-color: var(--orange); }
.detail-fav-btn:active { opacity: 0.8; }

.result-fav { font-size: 18px; color: var(--gray-300); cursor: pointer; padding: 2px 4px; transition: color 0.2s; }
.result-fav.active { color: var(--orange); }
.result-fav:active { transform: scale(1.2); }
.detail-section { margin-bottom: 20px; }
.detail-label { font-size: 13px; font-weight: 600; color: var(--primary); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
.detail-text { font-size: 16px; color: var(--gray-700); line-height: 1.8; }
</style>
