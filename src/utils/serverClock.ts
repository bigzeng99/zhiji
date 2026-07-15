// 用 Supabase 每次 HTTP 响应自带的标准 Date 响应头校正本地时钟。
// 即使用户设备时间不准，写入数据库的时间也会用"服务器时间 - 设备时间"的偏差纠正过来，
// 不需要改数据库结构（没有直连数据库权限，建不了触发器）。

let offsetMs = 0
let calibrated = false

export function updateClockOffsetFromResponse(res: Response) {
  const dateHeader = res.headers.get('date')
  if (!dateHeader) return
  const serverMs = Date.parse(dateHeader)
  if (Number.isNaN(serverMs)) return
  offsetMs = serverMs - Date.now()
  calibrated = true
}

export function isClockCalibrated() {
  return calibrated
}

export function serverNow(): Date {
  return new Date(Date.now() + offsetMs)
}

export function serverNowISOString(): string {
  return serverNow().toISOString()
}

export function serverTodayString(): string {
  return serverNow().toISOString().slice(0, 10)
}
