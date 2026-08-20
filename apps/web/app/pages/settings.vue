<template>
  <div class="pb-20">
    <header class="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 z-40">
      <h1 class="text-lg font-bold">Settings</h1>
    </header>

    <div class="px-4 py-4 space-y-4">
      <div v-if="user" class="rounded-lg border border-gray-200 bg-white p-4">
        <div class="text-sm text-gray-500">Signed in as</div>
        <div class="font-medium mt-1">{{ user.username }}</div>
      </div>

      <button
        @click="handleLogout"
        class="w-full rounded-lg border border-red-200 bg-white py-3 text-sm font-medium text-red-600 hover:bg-red-50"
      >
        Sign Out
      </button>

      <div class="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
        <div class="text-sm font-semibold">About</div>
        <div class="text-xs text-gray-500">JheckBot — Self-hosted mobile development assistant</div>
        <div class="text-xs text-gray-500">Controls Devin CLI from your phone</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { user, logout, fetchUser } = useAuth()

async function handleLogout() {
  await logout()
}

onMounted(async () => {
  await fetchUser()
  if (!user.value) {
    await navigateTo('/login')
  }
})
</script>
