<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">
    <slot />
    <nav
      v-if="showNav"
      class="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white flex items-center justify-around py-2 z-50"
    >
      <NuxtLink to="/" class="flex flex-col items-center text-xs text-gray-600 hover:text-indigo-600">
        <span class="text-lg">Home</span>
        <span>Home</span>
      </NuxtLink>
      <NuxtLink to="/projects" class="flex flex-col items-center text-xs text-gray-600 hover:text-indigo-600">
        <span class="text-lg">Projects</span>
        <span>Projects</span>
      </NuxtLink>
      <NuxtLink to="/history" class="flex flex-col items-center text-xs text-gray-600 hover:text-indigo-600">
        <span class="text-lg">History</span>
        <span>History</span>
      </NuxtLink>
      <NuxtLink to="/settings" class="flex flex-col items-center text-xs text-gray-600 hover:text-indigo-600">
        <span class="text-lg">Settings</span>
        <span>Settings</span>
      </NuxtLink>
    </nav>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const showNav = computed(() => !route.path.startsWith('/login') && !route.path.startsWith('/conversations/'))
</script>
