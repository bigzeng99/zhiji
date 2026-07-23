import { ref, computed } from 'vue'
import { supabase } from './supabase'
import { serverNowISOString } from './utils/serverClock'
import type { User, Session } from '@supabase/supabase-js'

const currentUser = ref<User | null>(null)
const currentSession = ref<Session | null>(null)
const profile = ref<any>(null)
const loading = ref(true)
const isGuest = ref(false)

export const auth = {
  currentUser,
  currentSession,
  profile,
  loading,
  isGuest,

  isLoggedIn: computed(() => !!currentUser.value && !isGuest.value),
  isVip: computed(() => {
    if (!profile.value) return false
    if (!profile.value.is_vip) return false
    if (profile.value.vip_expires_at && new Date(profile.value.vip_expires_at) < new Date()) return false
    return true
  }),

  async init() {
    loading.value = true
    try {
      const sessionPromise = supabase.auth.getSession()
      const timeout = new Promise<null>(r => setTimeout(() => r(null), 5000))
      const result = await Promise.race([sessionPromise, timeout])
      const session = result?.data?.session ?? null
      if (session) {
        currentSession.value = session
        currentUser.value = session.user
        await Promise.race([this.loadProfile(), new Promise(r => setTimeout(r, 3000))])
      }
    } catch {}
    loading.value = false

    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (_event === 'SIGNED_OUT') {
        currentSession.value = null
        currentUser.value = null
        profile.value = null
        return
      }
      if (session?.user) {
        currentSession.value = session
        currentUser.value = session.user
        await this.loadProfile()
      }
    })
  },

  async loadProfile() {
    if (!currentUser.value) return
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentUser.value.id)
      .single()
    profile.value = data
  },

  async signUp(email: string, password: string, nickname?: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nickname: nickname || '知记用户' } }
    })
    if (error) throw error
    return data
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  },

  async signOut() {
    isGuest.value = false
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    profile.value = null
  },

  enterGuestMode() {
    isGuest.value = true
    loading.value = false
  },

  async updateProfile(updates: { nickname?: string; avatar_url?: string }) {
    if (!currentUser.value) return
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: serverNowISOString() })
      .eq('id', currentUser.value.id)
      .select()
      .single()
    if (error) throw error
    profile.value = data
    return data
  }
}
