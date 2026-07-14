// @ts-ignore
import QRCode from 'qrcode'

export interface SharePointInfo {
  id: string
  title: string
  question: string
  subjectName: string
  subjectIcon: string
  subjectColor: string
}

const FONT = '-apple-system, BlinkMacSystemFont, PingFang SC, sans-serif'
const W = 640
const PAD = 40
const CONTENT_W = W - PAD * 2

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function roundRectTop(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h)
  ctx.lineTo(x, y + h)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    if (!paragraph.trim()) { lines.push(''); continue }
    let line = ''
    for (const ch of paragraph) {
      const test = line + ch
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line)
        line = ch
      } else {
        line = test
      }
    }
    if (line) lines.push(line)
  }
  return lines
}

function stripMd(text: string): string {
  return text
    .replace(/[#*_~`>]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .trim()
}

export async function drawPointShareCard(canvas: HTMLCanvasElement, point: SharePointInfo): Promise<void> {
  const ctx = canvas.getContext('2d')!
  const question = stripMd(point.question)

  ctx.font = `bold 22px ${FONT}`
  const titleLines = wrapText(ctx, point.title, CONTENT_W - 40)

  ctx.font = `15px ${FONT}`
  const questionLines = wrapText(ctx, question, CONTENT_W - 40)
  const maxQuestionLines = 12
  const clippedQuestion = questionLines.slice(0, maxQuestionLines)
  const questionClipped = questionLines.length > maxQuestionLines

  const topH = 100
  const subjectY = topH + 28
  const subjectH = 30
  const cardTopY = subjectY + subjectH + 20
  const titleBlockH = titleLines.length * 30 + 16
  const questionBlockH = clippedQuestion.length * 24 + (questionClipped ? 24 : 0)
  const cardContentH = 24 + titleBlockH + 12 + questionBlockH + 24
  const qrSectionY = cardTopY + cardContentH + 24
  const qrSectionH = 140
  const footerH = 50
  const H = qrSectionY + qrSectionH + footerH

  canvas.width = W
  canvas.height = H
  ctx.clearRect(0, 0, W, H)

  // background
  ctx.fillStyle = '#F7F9FC'
  ctx.fillRect(0, 0, W, H)

  // header gradient
  const topGrad = ctx.createLinearGradient(0, 0, W, topH)
  topGrad.addColorStop(0, '#3B82F6')
  topGrad.addColorStop(1, '#60A5FA')
  ctx.fillStyle = topGrad
  roundRectTop(ctx, 0, 0, W, topH, 0)
  ctx.fill()

  ctx.fillStyle = '#fff'
  ctx.font = `bold 26px ${FONT}`
  ctx.fillText('📖 知记 · 知识分享', PAD, 46)

  const dateStr = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
  ctx.font = `15px ${FONT}`
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.fillText(dateStr, PAD, 74)

  // subject tag
  const tagText = `${point.subjectIcon} ${point.subjectName}`
  ctx.font = `bold 14px ${FONT}`
  const tagW = ctx.measureText(tagText).width + 24
  ctx.fillStyle = point.subjectColor + '18'
  roundRect(ctx, PAD, subjectY, tagW, subjectH, 15)
  ctx.fill()
  ctx.fillStyle = point.subjectColor
  ctx.fillText(tagText, PAD + 12, subjectY + 20)

  // content card
  ctx.fillStyle = '#FFFFFF'
  ctx.shadowColor = 'rgba(0,0,0,0.06)'
  ctx.shadowBlur = 16
  ctx.shadowOffsetY = 4
  roundRect(ctx, PAD, cardTopY, CONTENT_W, cardContentH, 16)
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0

  // title
  ctx.fillStyle = '#1A2233'
  ctx.font = `bold 22px ${FONT}`
  let ty = cardTopY + 36
  for (const line of titleLines) {
    ctx.fillText(line, PAD + 20, ty)
    ty += 30
  }

  // divider
  ty += 4
  ctx.strokeStyle = '#EFF2F7'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(PAD + 20, ty)
  ctx.lineTo(PAD + CONTENT_W - 20, ty)
  ctx.stroke()
  ty += 16

  // question text
  ctx.fillStyle = '#4B5563'
  ctx.font = `15px ${FONT}`
  for (const line of clippedQuestion) {
    ctx.fillText(line, PAD + 20, ty)
    ty += 24
  }
  if (questionClipped) {
    ctx.fillStyle = '#9CA3AF'
    ctx.fillText('......', PAD + 20, ty)
  }

  // QR section
  ctx.fillStyle = '#FFFFFF'
  ctx.shadowColor = 'rgba(0,0,0,0.05)'
  ctx.shadowBlur = 12
  ctx.shadowOffsetY = 3
  roundRect(ctx, PAD, qrSectionY, CONTENT_W, qrSectionH, 16)
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0

  ctx.fillStyle = '#6B7A92'
  ctx.font = `bold 15px ${FONT}`
  ctx.fillText('💡 扫码查看答案', PAD + 20, qrSectionY + 32)

  ctx.fillStyle = '#9CA3AF'
  ctx.font = `13px ${FONT}`
  ctx.fillText('打开知记 App 查看完整解析', PAD + 20, qrSectionY + 56)

  // QR code
  const shareUrl = `https://bigzeng99.github.io/zhiji/#/share/${point.id}`
  try {
    const qrDataUrl = await QRCode.toDataURL(shareUrl, {
      width: 120, margin: 1,
      color: { dark: '#3B82F6', light: '#ffffff' }
    })
    const qrImg = await loadImage(qrDataUrl)
    const qrSize = 90
    const qrX = PAD + CONTENT_W - 20 - qrSize
    const qrY = qrSectionY + (qrSectionH - qrSize) / 2
    ctx.fillStyle = '#fff'
    ctx.shadowColor = 'rgba(0,0,0,0.08)'
    ctx.shadowBlur = 8
    roundRect(ctx, qrX - 6, qrY - 6, qrSize + 12, qrSize + 12, 10)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize)
  } catch {}

  // footer
  ctx.fillStyle = '#9BA8BA'
  ctx.font = `12px ${FONT}`
  ctx.fillText('知记 — 科学记忆，高效学习', PAD, H - 18)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export function doShare(canvas: HTMLCanvasElement, filename: string = 'zhiji-share') {
  canvas.toBlob(async (blob) => {
    if (!blob) return
    if (navigator.share && 'canShare' in navigator) {
      const file = new File([blob], `${filename}.png`, { type: 'image/png' })
      try {
        await navigator.share({ title: '知记知识分享', files: [file] })
        return
      } catch {}
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.png`
    a.click()
    URL.revokeObjectURL(url)
  }, 'image/png')
}
