<template>
  <div class="page profile-page">
    <div class="profile-header-actions">
      <span class="h-icon">⚙️</span>
      <span class="h-icon">✉️</span>
    </div>

    <div class="user-info">
      <div class="avatar"><div class="avatar-placeholder">👨‍🎓</div></div>
      <div class="user-detail">
        <div class="username">知记学员</div>
        <span class="level-badge">LV.{{ level }}</span>
        <div class="upgrade-hint">已学习 <strong>{{ profile.learned_points }}</strong> 个知识点</div>
      </div>
    </div>

    <div class="streak-card card">
      <div class="streak-item"><div class="streak-value">{{ profile.streak }}</div><div class="streak-label">当前连续</div></div>
      <div class="streak-divider"></div>
      <div class="streak-item"><div class="streak-value">{{ profile.max_streak }}</div><div class="streak-label">最大连续</div></div>
      <div class="streak-divider"></div>
      <div class="streak-item"><div class="streak-value">{{ profile.total_study_days }}</div><div class="streak-label">累计学习天</div></div>
    </div>

    <div class="settings-list card">
      <div class="setting-item"><span class="setting-icon">📋</span><span class="setting-label">总知识点</span><span class="setting-value">{{ profile.total_points }}</span></div>
      <div class="setting-item"><span class="setting-icon">✅</span><span class="setting-label">已学习</span><span class="setting-value">{{ profile.learned_points }}</span></div>
      <div class="setting-item"><span class="setting-icon">📝</span><span class="setting-label">总复习次数</span><span class="setting-value">{{ profile.total_reviews }}</span></div>
      <div class="setting-item"><span class="setting-icon">📈</span><span class="setting-label">日均新学</span><span class="setting-value">{{ profile.avg_new_per_day }}</span></div>
      <div class="setting-item"><span class="setting-icon">🔄</span><span class="setting-label">日均复习</span><span class="setting-value">{{ profile.avg_review_per_day }}</span></div>
    </div>

    <div class="section-title">各学科学习进度</div>
    <div class="progress-list card">
      <div class="progress-item" v-for="s in profile.subjects" :key="s.id">
        <div class="icon-circle" :style="{ background: s.color }">{{ s.icon }}</div>
        <span class="progress-name">{{ s.name }}</span>
        <div class="progress-bar-wrap"><div class="progress-bar-bg"><div class="progress-bar-fill" :style="{ width: s.progress + '%', background: s.color }"></div></div></div>
        <span class="progress-percent">{{ s.progress }}%</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { api } from '../db'

const profile = ref<any>({
  total_reviews: 0, total_points: 0, learned_points: 0,
  streak: 0, max_streak: 0, total_study_days: 0,
  avg_new_per_day: 0, avg_review_per_day: 0, subjects: []
})

const level = computed(() => Math.max(1, Math.floor(profile.value.total_reviews / 20) + 1))

onMounted(async () => {
  profile.value = await api.getProfile()
})
</script>

<style scoped>
.profile-page { background: var(--white); }
.profile-header-actions { display: flex; justify-content: flex-end; gap: 16px; padding: 12px 0 4px; font-size: 20px; }
.h-icon { cursor: pointer; }

.user-info { display: flex; align-items: center; gap: 16px; padding: 16px 0; }
.avatar { width: 64px; height: 64px; border-radius: 50%; background: var(--primary-bg); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.avatar-placeholder { font-size: 36px; }
.user-detail { flex: 1; }
.username { font-size: 18px; font-weight: 700; color: var(--gray-900); margin-bottom: 4px; }
.level-badge { display: inline-block; background: var(--primary); color: white; font-size: 11px; font-weight: 700; padding: 2px 10px; border-radius: 4px; margin-bottom: 4px; }
.upgrade-hint { font-size: 13px; color: var(--gray-500); }
.upgrade-hint strong { color: var(--primary); }

.card { background: var(--gray-50); border: 1px solid var(--gray-200); border-radius: var(--radius); padding: 16px; margin-bottom: 12px; box-shadow: var(--shadow); }
.streak-card { display: flex; align-items: center; }
.streak-item { flex: 1; text-align: center; }
.streak-value { font-size: 24px; font-weight: 700; color: var(--gray-900); }
.streak-label { font-size: 11px; color: var(--gray-500); margin-top: 2px; }
.streak-divider { width: 1px; height: 36px; background: var(--gray-200); }

.settings-list { padding: 0; }
.setting-item { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-bottom: 1px solid var(--gray-100); }
.setting-item:last-child { border-bottom: none; }
.setting-icon { font-size: 18px; }
.setting-label { flex: 1; font-size: 15px; color: var(--gray-700); }
.setting-value { font-size: 14px; font-weight: 600; color: var(--primary); background: var(--primary-bg); padding: 4px 12px; border-radius: 8px; }

.section-title { font-size: 16px; font-weight: 700; color: var(--gray-900); margin: 16px 0 8px; }
.progress-list { padding: 8px 16px; }
.progress-item { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--gray-100); }
.progress-item:last-child { border-bottom: none; }
.icon-circle { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px; color: white; flex-shrink: 0; }
.progress-name { font-size: 14px; font-weight: 500; width: 50px; }
.progress-bar-wrap { flex: 1; }
.progress-bar-bg { height: 10px; background: var(--gray-200); border-radius: 5px; overflow: hidden; }
.progress-bar-fill { height: 100%; border-radius: 5px; transition: width 0.5s; }
.progress-percent { font-size: 13px; color: var(--gray-500); width: 36px; text-align: right; }
</style>
