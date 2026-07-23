<template>
  <nav class="tab-bar">
    <router-link
      v-for="tab in tabs"
      :key="tab.path"
      :to="tab.path"
      class="tab-item"
      :class="{ active: $route.path === tab.path }"
      @click="onTabClick(tab.path)"
    >
      <div class="tab-icon-wrap">
        <span class="tab-icon" v-html="tab.icon"></span>
        <span v-if="tab.path === '/review' && badgeCount > 0" class="tab-badge">{{ badgeCount }}</span>
      </div>
      <span class="tab-label">{{ tab.label }}</span>
    </router-link>
  </nav>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { store } from '../store'

const route = useRoute()

onMounted(() => {
  if (!store._overviewLoadedAt) store.loadOverview()
})

function onTabClick(path: string) {
  if (route.path === path) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    if (path === '/feed') {
      store.feedNeedsRefresh = true
    }
  }
}

const badgeCount = computed(() => {
  if (store.sessionDone) return 0
  return store.reviewQueue.length
})

const tabs = [
  {
    path: '/feed',
    label: '知识流',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/></svg>`
  },
  {
    path: '/review',
    label: '复习',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg>`
  },
  {
    path: '/library',
    label: '知识库',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>`
  },
  {
    path: '/profile',
    label: '我的',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`
  }
]
</script>

<style scoped>
.tab-bar {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translate3d(-50%, 0, 0);
  -webkit-transform: translate3d(-50%, 0, 0);
  will-change: transform;
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
  width: 100%;
  max-width: 430px;
  display: flex;
  justify-content: space-around;
  align-items: center;
  background: var(--glass);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  border-top: 1px solid var(--border-color);
  padding: 8px 0 env(safe-area-inset-bottom, 10px);
  z-index: 100;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  -webkit-user-select: none;
}

.tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-decoration: none;
  color: var(--gray-400);
  font-size: 11px;
  padding: 6px 16px;
  transition: color 0.2s;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  cursor: pointer;
}

.tab-item.active {
  color: var(--primary);
}

.tab-icon-wrap {
  position: relative;
  margin-bottom: 2px;
}

.tab-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.tab-badge {
  position: absolute;
  top: -6px;
  right: -10px;
  background: var(--red);
  color: white;
  font-size: 10px;
  font-weight: 600;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}

.tab-label {
  font-size: 11px;
  font-weight: 500;
}

.tab-item.active .tab-label {
  font-weight: 700;
}
</style>
