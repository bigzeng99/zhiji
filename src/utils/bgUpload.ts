import { reactive } from 'vue'

export const bgUpload = reactive({
  active: false,
  total: 0,
  done: 0,
  failed: 0,
  label: '',
  finished: false,
  result: ''
})

export async function runBgUpload(label: string, fn: (progress: (done: number) => void) => Promise<{ done: number; failed: number }>) {
  bgUpload.active = true
  bgUpload.finished = false
  bgUpload.label = label
  bgUpload.done = 0
  bgUpload.failed = 0
  bgUpload.result = ''
  try {
    const res = await fn((n) => { bgUpload.done = n })
    bgUpload.done = res.done
    bgUpload.failed = res.failed
    const subjectHint = label.includes('「') ? label.slice(label.indexOf('「')) : ''
    bgUpload.result = res.failed > 0
      ? `完成：${res.done} 条成功${subjectHint}，${res.failed} 条未通过`
      : `已上传 ${res.done} 条${subjectHint}`
  } catch (e: any) {
    bgUpload.result = `上传失败：${e.message || '未知错误'}`
  } finally {
    bgUpload.finished = true
    setTimeout(() => { bgUpload.active = false; bgUpload.finished = false }, 6000)
  }
}
