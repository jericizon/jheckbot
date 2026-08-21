<template>
  <div class="min-h-[100dvh] flex items-center justify-center bg-surface px-4">
    <div class="w-full max-w-sm animate-fade-in">
      <h1 class="text-2xl font-bold text-content text-center mb-8">JheckBot</h1>
      <form @submit.prevent="handleLogin" class="space-y-4">
        <div>
          <input
            v-model="username"
            type="text"
            placeholder="Username"
            autocomplete="username"
            class="w-full rounded-lg border border-border bg-surface-elevated px-4 py-3 text-sm text-content placeholder-content-subtle focus:border-content-subtle focus:outline-none transition-colors"
          />
        </div>
        <div>
          <input
            v-model="password"
            type="password"
            placeholder="Password"
            autocomplete="current-password"
            class="w-full rounded-lg border border-border bg-surface-elevated px-4 py-3 text-sm text-content placeholder-content-subtle focus:border-content-subtle focus:outline-none transition-colors"
          />
        </div>
        <p v-if="error" class="text-sm text-red-500">{{ error }}</p>
        <button
          type="submit"
          :disabled="loading"
          class="w-full rounded-lg bg-content text-surface px-4 py-3 text-sm font-medium hover:opacity-80 disabled:opacity-50 transition-opacity active:scale-[0.98]"
        >
          {{ loading ? 'Signing in...' : 'Sign In' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const { login, fetchUser } = useAuth()
const username = ref('')
const password = ref('')
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
  if (useAuth().user.value) {
    await navigateTo('/')
  }
})
</script>
