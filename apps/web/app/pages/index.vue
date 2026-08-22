<template>
  <div class="pb-20">
    <header class="sticky top-0 bg-surface-elevated border-b border-border px-4 py-3 z-40 space-y-3">
      <h1 class="text-lg font-semibold">JheckBot</h1>
      <div class="relative">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-subtle" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        <input
          v-model="query"
          @input="onSearchInput"
          placeholder="Search conversations..."
          class="w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-2 text-sm text-content placeholder-content-subtle focus:border-content-subtle focus:ring-2 focus:ring-content-subtle/20 focus:outline-none transition-all"
        />
      </div>
    </header>

    <div class="px-4 py-4 max-w-2xl mx-auto">
      <h2 class="text-[11px] font-medium text-content-subtle uppercase tracking-wide mb-3">
        {{ query.trim() ? 'Results' : 'Recent' }}
      </h2>

      <!-- Loading -->
      <div v-if="loading" class="space-y-2">
        <div v-for="i in 3" :key="i" class="rounded-lg border border-border bg-surface-elevated p-3 animate-pulse">
          <div class="h-4 w-32 bg-surface-subtle rounded" />
          <div class="h-3 w-20 bg-surface-subtle rounded mt-2" />
        </div>
      </div>

      <!-- Empty -->
      <div v-else-if="items.length === 0" class="text-content-subtle text-sm py-8 text-center">
        {{ query.trim() ? 'No results found.' : 'No conversations yet. Select a project to start.' }}
      </div>

      <!-- Search results -->
      <div v-else-if="query.trim()" class="space-y-2">
        <NuxtLink
          v-for="result in searchResults"
          :key="result.conversation_id"
          :to="`/conversations/${result.conversation_id}`"
          class="block rounded-lg border border-border bg-surface-elevated p-3 hover:border-content-subtle transition-colors"
        >
          <div class="text-xs text-content-subtle">{{ result.project_name }}</div>
          <div class="font-medium text-sm mt-1">{{ result.conversation_title }}</div>
          <div class="text-xs text-content-subtle mt-1">{{ new Date(result.created_at).toLocaleDateString() }}</div>
        </NuxtLink>
      </div>

      <!-- Recent conversations -->
      <div v-else class="space-y-2">
        <NuxtLink
          v-for="conv in recent"
          :key="conv.id"
          :to="`/conversations/${conv.id}`"
          class="block rounded-lg border border-border bg-surface-elevated p-3 hover:border-content-subtle transition-colors"
        >
          <div class="flex items-center gap-2">
            <span class="relative flex h-2 w-2 items-center justify-center" :title="isAgentActive(conv) ? 'Agent running' : 'Idle'">
              <span v-if="isAgentActive(conv)" class="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60 animate-ping" />
              <span class="relative inline-flex rounded-full h-1.5 w-1.5" :class="isAgentActive(conv) ? 'bg-emerald-500' : 'bg-content-subtle'" />
            </span>
            <span class="font-medium text-sm truncate flex-1">{{ conv.title }}</span>
            <span v-if="isAgentActive(conv)" class="text-[10px] font-medium text-emerald-500 shrink-0">Active</span>
          </div>
          <p class="text-xs text-content-subtle mt-1">{{ formatTime(conv.last_message_at || conv.created_at) }}</p>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { fetchUser, user } = useAuth()
const convApi = useConversations()

interface Conversation {
  id: string
  title: string
  agent_status: string
  last_message_at: string | null
  created_at: string
}

interface SearchResult {
  conversation_id: string
  project_id: string
  project_name: string
  conversation_title: string
  created_at: string
}

const recent = ref<Conversation[]>([])
const searchResults = ref<SearchResult[]>([])
const query = ref('')
const loading = ref(true)
let debounce: ReturnType<typeof setTimeout>

const items = computed(() => (query.value.trim() ? searchResults.value : recent.value))

const ACTIVE_STATUSES = ['starting', 'running', 'stopping']
function isAgentActive(conv: Conversation) {
  return ACTIVE_STATUSES.includes(conv.agent_status)
}

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

function onSearchInput() {
  clearTimeout(debounce)
  if (!query.value.trim()) {
    searchResults.value = []
    loading.value = false
    return
  }
  loading.value = true
  debounce = setTimeout(async () => {
    try {
      searchResults.value = await convApi.search(query.value)
    } catch {
      searchResults.value = []
    } finally {
      loading.value = false
    }
  }, 300)
}

onMounted(async () => {
  await fetchUser()
  if (!user.value) {
    await navigateTo('/login')
    return
  }
  try {
    const projects = await useProjects().list()
    const allConvs: Conversation[] = []
    for (const project of projects) {
      const convs = await useConversations().listByProject(project.id)
      allConvs.push(...convs.map((c) => ({
        id: c.id,
        title: c.title,
        agent_status: c.agent_status,
        last_message_at: c.last_message_at,
        created_at: c.created_at,
      })))
    }
    allConvs.sort((a, b) => {
      const aTime = a.last_message_at || a.created_at
      const bTime = b.last_message_at || b.created_at
      return new Date(bTime).getTime() - new Date(aTime).getTime()
    })
    recent.value = allConvs.slice(0, 10)
  } catch {
    // ignore
  } finally {
    loading.value = false
  }
})
</script>
