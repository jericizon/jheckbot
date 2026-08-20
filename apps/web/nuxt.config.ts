export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devServer: {
    port: 8800,
    host: '0.0.0.0',
  },
  modules: ['@nuxtjs/tailwindcss'],
  css: ['~/assets/css/main.css'],
  typescript: {
    strict: true,
  },
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8801',
    },
  },
})
