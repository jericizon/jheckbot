<template>
  <div class="min-h-[100dvh] bg-surface text-content">
    <slot />
    <nav
      v-if="showNav"
      class="fixed bottom-0 left-0 right-0 border-t border-border bg-surface-elevated flex items-center justify-around py-2 z-50 safe-area-pb"
    >
      <NuxtLink to="/" class="flex flex-col items-center gap-0.5 text-[11px] text-content-muted hover:text-content transition-colors" active-class="text-content">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
        <span>Home</span>
      </NuxtLink>
      <NuxtLink to="/projects" class="flex flex-col items-center gap-0.5 text-[11px] text-content-muted hover:text-content transition-colors" active-class="text-content">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z M3 7l2-2h12l2 2" /></svg>
        <span>Projects</span>
      </NuxtLink>
      <NuxtLink to="/settings" class="flex flex-col items-center gap-0.5 text-[11px] text-content-muted hover:text-content transition-colors" active-class="text-content">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.428 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.428 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.428-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        <span>Settings</span>
      </NuxtLink>
    </nav>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const showNav = computed(() =>
  !route.path.startsWith('/login')
  && !route.path.startsWith('/conversations/')
  && !(/^\/projects\/[^/]+\/?$/.test(route.path))
)
</script>
