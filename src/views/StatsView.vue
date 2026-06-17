<template>
  <div class="page stats-page">
    <div class="stats-tabs">
      <span v-for="tab in tabs" :key="tab" class="stats-tab" :class="{ active: activeTab === tab }" @click="activeTab = tab">{{ tab }}</span>
    </div>

    <div class="subject-dropdown" @click="showDropdown = !showDropdown">
      <span>{{ selectedLabel }}</span>
      <span class="dropdown-arrow">▾</span>
      <div v-if="showDropdown" class="dropdown-menu">
        <div v-for="s in subjectOptions" :key="s.id" class="dropdown-item" :class="{ selected: selectedSubject === s.id }" @click.stop="selectSubject(s.id, s.name)">{{ s.name }}</div>
      </div>
    </div>

    <div v-if="activeTab === '遗忘曲线'" class="curve-section">
      <div class="curve-card card">
        <div class="curve-title">遗忘曲线</div>
        <canvas ref="canvasRef" width="380" height="260"></canvas>
        <div class="curve-legend">
          <div class="legend-item"><span class="legend-dot" style="background:#E67E22"></span>你的学习遗忘曲线</div>
          <div class="legend-item"><span class="legend-dot" style="background:#27AE60"></span>艾宾浩斯遗忘曲线</div>
        </div>
      </div>
      <div class="info-card">
        <div class="info-icon">💡</div>
        <div class="info-text">
          <strong>坚持使用知记，获取更精准的遗忘曲线</strong>
          <p>随着学习数据的积累，你的遗忘曲线会更加精准。</p>
        </div>
      </div>
    </div>

    <div v-else-if="activeTab === '学习情况'" class="learning-section">
      <div class="card">
        <div class="learn-stat-row">
          <div class="learn-stat"><div class="learn-stat-value">{{ overview.reviewed_today }}</div><div class="learn-stat-label">今日已复习</div></div>
          <div class="learn-stat"><div class="learn-stat-value">{{ overview.due_today }}</div><div class="learn-stat-label">今日待复习</div></div>
          <div class="learn-stat"><div class="learn-stat-value">{{ overview.new_today }}</div><div class="learn-stat-label">今日新学</div></div>
        </div>
      </div>
      <div class="card">
        <div class="learn-detail-title">最近 7 天学习量</div>
        <div class="bar-chart">
          <div v-for="d in weeklyData" :key="d.date" class="bar-col">
            <div class="bar-value">{{ d.reviewed }}</div>
            <div class="bar" :style="{ height: Math.max(4, d.reviewed / (maxWeekly || 1) * 120) + 'px' }"></div>
            <div class="bar-label">{{ d.day }}</div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="durability-section">
      <div class="card">
        <div class="dur-title">记忆持久度分布</div>
        <div class="dur-bars">
          <div class="dur-row"><span class="dur-label">标熟</span><div class="dur-bar-bg"><div class="dur-bar-fill" :style="{ width: masteryData.mastered + '%', background: '#1B6B3A' }"></div></div><span class="dur-percent">{{ masteryData.mastered }}%</span></div>
          <div class="dur-row"><span class="dur-label">熟悉</span><div class="dur-bar-bg"><div class="dur-bar-fill" :style="{ width: masteryData.familiar + '%', background: '#27AE60' }"></div></div><span class="dur-percent">{{ masteryData.familiar }}%</span></div>
          <div class="dur-row"><span class="dur-label">一般</span><div class="dur-bar-bg"><div class="dur-bar-fill" :style="{ width: masteryData.normal + '%', background: '#F39C12' }"></div></div><span class="dur-percent">{{ masteryData.normal }}%</span></div>
          <div class="dur-row"><span class="dur-label">不熟</span><div class="dur-bar-bg"><div class="dur-bar-fill" :style="{ width: masteryData.unfamiliar + '%', background: '#E74C3C' }"></div></div><span class="dur-percent">{{ masteryData.unfamiliar }}%</span></div>
          <div class="dur-row"><span class="dur-label">未学</span><div class="dur-bar-bg"><div class="dur-bar-fill" :style="{ width: masteryData.unlearned + '%', background: '#9CA3AF' }"></div></div><span class="dur-percent">{{ masteryData.unlearned }}%</span></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { api } from '../db'
import { store } from '../store'

const activeTab = ref('遗忘曲线')
const tabs = ['遗忘曲线', '学习情况', '记忆持久度']
const showDropdown = ref(false)
const selectedSubject = ref('all')
const selectedLabel = ref('全部学科')
const canvasRef = ref<HTMLCanvasElement | null>(null)

const overview = ref({ due_today: 0, reviewed_today: 0, new_today: 0 })
const weeklyData = ref<any[]>([])
const masteryData = ref({ mastered: 0, familiar: 0, normal: 0, unfamiliar: 0, unlearned: 0 })
const curveData = ref<any>({ user: [], ebbinghaus: [] })

const subjectOptions = computed(() => [
  { id: 'all', name: '全部学科' },
  ...store.subjects.map(s => ({ id: s.id, name: s.name }))
])

const maxWeekly = computed(() => Math.max(...weeklyData.value.map(d => d.reviewed), 1))

function selectSubject(id: string, name: string) {
  selectedSubject.value = id
  selectedLabel.value = name
  showDropdown.value = false
  loadTabData()
}

async function loadTabData() {
  const sub = selectedSubject.value === 'all' ? undefined : selectedSubject.value
  if (activeTab.value === '遗忘曲线') {
    curveData.value = await api.getCurve(sub)
    nextTick(drawCurve)
  } else if (activeTab.value === '学习情况') {
    const [ov, weekly] = await Promise.all([api.getOverview(), api.getWeekly()])
    overview.value = ov
    weeklyData.value = weekly
  } else {
    masteryData.value = await api.getMastery(sub)
  }
}

function drawCurve() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = canvas.width, h = canvas.height
  const padL = 40, padR = 10, padT = 10, padB = 30
  const chartW = w - padL - padR, chartH = h - padT - padB

  ctx.clearRect(0, 0, w, h)
  ctx.strokeStyle = '#E5E7EB'; ctx.lineWidth = 1; ctx.font = '11px sans-serif'; ctx.fillStyle = '#9CA3AF'; ctx.textAlign = 'right'
  for (let i = 0; i <= 5; i++) {
    const y = padT + (chartH / 5) * i
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke()
    ctx.fillText((100 - i * 20) + '%', padL - 6, y + 4)
  }

  const userData = curveData.value.user as any[]
  const ebbY = curveData.value.ebbinghaus as number[]
  const len = Math.max(userData.length, ebbY.length)
  if (len === 0) return

  ctx.textAlign = 'center'
  const labels = ['今天', '1天前', '2天前', '3天前', '4天前', '5天前', '6天前', '7天前', '8天前', '9天前'].reverse()
  for (let i = 0; i < len; i++) {
    const x = padL + (chartW / (len - 1)) * i
    ctx.fillStyle = '#9CA3AF'
    ctx.fillText(labels[i] || '', x, h - 6)
  }

  function drawLine(values: (number | null)[], color: string) {
    const c = ctx!
    c.strokeStyle = color; c.lineWidth = 3; c.lineJoin = 'round'; c.lineCap = 'round'
    c.beginPath()
    let started = false
    for (let i = 0; i < values.length; i++) {
      const v = values[i]
      if (v === null) continue
      const x = padL + (chartW / (values.length - 1)) * i
      const y = padT + chartH * (1 - v / 100)
      if (!started) { c.moveTo(x, y); started = true } else c.lineTo(x, y)
    }
    c.stroke()
    for (let i = 0; i < values.length; i++) {
      const v = values[i]
      if (v === null) continue
      const x = padL + (chartW / (values.length - 1)) * i
      const y = padT + chartH * (1 - v / 100)
      c.beginPath(); c.fillStyle = color; c.arc(x, y, 4, 0, Math.PI * 2); c.fill()
    }
  }

  drawLine(ebbY, '#27AE60')
  drawLine(userData.map(d => d.retention), '#E67E22')
}

onMounted(async () => {
  await store.loadSubjects()
  loadTabData()
})
watch(activeTab, () => loadTabData())
</script>

<style scoped>
.stats-page { background: var(--white); }
.stats-tabs { display: flex; gap: 20px; padding: 14px 0 10px; border-bottom: 1px solid var(--gray-200); }
.stats-tab { font-size: 16px; color: var(--gray-400); cursor: pointer; padding-bottom: 8px; border-bottom: 2px solid transparent; font-weight: 500; }
.stats-tab.active { color: var(--primary); border-bottom-color: var(--primary); font-weight: 700; }

.subject-dropdown { display: inline-flex; align-items: center; gap: 6px; padding: 8px 18px; border: 2px solid var(--primary); border-radius: 24px; font-size: 14px; font-weight: 600; color: var(--primary); cursor: pointer; margin: 14px 0; position: relative; }
.dropdown-arrow { font-size: 12px; }
.dropdown-menu { position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid var(--gray-200); border-radius: var(--radius-sm); box-shadow: var(--shadow-lg); z-index: 50; margin-top: 4px; overflow: hidden; min-width: 120px; }
.dropdown-item { padding: 10px 16px; font-size: 14px; color: var(--gray-700); cursor: pointer; }
.dropdown-item:hover, .dropdown-item.selected { background: var(--primary-bg); color: var(--primary); font-weight: 600; }

.curve-card { background: var(--gray-50); border: 1px solid var(--gray-200); }
.curve-title { font-size: 16px; font-weight: 700; margin-bottom: 12px; }
canvas { display: block; width: 100%; max-width: 380px; margin: 0 auto; }
.curve-legend { margin-top: 12px; display: flex; flex-direction: column; gap: 6px; }
.legend-item { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--gray-700); }
.legend-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }

.info-card { display: flex; gap: 12px; background: var(--primary); color: white; padding: 16px; border-radius: var(--radius); margin-top: 12px; }
.info-icon { font-size: 24px; flex-shrink: 0; }
.info-text strong { font-size: 14px; display: block; margin-bottom: 4px; }
.info-text p { font-size: 12px; opacity: 0.9; line-height: 1.6; margin: 0; }

.learn-stat-row { display: flex; justify-content: space-around; text-align: center; }
.learn-stat-value { font-size: 28px; font-weight: 700; color: var(--primary); }
.learn-stat-label { font-size: 12px; color: var(--gray-500); margin-top: 4px; }
.learn-detail-title { font-size: 15px; font-weight: 600; margin-bottom: 16px; }
.bar-chart { display: flex; justify-content: space-around; align-items: flex-end; height: 160px; }
.bar-col { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; }
.bar-value { font-size: 11px; color: var(--gray-500); }
.bar { width: 24px; background: var(--primary); border-radius: 4px 4px 0 0; transition: height 0.5s; min-height: 4px; }
.bar-label { font-size: 11px; color: var(--gray-500); }

.dur-title { font-size: 15px; font-weight: 600; margin-bottom: 16px; }
.dur-bars { display: flex; flex-direction: column; gap: 12px; }
.dur-row { display: flex; align-items: center; gap: 10px; }
.dur-label { font-size: 13px; width: 36px; color: var(--gray-700); }
.dur-bar-bg { flex: 1; height: 12px; background: var(--gray-100); border-radius: 6px; overflow: hidden; }
.dur-bar-fill { height: 100%; border-radius: 6px; transition: width 0.5s; }
.dur-percent { font-size: 13px; color: var(--gray-500); width: 36px; text-align: right; }

.card { background: var(--gray-50); border: 1px solid var(--gray-200); border-radius: var(--radius); padding: 16px; margin-bottom: 12px; box-shadow: var(--shadow); }
</style>
