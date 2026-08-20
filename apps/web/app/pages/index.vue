<template>
  <div class="pb-20">
    <header class="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-40">
      <h1 class="text-lg font-bold">JheckBot</h1>
    </header>

    <div class="px-4 py-4">
      <h2 class="text-sm font-semibold text-gray-500 uppercase mb-3">Recent</h2>
      <div v-if="loading" class="text-gray-500 text-sm">Loading...</div>
      <div v-else-if="recent.length === 0" class="text-gray-500 text-sm">
        No conversations yet. Select a project to start.
      </div>
      <div v-else class="space-y-3">
        <NuxtLink
          v-for="conv in recent"
          :key="conv.id"
          :to="`/conversations/${conv.id}`"
          class="block rounded-lg border border-gray-200 bg-white p-3 hover:border-indigo-300"
        >
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full" :class="conv.agent_status === 'running' ? 'bg-green-500' : 'bg-gray-300'" />
            <span class="font-medium text-sm">{{ conv.title }}</span>
          </div>
          <p class="text-xs text-gray-500 mt-1">{{ formatTime(conv.last_message_at || conv.created_at) }}</p>
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
  if (mins < 60) return `${mins} minutes ago`
  if (mins < 1440) return `${Math.floor(mins / 60)} hours ago`
  return d.toLocaleDateString()
}

onMounted(async () => {
  await fetchUser()
  if (!user.value) {
    await navigateTo('/login')
    return
  }
  // Load recent conversations across projects
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
