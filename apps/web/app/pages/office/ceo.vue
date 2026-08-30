<template>
  <div class="flex h-[100dvh] overflow-hidden bg-surface text-content">
    <!-- Sidebar -->
    <aside
      class="hidden md:flex w-64 shrink-0 h-full bg-surface-elevated border-r border-border flex-col"
    >
      <!-- Back to project -->
      <div class="p-3">
        <NuxtLink
          :to="backTo"
          class="w-full flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-content bg-accent-muted hover:bg-border-subtle transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to project
        </NuxtLink>
      </div>

      <!-- Office info -->
      <div class="px-3 pb-3">
        <p class="px-3 py-2 text-[11px] font-medium text-content-subtle uppercase tracking-wide">CEO Chat</p>
        <div class="px-3 py-2 text-sm text-content-muted">
          <p>Talk to the CEO to plan tasks and assign work to agents.</p>
        </div>
      </div>

      <!-- Footer -->
      <div class="mt-auto p-3 border-t border-border flex items-center justify-between">
        <NuxtLink to="/" class="flex items-center gap-2 text-sm text-content-muted hover:text-content transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          Home
        </NuxtLink>
        <div class="flex items-center gap-1">
          <button
            @click="toggleTheme"
            class="p-1.5 rounded-md text-content-subtle hover:text-content hover:bg-surface-subtle transition-colors"
            :aria-label="theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
            :title="theme === 'dark' ? 'Switch to light' : 'Switch to dark'"
          >
            <svg v-if="theme === 'dark'" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          </button>
        </div>
      </div>
    </aside>

    <!-- Mobile header back link -->
    <div class="md:hidden fixed top-0 left-0 right-0 z-40 bg-surface-elevated border-b border-border px-3 py-3 flex items-center gap-2">
      <NuxtLink
        :to="backTo"
        class="flex items-center gap-1.5 text-sm text-content-subtle hover:text-content"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Project
      </NuxtLink>
      <h1 class="text-sm font-semibold">Talk to CEO</h1>
    </div>

    <!-- Main chat area -->
    <div class="flex-1 flex flex-col h-full min-w-0 pt-12 md:pt-0">
      <!-- Desktop header -->
      <header class="hidden md:flex items-center gap-2 border-b border-border shrink-0 px-4 py-3">
        <h1 class="text-sm font-semibold">Talk to CEO</h1>
        <span
          class="text-xs text-content-subtle font-mono truncate max-w-[50%]"
          :title="officeId"
        >
          {{ officeId }}
        </span>
      </header>

      <!-- Chat content (messages + input) -->
      <CEOChat :office-id="officeId" :project-id="projectId" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import CEOChat from '~/components/office/CEOChat.vue'

const route = useRoute()
const { theme, toggle: toggleTheme } = useTheme()

const officeId = computed(() => (route.query.office as string) ?? '')
const projectId = computed(() => (route.query.project as string) ?? undefined)

const backTo = computed(() =>
  projectId.value ? `/projects/${projectId.value}` : '/projects',
)

useHead(() => ({
  title: 'Talk to CEO',
}))
</script>
