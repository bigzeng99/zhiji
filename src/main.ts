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

initDB()
  .then(() => store.preload())
  .catch(() => {})

auth.init().catch(() => {
  auth.loading.value = false
})
