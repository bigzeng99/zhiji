<template>
  <div class="auth-page">
    <div class="auth-hero">
      <img src="/logo.png" alt="知记" class="app-icon-img" />
      <h1 class="app-name">知记</h1>
      <p class="app-desc">科学记忆，高效学习</p>
    </div>

    <div class="auth-card card">
      <div class="auth-tabs">
        <span class="auth-tab" :class="{ active: mode === 'login' }" @click="mode = 'login'">登录</span>
        <span class="auth-tab" :class="{ active: mode === 'register' }" @click="mode = 'register'">注册</span>
      </div>

      <div class="social-btns">
        <button class="social-btn google-btn" @click="signInWith('google')" :disabled="socialLoading">
          <svg class="social-icon" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Google 登录
        </button>
        <button class="social-btn github-btn" @click="signInWith('github')" :disabled="socialLoading">
          <svg class="social-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/></svg>
          GitHub 登录
        </button>
      </div>

      <div class="divider"><span>或使用邮箱</span></div>

      <form @submit.prevent="handleSubmit" class="auth-form">
        <div class="form-group" v-show="mode === 'register'">
          <input v-model="nickname" type="text" placeholder="昵称" class="form-input" />
        </div>
        <div class="form-group">
          <input v-model="email" type="email" placeholder="邮箱" class="form-input" required />
        </div>
        <div class="form-group">
          <input v-model="password" type="password" placeholder="密码（至少6位）" class="form-input" required minlength="6" />
        </div>
        <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>
        <div v-if="successMsg" class="success-msg">{{ successMsg }}</div>
        <button type="submit" class="submit-btn" :disabled="submitting">
          {{ submitting ? '处理中...' : (mode === 'login' ? '登录' : '注册') }}
        </button>
      </form>
    </div>

    <button class="guest-btn" @click="enterGuest">跳过登录，先体验一下</button>
    <p class="guest-hint">试用模式下数据仅保存在本地，不会同步到云端</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { auth } from '../auth'
import { supabase } from '../supabase'

defineOptions({ name: 'AuthView' })

const router = useRouter()
const mode = ref<'login' | 'register'>('login')
const email = ref('')
const password = ref('')
const nickname = ref('')
const errorMsg = ref('')
const successMsg = ref('')
const submitting = ref(false)
const socialLoading = ref(false)

async function signInWith(provider: 'google' | 'github') {
  socialLoading.value = true
  errorMsg.value = ''
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin + window.location.pathname
      }
    })
    if (error) throw error
  } catch (e: any) {
    errorMsg.value = e.message || '登录失败'
    socialLoading.value = false
  }
}

async function handleSubmit() {
  errorMsg.value = ''
  successMsg.value = ''
  submitting.value = true

  try {
    if (mode.value === 'register') {
      await auth.signUp(email.value, password.value, nickname.value)
      successMsg.value = '注册成功！请查看邮箱确认链接，或直接登录'
      mode.value = 'login'
    } else {
      await auth.signIn(email.value, password.value)
      router.replace('/feed')
    }
  } catch (e: any) {
    const msg = e.message || '操作失败'
    if (msg.includes('Invalid login')) errorMsg.value = '邮箱或密码错误'
    else if (msg.includes('already registered')) errorMsg.value = '该邮箱已注册'
    else if (msg.includes('valid email')) errorMsg.value = '请输入有效的邮箱地址'
    else if (msg.includes('at least')) errorMsg.value = '密码至少需要6位'
    else errorMsg.value = msg
  } finally {
    submitting.value = false
  }
}

function enterGuest() {
  auth.enterGuestMode()
  router.replace('/feed')
}
</script>

<style scoped>
.auth-page {
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 20px;
  overflow: hidden;
  box-sizing: border-box;
}

.auth-hero { text-align: center; margin-bottom: 16px; flex-shrink: 0; }
.app-icon-img { width: 56px; height: 56px; margin-bottom: 6px; border-radius: 14px; }
.app-name { font-size: 24px; font-weight: 800; color: var(--gray-900); margin-bottom: 2px; }
.app-desc { font-size: 14px; color: var(--gray-500); }

.auth-card {
  width: 100%;
  max-width: 380px;
  background: var(--glass-strong);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-glow);
}

.auth-tabs { display: flex; gap: 0; margin-bottom: 20px; border-bottom: 2px solid var(--gray-200); }
.auth-tab { flex: 1; text-align: center; padding: 10px 0; font-size: 16px; font-weight: 600; color: var(--gray-400); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 0.2s; }
.auth-tab.active { color: var(--primary); border-bottom-color: var(--primary); }

.social-btns { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
.social-btn { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; padding: 12px; border-radius: var(--radius-btn); font-size: 15px; font-weight: 500; cursor: pointer; transition: opacity 0.2s; border: 1px solid var(--gray-200); }
.social-btn:active { opacity: 0.8; }
.social-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.social-icon { width: 20px; height: 20px; flex-shrink: 0; }

.google-btn { background: var(--card-bg); color: var(--gray-700); }
.github-btn { background: #24292e; color: white; border-color: #24292e; }

.divider { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; color: var(--gray-400); font-size: 13px; }
.divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: var(--gray-200); }

.auth-form { display: flex; flex-direction: column; gap: 14px; }
.form-input { width: 100%; padding: 14px 16px; border: 1px solid var(--gray-200); border-radius: var(--radius-input); font-size: 15px; background: var(--card-bg); outline: none; transition: border-color 0.2s; box-sizing: border-box; }
.form-input:focus { border-color: var(--primary); }

.error-msg { color: var(--red); font-size: 13px; text-align: center; }
.success-msg { color: var(--green); font-size: 13px; text-align: center; }

.submit-btn { width: 100%; padding: 14px; background: var(--primary); color: white; border: none; border-radius: var(--radius-btn); font-size: 16px; font-weight: 600; cursor: pointer; }
.submit-btn:active { opacity: 0.85; }
.submit-btn:disabled { background: var(--gray-300); cursor: not-allowed; }

.guest-btn { margin-top: 16px; background: none; border: none; color: var(--primary); font-size: 15px; font-weight: 500; cursor: pointer; padding: 8px 16px; flex-shrink: 0; }
.guest-hint { margin-top: 4px; font-size: 12px; color: var(--gray-400); text-align: center; flex-shrink: 0; }
</style>
