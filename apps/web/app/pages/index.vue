<template>
  <div class="pb-20">
    <header class="sticky top-0 bg-surface-elevated border-b border-border px-4 py-3 z-40">
      <h1 class="text-lg font-semibold">JheckBot</h1>
    </header>

    <div class="px-4 py-4 max-w-2xl mx-auto">
      <h2 class="text-[11px] font-medium text-content-subtle uppercase tracking-wide mb-3">Recent</h2>
      <div v-if="loading" class="space-y-2">
        <div v-for="i in 3" :key="i" class="rounded-lg border border-border bg-surface-elevated p-3 animate-pulse">
          <div class="h-4 w-32 bg-surface-subtle rounded" />
          <div class="h-3 w-20 bg-surface-subtle rounded mt-2" />
        </div>
      </div>
      <div v-else-if="recent.length === 0" class="text-content-subtle text-sm py-8 text-center">
        No conversations yet. Select a project to start.
      </div>
      <div v-else class="space-y-2">
        <NuxtLink
          v-for="conv in recent"
          :key="conv.id"
          :to="`/conversations/${conv.id}`"
          class="block rounded-lg border border-border bg-surface-elevated p-3 hover:border-content-subtle transition-colors"
        >
          <div class="flex items-center gap-2">
            <span class="h-1.5 w-1.5 rounded-full" :class="conv.agent_status === 'running' ? 'bg-emerald-500' : 'bg-content-subtle'" />
            <span class="font-medium text-sm truncate">{{ conv.title }}</span>
          </div>
          <p class="text-xs text-content-subtle mt-1">{{ formatTime(conv.last_message_at || conv.created_at) }}</p>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { fetchUser, user } = useAuth()

interface Conversation {
  id: string
  title: string
  agent_status: string
  last_message_at: string | null
  created_at: string
}

const recent = ref<Conversation[]>([])
const loading = ref(true)

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
