import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { initDB } from './db'
import './styles/global.css'

initDB().then(() => {
  createApp(App).use(router).mount('#app')
})
