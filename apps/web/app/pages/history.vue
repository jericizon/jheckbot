<template>
  <div class="pb-20">
    <header class="sticky top-0 bg-surface-elevated border-b border-border px-4 py-3 z-40 space-y-2">
      <h1 class="text-lg font-semibold">History</h1>
      <input
        v-model="query"
        @input="search"
        placeholder="Search conversations..."
        class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content placeholder-content-subtle focus:border-content-subtle focus:outline-none transition-colors"
      />
    </header>

    <div class="px-4 py-4 max-w-2xl mx-auto">
      <div v-if="loading" class="text-content-subtle text-sm">Searching...</div>
      <div v-else-if="results.length === 0" class="text-content-subtle text-sm">
        {{ query ? 'No results found.' : 'Start typing to search.' }}
      </div>
      <div v-else class="space-y-2">
        <NuxtLink
          v-for="result in results"
          :key="result.conversation_id"
          :to="`/conversations/${result.conversation_id}`"
          class="block rounded-lg border border-border bg-surface-elevated p-3 hover:border-content-subtle transition-colors"
        >
          <div class="text-xs text-content-subtle">{{ result.project_name }}</div>
          <div class="font-medium text-sm mt-1">{{ result.conversation_title }}</div>
          <div class="text-xs text-content-subtle mt-1">{{ new Date(result.created_at).toLocaleDateString() }}</div>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const convApi = useConversations()

interface SearchResult {
  conversation_id: string
  project_id: string
  project_name: string
  conversation_title: string
  created_at: string
}

const query = ref('')
const results = ref<SearchResult[]>([])
const loading = ref(false)
let debounce: ReturnType<typeof setTimeout>

async function search() {
  clearTimeout(debounce)
  if (!query.value.trim()) {
    results.value = []
    return
  }
  debounce = setTimeout(async () => {
    loading.value = true
    try {
      results.value = await convApi.search(query.value)
    } catch {
      results.value = []
    } finally {
      loading.value = false
    }
  }, 300)
}
</script>
