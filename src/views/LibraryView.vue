<template>
  <div class="page library-page">
    <div class="library-title-bar">
      <div class="title-group">
        <h1 class="page-title">知识库</h1>
        <span class="title-sub">{{ displayStats.total }} 个知识点 · {{ subjects.length }} 个科目</span>
      </div>
      <span class="search-btn" @click="onSearch">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      </span>
    </div>

    <div v-if="isLoggedIn" class="seg-control">
      <button class="seg-item" :class="{ active: selectedSpaces.has('mine') }" @click="toggleSpace('mine')">我的库</button>
      <button class="seg-item" :class="{ active: selectedSpaces.has('public') }" @click="toggleSpace('public')">公开库</button>
      <button v-for="t in store.teams" :key="t.id" class="seg-item" :class="{ active: selectedSpaces.has(t.id) }" @click="toggleSpace(t.id)">{{ t.name }}</button>
      <button class="seg-item seg-add" @click="openTeamPanel">+</button>
    </div>

    <div class="stat-blocks">
      <div class="stat-block">
        <span class="stat-block-val primary">{{ displayStats.due }}</span>
        <span class="stat-block-label">待复习</span>
      </div>
      <div class="stat-block">
        <span class="stat-block-val">{{ overview.reviewed_today }}</span>
        <span class="stat-block-label">已复习</span>
      </div>
      <div class="stat-block">
        <span class="stat-block-val">{{ overview.new_today }}</span>
        <span class="stat-block-label">新学</span>
      </div>
    </div>

    <div class="section-header">
      <div class="section-header-left">
        <span class="section-header-title">{{ publicOnly ? '公开库' : '我的科目' }}</span>
        <span class="section-header-sub">{{ subjects.length }} 个科目</span>
      </div>
      <button class="manage-btn" :class="{ active: managingMode }" @click="managingMode = !managingMode">
        {{ managingMode ? '完成' : '管理' }}
      </button>
    </div>

    <div v-if="managingMode" class="manage-actions">
      <span v-if="isLoggedIn && !publicOnly" class="manage-action-btn" @click="showCreateSubject = true">+ 科目</span>
      <span v-if="isLoggedIn && selectedSpaces.has('public')" class="manage-action-btn" @click="batchClone">批量克隆</span>
      <span class="manage-action-btn" @click="toggleAllSubjects">{{ allSelected ? '取消全选' : '全选' }}</span>
    </div>

    <div v-for="group in subjectGroups" :key="group.key" class="subject-group">
      <div class="group-header">
        <span class="group-dot" :style="{ background: group.color }"></span>
        <span class="group-name">{{ group.label }}</span>
        <span class="group-count">{{ group.subjects.length }}</span>
      </div>
      <div class="subject-grid">
        <div v-for="subject in group.subjects" :key="subject.id" class="subject-card" :class="{ selected: selected.has(subject.id) }" @click="toggleSelect(subject.id)">
          <div class="icon-circle-sm" :style="{ background: subject.color }">{{ subject.icon }}</div>
          <div class="subject-card-name">{{ subject.name }}</div>
          <div class="subject-card-meta">{{ subject.learned_count }}/{{ subject.point_count }}</div>
          <span class="subject-card-view" @click.stop="openSubjectDetail(subject)">查看</span>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <span class="loading-text">加载中...</span>
    </div>

    <div v-else-if="subjects.length === 0 && isLoggedIn && selectedSpaces.has('mine')" class="empty-mine-card card">
      <div class="empty-mine-icon">📚</div>
      <div class="empty-mine-text">暂无知识点</div>
      <div class="empty-mine-hint">去 <span class="empty-mine-link" @click="toggleSpace('public')">公开库</span> 克隆科目，或点击右下角上传</div>
    </div>

    <div v-if="showPoints" class="points-overlay" @click.self="showPoints = false">
      <div class="points-panel">
        <div class="points-header">
          <h3>{{ activeSubject?.name }} · 知识点</h3>
          <span class="close-btn" @click="showPoints = false">✕</span>
        </div>
        <div class="points-actions">
          <template v-if="activeSubject && isPublicSubject(activeSubject)">
            <button class="add-point-btn" @click="cloneSubject(activeSubject)">克隆整个科目到我的库</button>
          </template>
          <template v-else>
            <button class="add-point-btn" @click="openQuickAdd">+ 添加知识点</button>
          </template>
          <button class="review-btn" @click="startSubjectReview">复习该学科</button>
          <button v-if="activeSubject && !isPublicSubject(activeSubject) && canDeleteSubject(activeSubject)" class="delete-subject-btn" @click="deleteSubjectAction">删除科目</button>
        </div>
        <div class="points-list">
          <div v-for="p in subjectPoints" :key="p.id" class="point-item">
            <div class="point-main" @click="openEditor(p)">
              <div class="point-title">
                <span v-if="isImagePoint(p)" class="image-tag">图片题</span>
                <span v-else-if="isChoicePoint(p)" class="choice-tag">选择题</span>
                {{ p.title }}
              </div>
              <div class="point-category">{{ p.category }}</div>
            </div>
            <div class="point-status">
              <span class="interval-badge" v-if="p.repetitions > 0">{{ p.interval }}天</span>
              <span class="new-badge" v-else>新</span>
            </div>
            <span v-if="activeSubject && isPublicSubject(activeSubject)" class="collect-btn" @click.stop="collectPoint(p)">收藏</span>
            <span v-else class="delete-btn" @click.stop="deletePoint(p)">删除</span>
          </div>
          <div v-if="subjectPoints.length === 0" class="empty-state">暂无知识点，点击上方添加</div>
        </div>
      </div>
    </div>

    <div v-if="showTeamPanel" class="panel-overlay" @click.self="showTeamPanel = false">
      <div class="panel-sheet">
        <div class="panel-header">
          <span v-if="teamAction !== 'menu'" class="back-btn" @click="teamAction = 'menu'">‹</span>
          <h3>{{ teamPanelTitle }}</h3>
          <span class="close-btn" @click="showTeamPanel = false">✕</span>
        </div>

        <div v-if="teamAction === 'menu'" class="team-menu">
          <div class="team-menu-item" @click="teamAction = 'create'">
            <span class="menu-icon">➕</span>
            <div class="menu-text">
              <span class="menu-title">新建知识库</span>
              <span class="menu-desc">每人最多创建 3 个知识库</span>
            </div>
          </div>
          <div class="team-menu-item" @click="teamAction = 'join'">
            <span class="menu-icon">🔗</span>
            <div class="menu-text">
              <span class="menu-title">加入知识库</span>
              <span class="menu-desc">输入邀请码加入已有知识库</span>
            </div>
          </div>
          <div v-if="store.teams.length > 0" class="team-list-divider">我的知识库</div>
          <div v-for="t in store.teams" :key="t.id" class="team-menu-item" @click="openTeamInfoFor(t.id)">
            <span class="menu-icon">👥</span>
            <div class="menu-text">
              <span class="menu-title">{{ t.name }}</span>
              <span class="menu-desc">{{ t.role === 'owner' ? '创建者' : '成员' }}</span>
            </div>
            <span class="menu-arrow">›</span>
          </div>
        </div>

        <div v-if="teamAction === 'create'">
          <div class="field">
            <label>知识库名称</label>
            <input v-model="newTeamName" placeholder="如：考研小组" />
          </div>
          <div v-if="createdTeamCode" class="invite-result">
            <div class="invite-label">知识库创建成功！邀请码：</div>
            <div class="invite-code-box">
              <span class="invite-code">{{ createdTeamCode }}</span>
              <button class="copy-btn" @click="copyCode(createdTeamCode)">复制</button>
            </div>
            <div class="invite-hint">分享邀请码给你的伙伴</div>
          </div>
          <button v-if="!createdTeamCode" class="primary-btn" @click="doCreateTeam" :disabled="teamLoading || !newTeamName.trim()">
            {{ teamLoading ? '创建中...' : '新建知识库' }}
          </button>
          <button v-else class="primary-btn" @click="showTeamPanel = false">完成</button>
        </div>

        <div v-if="teamAction === 'join'">
          <div class="field">
            <label>邀请码</label>
            <input v-model="joinCode" placeholder="输入8位邀请码" />
          </div>
          <button class="primary-btn" @click="doJoinTeam" :disabled="teamLoading || !joinCode.trim()">
            {{ teamLoading ? '加入中...' : '加入知识库' }}
          </button>
        </div>

        <div v-if="teamAction === 'info' && infoTeam">
          <div class="info-section">
            <div class="info-row">
              <span class="info-label">知识库名称</span>
              <div v-if="!editingTeamName" class="info-value rename-trigger">
                <span>{{ infoTeam.name }}</span>
                <span v-if="infoTeam.role === 'owner'" class="edit-icon" @click="startRename">✏️</span>
              </div>
              <div v-else class="rename-row">
                <input v-model="renameValue" class="rename-input" @keyup.enter="doRenameTeam" />
                <button class="rename-save" @click="doRenameTeam">保存</button>
                <button class="rename-cancel" @click="editingTeamName = false">取消</button>
              </div>
            </div>
            <div class="info-row">
              <span class="info-label">邀请码</span>
              <div class="info-value invite-row">
                <span class="invite-code">{{ infoTeam.invite_code }}</span>
                <button class="copy-btn" @click="copyCode(infoTeam.invite_code)">复制</button>
              </div>
            </div>
          </div>
          <div class="members-section">
            <div class="members-title">成员（{{ teamMembers.length }}）</div>
            <div v-for="m in teamMembers" :key="m.id" class="member-item">
              <span class="member-avatar">👤</span>
              <span class="member-name">{{ m.nickname || m.email || '未知' }}</span>
              <span class="member-role" :class="{ owner: m.role === 'owner' }">{{ m.role === 'owner' ? '创建者' : '成员' }}</span>
            </div>
          </div>
          <button v-if="infoTeam.role !== 'owner'" class="leave-btn" @click="doLeaveTeam" :disabled="teamLoading">
            {{ teamLoading ? '退出中...' : '退出知识库' }}
          </button>
          <button v-if="infoTeam.role === 'owner'" class="leave-btn" @click="doDeleteTeam" :disabled="teamLoading" style="margin-top:12px">
            {{ teamLoading ? '删除中...' : '解散知识库' }}
          </button>
        </div>

        <div v-if="teamError" class="error-msg">{{ teamError }}</div>
      </div>
    </div>

    <div v-if="showCreateSubject" class="panel-overlay" @click.self="showCreateSubject = false">
      <div class="panel-sheet">
        <div class="panel-header">
          <h3>添加科目</h3>
          <span class="close-btn" @click="showCreateSubject = false">✕</span>
        </div>
        <div v-if="isLoggedIn" class="field">
          <label>添加到</label>
          <select v-model="newSubjectLibrary" class="library-select">
            <option value="">我的库</option>
            <option value="public">公开库</option>
            <option v-for="t in store.teams" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
        </div>
        <div class="field">
          <label>科目名称</label>
          <input v-model="newSubjectName" placeholder="输入科目名称" />
        </div>
        <div class="field">
          <label>图标</label>
          <div class="icon-picker">
            <span v-for="icon in primaryIcons" :key="icon" class="icon-option" :class="{ active: newSubjectIcon === icon }" @click="newSubjectIcon = icon">{{ icon }}</span>
            <span class="icon-option more-toggle" :class="{ active: showMoreIcons }" @click="showMoreIcons = !showMoreIcons">···</span>
          </div>
          <div v-if="showMoreIcons" class="icon-picker" style="margin-top:8px">
            <span v-for="icon in moreIcons" :key="icon" class="icon-option" :class="{ active: newSubjectIcon === icon }" @click="newSubjectIcon = icon">{{ icon }}</span>
          </div>
        </div>
        <div class="field">
          <label>背景色</label>
          <div class="color-picker">
            <span v-for="c in colorPresets" :key="c" class="color-dot" :class="{ active: newSubjectColor === c }" :style="{ background: c }" @click="newSubjectColor = c"></span>
          </div>
          <div class="color-preview">
            <div class="icon-circle" :style="{ background: newSubjectColor }">{{ newSubjectIcon }}</div>
            <span class="preview-label">预览</span>
          </div>
        </div>
        <button class="primary-btn" @click="doCreateSubject" :disabled="teamLoading || !newSubjectName.trim()">
          {{ teamLoading ? '创建中...' : '创建科目' }}
        </button>
        <div v-if="teamError" class="error-msg">{{ teamError }}</div>
      </div>
    </div>

    <PointEditor v-if="editorVisible && editingPoint" :point="editingPoint" :subject-id="activeSubject?.id || subjects[0]?.id" :team-id="activeTeamId" @close="editorVisible = false" @saved="onPointSaved" />

    <div class="bottom-bar">
      <button class="bottom-add-btn" @click="openQuickAdd">+ 添加知识点</button>
      <div class="review-btn-group" :class="{ disabled: displayStats.due === 0 || selected.size === 0 }">
        <button class="bottom-review-btn" @click="startReview" :disabled="displayStats.due === 0 || selected.size === 0">
          {{ selected.size === 0 ? '选择科目' : displayStats.due === 0 ? '暂无待复习' : '开始复习' }}
        </button>
        <button v-if="selected.size > 0 && displayStats.due > 0" class="review-count-btn" @click.stop="showLimitPicker = true">
          {{ sessionLimit }} <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
      </div>
    </div>

    <div v-if="showLimitPicker" class="picker-overlay" @click.self="showLimitPicker = false">
      <div class="picker-sheet">
        <div class="picker-handle"></div>
        <div class="picker-title">本次复习数量</div>
        <div class="picker-hint">共 {{ displayStats.due }} 题待复习</div>
        <div class="picker-options">
          <button v-for="n in limitOptions" :key="n"
            class="picker-opt"
            :class="{ active: sessionLimit === n, faded: n > displayStats.due }"
            @click="selectLimit(n)">
            <span class="picker-opt-val">{{ n }}</span>
            <span class="picker-opt-unit">题</span>
          </button>
        </div>
        <div class="picker-input-row">
          <span class="picker-input-label">自定义</span>
          <input type="number" class="picker-input" v-model.number="customLimit" min="1" :max="displayStats.due" placeholder="输入数量" @keyup.enter="applyCustomLimit" />
          <button class="picker-input-btn" @click="applyCustomLimit" :disabled="!customLimit || customLimit < 1">确定</button>
        </div>
      </div>
    </div>

    <AiUpload v-if="showAiUpload" :subjects="allSubjectsForUpload" :team-id="activeTeamId" :teams="store.teams" @close="showAiUpload = false" @saved="onPointSaved" />
    <SearchPanel v-if="showSearch" @close="showSearch = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onActivated } from 'vue'
import { useRouter } from 'vue-router'
import { getApi } from '../apiSwitch'
import { store } from '../store'
import { auth } from '../auth'
import PointEditor from '../components/PointEditor.vue'
import AiUpload from '../components/AiUpload.vue'
import SearchPanel from '../components/SearchPanel.vue'

defineOptions({ name: 'LibraryView' })

const router = useRouter()
const subjects = ref<any[]>([])
const overview = ref({ total_points: 0, learned_points: 0, due_today: 0, new_today: 0, reviewed_today: 0 })
const selected = reactive(new Set<string>())
const showPoints = ref(false)
const activeSubject = ref<any>(null)
const subjectPoints = ref<any[]>([])
const editorVisible = ref(false)
const editingPoint = ref<any>(null)
const showAiUpload = ref(false)
const showSearch = ref(false)
const managingMode = ref(false)
const loading = ref(false)

const isLoggedIn = auth.isLoggedIn
const selectedSpaces = reactive(new Set<string>())

const showTeamPanel = ref(false)
const teamAction = ref<'menu' | 'create' | 'join' | 'info'>('menu')
const newTeamName = ref('')
const joinCode = ref('')
const createdTeamCode = ref('')
const teamMembers = ref<any[]>([])
const teamLoading = ref(false)
const teamError = ref('')
const infoTeamId = ref<string | null>(null)

const editingTeamName = ref(false)
const renameValue = ref('')

const showCreateSubject = ref(false)
const newSubjectName = ref('')
const newSubjectLibrary = ref('')
const newSubjectIcon = ref('📚')
const newSubjectColor = ref('#3B82F6')
const showMoreIcons = ref(false)
const primaryIcons = ['📚', '📐', '🔬', '🌍', '💡', '🎨']
const moreIcons = ['📊', '🏛️', '💻', '🧠', '🎵', '⚽', '✏️', '📝', '🔢', '🧪', '🌐', '📖', '🎯', '🏆', '💰', '⚖️', '🔧', '🩺', '🎭', '🧬', '📡', '🚀', '🎓', '🪴']
const colorPresets = ['#3B82F6', '#10B981', '#EF4444', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316']

const infoTeam = computed(() => store.teams.find((t: any) => t.id === infoTeamId.value) || null)

const activeTeamId = computed(() => {
  for (const s of selectedSpaces) {
    if (s !== 'public' && s !== 'mine') return s
  }
  return null
})

const teamPanelTitle = computed(() => {
  const titles: Record<string, string> = { menu: '知识库管理', create: '新建知识库', join: '加入知识库', info: '知识库信息' }
  return titles[teamAction.value]
})

const showLimitPicker = ref(false)
const sessionLimit = ref(store.dailyLimit || 20)
const customLimit = ref<number | null>(null)
const limitOptions = [10, 20, 30, 50]

function selectLimit(n: number) {
  if (n > displayStats.value.due) return
  sessionLimit.value = n
  showLimitPicker.value = false
  startReview()
}

function applyCustomLimit() {
  const val = customLimit.value
  if (!val || val < 1) return
  sessionLimit.value = Math.min(val, displayStats.value.due)
  customLimit.value = null
  showLimitPicker.value = false
  startReview()
}



const allSelected = computed(() => subjects.value.length > 0 && selected.size === subjects.value.length)

const displayStats = computed(() => {
  const seen = new Set<string>()
  let total = 0, due = 0
  for (const s of subjects.value) {
    if (seen.has(s.name)) continue
    seen.add(s.name)
    total += (s.point_count || 0)
    due += (s.due_count || 0)
  }
  return { total, due }
})

const publicOnly = computed(() => selectedSpaces.size === 1 && selectedSpaces.has('public'))

function isPublicSubject(subject: any) {
  if (!isLoggedIn.value) return false
  const userId = auth.currentUser.value?.id
  return !subject.team_id && (!subject.owner_id || subject.owner_id !== userId)
}

function isChoicePoint(p: any) {
  try {
    if (p.question?.trimStart().startsWith('{')) {
      return JSON.parse(p.question)?.type === 'choice'
    }
  } catch {}
  return false
}

function isImagePoint(p: any) {
  try {
    if (p.question?.trimStart().startsWith('{')) {
      const q = JSON.parse(p.question)
      return q?.type === 'choice' && !!q.image
    }
  } catch {}
  return false
}

function canDeleteSubject(subject: any): boolean {
  if (!subject) return false
  if (!isLoggedIn.value) return true
  return subject.owner_id === auth.currentUser.value?.id
}

function getGroupOrder(subject: any, userId: string | null | undefined): number {
  if (!subject.team_id && subject.owner_id === userId) return 0
  if (subject.team_id) return 1
  return 2
}

const allSubjectsForUpload = computed(() => store.subjects.length > 0 ? store.subjects : subjects.value)

const subjectGroups = computed(() => {
  const userId = isLoggedIn.value ? auth.currentUser.value?.id : null
  const groups: Array<{ key: string; label: string; shortLabel: string; color: string; subjects: any[] }> = []

  const mine = subjects.value.filter(s => !s.team_id && s.owner_id === userId)
  if (mine.length > 0) groups.push({ key: 'mine', label: '我的库', shortLabel: '我的', color: '#3B82F6', subjects: mine })

  const teamIds = new Set<string>()
  for (const s of subjects.value) {
    if (s.team_id) teamIds.add(s.team_id)
  }
  for (const tid of teamIds) {
    const team = store.teams.find((t: any) => t.id === tid)
    const teamSubs = subjects.value.filter(s => s.team_id === tid)
    if (teamSubs.length > 0) {
      groups.push({ key: tid, label: team?.name || '知识库', shortLabel: '库', color: '#8B5CF6', subjects: teamSubs })
    }
  }

  const pub = subjects.value.filter(s => !s.team_id && (!s.owner_id || s.owner_id !== userId))
  if (pub.length > 0) groups.push({ key: 'public', label: '公开库', shortLabel: '公开', color: '#10B981', subjects: pub })

  return groups
})

async function loadDataLocal() {
  const { api: localApi } = await import('../db')
  const allSubs = await localApi.getSubjects()
  // Temporarily show public library so local seed data is visible immediately
  const hadPublic = selectedSpaces.has('public')
  if (!hadPublic) selectedSpaces.add('public')
  applySubjects(allSubs, null)
  if (!hadPublic) selectedSpaces.delete('public')
}

function applySubjects(allSubs: any[], userId: string | null | undefined) {
  const filtered: any[] = []
  const seen = new Set<string>()
  for (const s of allSubs) {
    if (seen.has(s.id)) continue
    if (store.hiddenSubjects.includes(s.id)) continue
    const teamId = s.team_id || null
    if (selectedSpaces.has('mine') && !teamId && s.owner_id === userId) { seen.add(s.id); filtered.push(s); continue }
    if (selectedSpaces.has('public') && !teamId && (!s.owner_id || s.owner_id !== userId)) { seen.add(s.id); filtered.push(s); continue }
    if (teamId && selectedSpaces.has(teamId)) { seen.add(s.id); filtered.push(s) }
  }

  filtered.sort((a: any, b: any) => {
    const ga = getGroupOrder(a, userId)
    const gb = getGroupOrder(b, userId)
    if (ga !== gb) return ga - gb
    if ((b.learned_count || 0) !== (a.learned_count || 0)) return (b.learned_count || 0) - (a.learned_count || 0)
    return (a.sort_order ?? 999) - (b.sort_order ?? 999)
  })

  subjects.value = filtered

  const visibleIds = new Set(filtered.map((s: any) => s.id))
  const persisted = store.selectedSubjects
  if (selected.size === 0 && persisted.length > 0) {
    for (const id of persisted) {
      if (visibleIds.has(id)) selected.add(id)
    }
  }
}

async function loadData() {
  const hadData = subjects.value.length > 0
  if (!hadData) loading.value = true
  const api = getApi()

  let allSubs: any[]
  if (store.subjects.length > 0) {
    allSubs = store.subjects
  } else {
    allSubs = await api.getSubjects()
    store.subjects = allSubs
    store._subjectsLoadedAt = Date.now()
  }

  const userId = isLoggedIn.value ? auth.currentUser.value?.id : null
  applySubjects(allSubs, userId)
  loading.value = false

  const ov = await api.getOverview().catch(() => overview.value)
  overview.value = ov
  store.overview = ov
}

function onSearch() {
  showSearch.value = true
}

onMounted(async () => {
  if (isLoggedIn.value) {
    selectedSpaces.add('mine')
    if (store._teamsLoadedAt === 0) store.loadTeams().catch(() => {})
    loadDataLocal().then(() => {
      loadData().catch(() => {})
    })
  } else {
    selectedSpaces.add('public')
    loadData()
  }
})

onActivated(() => {
  getApi().getOverview().then(ov => {
    overview.value = ov
    store.overview = ov
  }).catch(() => {})
})

function toggleSpace(spaceId: string) {
  if (selectedSpaces.has(spaceId)) {
    if (selectedSpaces.size > 1) {
      selectedSpaces.delete(spaceId)
    }
  } else {
    selectedSpaces.add(spaceId)
  }
  loadData().then(() => {
    const visibleIds = new Set(subjects.value.map((s: any) => s.id))
    for (const id of [...selected]) {
      if (!visibleIds.has(id)) selected.delete(id)
    }
    store.saveSelectedSubjects([...selected])
  })
}

function openTeamPanel() {
  teamAction.value = 'menu'
  teamError.value = ''
  createdTeamCode.value = ''
  newTeamName.value = ''
  joinCode.value = ''
  editingTeamName.value = false
  showTeamPanel.value = true
}

function openTeamInfoFor(teamId: string) {
  infoTeamId.value = teamId
  teamAction.value = 'info'
  teamError.value = ''
  editingTeamName.value = false
  loadTeamMembers(teamId)
}

async function loadTeamMembers(teamId?: string) {
  const id = teamId || infoTeamId.value
  if (!id) return
  try {
    teamMembers.value = await getApi().getTeamMembers(id)
  } catch {
    teamMembers.value = []
  }
}

async function doCreateTeam() {
  if (!newTeamName.value.trim()) return
  teamLoading.value = true
  teamError.value = ''
  try {
    const team = await getApi().createTeam(newTeamName.value.trim())
    createdTeamCode.value = team.invite_code
    await store.loadTeams()
    selectedSpaces.add(team.id)
    newTeamName.value = ''
    loadData()
  } catch (e: any) {
    teamError.value = e.message || '创建失败'
  } finally {
    teamLoading.value = false
  }
}

async function doJoinTeam() {
  if (!joinCode.value.trim()) return
  teamLoading.value = true
  teamError.value = ''
  try {
    const team = await getApi().joinTeam(joinCode.value.trim())
    await store.loadTeams()
    selectedSpaces.add(team.id)
    joinCode.value = ''
    showTeamPanel.value = false
    loadData()
  } catch (e: any) {
    teamError.value = e.message || '加入失败'
  } finally {
    teamLoading.value = false
  }
}

async function doLeaveTeam() {
  if (!infoTeamId.value) return
  if (!confirm('确定要退出该知识库吗？')) return
  teamLoading.value = true
  teamError.value = ''
  try {
    await getApi().leaveTeam(infoTeamId.value)
    selectedSpaces.delete(infoTeamId.value)
    await store.loadTeams()
    showTeamPanel.value = false
    loadData()
  } catch (e: any) {
    teamError.value = e.message || '退出失败'
  } finally {
    teamLoading.value = false
  }
}

function startRename() {
  if (!infoTeam.value) return
  renameValue.value = infoTeam.value.name
  editingTeamName.value = true
}

async function doRenameTeam() {
  if (!infoTeamId.value || !renameValue.value.trim()) return
  teamLoading.value = true
  teamError.value = ''
  try {
    await getApi().updateTeam(infoTeamId.value, { name: renameValue.value.trim() })
    await store.loadTeams()
    editingTeamName.value = false
  } catch (e: any) {
    teamError.value = e.message || '修改失败'
  } finally {
    teamLoading.value = false
  }
}

function copyCode(code: string) {
  navigator.clipboard.writeText(code).then(() => alert('已复制到剪贴板'))
}

async function doCreateSubject() {
  if (!newSubjectName.value.trim()) return
  teamLoading.value = true
  teamError.value = ''
  try {
    const isPublicTarget = newSubjectLibrary.value === 'public'
    const teamId = (newSubjectLibrary.value && !isPublicTarget) ? newSubjectLibrary.value : undefined
    await getApi().createSubject({
      name: newSubjectName.value.trim(),
      icon: newSubjectIcon.value,
      color: newSubjectColor.value,
      team_id: teamId,
      is_public: isPublicTarget
    })
    newSubjectName.value = ''
    newSubjectLibrary.value = ''
    newSubjectIcon.value = '📚'
    newSubjectColor.value = '#3B82F6'
    showMoreIcons.value = false
    showCreateSubject.value = false
    store.subjects = []
    store._subjectsLoadedAt = 0
    loadData()
  } catch (e: any) {
    teamError.value = e.message || '创建失败'
  } finally {
    teamLoading.value = false
  }
}

async function cloneSubject(subject: any) {
  if (!confirm(`将「${subject.name}」及其所有知识点克隆到我的库？`)) return
  try {
    await getApi().cloneSubjectToMine(subject.id, { name: subject.name, icon: subject.icon, color: subject.color, sort_order: subject.sort_order })
    alert('克隆成功！已添加到我的库')
    store.subjects = []
    store._subjectsLoadedAt = 0
    if (!selectedSpaces.has('mine')) selectedSpaces.add('mine')
    loadData()
  } catch (e: any) {
    alert(e.message || '克隆失败')
  }
}

async function batchClone() {
  const publicSubs = subjects.value.filter(s => isPublicSubject(s) && selected.has(s.id))
  if (publicSubs.length === 0) { alert('请先选中要克隆的公开科目'); return }
  if (!confirm(`将选中的 ${publicSubs.length} 个公开科目克隆到我的库？`)) return
  try {
    for (const s of publicSubs) {
      await getApi().cloneSubjectToMine(s.id, { name: s.name, icon: s.icon, color: s.color, sort_order: s.sort_order })
    }
    alert(`成功克隆 ${publicSubs.length} 个科目到我的库`)
    store.subjects = []
    store._subjectsLoadedAt = 0
    if (!selectedSpaces.has('mine')) selectedSpaces.add('mine')
    loadData()
  } catch (e: any) {
    alert(e.message || '批量克隆失败')
  }
}

async function collectPoint(point: any) {
  try {
    const userId = auth.currentUser.value?.id
    const allSubs = store.subjects.length > 0 ? store.subjects : await getApi().getSubjects()
    const mySubjects = allSubs.filter((s: any) => !s.team_id && s.owner_id === userId)

    let targetId: string
    const srcSubject = activeSubject.value
    const match = mySubjects.find((s: any) => s.name === srcSubject?.name)

    if (match) {
      targetId = match.id
    } else {
      const newSub = await getApi().createSubject({
        name: srcSubject?.name || '收藏',
        icon: srcSubject?.icon || '📚',
        color: srcSubject?.color || '#3B82F6'
      })
      targetId = newSub.id
      store.subjects = []
      store._subjectsLoadedAt = 0
    }

    await getApi().clonePointToMine(point.id, targetId)
    alert('已收藏到我的库')
  } catch (e: any) {
    alert(e.message || '收藏失败')
  }
}

function toggleSelect(id: string) {
  if (selected.has(id)) selected.delete(id)
  else selected.add(id)
  store.saveSelectedSubjects([...selected])
}

function toggleAllSubjects() {
  if (allSelected.value) {
    selected.clear()
  } else {
    subjects.value.forEach(s => selected.add(s.id))
  }
  store.saveSelectedSubjects([...selected])
}

async function startReview() {
  const selectedSubs = subjects.value.filter(s => selected.has(s.id))
  if (selectedSubs.length === 0) {
    alert('请先选择要复习的科目')
    return
  }
  const publicSubs = selectedSubs.filter(s => isPublicSubject(s))

  if (publicSubs.length > 0 && isLoggedIn.value) {
    if (confirm('公开库知识点需先克隆到我的库才能复习，是否克隆？')) {
      for (const s of publicSubs) {
        await getApi().cloneSubjectToMine(s.id, { name: s.name, icon: s.icon, color: s.color, sort_order: s.sort_order })
      }
      store.subjects = []
      store._subjectsLoadedAt = 0
      await loadData()
    } else {
      const nonPublic = selectedSubs.filter(s => !isPublicSubject(s))
      if (nonPublic.length === 0) return
    }
  }

  const subjectIdsForReview = [...selected]
  const limit = sessionLimit.value >= displayStats.value.due ? 0 : sessionLimit.value
  await store.loadReviewQueue(subjectIdsForReview, limit)
  if (store.reviewQueue.length === 0) {
    alert('所选学科暂无待复习的知识点')
    return
  }
  router.push('/review')
}

async function openSubjectDetail(subject: any) {
  activeSubject.value = subject
  subjectPoints.value = await getApi().getSubjectPoints(subject.id)
  showPoints.value = true
}

async function startSubjectReview() {
  if (!activeSubject.value) return

  if (isPublicSubject(activeSubject.value) && isLoggedIn.value) {
    if (!confirm('公开库知识点需先克隆到我的库才能复习，是否克隆？')) return
    await getApi().cloneSubjectToMine(activeSubject.value.id, {
      name: activeSubject.value.name, icon: activeSubject.value.icon,
      color: activeSubject.value.color, sort_order: activeSubject.value.sort_order
    })
    store.subjects = []
    store._subjectsLoadedAt = 0
    await loadData()
    const userId = auth.currentUser.value?.id
    const cloned = subjects.value.find((s: any) => s.name === activeSubject.value.name && s.owner_id === userId && !s.team_id)
    if (cloned) activeSubject.value = cloned
  }

  const limit = store.dailyLimit > 0 ? store.dailyLimit : undefined
  await store.loadReviewQueue([activeSubject.value.id], limit)
  showPoints.value = false
  if (store.reviewQueue.length === 0) {
    alert('该学科暂无待复习的知识点')
    return
  }
  router.push('/review')
}

function openQuickAdd() {
  if (!auth.isLoggedIn.value) {
    if (confirm('登录后才能添加知识点，是否前往登录？')) router.push('/auth')
    return
  }
  showAiUpload.value = true
}

function openEditor(point: any) {
  editingPoint.value = point
  editorVisible.value = true
}

async function onPointSaved() {
  editorVisible.value = false
  store.subjects = []
  store._subjectsLoadedAt = 0
  if (activeSubject.value) {
    subjectPoints.value = await getApi().getSubjectPoints(activeSubject.value.id)
  }
  loadData()
}

async function deletePoint(p: any) {
  if (!confirm(`确定删除「${p.title}」？`)) return
  await getApi().deletePoint(p.id)
  subjectPoints.value = subjectPoints.value.filter(x => x.id !== p.id)
  store.subjects = []
  store._subjectsLoadedAt = 0
  loadData()
}

async function deleteSubjectAction() {
  if (!activeSubject.value) return
  if (!confirm(`确定要删除科目「${activeSubject.value.name}」及其所有知识点吗？此操作不可撤销。`)) return
  try {
    await getApi().deleteSubject(activeSubject.value.id)
    showPoints.value = false
    selected.delete(activeSubject.value.id)
    store.subjects = []
    store._subjectsLoadedAt = 0
    store.saveSelectedSubjects([...selected])
    loadData()
  } catch (e: any) {
    alert(e.message || '删除失败')
  }
}

async function doDeleteTeam() {
  if (!infoTeamId.value) return
  if (!confirm('确定要解散该知识库吗？所有成员将被移除，知识库内的科目和知识点将被删除。此操作不可撤销。')) return
  teamLoading.value = true
  teamError.value = ''
  try {
    await getApi().deleteTeam(infoTeamId.value)
    selectedSpaces.delete(infoTeamId.value)
    await store.loadTeams()
    showTeamPanel.value = false
    store.subjects = []
    store._subjectsLoadedAt = 0
    loadData()
  } catch (e: any) {
    teamError.value = e.message || '删除失败'
  } finally {
    teamLoading.value = false
  }
}
</script>

<style scoped>
.library-page { background: transparent; padding-bottom: 130px; }
.library-title-bar { position: sticky; top: 0; z-index: 21; background: var(--glass); -webkit-backdrop-filter: var(--glass-blur); backdrop-filter: var(--glass-blur); margin: 0 -16px; padding: 10px 16px 8px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); }
.title-group { display: flex; flex-direction: column; }
.title-group .page-title { margin: 0; }
.title-sub { font-size: 12px; color: var(--gray-400); font-weight: 400; margin-top: 1px; }
.search-btn { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; color: var(--gray-500); cursor: pointer; border-radius: 50%; transition: background 0.2s; }
.search-btn:active { background: var(--gray-100); }

/* Segmented control */
.seg-control { display: flex; gap: 0; background: var(--gray-100); border-radius: 10px; padding: 3px; margin: 12px 0 0; overflow-x: auto; scrollbar-width: none; }
.seg-control::-webkit-scrollbar { display: none; }
.seg-item { flex: 1; min-width: 0; padding: 7px 12px; font-size: 13px; font-weight: 600; color: var(--gray-500); background: transparent; border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s; white-space: nowrap; text-align: center; }
.seg-item.active { background: var(--primary); color: white; box-shadow: 0 1px 3px rgba(59,130,246,0.3); }
.seg-item.seg-add { flex: 0; color: var(--primary); font-size: 18px; font-weight: 700; padding: 7px 14px; min-width: 40px; background: var(--card-bg); border: 1.5px dashed rgba(59,130,246,0.4); }

/* Stat blocks */
.stat-blocks { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 12px 0 0; }
.stat-block { display: flex; flex-direction: column; align-items: center; padding: 12px 8px; background: var(--card-bg); border-radius: 12px; border: 1px solid var(--border-color); }
.stat-block-val { font-size: 22px; font-weight: 700; color: var(--gray-800); }
.stat-block-val.primary { color: var(--primary); }
.stat-block-label { font-size: 12px; color: var(--gray-400); margin-top: 2px; }

/* Section header */
.section-header { display: flex; justify-content: space-between; align-items: center; margin: 16px 0 8px; }
.section-header-left { display: flex; flex-direction: column; }
.section-header-title { font-size: 16px; font-weight: 700; color: var(--gray-900); }
.section-header-sub { font-size: 12px; color: var(--gray-400); margin-top: 1px; }
.manage-btn { font-size: 13px; font-weight: 600; color: var(--primary); background: transparent; border: 1px solid var(--primary); border-radius: 16px; padding: 4px 14px; cursor: pointer; transition: all 0.2s; }
.manage-btn.active { background: var(--primary); color: white; }

/* Manage actions row */
.manage-actions { display: flex; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
.manage-action-btn { font-size: 12px; color: var(--primary); cursor: pointer; font-weight: 600; padding: 4px 12px; border: 1px solid rgba(59,130,246,0.3); border-radius: 16px; background: var(--primary-bg); }
.manage-action-btn:active { background: rgba(59,130,246,0.15); }

/* Subject groups & cards */
.subject-group { margin-bottom: 8px; }
.group-header { display: flex; align-items: center; gap: 6px; padding: 10px 0 6px; }
.group-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.group-name { font-size: 13px; font-weight: 600; color: var(--gray-600); }
.group-count { font-size: 11px; color: var(--gray-400); margin-left: 4px; }

.subject-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
.subject-card { display: flex; flex-direction: column; align-items: center; padding: 12px 6px 8px; border-radius: 12px; background: var(--card-bg); border: 1px solid var(--border-color); cursor: pointer; text-align: center; transition: all 0.2s; }
.subject-card.selected { border-color: var(--primary); background: rgba(59,130,246,0.04); box-shadow: 0 0 0 2px rgba(59,130,246,0.1); }
.subject-card:active { transform: scale(0.97); }

.icon-circle-sm { width: 34px; height: 34px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 17px; color: var(--white); flex-shrink: 0; }
.subject-card-name { font-size: 12px; font-weight: 600; margin-top: 6px; color: var(--gray-900); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; }
.subject-card-meta { font-size: 10px; color: var(--gray-400); margin-top: 2px; }
.subject-card-view { font-size: 10px; color: var(--primary); font-weight: 500; margin-top: 4px; opacity: 0.7; }

/* Icon circle used in create-subject panel */
.icon-circle { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; color: var(--white); flex-shrink: 0; }

/* Points overlay */
.points-overlay { position: fixed; inset: 0; background: var(--overlay); z-index: 200; display: flex; align-items: flex-end; }
.points-panel { background: var(--card-bg); width: 100%; max-width: 430px; margin: 0 auto; border-radius: var(--radius-modal) var(--radius-modal) 0 0; max-height: 80vh; overflow-y: auto; padding: 20px 16px; }
.points-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.points-header h3 { font-size: 18px; }
.close-btn { font-size: 20px; cursor: pointer; color: var(--gray-400); padding: 4px; }
.points-actions { display: flex; gap: 10px; margin-bottom: 16px; }
.add-point-btn { flex: 1; padding: 10px; background: var(--primary-bg); color: var(--primary); border: 1px solid var(--primary); border-radius: var(--radius-btn); font-size: 14px; font-weight: 600; cursor: pointer; }
.review-btn { flex: 1; padding: 10px; font-size: 14px; background: var(--primary); color: white; border: none; border-radius: var(--radius-btn); font-weight: 600; cursor: pointer; }

.point-item { display: flex; align-items: center; gap: 10px; padding: 12px 0; border-bottom: 1px solid var(--gray-100); }
.point-main { flex: 1; cursor: pointer; }
.point-title { font-size: 15px; font-weight: 500; }
.point-category { font-size: 12px; color: var(--gray-400); margin-top: 2px; }
.point-status { flex-shrink: 0; }
.interval-badge { font-size: 11px; background: rgba(16, 185, 129, 0.12); color: var(--green); padding: 2px 8px; border-radius: 4px; }
.new-badge { font-size: 11px; background: var(--primary-bg); color: var(--primary); padding: 2px 8px; border-radius: 4px; }
.choice-tag { font-size: 10px; background: rgba(245, 158, 11, 0.12); color: #d97706; padding: 1px 6px; border-radius: 3px; margin-right: 4px; vertical-align: middle; }
.image-tag { font-size: 10px; background: rgba(59, 130, 246, 0.12); color: #2563EB; padding: 1px 6px; border-radius: 3px; margin-right: 4px; vertical-align: middle; }
.delete-btn { font-size: 12px; font-weight: 500; color: var(--red); cursor: pointer; padding: 4px 8px; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: var(--radius-tag); flex-shrink: 0; opacity: 0.8; }
.delete-btn:active { opacity: 1; background: rgba(239, 68, 68, 0.06); }
.empty-state { text-align: center; padding: 32px; color: var(--gray-400); font-size: 14px; }

/* Bottom bar */
.bottom-bar { position: fixed; bottom: calc(64px + env(safe-area-inset-bottom, 10px)); left: 50%; transform: translateX(-50%); width: calc(100% - 32px); max-width: 398px; display: flex; gap: 10px; z-index: 90; }
.bottom-add-btn { padding: 12px 16px; background: var(--card-bg); color: var(--primary); border: 1px solid var(--primary); border-radius: var(--radius-btn); font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; box-shadow: var(--shadow); height: 48px; box-sizing: border-box; display: flex; align-items: center; }
.bottom-add-btn:active { background: var(--primary-bg); }
.bottom-review-btn { flex: 1; padding: 12px; background: var(--primary); color: white; border: none; border-radius: var(--radius-btn); font-size: 15px; font-weight: 600; cursor: pointer; box-shadow: var(--shadow-btn); height: 48px; box-sizing: border-box; }
.bottom-review-btn:active { opacity: 0.85; }
.bottom-review-btn:disabled { background: var(--gray-300); box-shadow: none; cursor: not-allowed; }

/* Team / Subject panel overlays */
.panel-overlay { position: fixed; inset: 0; background: var(--overlay); z-index: 300; display: flex; align-items: flex-end; }
.panel-sheet { background: var(--card-bg); width: 100%; max-width: 430px; margin: 0 auto; border-radius: var(--radius-modal) var(--radius-modal) 0 0; padding: 20px 16px 40px; max-height: 85vh; overflow-y: auto; -webkit-overflow-scrolling: touch; }
.panel-header { display: flex; align-items: center; margin-bottom: 16px; gap: 8px; }
.panel-header h3 { flex: 1; font-size: 18px; font-weight: 700; }
.back-btn { font-size: 24px; cursor: pointer; color: var(--gray-400); padding: 0 4px; }

.team-menu { display: flex; flex-direction: column; gap: 8px; }
.team-menu-item { display: flex; align-items: center; gap: 14px; padding: 16px; background: var(--gray-50); border-radius: 12px; cursor: pointer; transition: background 0.2s; }
.team-menu-item:active { background: var(--gray-100); }
.menu-icon { font-size: 24px; flex-shrink: 0; }
.menu-text { display: flex; flex-direction: column; flex: 1; }
.menu-title { font-size: 15px; font-weight: 600; color: var(--gray-900); }
.menu-desc { font-size: 12px; color: var(--gray-400); margin-top: 2px; }
.menu-arrow { font-size: 18px; color: var(--gray-300); flex-shrink: 0; }
.team-list-divider { font-size: 13px; font-weight: 600; color: var(--gray-400); margin-top: 8px; padding: 4px 0; }

.field { margin-bottom: 16px; }
.field label { display: block; font-size: 13px; font-weight: 600; color: var(--gray-600); margin-bottom: 6px; }
.field input { width: 100%; padding: 12px; border: 1px solid var(--gray-200); border-radius: var(--radius-sm); font-size: 14px; box-sizing: border-box; }
.field input:focus { outline: none; border-color: var(--primary); }

.primary-btn { width: 100%; padding: 14px; background: var(--primary); color: white; border: none; border-radius: var(--radius-btn); font-size: 16px; font-weight: 600; cursor: pointer; }
.primary-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.invite-result { text-align: center; padding: 20px 0; margin-bottom: 16px; }
.invite-label { font-size: 14px; color: var(--gray-600); margin-bottom: 12px; }
.invite-code-box { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 8px; }
.invite-code { font-size: 24px; font-weight: 700; letter-spacing: 2px; color: var(--primary); font-family: monospace; }
.copy-btn { padding: 6px 14px; font-size: 13px; font-weight: 600; background: var(--primary-bg); color: var(--primary); border: 1px solid var(--primary); border-radius: 8px; cursor: pointer; }
.invite-hint { font-size: 12px; color: var(--gray-400); }

.info-section { margin-bottom: 20px; }
.info-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--gray-100); }
.info-label { font-size: 14px; color: var(--gray-500); flex-shrink: 0; }
.info-value { font-size: 14px; font-weight: 500; }
.invite-row { display: flex; align-items: center; gap: 8px; }
.rename-trigger { display: flex; align-items: center; gap: 8px; }
.edit-icon { cursor: pointer; font-size: 14px; }
.rename-row { display: flex; align-items: center; gap: 6px; flex: 1; margin-left: 12px; }
.rename-input { flex: 1; padding: 6px 10px; border: 1px solid var(--primary); border-radius: 6px; font-size: 14px; outline: none; }
.rename-save { padding: 6px 12px; font-size: 13px; font-weight: 600; background: var(--primary); color: white; border: none; border-radius: 6px; cursor: pointer; white-space: nowrap; }
.rename-cancel { padding: 6px 12px; font-size: 13px; font-weight: 600; background: var(--gray-100); color: var(--gray-600); border: none; border-radius: 6px; cursor: pointer; white-space: nowrap; }

.members-section { margin-bottom: 20px; }
.members-title { font-size: 14px; font-weight: 600; color: var(--gray-600); margin-bottom: 10px; }
.member-item { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--gray-50); }
.member-avatar { font-size: 20px; }
.member-name { flex: 1; font-size: 14px; font-weight: 500; }
.member-role { font-size: 12px; color: var(--gray-400); padding: 2px 8px; background: var(--gray-100); border-radius: 4px; }
.member-role.owner { color: var(--primary); background: var(--primary-bg); }

.leave-btn { width: 100%; padding: 14px; background: var(--card-bg); color: var(--red); border: 1px solid var(--red); border-radius: var(--radius-btn); font-size: 16px; font-weight: 600; cursor: pointer; }
.leave-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.error-msg { color: var(--red); font-size: 13px; text-align: center; padding: 10px 0; }

.icon-picker { display: flex; flex-wrap: wrap; gap: 8px; }
.icon-option { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 20px; border-radius: 10px; border: 2px solid var(--gray-200); cursor: pointer; transition: all 0.2s; }
.icon-option.active { border-color: var(--primary); background: var(--primary-bg); }
.more-toggle { font-size: 16px; font-weight: 700; color: var(--gray-400); letter-spacing: 2px; }
.more-toggle.active { color: var(--primary); }

.color-picker { display: flex; gap: 10px; flex-wrap: wrap; }
.color-dot { width: 32px; height: 32px; border-radius: 50%; cursor: pointer; border: 3px solid transparent; transition: all 0.2s; }
.color-dot.active { border-color: var(--gray-900); box-shadow: 0 0 0 2px white inset; }
.color-preview { display: flex; align-items: center; gap: 10px; margin-top: 12px; }
.preview-label { font-size: 13px; color: var(--gray-400); }

.collect-btn { font-size: 12px; color: var(--primary); cursor: pointer; padding: 4px 8px; border: 1px solid var(--primary); border-radius: 6px; font-weight: 500; flex-shrink: 0; }
.collect-btn:active { background: var(--primary-bg); }

.empty-mine-card { text-align: center; padding: 40px 20px; }
.empty-mine-icon { font-size: 48px; margin-bottom: 12px; }
.empty-mine-text { font-size: 16px; font-weight: 600; color: var(--gray-700); margin-bottom: 8px; }
.empty-mine-hint { font-size: 14px; color: var(--gray-400); line-height: 1.8; }
.empty-mine-link { color: var(--primary); font-weight: 600; cursor: pointer; }

/* Loading state */
.loading-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 0; gap: 12px; }
.loading-spinner { width: 28px; height: 28px; border: 3px solid var(--gray-200); border-top-color: var(--primary); border-radius: 50%; animation: spin .7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.loading-text { font-size: 13px; color: var(--gray-400); }

.delete-subject-btn { padding: 8px 12px; font-size: 13px; font-weight: 600; background: var(--card-bg); color: var(--red); border: 1px solid var(--red); border-radius: var(--radius-btn); cursor: pointer; white-space: nowrap; }
.delete-subject-btn:active { background: rgba(239, 68, 68, 0.06); }

.library-select { width: 100%; padding: 12px 14px; border: 1px solid var(--gray-200); border-radius: var(--radius-sm); font-size: 15px; font-weight: 500; background: var(--card-bg); color: var(--gray-900); }
.library-select:focus { outline: none; border-color: var(--primary); }

/* Review count picker */
.review-btn-group { flex: 1; display: flex; border-radius: var(--radius-btn); overflow: hidden; box-shadow: var(--shadow-btn); }
.review-btn-group .bottom-review-btn { flex: 1; border-radius: 0; box-shadow: none; }
.review-btn-group.disabled .bottom-review-btn { background: var(--gray-300); box-shadow: none; }
.review-count-btn { padding: 0 14px; background: var(--primary-hover); color: white; border: none; border-left: 1px solid rgba(255,255,255,0.2); font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 3px; white-space: nowrap; flex-shrink: 0; }
.review-count-btn:active { opacity: 0.85; }

.picker-overlay { position: fixed; inset: 0; background: var(--overlay); z-index: 400; display: flex; align-items: flex-end; }
.picker-sheet { background: var(--card-bg); width: 100%; max-width: 430px; margin: 0 auto; border-radius: var(--radius-modal) var(--radius-modal) 0 0; padding: 12px 20px 40px; }
.picker-handle { width: 36px; height: 4px; border-radius: 2px; background: var(--gray-300); margin: 0 auto 16px; }
.picker-title { font-size: 17px; font-weight: 700; color: var(--gray-900); margin-bottom: 4px; }
.picker-hint { font-size: 13px; color: var(--gray-400); margin-bottom: 20px; }
.picker-options { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
.picker-opt { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 14px 6px; background: var(--gray-100); border: 2px solid transparent; border-radius: var(--radius-btn); cursor: pointer; transition: all 0.15s; gap: 2px; }
.picker-opt:active { transform: scale(0.96); }
.picker-opt.active { background: var(--primary-bg); border-color: var(--primary); }
.picker-opt.faded { opacity: 0.35; cursor: not-allowed; }
.picker-opt-val { font-size: 18px; font-weight: 700; color: var(--gray-900); }
.picker-opt.active .picker-opt-val { color: var(--primary); }
.picker-opt-unit { font-size: 11px; color: var(--gray-400); }

.picker-input-row { display: flex; align-items: center; gap: 10px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--gray-200); }
.picker-input-label { font-size: 14px; font-weight: 500; color: var(--gray-600); flex-shrink: 0; }
.picker-input { flex: 1; padding: 10px 12px; border: 1px solid var(--gray-200); border-radius: var(--radius-input); font-size: 15px; font-weight: 600; text-align: center; color: var(--gray-900); background: var(--card-bg); }
.picker-input:focus { outline: none; border-color: var(--primary); }
.picker-input-btn { padding: 10px 18px; background: var(--primary); color: white; border: none; border-radius: var(--radius-btn); font-size: 14px; font-weight: 600; cursor: pointer; flex-shrink: 0; }
.picker-input-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
