import { createRouter, createWebHashHistory } from 'vue-router'
import LibraryView from '../views/LibraryView.vue'
import ReviewView from '../views/ReviewView.vue'
import StatsView from '../views/StatsView.vue'
import ProfileView from '../views/ProfileView.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/library' },
    { path: '/library', name: 'library', component: LibraryView },
    { path: '/review', name: 'review', component: ReviewView },
    { path: '/stats', name: 'stats', component: StatsView },
    { path: '/profile', name: 'profile', component: ProfileView },
  ]
})

export default router
