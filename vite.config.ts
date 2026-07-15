import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '知记 - 知识记忆助手',
        short_name: '知记',
        description: '基于艾宾浩斯遗忘曲线的间隔重复记忆工具',
        lang: 'zh-CN',
        theme_color: '#3B82F6',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        id: '/zhiji/',
        categories: ['education', 'productivity'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ],
        shortcuts: [
          { name: '开始复习', url: './#/library', icons: [{ src: 'icon-192.png', sizes: '192x192' }] },
          { name: '知识流', url: './#/feed', icons: [{ src: 'icon-192.png', sizes: '192x192' }] }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,woff2}'],
        globIgnores: ['signs/**', 'pdf.worker*'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /\/signs\/.+\.svg$/,
            handler: 'CacheFirst',
            options: { cacheName: 'sign-images', expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 } }
          },
          {
            urlPattern: /pdf\.worker.*\.mjs$/,
            handler: 'CacheFirst',
            options: { cacheName: 'pdf-worker', expiration: { maxEntries: 2, maxAgeSeconds: 30 * 24 * 60 * 60 } }
          },
          {
            urlPattern: /^https:\/\/joqppofbsptljxdhxcpe\.supabase\.co\/rest\/v1\//,
            handler: 'NetworkFirst',
            options: { cacheName: 'supabase-api', expiration: { maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 }, networkTimeoutSeconds: 5 }
          }
        ]
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 500
  },
  server: {
    host: '0.0.0.0',
    port: 5173
  }
})
