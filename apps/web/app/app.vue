<template>
  <div>
    <SplashScreen :visible="showSplash" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<script setup lang="ts">
// Show the splash during initial hydration, then fade it out once mounted.
const showSplash = ref(true)

onMounted(() => {
  // Brief delay so the fade-out transition is visible rather than instant.
  setTimeout(() => {
    showSplash.value = false
  }, 350)
})
</script>
