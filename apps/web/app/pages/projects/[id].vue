<template>
  <div class="pb-20">
    <header class="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 z-40">
      <button @click="navigateTo('/projects')" class="text-gray-600 text-lg">&larr;</button>
      <h1 class="text-lg font-bold truncate">{{ project?.name || 'Project' }}</h1>
    </header>

    <div class="px-4 py-4 space-y-4">
      <!-- Project info -->
      <div v-if="project" class="rounded-lg border border-gray-200 bg-white p-3">
        <p class="text-xs text-gray-500 font-mono break-all">{{ project.path }}</p>
        <button @click="checkHealth" :disabled="healthLoading" class="mt-2 text-xs text-indigo-600 hover:underline">
          {{ healthLoading ? 'Checking...' : 'Run health check' }}
        </button>
        <div v-if="health" class="mt-2 space-y-1 text-xs">
          <div class="flex items-center gap-2"><span>{{ health.directory ? '✓' : '✗' }}</span> Directory</div>
          <div class="flex items-center gap-2"><span>{{ health.accessible ? '✓' : '✗' }}</span> Accessible</div>
          <div class="flex items-center gap-2"><span>{{ health.gitRepository ? '✓' : '✗' }}</span> Git</div>
          <div class="flex items-center gap-2"><span>{{ health.nodeProject ? '✓' : '✗' }}</span> Node</div>
          <div class="flex items-center gap-2"><span>{{ health.pnpmProject ? '✓' : '✗' }}</span> pnpm</div>
          <div class="flex items-center gap-2"><span>{{ health.dockerProject ? '✓' : '✗' }}</span> Docker</div>
          <div class="flex items-center gap-2"><span>{{ health.devinCli ? '✓' : '✗' }}</span> Devin CLI</div>
        </div>
      </div>

      <!-- Conversations -->
      <div>
        <h2 class="text-sm font-semibold text-gray-500 uppercase mb-2">Conversations</h2>
        <button @click="newConversation" class="w-full rounded-lg border-2 border-dashed border-gray-300 py-3 text-sm text-gray-600 hover:border-indigo-400 hover:text-indigo-600 mb-3">
          + New Conversation
        </button>
        <div v-if="convLoading" class="text-gray-500 text-sm">Loading...</div>
        <div v-else-if="conversations.length === 0" class="text-gray-500 text-sm">No conversations yet.</div>
        <div v-else class="space-y-2">
          <NuxtLink
            v-for="conv in conversations"
            :key="conv.id"
            :to="`/conversations/${conv.id}`"
            class="block rounded-lg border border-gray-200 bg-white p-3 hover:border-indigo-300"
          >
            <div class="flex items-center justify-between">
              <span class="font-medium text-sm">{{ conv.title }}</span>
              <span class="h-2 w-2 rounded-full" :class="conv.agent_status === 'running' ? 'bg-green-500' : 'bg-gray-300'" />
            </div>
            <p class="text-xs text-gray-500 mt-1">{{ formatTime(conv.last_message_at || conv.created_at) }}</p>
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const projectsApi = useProjects()
const convApi = useConversations()

const id = computed(() => route.params.id as string)

interface Project { id: string; name: string; path: string; description: string | null; enabled: boolean }
interface Conversation { id: string; title: string; agent_status: string; last_message_at: string | null; created_at: string }
interface HealthResult { directory: boolean; accessible: boolean; gitRepository: boolean; nodeProject: boolean; pnpmProject: boolean; dockerProject: boolean; devinCli: boolean }

const project = ref<Project | null>(null)
const conversations = ref<Conversation[]>([])
const convLoading = ref(true)
const health = ref<HealthResult | null>(null)
const healthLoading = ref(false)

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`
  return d.toLocaleDateString()
}

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
