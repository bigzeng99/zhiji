import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { initDB } from './db'
import { auth } from './auth'
import { store } from './store'
import './styles/global.css'

const app = createApp(App)
app.use(router)
app.mount('#app')

const dbReady = initDB().catch(() => {})
const authReady = auth.init().catch(() => {
  auth.loading.value = false
})

Promise.all([dbReady, authReady]).then(() => store.preload())
