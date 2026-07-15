<template>
  <div class="page profile-page">
    <div class="user-info">
      <div class="avatar" :class="{ clickable: !isLoggedIn }" @click="onAvatarClick">
        <img v-if="userAvatar" :src="userAvatar" class="avatar-img" />
        <span v-else class="avatar-fallback">{{ userInitial }}</span>
      </div>
      <div class="user-detail" @click="onAvatarClick" :class="{ clickable: !isLoggedIn }">
        <div class="username">{{ userName }}</div>
        <span class="level-badge" v-if="isLoggedIn">LV.{{ level }}</span>
        <span class="login-hint" v-else>点击登录 ›</span>
      </div>
      <span class="settings-btn" @click="showSettings = !showSettings">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
      </span>
    </div>

    <div class="quick-stats">
      <div class="qs-item"><b>{{ profile.streak }}</b> 天连续</div>
      <div class="qs-dot">·</div>
      <div class="qs-item"><b>{{ profile.learned_points }}</b> 已学</div>
      <div class="qs-dot">·</div>
      <div class="qs-item"><b>{{ profile.total_reviews }}</b> 复习</div>
    </div>

    <div class="section-title-row">
      <span class="section-title-text">学习热力图</span>
      <span class="section-hint">{{ new Date().getFullYear() }} 年</span>
    </div>
    <!-- Heatmap: pad start to Sunday so columns align -->
        <div class="heatmap-wrap">
          <div class="heatmap-scroll">
            <div class="heatmap-months-row">
              <span v-for="m in heatmapMonths" :key="m.key" class="heatmap-month" :style="{ width: (m.cols * 12) + 'px' }">{{ m.label }}</span>
            </div>
            <div class="heatmap-grid">
              <div v-for="(d, i) in heatmapPadded" :key="i" class="heatmap-cell" :style="{ background: d ? heatColor(d.count) : 'transparent' }" :title="d ? d.date + ': ' + d.count + '题' : ''"></div>
            </div>
          </div>
          <div class="heatmap-legend">
            <span class="heatmap-legend-label">少</span>
            <span class="heatmap-legend-cell" style="background:var(--gray-200)"></span>
            <span class="heatmap-legend-cell" style="background:#86EFAC"></span>
            <span class="heatmap-legend-cell" style="background:#22C55E"></span>
            <span class="heatmap-legend-cell" style="background:#15803D"></span>
            <span class="heatmap-legend-cell" style="background:#14532D"></span>
            <span class="heatmap-legend-label">多</span>
          </div>
        </div>

    <div class="section-title-row">
      <span class="section-title-text">近 7 天趋势</span>
    </div>
    <div class="card">
      <canvas ref="trendCanvas" width="360" height="160" class="trend-canvas"></canvas>
    </div>

    <div class="progress-banner card" :class="{ 'banner-expanded': showSubjects }" @click="toggleSubjectsAndDraw">
      <div class="banner-top">
        <span class="banner-label">学习总进度</span>
        <span class="banner-percent">{{ totalProgress }}%</span>
      </div>
      <div class="banner-bar"><div class="banner-bar-fill" :style="{ width: totalProgress + '%' }"></div></div>
      <div class="banner-hint">{{ profile.learned_points }} / {{ profile.total_points }} 已学习 <svg class="banner-chevron" :class="{ expanded: showSubjects }" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></div>
    </div>
    <div v-if="showSubjects" class="card progress-list" style="margin-top:-12px;border-top-left-radius:0;border-top-right-radius:0;border-top:1px solid var(--gray-100)">
      <canvas ref="radarCanvas" width="280" height="280" class="radar-canvas"></canvas>
      <div class="progress-item" v-for="s in dedupSubjects" :key="s.id">
        <div class="icon-circle" :style="{ background: s.color }">{{ s.icon }}</div>
        <span class="progress-name">{{ s.name }}</span>
        <div class="progress-bar-wrap"><div class="progress-bar-bg"><div class="progress-bar-fill" :style="{ width: s.progress + '%', background: s.color }"></div></div></div>
        <span class="progress-percent">{{ s.progress }}%</span>
      </div>
    </div>

    <div class="activity-banner card" :class="{ 'banner-expanded': showActivities }" @click="showActivities = !showActivities">
      <div class="banner-top">
        <span class="banner-label">学习动态</span>
        <span class="activity-badge" v-if="activities.length > 0">{{ activities.length }} 条</span>
      </div>
      <div class="banner-hint">最近复习的知识点 <svg class="banner-chevron" :class="{ expanded: showActivities }" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></div>
    </div>
    <div v-if="showActivities && activities.length > 0" class="card activity-list" style="margin-top:-12px;border-top-left-radius:0;border-top-right-radius:0;border-top:1px solid var(--gray-100)">
      <template v-if="!activeActivity">
        <div v-for="a in activities" :key="a.reviewed_at" class="activity-item" @click="activeActivity = a">
          <div class="activity-dot" :style="{ background: a.subject_color || '#3B82F6' }">{{ a.subject_icon || '📚' }}</div>
          <div class="activity-text">
            <span class="activity-title">复习了 <b>{{ a.title }}</b></span>
            <span class="activity-meta">{{ a.subject_name }} · {{ timeAgo(a.reviewed_at) }}</span>
          </div>
          <span class="activity-rating-tag" :style="{ color: ratingColors[a.rating], background: ratingColors[a.rating] + '18' }">{{ ratingLabels[a.rating] }}</span>
        </div>
      </template>
      <div v-else class="activity-detail">
        <div class="activity-detail-back" @click="activeActivity = null">← 返回动态</div>
        <div class="activity-detail-subject" :style="{ color: activeActivity.subject_color }">{{ activeActivity.subject_icon }} {{ activeActivity.subject_name }}</div>
        <h3 class="activity-detail-title">{{ activeActivity.title }}</h3>
        <div class="activity-detail-meta">
          <span class="activity-rating-tag" :style="{ color: ratingColors[activeActivity.rating], background: ratingColors[activeActivity.rating] + '18' }">{{ ratingLabels[activeActivity.rating] }}</span>
          <span>{{ timeAgo(activeActivity.reviewed_at) }}</span>
        </div>
        <div v-if="activeActivity.question" class="activity-detail-section">
          <div class="activity-detail-label">问题</div>
          <div class="activity-detail-text md-content" v-html="renderMd(activeActivity.question)"></div>
        </div>
        <div v-if="activeActivity.answer" class="activity-detail-section">
          <div class="activity-detail-label">答案</div>
          <AnswerRenderer class="activity-detail-text" :answer="activeActivity.answer" />
        </div>
      </div>
    </div>

    <div class="entry-row">
      <div class="fav-entry card" @click="showFavPanel = true">
        <span class="fav-entry-label">重点 {{ favorites.length }}</span>
      </div>
      <div class="fav-entry card" @click="showSuspended = true">
        <span class="fav-entry-label">隐藏 {{ suspendedPoints.length }}</span>
      </div>
      <div class="fav-entry card" @click="showMyUploads = true" v-if="isLoggedIn">
        <span class="fav-entry-label">上传 {{ myUploads.length }}</span>
      </div>
    </div>

    <div v-if="showFavPanel" class="fav-overlay">
      <div class="fav-panel">
        <div class="fav-panel-header">
          <h3>我的重点 <span class="fav-panel-count">{{ favorites.length }}</span></h3>
          <span class="close-btn" @click="showFavPanel = false">✕</span>
        </div>
        <div v-if="favorites.length > 0" class="fav-panel-list">
          <div v-if="!activeFav">
            <div v-for="f in favorites" :key="f.id" class="fav-list-item" @click="activeFav = f">
              <div class="fav-list-top">
                <span class="fav-list-subject" :style="{ color: f.subject_color }">{{ f.subject_icon }} {{ f.subject_name }}</span>
                <span class="fav-remove" @click.stop="removeFav(f)">取消标记</span>
              </div>
              <div class="fav-list-title">{{ f.title }}</div>
              <div class="fav-list-q">{{ toPlainPreview(f.question) }}</div>
            </div>
          </div>
          <div v-else class="fav-detail">
            <div class="fav-detail-back" @click="activeFav = null">← 返回列表</div>
            <div class="fav-detail-subject" :style="{ color: activeFav.subject_color }">{{ activeFav.subject_icon }} {{ activeFav.subject_name }} · {{ activeFav.category }}</div>
            <h2 class="fav-detail-title">{{ activeFav.title }}</h2>
            <div class="fav-detail-section">
              <div class="fav-detail-label">问题</div>
              <div class="fav-detail-text md-content" v-html="renderMd(activeFav.question)"></div>
            </div>
            <div class="fav-detail-section">
              <div class="fav-detail-label">答案</div>
              <AnswerRenderer class="fav-detail-text" :answer="activeFav.answer" />
            </div>
            <button class="fav-detail-remove" @click="removeFavAndBack(activeFav)">取消重点标记</button>
          </div>
        </div>
        <div v-else class="fav-panel-empty">
          <p>暂无重点标记</p>
          <p class="empty-hint">在知识流或复习中点击 ☆ 标记重点</p>
        </div>
      </div>
    </div>

    <div v-if="showSuspended" class="fav-overlay">
      <div class="fav-panel">
        <div class="fav-panel-header">
          <h3>已隐藏 <span class="fav-panel-count">{{ suspendedPoints.length }}</span></h3>
          <span class="close-btn" @click="showSuspended = false">✕</span>
        </div>
        <div v-if="suspendedPoints.length > 0" class="fav-panel-list">
          <div v-for="sp in suspendedPoints" :key="sp.id" class="fav-list-item" @click="activeSuspended = sp">
            <div class="fav-list-top">
              <span class="fav-list-subject" :style="{ color: sp.subject_color }">{{ sp.subject_icon }} {{ sp.subject_name }}</span>
              <span class="fav-remove" @click.stop="restorePoint(sp)">恢复</span>
            </div>
            <div class="fav-list-title">{{ sp.title }}</div>
            <div class="fav-list-q">{{ toPlainPreview(sp.question) }}</div>
          </div>
        </div>
        <div v-else class="fav-panel-empty">
          <p>暂无隐藏的知识点</p>
        </div>
      </div>
    </div>

    <div v-if="showMyUploads" class="fav-overlay">
      <div class="fav-panel">
        <div class="fav-panel-header">
          <h3>我的上传 <span class="fav-panel-count">{{ myUploads.length }}</span></h3>
          <span class="close-btn" @click="showMyUploads = false">✕</span>
        </div>
        <div v-if="myUploads.length > 0" class="fav-panel-list">
          <div v-for="p in myUploads" :key="p.id" class="fav-list-item">
            <div class="fav-list-top">
              <span class="fav-list-subject" :style="{ color: p.subject_color }">{{ p.subject_icon }} {{ p.subject_name }}</span>
              <span class="review-badge" :class="'badge-' + p.review_status">{{ reviewStatusText(p.review_status) }}</span>
            </div>
            <div class="fav-list-title">{{ p.title }}</div>
            <div class="fav-list-q">{{ toPlainPreview(p.question) }}</div>
            <div v-if="p.review_status === 'rejected' && p.reject_reason" class="reject-reason">原因：{{ p.reject_reason }}</div>
          </div>
        </div>
        <div v-else class="fav-panel-empty">
          <p>暂无上传的知识点</p>
          <p class="empty-hint">在知识库中点击 + 添加知识点</p>
        </div>
      </div>
    </div>

    <div v-if="showSettings" class="settings-overlay" @click.self="showSettings = false">
      <div class="settings-panel">
        <div class="settings-header"><h3>设置</h3><span class="close-btn" @click="showSettings = false">✕</span></div>
        <div class="setting-item">
          <span>🌙 夜间模式</span>
          <div class="toggle-switch" :class="{ active: isDark }" @click="toggleTheme">
            <div class="toggle-knob"></div>
          </div>
        </div>
        <div class="setting-divider"></div>
        <div class="setting-item" v-if="isLoggedIn && !editingNickname" @click="startEditNickname">
          <span>✏️ 改名字</span>
          <span class="setting-hint">{{ userName }}</span>
        </div>
        <div class="setting-item nickname-editing" v-if="isLoggedIn && editingNickname">
          <span>✏️ 改名字</span>
          <div class="rename-row">
            <input v-model="nicknameValue" class="rename-input" maxlength="20" @keyup.enter="saveNickname" />
            <button class="rename-save" :disabled="savingNickname" @click="saveNickname">{{ savingNickname ? '保存中' : '保存' }}</button>
            <button class="rename-cancel" @click="editingNickname = false">取消</button>
          </div>
        </div>
        <div v-if="nicknameError" class="setting-note" style="color:var(--red)">{{ nicknameError }}</div>
        <div class="setting-divider"></div>
        <div class="setting-item">
          <span>每日复习数量</span>
          <div class="limit-control">
            <input type="number" class="limit-input" :value="store.dailyLimit" @change="onLimitChange" min="1" max="999" />
          </div>
        </div>
        <div class="setting-divider"></div>
        <div class="filter-banner card" :class="{ 'banner-expanded': showSubjectFilter }" @click="showSubjectFilter = !showSubjectFilter">
          <div class="banner-top">
            <span class="banner-label">科目筛选</span>
            <span class="activity-badge" v-if="settingsSubjects.length > 0">{{ settingsSubjects.length - store.hiddenSubjects.length }}/{{ settingsSubjects.length }} 已开启</span>
          </div>
          <div class="banner-hint">关闭的科目不会出现在知识流和复习中 <svg class="banner-chevron" :class="{ expanded: showSubjectFilter }" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></div>
        </div>
        <div v-if="showSubjectFilter" class="subject-toggle-list card" style="margin-top:-12px;border-top-left-radius:0;border-top-right-radius:0;border-top:1px solid var(--gray-100)">
          <div v-for="s in settingsSubjects" :key="s.id" class="subject-toggle-item" @click="store.toggleHiddenSubject(s.id)">
            <div class="subject-toggle-left">
              <span class="subject-toggle-icon" :style="{ background: s.color }">{{ s.icon }}</span>
              <span class="subject-toggle-name">{{ s.name }}</span>
            </div>
            <div class="toggle-switch" :class="{ active: !store.isSubjectHidden(s.id) }">
              <div class="toggle-knob"></div>
            </div>
          </div>
        </div>
        <div class="setting-divider"></div>
        <div class="setting-section-title">数据管理</div>
        <div class="setting-item" @click="doExport">
          <span>📤 导出学习数据</span>
          <span class="setting-hint">下载为备份文件</span>
        </div>
        <div class="setting-item" @click="triggerImport">
          <span>📥 导入学习数据</span>
          <span class="setting-hint">从备份文件恢复</span>
        </div>
        <input ref="fileInput" type="file" accept=".json" style="display:none" @change="doImport" />
        <p class="setting-note">导出的文件包含所有学习进度、复习记录和收藏。换设备或清除浏览器数据前请先导出备份。</p>
        <div class="setting-divider"></div>
        <div class="setting-item" @click="runContentNormalize" v-if="isLoggedIn">
          <span>🔧 修复内容排版</span>
          <span class="setting-hint">{{ normalizeStatus }}</span>
        </div>
        <div class="setting-divider" v-if="isLoggedIn"></div>
        <div class="setting-item logout-item" @click="doLogout" v-if="isLoggedIn">
          <span>退出登录</span>
        </div>
      </div>
    </div>
    <div class="about-section">
      <div class="about-header">
        <img src="/logo.png" alt="知记" class="about-logo" />
        <div class="about-title-wrap">
          <div class="about-title">知记</div>
          <div class="about-slogan">科学记忆，高效学习</div>
        </div>
      </div>
      <p class="about-desc">知记是一款基于认知科学的智能记忆工具，致力于帮助用户高效记忆各类知识点与重要事项。</p>
      <div class="about-features">
        <div class="about-feature">
          <span class="feature-icon">📈</span>
          <div>
            <div class="feature-title">艾宾浩斯记忆曲线</div>
            <div class="feature-desc">基于间隔重复算法（Spaced Repetition），根据每个知识点的掌握程度动态调整复习间隔，在遗忘临界点精准触发复习，实现长期记忆巩固。</div>
          </div>
        </div>
        <div class="about-feature">
          <span class="feature-icon">🧠</span>
          <div>
            <div class="feature-title">智能推荐引擎</div>
            <div class="feature-desc">知识流采用个性化推荐算法，综合分析用户浏览偏好、收藏行为与学习历史，智能排序知识卡片，让高价值内容优先呈现。</div>
          </div>
        </div>
        <div class="about-feature">
          <span class="feature-icon">🤖</span>
          <div>
            <div class="feature-title">AI 大模型生成知识点</div>
            <div class="feature-desc">集成大语言模型，支持按学科与主题自动生成结构化知识问答卡片，覆盖多领域知识体系，持续扩充内容库。</div>
          </div>
        </div>
        <div class="about-feature">
          <span class="feature-icon">📚</span>
          <div>
            <div class="feature-title">自建知识库</div>
            <div class="feature-desc">支持用户手动创建个性化知识点，构建专属知识体系。可创建知识库空间，实现知识协作与共享。</div>
          </div>
        </div>
        <div class="about-feature">
          <span class="feature-icon">📄</span>
          <div>
            <div class="feature-title">文档解析</div>
            <div class="feature-desc">支持 PDF、DOCX、TXT 等文档格式导入，自动提取核心知识点，一键生成结构化记忆卡片。</div>
          </div>
        </div>
        <div class="about-feature">
          <span class="feature-icon">🖼️</span>
          <div>
            <div class="feature-title">图片识别题 <span style="font-size:11px;color:var(--orange);font-weight:600">测试中</span></div>
            <div class="feature-desc">支持交通标志等图片识别选择题，结合图片记忆法提升学习效果，目前已收录 50 道驾考图片题。</div>
          </div>
        </div>
      </div>
      <p class="about-footer">知记 v1.0 · 让每一次学习都有迹可循</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onActivated, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { exportData, importData } from '../db'
import { getApi } from '../apiSwitch'
import { store } from '../store'
import { auth } from '../auth'
import { renderMd, toPlainPreview, normalizeKnowledgeContent } from '../utils/markdown'
import AnswerRenderer from '../components/AnswerRenderer.vue'
import { supabase } from '../supabase'

defineOptions({ name: 'ProfileView' })

const router = useRouter()

const userAvatar = computed(() => {
  const u = auth.currentUser.value
  return u?.user_metadata?.avatar_url || u?.user_metadata?.picture || ''
})
const userName = computed(() => {
  if (!auth.isLoggedIn.value) return '未登录'
  const u = auth.currentUser.value
  return auth.profile.value?.nickname || u?.user_metadata?.full_name || u?.user_metadata?.name || u?.email?.split('@')[0] || '知记学员'
})
const userInitial = computed(() => userName.value.charAt(0).toUpperCase())

const editingNickname = ref(false)
const nicknameValue = ref('')
const savingNickname = ref(false)
const nicknameError = ref('')

function startEditNickname() {
  nicknameValue.value = userName.value
  nicknameError.value = ''
  editingNickname.value = true
}

async function saveNickname() {
  const name = nicknameValue.value.trim()
  if (!name) { nicknameError.value = '名字不能为空'; return }
  savingNickname.value = true
  nicknameError.value = ''
  try {
    await auth.updateProfile({ nickname: name })
    const { data, error } = await supabase.auth.updateUser({ data: { full_name: name, name } })
    if (error) throw error
    if (data.user) auth.currentUser.value = data.user
    editingNickname.value = false
  } catch (e: any) {
    nicknameError.value = e.message || '修改失败'
  } finally {
    savingNickname.value = false
  }
}

function onAvatarClick() {
  if (!isLoggedIn.value) router.push('/auth')
}

const profile = ref<any>({
  total_reviews: 0, total_points: 0, learned_points: 0,
  streak: 0, max_streak: 0, total_study_days: 0,
  avg_new_per_day: 0, avg_review_per_day: 0, subjects: []
})
const weeklyData = ref<any[]>([])
const activities = ref<any[]>([])
const showActivities = ref(false)
const activeActivity = ref<any>(null)
const ratingLabels: Record<number, string> = { 0: '忘记', 1: '模糊', 2: '认识' }
const ratingColors: Record<number, string> = { 0: 'var(--red)', 1: 'var(--orange)', 2: 'var(--green)' }
const favorites = ref<any[]>([])
const suspendedPoints = ref<any[]>([])
const activeFav = ref<any>(null)
const activeSuspended = ref<any>(null)
const showSettings = ref(false)
const heatmapData = ref<Array<{date: string; count: number}>>([])
const trendCanvas = ref<HTMLCanvasElement | null>(null)
const radarCanvas = ref<HTMLCanvasElement | null>(null)

const dedupSubjects = computed(() => {
  if (!profile.value.subjects) return []
  const seen = new Set<string>()
  return profile.value.subjects.filter((s: any) => {
    if (seen.has(s.name)) return false
    seen.add(s.name)
    return s.total > 0
  })
})

const heatmapPadded = computed(() => {
  if (!heatmapData.value.length) return []
  // Find day-of-week of first day (0=Sun)
  const firstDow = new Date(heatmapData.value[0].date).getDay()
  const pad: (null | {date: string; count: number})[] = Array(firstDow).fill(null)
  return [...pad, ...heatmapData.value]
})

const heatmapMonths = computed(() => {
  const labels = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']
  const data = heatmapData.value
  if (!data.length) return []
  const firstDow = new Date(data[0].date).getDay()
  const result: Array<{key: string; label: string; cols: number}> = []
  let lastMonth = -1
  let monthStartCol = 0
  let col = 0
  const totalCells = firstDow + data.length
  for (let i = 0; i < totalCells; i++) {
    if (i > 0 && i % 7 === 6) col++
    const dataIdx = i - firstDow
    if (dataIdx < 0) continue
    const m = new Date(data[dataIdx].date).getMonth()
    if (m !== lastMonth) {
      if (lastMonth !== -1 && result.length > 0) {
        result[result.length - 1].cols = col - monthStartCol
      }
      result.push({ key: `${m}`, label: labels[m], cols: 0 })
      monthStartCol = col
      lastMonth = m
    }
  }
  if (result.length > 0) result[result.length - 1].cols = col - monthStartCol + 1
  return result
})

function heatColor(count: number): string {
  if (count === 0) return 'var(--gray-200)'
  if (count <= 5) return '#86EFAC'
  if (count <= 15) return '#22C55E'
  if (count <= 30) return '#15803D'
  return '#14532D'
}

async function loadCharts() {
  const api = getApi()
  heatmapData.value = await api.getHeatmap().catch(() => [])
  await nextTick()
  drawTrend()
}

function toggleSubjectsAndDraw() {
  showSubjects.value = !showSubjects.value
  if (showSubjects.value) {
    nextTick(() => drawRadar())
  }
}

function drawTrend() {
  const canvas = trendCanvas.value
  if (!canvas || !weeklyData.value.length) return
  const ctx = canvas.getContext('2d')!
  const dpr = window.devicePixelRatio || 1
  const w = canvas.offsetWidth || canvas.parentElement?.offsetWidth || 320
  const h = 160
  canvas.width = w * dpr
  canvas.height = h * dpr
  canvas.style.height = h + 'px'
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, w, h)

  const data = weeklyData.value
  const maxVal = Math.max(...data.map(d => d.reviewed), 1)
  const padL = 30, padR = 10, padT = 20, padB = 30
  const chartW = w - padL - padR, chartH = h - padT - padB

  ctx.strokeStyle = 'var(--gray-200)'
  ctx.lineWidth = 1
  for (let i = 0; i <= 4; i++) {
    const y = padT + (chartH / 4) * i
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke()
  }

  const pts = data.map((d, i) => ({
    x: padL + (chartW / (data.length - 1)) * i,
    y: padT + chartH - (d.reviewed / maxVal) * chartH
  }))

  const grad = ctx.createLinearGradient(0, padT, 0, h - padB)
  grad.addColorStop(0, 'rgba(59,130,246,0.3)')
  grad.addColorStop(1, 'rgba(59,130,246,0)')
  ctx.beginPath()
  ctx.moveTo(pts[0].x, h - padB)
  pts.forEach(p => ctx.lineTo(p.x, p.y))
  ctx.lineTo(pts[pts.length - 1].x, h - padB)
  ctx.fillStyle = grad
  ctx.fill()

  ctx.beginPath()
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
  ctx.strokeStyle = '#3B82F6'
  ctx.lineWidth = 2.5
  ctx.stroke()

  pts.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2); ctx.fillStyle = '#3B82F6'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke() })

  ctx.fillStyle = '#9CA3AF'
  ctx.font = '11px -apple-system, sans-serif'
  ctx.textAlign = 'center'
  data.forEach((d, i) => ctx.fillText(d.day, pts[i].x, h - 8))
  ctx.textAlign = 'right'
  for (let i = 0; i <= 4; i++) {
    ctx.fillText(String(Math.round(maxVal / 4 * (4 - i))), padL - 6, padT + (chartH / 4) * i + 4)
  }
}

function drawRadar() {
  const canvas = radarCanvas.value
  if (!canvas || !profile.value.subjects?.length) return
  const ctx = canvas.getContext('2d')!
  const size = 300
  const dpr = window.devicePixelRatio || 1
  canvas.width = size * dpr
  canvas.height = size * dpr
  canvas.style.width = size + 'px'
  canvas.style.height = size + 'px'
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, size, size)

  const subs = dedupSubjects.value.slice(0, 8)
  if (subs.length < 3) return
  const cx = size / 2, cy = size / 2, r = 100
  const n = subs.length

  for (let ring = 1; ring <= 4; ring++) {
    const rr = r * ring / 4
    ctx.beginPath()
    for (let i = 0; i <= n; i++) {
      const angle = (Math.PI * 2 / n) * i - Math.PI / 2
      const x = cx + rr * Math.cos(angle), y = cy + rr * Math.sin(angle)
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.strokeStyle = 'rgba(156,163,175,0.3)'
    ctx.lineWidth = 1
    ctx.stroke()
  }

  ctx.beginPath()
  subs.forEach((s: any, i: number) => {
    const angle = (Math.PI * 2 / n) * i - Math.PI / 2
    const val = s.total > 0 ? s.progress / 100 : 0
    const x = cx + r * val * Math.cos(angle), y = cy + r * val * Math.sin(angle)
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  })
  ctx.closePath()
  ctx.fillStyle = 'rgba(59,130,246,0.2)'
  ctx.fill()
  ctx.strokeStyle = '#3B82F6'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.fillStyle = '#6B7280'
  ctx.font = '11px -apple-system, sans-serif'
  ctx.textAlign = 'center'
  subs.forEach((s: any, i: number) => {
    const angle = (Math.PI * 2 / n) * i - Math.PI / 2
    const lx = cx + (r + 20) * Math.cos(angle), ly = cy + (r + 20) * Math.sin(angle)
    ctx.fillText(s.icon + s.name.slice(0, 3), lx, ly + 4)
  })
}
const isDark = ref(document.documentElement.getAttribute('data-theme') === 'dark')

function toggleTheme() {
  isDark.value = !isDark.value
  if (isDark.value) {
    document.documentElement.setAttribute('data-theme', 'dark')
    localStorage.setItem('zhiji_theme', 'dark')
  } else {
    document.documentElement.removeAttribute('data-theme')
    localStorage.setItem('zhiji_theme', 'light')
  }
}
const showFavPanel = ref(false)
const showSuspended = ref(false)
const showMyUploads = ref(false)
const myUploads = ref<any[]>([])
const showSubjects = ref(false)
const showSubjectFilter = ref(false)
const settingsSubjects = ref<any[]>([])

function dedupByName(list: any[]): any[] {
  const seen = new Set<string>()
  return list.filter(s => {
    if (seen.has(s.name)) return false
    seen.add(s.name)
    return true
  })
}
const fileInput = ref<HTMLInputElement | null>(null)
const isLoggedIn = auth.isLoggedIn

const level = computed(() => Math.max(1, Math.floor(profile.value.total_reviews / 20) + 1))
// weeklyData used in drawTrend via ref
const totalProgress = computed(() => {
  if (profile.value.total_points === 0) return 0
  return Math.round(profile.value.learned_points / profile.value.total_points * 100)
})

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days === 1) return '昨天'
  return `${days}天前`
}

async function removeFav(f: any) {
  await getApi().toggleFavorite(f.id)
  favorites.value = favorites.value.filter(x => x.id !== f.id)
}

async function removeFavAndBack(f: any) {
  await getApi().toggleFavorite(f.id)
  favorites.value = favorites.value.filter(x => x.id !== f.id)
  activeFav.value = null
}

async function restorePoint(sp: any) {
  await getApi().unsuspendPoint(sp.id)
  suspendedPoints.value = suspendedPoints.value.filter(x => x.id !== sp.id)
}

async function doExport() {
  await exportData()
}

function triggerImport() {
  fileInput.value?.click()
}

async function doImport(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    await importData(file)
    alert('导入成功！页面将刷新。')
    location.reload()
  } catch (err) {
    alert('导入失败：' + (err as Error).message)
  }
}

function onLimitChange(e: Event) {
  const val = parseInt((e.target as HTMLInputElement).value)
  if (isNaN(val) || val < 1) { store.setDailyLimit(1); return }
  if (val > 999) { store.setDailyLimit(999); return }
  store.setDailyLimit(val)
}

function reviewStatusText(status: string) {
  const map: Record<string, string> = { pending: '审核中', approved: '已通过', rejected: '未通过' }
  return map[status] || status
}

const normalizeStatus = ref('一键修复')

async function runContentNormalize() {
  if (normalizeStatus.value !== '一键修复' && normalizeStatus.value !== '完成') return
  normalizeStatus.value = '拉取中...'
  try {
    const rows: any[] = []
    let from = 0
    while (true) {
      const { data } = await supabase.from('points').select('id,question,answer').range(from, from + 999)
      if (!data || !data.length) break
      rows.push(...data)
      if (data.length < 1000) break
      from += 1000
    }
    normalizeStatus.value = `分析 ${rows.length} 条...`

    const toFix: { id: string; question: string; answer: string }[] = []
    for (const p of rows) {
      const nq = normalizeKnowledgeContent(p.question || '')
      const na = normalizeKnowledgeContent(p.answer || '')
      if (nq !== (p.question || '') || na !== (p.answer || '')) {
        toFix.push({ id: p.id, question: nq, answer: na })
      }
    }

    if (toFix.length === 0) {
      normalizeStatus.value = '无需修复'
      setTimeout(() => { normalizeStatus.value = '一键修复' }, 3000)
      return
    }

    if (!confirm(`将修复 ${toFix.length} 条知识点的排版（不影响学习进度），确认？`)) {
      normalizeStatus.value = '一键修复'
      return
    }

    let ok = 0
    for (const f of toFix) {
      await supabase.from('points').update({ question: f.question, answer: f.answer }).eq('id', f.id)
      ok++
      if (ok % 20 === 0) normalizeStatus.value = `修复中 ${ok}/${toFix.length}`
    }
    normalizeStatus.value = `完成，修复 ${ok} 条`
    store.feedNeedsRefresh = true
  } catch (e: any) {
    normalizeStatus.value = `失败: ${e.message?.slice(0, 30) || '未知错误'}`
  }
}

async function doLogout() {
  if (!confirm('确定退出登录？')) return
  await auth.signOut()
  location.reload()
}

onMounted(async () => {
  const api = getApi()
  const [p, w, f, sp] = await Promise.all([
    api.getProfile().catch(() => profile.value),
    api.getWeekly().catch(() => []),
    api.getFavorites().catch(() => []),
    api.getSuspended().catch(() => [])
  ])
  profile.value = p
  weeklyData.value = w
  favorites.value = f
  suspendedPoints.value = sp
  settingsSubjects.value = dedupByName(p.subjects || [])
  api.getRecentActivity(10).then(data => {
    activities.value = [...data].sort((a, b) => b.reviewed_at.localeCompare(a.reviewed_at))
  }).catch(() => {})
  if (isLoggedIn.value && 'getMyUploads' in api) {
    myUploads.value = await (api as any).getMyUploads().catch(() => [])
  }
  loadCharts()
})

onActivated(async () => {
  const api = getApi()
  const [p, w] = await Promise.all([
    api.getProfile().catch(() => profile.value),
    api.getWeekly().catch(() => weeklyData.value)
  ])
  profile.value = p
  weeklyData.value = w
  settingsSubjects.value = dedupByName(p.subjects || [])
  api.getRecentActivity(10).then(data => {
    activities.value = [...data].sort((a, b) => b.reviewed_at.localeCompare(a.reviewed_at))
  }).catch(() => {})
})
</script>

<style scoped>
.profile-page { background: transparent; }

.user-info { display: flex; align-items: center; gap: 14px; padding: 16px 0; }
.avatar { width: 56px; height: 56px; border-radius: 50%; background: var(--primary-bg); display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; }
.avatar-img { width: 100%; height: 100%; object-fit: cover; }
.avatar-fallback { font-size: 24px; font-weight: 700; color: white; }
.user-detail { flex: 1; }
.username { font-size: 18px; font-weight: 700; color: var(--gray-900); margin-bottom: 4px; }
.level-badge { display: inline-block; background: var(--primary); color: white; font-size: 11px; font-weight: 700; padding: 2px 10px; border-radius: 4px; margin-bottom: 4px; }
.upgrade-hint { font-size: 13px; color: var(--gray-500); }
.upgrade-hint strong { color: var(--primary); }
.settings-btn { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 12px; background: var(--gray-100); color: var(--gray-500); cursor: pointer; transition: all 0.2s; flex-shrink: 0; }
.settings-btn:active { background: var(--gray-200); color: var(--gray-700); }
.clickable { cursor: pointer; }
.login-hint { font-size: 13px; color: var(--primary); font-weight: 500; }

.card { background: var(--card-bg); border: 1px solid var(--border-color); border-radius: var(--radius); padding: 16px; margin-bottom: 12px; box-shadow: var(--shadow); }

.quick-stats { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 6px 0 10px; font-size: 13px; color: var(--gray-500); flex-wrap: wrap; background: transparent; }
.qs-item { display: flex; align-items: center; gap: 3px; }
.qs-item b { color: var(--gray-900); font-size: 15px; }
.qs-dot { color: var(--gray-300); }

.section-title-row { display: flex; justify-content: space-between; align-items: center; margin: 8px 0 6px; }
.section-title-text { font-size: 14px; font-weight: 700; color: var(--gray-900); }
.section-hint { font-size: 12px; color: var(--gray-400); }

.heatmap-card { padding: 12px; overflow: hidden; }

.entry-row { display: flex; gap: 10px; margin-top: 4px; margin-bottom: 12px; }
.entry-row .fav-entry { flex: 1; display: flex; align-items: center; justify-content: center; padding: 14px 8px; margin-bottom: 0; cursor: pointer; background: var(--card-bg); border: 1px solid var(--border-color); box-shadow: var(--shadow); }
.entry-row .fav-entry-label { font-size: 13px; color: var(--gray-600); font-weight: 600; }

.progress-banner { cursor: pointer; margin-bottom: 12px; }
.activity-banner { cursor: pointer; margin-bottom: 12px; }
.filter-banner { cursor: pointer; margin-bottom: 0; }
.banner-expanded { margin-bottom: 0; border-bottom-left-radius: 0 !important; border-bottom-right-radius: 0 !important; }
.banner-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.banner-label { font-size: 15px; font-weight: 600; color: var(--gray-900); }
.banner-percent { font-size: 20px; font-weight: 700; color: var(--primary); }
.banner-bar { height: 8px; background: var(--gray-200); border-radius: 4px; overflow: hidden; margin-bottom: 8px; }
.banner-bar-fill { height: 100%; background: var(--primary); border-radius: 4px; transition: width 0.5s; }
.banner-hint { font-size: 13px; color: var(--gray-400); display: flex; justify-content: space-between; align-items: center; }
.banner-chevron { color: var(--gray-400); transition: transform 0.3s ease; flex-shrink: 0; }
.banner-chevron.expanded { transform: rotate(180deg); }
.activity-badge { font-size: 13px; color: var(--primary); font-weight: 600; background: var(--primary-bg); padding: 2px 10px; border-radius: 10px; }

.activity-list { padding: 12px 14px; }
.activity-item { display: flex; align-items: center; gap: 10px; padding: 8px 0; cursor: pointer; }
.activity-item:active { opacity: 0.7; }
.activity-item + .activity-item { border-top: 1px solid var(--gray-100); }
.activity-dot { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
.activity-text { flex: 1; min-width: 0; }
.activity-title { display: block; font-size: 13px; color: var(--gray-700); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.activity-title b { font-weight: 600; }
.activity-meta { display: block; font-size: 11px; color: var(--gray-400); margin-top: 2px; }
.activity-rating-tag { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: var(--radius-tag); flex-shrink: 0; }

.activity-detail { padding: 4px 0; }
.activity-detail-back { font-size: 14px; color: var(--primary); cursor: pointer; padding: 4px 0 12px; }
.activity-detail-subject { font-size: 13px; font-weight: 600; margin-bottom: 6px; }
.activity-detail-title { font-size: 20px; font-weight: 700; color: var(--gray-900); margin-bottom: 10px; }
.activity-detail-meta { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--gray-400); margin-bottom: 16px; }
.activity-detail-section { margin-bottom: 16px; }
.activity-detail-label { font-size: 12px; font-weight: 600; color: var(--primary); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
.activity-detail-text { font-size: 14px; color: var(--gray-700); line-height: 1.8; }

.progress-list { padding: 8px 16px; }
.progress-item { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--gray-100); }
.progress-item:last-child { border-bottom: none; }
.icon-circle { width: 28px; height: 28px; border-radius: 7px; display: flex; align-items: center; justify-content: center; font-size: 14px; color: white; flex-shrink: 0; }
.progress-name { font-size: 13px; font-weight: 500; width: 45px; }
.progress-bar-wrap { flex: 1; }
.progress-bar-bg { height: 8px; background: var(--gray-200); border-radius: 4px; overflow: hidden; }
.progress-bar-fill { height: 100%; border-radius: 4px; transition: width 0.5s; }
.progress-percent { font-size: 12px; color: var(--gray-500); width: 34px; text-align: right; }

.settings-overlay { position: fixed; inset: 0; background: var(--overlay); z-index: 200; display: flex; align-items: flex-end; }
.settings-panel { background: var(--card-bg); width: 100%; max-width: 430px; margin: 0 auto; border-radius: var(--radius-modal) var(--radius-modal) 0 0; padding: 20px 16px 40px; max-height: 85vh; overflow-y: auto; -webkit-overflow-scrolling: touch; }
.settings-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.settings-header h3 { font-size: 18px; }
.close-btn { font-size: 20px; cursor: pointer; color: var(--gray-400); }
.setting-item { display: flex; justify-content: space-between; align-items: center; padding: 14px 0; }
.setting-item span { font-size: 15px; color: var(--gray-700); }
.setting-hint { font-size: 13px !important; color: var(--gray-400) !important; }
.nickname-editing { align-items: center; }
.rename-row { display: flex; align-items: center; gap: 6px; flex: 1; margin-left: 12px; justify-content: flex-end; }
.rename-input { flex: 1; max-width: 140px; padding: 6px 10px; border: 1px solid var(--primary); border-radius: 6px; font-size: 14px; outline: none; }
.rename-save { padding: 6px 12px; font-size: 13px; font-weight: 600; background: var(--primary); color: white; border: none; border-radius: 6px; cursor: pointer; white-space: nowrap; }
.rename-save:disabled { opacity: 0.6; }
.rename-cancel { padding: 6px 12px; font-size: 13px; font-weight: 600; background: var(--gray-100); color: var(--gray-600); border: none; border-radius: 6px; cursor: pointer; white-space: nowrap; }
.setting-divider { height: 1px; background: var(--gray-100); margin: 8px 0; }
.setting-section-title { font-size: 13px; font-weight: 600; color: var(--gray-400); padding: 8px 0 4px; text-transform: uppercase; letter-spacing: 1px; }
.setting-note { font-size: 12px; color: var(--gray-400); line-height: 1.6; padding: 12px 0 8px; }
.limit-control { display: flex; align-items: center; }
.limit-input { width: 64px; padding: 6px 8px; border: 1px solid var(--gray-200); border-radius: var(--radius-input); font-size: 16px; font-weight: 600; color: var(--primary); text-align: center; background: var(--card-bg); }
.limit-input:focus { outline: none; border-color: var(--primary); }
.fav-entry-left { display: flex; align-items: center; gap: 8px; }
.fav-entry-label { font-size: 16px; font-weight: 600; }
.fav-entry-right { display: flex; align-items: center; gap: 6px; }
.fav-entry-count { font-size: 14px; color: var(--gray-400); }
.fav-arrow { font-size: 20px; color: var(--gray-300); }

.fav-overlay { position: fixed; inset: 0; background: var(--card-bg); z-index: 200; display: flex; flex-direction: column; max-width: 430px; margin: 0 auto; }
.fav-panel { display: flex; flex-direction: column; height: 100%; }
.fav-panel-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 16px 12px; flex-shrink: 0; border-bottom: 1px solid var(--gray-100); }
.fav-panel-header h3 { font-size: 20px; }
.fav-panel-count { font-size: 15px; color: var(--gray-400); font-weight: 400; margin-left: 6px; }
.fav-panel-list { overflow-y: auto; padding: 12px 16px 30px; -webkit-overflow-scrolling: touch; flex: 1; overscroll-behavior: contain; }
.fav-list-item { cursor: pointer; margin-bottom: 12px; background: var(--gray-50); border-radius: 14px; padding: 16px; border: 1px solid var(--gray-200); }
.fav-list-item:active { background: var(--gray-100); }
.fav-list-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.fav-list-subject { font-size: 13px; font-weight: 600; }
.fav-remove { font-size: 13px; color: var(--gray-400); padding: 4px 8px; }
.fav-list-title { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
.fav-list-q { font-size: 15px; color: var(--gray-500); line-height: 1.7; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

.fav-detail { padding-bottom: 40px; }
.fav-detail-back { font-size: 15px; color: var(--primary); cursor: pointer; padding: 4px 0 16px; }
.fav-detail-subject { font-size: 14px; font-weight: 600; margin-bottom: 8px; }
.fav-detail-title { font-size: 24px; font-weight: 700; margin-bottom: 20px; }
.fav-detail-section { margin-bottom: 20px; }
.fav-detail-label { font-size: 13px; font-weight: 600; color: var(--primary); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
.fav-detail-text { font-size: 16px; color: var(--gray-700); line-height: 1.8; }
.fav-detail-remove { width: 100%; padding: 14px; background: var(--gray-100); color: var(--gray-500); border: none; border-radius: var(--radius-btn); font-size: 15px; font-weight: 500; cursor: pointer; margin-top: 20px; }

.fav-panel-empty { text-align: center; padding: 60px 16px; color: var(--gray-400); flex: 1; display: flex; flex-direction: column; justify-content: center; }
.empty-hint { font-size: 13px; margin-top: 6px; }

.subject-toggle-list { display: flex; flex-direction: column; gap: 2px; padding: 4px 16px; }
.subject-toggle-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; cursor: pointer; border-bottom: 1px solid var(--gray-100); }
.subject-toggle-item:last-child { border-bottom: none; }

.filter-banner { cursor: pointer; margin-bottom: 0; }
.subject-toggle-left { display: flex; align-items: center; gap: 10px; }
.subject-toggle-icon { width: 28px; height: 28px; border-radius: 7px; display: flex; align-items: center; justify-content: center; font-size: 14px; color: white; flex-shrink: 0; }
.subject-toggle-name { font-size: 15px; font-weight: 500; color: var(--gray-700); }
.toggle-switch { width: 44px; height: 26px; border-radius: 13px; background: var(--gray-300); position: relative; transition: background 0.2s; flex-shrink: 0; }
.toggle-switch.active { background: var(--primary); }
.toggle-knob { width: 22px; height: 22px; border-radius: 50%; background: white; position: absolute; top: 2px; left: 2px; transition: transform 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.15); }
.toggle-switch.active .toggle-knob { transform: translateX(18px); }

.logout-item { justify-content: center !important; }
.logout-item span { color: var(--red) !important; font-weight: 600 !important; }

.review-badge { font-size: 12px; padding: 2px 10px; border-radius: 10px; font-weight: 500; }
.badge-pending { background: rgba(245, 158, 11, 0.15); color: var(--orange); }
.badge-approved { background: rgba(16, 185, 129, 0.12); color: var(--green); }
.badge-rejected { background: rgba(239, 68, 68, 0.12); color: var(--red); }
.reject-reason { font-size: 13px; color: var(--red); margin-top: 8px; padding: 8px 10px; background: rgba(239, 68, 68, 0.06); border-radius: 8px; line-height: 1.5; }


.about-section { margin-top: 24px; padding: 24px 16px 32px; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: var(--radius); box-shadow: var(--shadow); }
.about-header { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
.about-logo { width: 48px; height: 48px; border-radius: 12px; }
.about-title-wrap { flex: 1; }
.about-title { font-size: 20px; font-weight: 700; color: var(--gray-900); }
.about-slogan { font-size: 13px; color: var(--gray-400); margin-top: 2px; }
.about-desc { font-size: 14px; color: var(--gray-600); line-height: 1.8; margin-bottom: 20px; }
.about-features { display: flex; flex-direction: column; gap: 16px; }
.about-feature { display: flex; gap: 12px; }
.feature-icon { font-size: 22px; flex-shrink: 0; width: 32px; text-align: center; padding-top: 2px; }
.feature-title { font-size: 15px; font-weight: 600; color: var(--gray-800); margin-bottom: 4px; }
.feature-desc { font-size: 13px; color: var(--gray-500); line-height: 1.7; }
.about-footer { text-align: center; font-size: 12px; color: var(--gray-400); margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--gray-100); }

.report-scroll { flex: 1; overflow-y: auto; padding: 0 16px 30px; -webkit-overflow-scrolling: touch; }
.report-section { margin-bottom: 24px; }
.report-section-title { font-size: 16px; font-weight: 700; color: var(--gray-900); margin-bottom: 4px; }
.report-section-hint { font-size: 12px; color: var(--gray-400); margin-bottom: 12px; }

.heatmap-wrap { overflow: hidden; }
.heatmap-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
.heatmap-scroll::-webkit-scrollbar { display: none; }
.heatmap-months-row { display: flex; margin-bottom: 3px; }
.heatmap-month { font-size: 10px; color: var(--gray-400); flex-shrink: 0; white-space: nowrap; overflow: hidden; box-sizing: border-box; }
.heatmap-grid { display: grid; grid-template-rows: repeat(7, 10px); grid-auto-flow: column; grid-auto-columns: 10px; gap: 2px; }
.heatmap-cell { width: 10px; height: 10px; border-radius: 2px; }
.heatmap-legend { display: flex; align-items: center; gap: 3px; margin-top: 8px; }
.heatmap-legend-label { font-size: 10px; color: var(--gray-400); }
.heatmap-legend-cell { width: 10px; height: 10px; border-radius: 2px; }

.trend-canvas { width: 100%; display: block; box-sizing: border-box; }
.radar-canvas { width: 100%; max-width: 280px; display: block; margin: 8px auto; }
</style>
