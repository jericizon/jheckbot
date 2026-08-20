<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-900 px-4">
    <div class="w-full max-w-sm">
      <h1 class="text-2xl font-bold text-white text-center mb-8">JheckBot</h1>
      <form @submit.prevent="handleLogin" class="space-y-4">
        <div>
          <input
            v-model="username"
            type="text"
            placeholder="Username"
            class="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
            autocomplete="username"
          />
        </div>
        <div>
          <input
            v-model="password"
            type="password"
            placeholder="Password"
            class="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
            autocomplete="current-password"
          />
        </div>
        <p v-if="error" class="text-sm text-red-400">{{ error }}</p>
        <button
          type="submit"
          :disabled="loading"
          class="w-full rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
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
