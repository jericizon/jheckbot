export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devServer: {
    port: 8800,
    host: '0.0.0.0',
  },
  modules: ['@nuxtjs/tailwindcss'],
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  typescript: {
    strict: true,
  },
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8801',
    },
  },
  nitro: {
    routeRules: {
      '/api/**': {
        proxy: `${process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8801'}/api/**`,
      },
    },
  },
  app: {
    head: {
      title: 'JheckBot',
      htmlAttrs: { lang: 'en', dir: 'ltr' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover' },
        { name: 'theme-color', content: '#17171b' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: 'JheckBot' },
        { name: 'application-name', content: 'JheckBot' },
        { name: 'color-scheme', content: 'dark' },
      ],
      link: [
        { rel: 'manifest', href: '/manifest.json' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/icon-192.png' },
        { rel: 'icon', type: 'image/png', sizes: '512x512', href: '/icon-512.png' },
      ],
    },
  },
})
