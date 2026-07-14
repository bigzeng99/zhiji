import { createRouter, createWebHashHistory } from 'vue-router'
import { auth } from '../auth'
import FeedView from '../views/FeedView.vue'

const AuthView = () => import('../views/AuthView.vue')
const ReviewView = () => import('../views/ReviewView.vue')
const LibraryView = () => import('../views/LibraryView.vue')
const ProfileView = () => import('../views/ProfileView.vue')
const ShareView = () => import('../views/ShareView.vue')

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/feed' },
    { path: '/auth', name: 'auth', component: AuthView, meta: { public: true } },
    { path: '/review', name: 'review', component: ReviewView },
    { path: '/feed', name: 'feed', component: FeedView },
    { path: '/library', name: 'library', component: LibraryView },
    { path: '/profile', name: 'profile', component: ProfileView },
    { path: '/share/:pointId', name: 'share', component: ShareView, meta: { public: true } },
  ]
})

router.beforeEach((to, _from, next) => {
  if (to.meta.public) return next()
  if (auth.loading.value) {
    const unwatch = auth.loading
    const check = () => {
      if (!unwatch.value) {
        if (auth.currentUser.value || auth.isGuest.value) next()
        else next('/auth')
      } else {
        setTimeout(check, 50)
      }
    }
    check()
  } else if (auth.currentUser.value || auth.isGuest.value) {
    next()
  } else {
    next('/auth')
  }
})

export default router
