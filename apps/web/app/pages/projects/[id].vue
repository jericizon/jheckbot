<template>
  <div class="flex h-[100dvh] overflow-hidden bg-surface text-content">
    <!-- Sidebar overlay (mobile) -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div v-if="sidebarOpen" class="fixed inset-0 bg-black/40 z-30 md:hidden" @click="closeSidebar" />
    </Transition>

    <!-- Sidebar -->
    <Transition
      enter-active-class="transition-transform duration-300 ease-out"
      leave-active-class="transition-transform duration-200 ease-in"
      enter-from-class="-translate-x-full"
      leave-to-class="-translate-x-full"
    >
      <aside
        v-if="sidebarOpen"
        class="fixed md:relative z-40 w-64 shrink-0 h-full bg-surface-elevated border-r border-border flex flex-col"
      >
        <!-- New chat -->
        <div class="p-3">
          <button
            @click="newConversation"
            class="w-full flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-content bg-accent-muted hover:bg-border-subtle transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg>
            New Conversation
          </button>
        </div>

        <!-- Conversation list -->
        <div class="flex-1 overflow-y-auto px-2 pb-2">
          <p class="px-3 py-2 text-[11px] font-medium text-content-subtle uppercase tracking-wide">Conversations</p>
          <div v-if="convLoading" class="px-3 py-2 text-sm text-content-subtle">Loading...</div>
          <div v-else-if="conversations.length === 0" class="px-3 py-2 text-sm text-content-subtle">No conversations yet.</div>
          <NuxtLink
            v-for="conv in conversations"
            :key="conv.id"
            :to="`/conversations/${conv.id}`"
            class="block rounded-lg px-3 py-2 text-sm truncate mb-0.5 transition-colors"
            :class="conv.agent_status === 'running' ? 'text-content' : 'text-content-muted hover:bg-surface-subtle hover:text-content'"
          >
            <div class="flex items-center gap-2">
              <span class="h-1.5 w-1.5 rounded-full shrink-0" :class="conv.agent_status === 'running' ? 'bg-emerald-500' : 'bg-content-subtle'" />
              <span class="truncate">{{ conv.title }}</span>
            </div>
          </NuxtLink>
        </div>

        <!-- Footer -->
        <div class="p-3 border-t border-border">
          <NuxtLink to="/" class="flex items-center gap-2 text-sm text-content-muted hover:text-content transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            Home
          </NuxtLink>
        </div>
      </aside>
    </Transition>

    <!-- Main content area -->
    <div class="flex-1 flex flex-col h-full min-w-0">
      <!-- Header -->
      <header class="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <button
          @click="toggleSidebar"
          class="text-content-muted hover:text-content transition-colors p-1 -ml-1 rounded-md hover:bg-surface-subtle"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <button
          @click="navigateTo('/projects')"
          class="text-content-subtle hover:text-content transition-colors p-1 rounded-md hover:bg-surface-subtle"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 class="flex-1 text-sm font-semibold truncate">{{ project?.name || 'Project' }}</h1>
        <button
          @click="toggleTheme"
          class="text-content-muted hover:text-content transition-colors p-1.5 rounded-md hover:bg-surface-subtle"
          :title="theme === 'dark' ? 'Switch to light' : 'Switch to dark'"
        >
          <svg v-if="theme === 'dark'" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
        </button>
      </header>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto">
        <div class="max-w-2xl mx-auto px-4 py-8 space-y-6">
          <!-- Project info -->
          <div v-if="project" class="rounded-lg border border-border bg-surface-elevated p-4">
            <p class="text-xs text-content-subtle font-mono break-all">{{ project.path }}</p>
            <button @click="checkHealth" :disabled="healthLoading" class="mt-3 text-xs text-content-muted hover:text-content transition-colors">
              {{ healthLoading ? 'Checking...' : 'Run health check' }}
            </button>
            <div v-if="health" class="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div class="flex items-center gap-2" :class="health.directory ? 'text-emerald-500' : 'text-content-subtle'">
                <span>{{ health.directory ? '✓' : '○' }}</span> Directory
              </div>
              <div class="flex items-center gap-2" :class="health.accessible ? 'text-emerald-500' : 'text-content-subtle'">
                <span>{{ health.accessible ? '✓' : '○' }}</span> Accessible
              </div>
              <div class="flex items-center gap-2" :class="health.gitRepository ? 'text-emerald-500' : 'text-content-subtle'">
                <span>{{ health.gitRepository ? '✓' : '○' }}</span> Git
              </div>
              <div class="flex items-center gap-2" :class="health.nodeProject ? 'text-emerald-500' : 'text-content-subtle'">
                <span>{{ health.nodeProject ? '✓' : '○' }}</span> Node
              </div>
              <div class="flex items-center gap-2" :class="health.pnpmProject ? 'text-emerald-500' : 'text-content-subtle'">
                <span>{{ health.pnpmProject ? '✓' : '○' }}</span> pnpm
              </div>
              <div class="flex items-center gap-2" :class="health.dockerProject ? 'text-emerald-500' : 'text-content-subtle'">
                <span>{{ health.dockerProject ? '✓' : '○' }}</span> Docker
              </div>
              <div class="flex items-center gap-2" :class="health.devinCli ? 'text-emerald-500' : 'text-content-subtle'">
                <span>{{ health.devinCli ? '✓' : '○' }}</span> Devin CLI
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const projectsApi = useProjects()
const convApi = useConversations()
const { theme, toggle: toggleTheme } = useTheme()
const { sidebarOpen, toggle: toggleSidebar, close: closeSidebar } = useSidebar()

const id = computed(() => route.params.id as string)

interface Project { id: string; name: string; path: string; description: string | null; enabled: boolean }
interface Conversation { id: string; title: string; agent_status: string; last_message_at: string | null; created_at: string }
interface HealthResult { directory: boolean; accessible: boolean; gitRepository: boolean; nodeProject: boolean; pnpmProject: boolean; dockerProject: boolean; devinCli: boolean }

const project = ref<Project | null>(null)
const conversations = ref<Conversation[]>([])
const convLoading = ref(true)
const health = ref<HealthResult | null>(null)
const healthLoading = ref(false)

async function load() {
  try {
    project.value = await projectsApi.get(id.value)
    conversations.value = await convApi.listByProject(id.value)
  } catch {
    // ignore
  } finally {
    convLoading.value = false
  }
}

async function checkHealth() {
  healthLoading.value = true
  try {
    health.value = await projectsApi.health(id.value)
  } catch {
    // ignore
  } finally {
    healthLoading.value = false
  }
}

async function newConversation() {
  try {
    const conv = await convApi.create(id.value)
    await navigateTo(`/conversations/${conv.id}`)
  } catch {
    // ignore
  }
}

onMounted(load)
</script>
