<template>
  <div class="app-shell">
    <router-view v-slot="{ Component }">
      <keep-alive :exclude="['ReviewView', 'KnowledgeMapView']">
        <component :is="Component" />
      </keep-alive>
    </router-view>
    <TabBar v-if="!isAuthPage && !isSharePage && !isMapPage" />

    <KeywordPopover />

    <div v-if="bgUpload.active" class="bg-toast" :class="{ done: bgUpload.finished }">
      <span class="bg-toast-icon">{{ bgUpload.finished ? '✓' : '⏳' }}</span>
      <span class="bg-toast-text">{{ bgUpload.finished ? bgUpload.result : `${bgUpload.label}... ${bgUpload.done > 0 ? bgUpload.done + '条' : ''}` }}</span>
    </div>

    <transition name="fade">
      <div v-if="offline" class="offline-toast">
        <span class="offline-icon">📡</span>
        <span>当前离线，部分功能不可用</span>
      </div>
    </transition>

    <div v-if="showInstallTip" class="install-overlay" @click="dismissTip">
      <div class="install-dialog" @click.stop>
        <div class="install-icon">📲</div>
        <h3 class="install-title">添加到主屏幕</h3>
        <p class="install-desc">将「知记」添加到主屏幕，获得更好的使用体验：全屏显示、离线可用、一键启动。</p>
        <div class="install-steps" v-if="isIOS">
          <div class="step"><span class="step-num">1</span>点击底部 Safari 的 <strong>分享按钮</strong> <span class="share-icon">⬆</span></div>
          <div class="step"><span class="step-num">2</span>滑动找到 <strong>「添加到主屏幕」</strong></div>
          <div class="step"><span class="step-num">3</span>点击右上角 <strong>「添加」</strong></div>
        </div>
        <div class="install-steps" v-else>
          <div class="step"><span class="step-num">1</span>点击浏览器右上角 <strong>菜单 ⋮</strong></div>
          <div class="step"><span class="step-num">2</span>选择 <strong>「添加到主屏幕」</strong></div>
          <div class="step"><span class="step-num">3</span>点击 <strong>「安装」或「添加」</strong></div>
        </div>
        <button class="install-btn" @click="dismissTip">我知道了</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import TabBar from './components/TabBar.vue'
import KeywordPopover from './components/KeywordPopover.vue'
import { bgUpload } from './utils/bgUpload'

const route = useRoute()
const isAuthPage = computed(() => route.path === '/auth')
const isSharePage = computed(() => route.path.startsWith('/share'))
const isMapPage = computed(() => route.path.startsWith('/map'))

const showInstallTip = ref(false)
const isIOS = ref(false)
const offline = ref(!navigator.onLine)

function goOnline() { offline.value = false }
function goOffline() { offline.value = true }

onMounted(() => {
  window.addEventListener('online', goOnline)
  window.addEventListener('offline', goOffline)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as any).standalone === true
  if (isStandalone) return

  const dismissed = localStorage.getItem('zhiji_install_tip_dismissed')
  if (dismissed) return

  isIOS.value = /iPad|iPhone|iPod/.test(navigator.userAgent)
  showInstallTip.value = true
})

onUnmounted(() => {
  window.removeEventListener('online', goOnline)
  window.removeEventListener('offline', goOffline)
})

function dismissTip() {
  showInstallTip.value = false
  localStorage.setItem('zhiji_install_tip_dismissed', '1')
}
</script>

<style scoped>
.app-shell {
  position: relative;
  min-height: 100vh;
  min-height: 100dvh;
}

.install-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.install-dialog {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  padding: 28px 24px;
  max-width: 340px;
  width: 100%;
  text-align: center;
}

.install-icon { font-size: 48px; margin-bottom: 12px; }
.install-title { font-size: 20px; font-weight: 700; margin-bottom: 8px; color: var(--gray-900); }
.install-desc { font-size: 14px; color: var(--gray-500); line-height: 1.6; margin-bottom: 20px; }

.install-steps { text-align: left; margin-bottom: 20px; }
.step { display: flex; align-items: flex-start; gap: 10px; padding: 8px 0; font-size: 14px; color: var(--gray-700); line-height: 1.5; }
.step-num { width: 22px; height: 22px; border-radius: 50%; background: var(--primary); color: white; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
.share-icon { font-size: 16px; }

.bg-toast { position: fixed; top: env(safe-area-inset-top, 12px); left: 50%; transform: translateX(-50%); background: rgba(30,30,50,0.92); color: white; padding: 10px 18px; border-radius: 24px; display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500; z-index: 1000; box-shadow: 0 4px 20px rgba(0,0,0,0.3); max-width: calc(100vw - 32px); animation: slideDown 0.3s ease; }
.bg-toast.done { background: rgba(16, 185, 129, 0.92); }
.bg-toast-icon { font-size: 16px; flex-shrink: 0; }
@keyframes slideDown { from { transform: translateX(-50%) translateY(-20px); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }

.offline-toast { position: fixed; bottom: calc(74px + env(safe-area-inset-bottom, 10px)); left: 50%; transform: translateX(-50%); background: rgba(239, 68, 68, 0.92); color: white; padding: 8px 18px; border-radius: 20px; display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; z-index: 1000; white-space: nowrap; }
.offline-icon { font-size: 14px; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.install-btn {
  width: 100%;
  padding: 14px;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: var(--radius-input);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}
</style>
