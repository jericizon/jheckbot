<template>
  <div class="min-h-[100dvh] flex items-center justify-center bg-surface px-4">
    <!-- Theme toggle -->
    <button
      type="button"
      @click="toggle"
      :aria-label="theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
      class="fixed top-4 right-4 p-2 rounded-lg text-content-subtle hover:text-content hover:bg-surface-elevated transition-colors"
    >
      <svg v-if="theme === 'dark'" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
      <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
    </button>

    <div class="w-full max-w-sm animate-fade-in">
      <!-- Brand -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-content text-surface mb-4">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </div>
        <h1 class="text-2xl font-bold text-content">JheckBot</h1>
        <p class="text-sm text-content-muted mt-1">Sign in to your account</p>
      </div>

      <!-- Card -->
      <form @submit.prevent="handleLogin" class="rounded-xl border border-border bg-surface-elevated p-6 space-y-5">
        <!-- Username -->
        <div class="space-y-1.5">
          <label for="username" class="block text-xs font-medium text-content-muted">Username</label>
          <input
            id="username"
            v-model="username"
            type="text"
            placeholder="Enter your username"
            autocomplete="username"
            class="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-content placeholder-content-subtle focus:border-content-subtle focus:ring-2 focus:ring-content-subtle/20 focus:outline-none transition-all"
          />
        </div>

        <!-- Password -->
        <div class="space-y-1.5">
          <label for="password" class="block text-xs font-medium text-content-muted">Password</label>
          <div class="relative">
            <input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Enter your password"
              autocomplete="current-password"
              class="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 pr-11 text-sm text-content placeholder-content-subtle focus:border-content-subtle focus:ring-2 focus:ring-content-subtle/20 focus:outline-none transition-all"
            />
            <button
              type="button"
              @click="showPassword = !showPassword"
              :aria-label="showPassword ? 'Hide password' : 'Show password'"
              :aria-pressed="showPassword"
              class="absolute inset-y-0 right-0 flex items-center justify-center w-11 text-content-subtle hover:text-content transition-colors"
            >
              <svg v-if="showPassword" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
              <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
          </div>
        </div>

        <!-- Error -->
        <p v-if="error" role="alert" class="text-sm text-red-500">{{ error }}</p>

        <!-- Submit -->
        <button
          type="submit"
          :disabled="loading"
          class="w-full rounded-lg bg-content text-surface px-4 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity active:scale-[0.98]"
        >
          {{ loading ? 'Signing in...' : 'Sign In' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const { login, fetchUser, user } = useAuth()
const { theme, toggle } = useTheme()

const username = ref('')
const password = ref('')
const showPassword = ref(false)
const error = ref('')
const loading = ref(false)

async function handleLogin() {
  loading.value = true
  error.value = ''
  const ok = await login(username.value, password.value)
  if (ok) {
    await navigateTo('/')
  } else {
    error.value = 'Invalid credentials'
  }
  loading.value = false
}

onMounted(async () => {
  await fetchUser()
  if (user.value) {
    await navigateTo('/')
  }
})
</script>
