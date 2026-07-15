import { supabase } from './supabase'
import { auth } from './auth'
import { serverNowISOString } from './utils/serverClock'

const queue: { event_type: string; event_data: any; created_at: string }[] = []
let flushTimer: number | null = null

export function track(eventType: string, data: Record<string, any> = {}) {
  queue.push({
    event_type: eventType,
    event_data: data,
    created_at: serverNowISOString()
  })
  if (!flushTimer) {
    flushTimer = window.setTimeout(flush, 5000)
  }
}

async function flush() {
  flushTimer = null
  if (queue.length === 0) return
  const batch = queue.splice(0, queue.length)
  const userId = auth.currentUser.value?.id || null
  if (!userId || auth.isGuest.value) return
  try {
    await supabase.from('events').insert(
      batch.map(e => ({ user_id: userId, ...e }))
    )
  } catch {
    queue.unshift(...batch)
  }
}

window.addEventListener('beforeunload', flush)
