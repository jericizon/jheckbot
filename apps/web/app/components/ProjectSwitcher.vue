<template>
  <div ref="rootEl" class="relative shrink-0">
    <button
      @click="open = !open"
      class="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-content hover:bg-surface-subtle transition-colors max-w-[40vw]"
      :title="'Switch project'"
      :aria-expanded="open"
    >
      <svg class="w-3.5 h-3.5 text-content-subtle shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z M3 7l2-2h12l2 2" /></svg>
      <span class="truncate">{{ currentLabel }}</span>
      <svg class="w-3 h-3 text-content-subtle shrink-0 transition-transform" :class="open ? 'rotate-180' : ''" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
    </button>

    <div
      v-if="open"
      class="absolute right-0 mt-1 w-64 rounded-lg border border-border bg-surface-elevated shadow-lg z-50 overflow-hidden animate-slide-up"
    >
      <div class="px-3 py-2 text-[11px] font-medium text-content-subtle uppercase tracking-wide border-b border-border">
        Switch project
      </div>
      <div class="max-h-72 overflow-y-auto py-1">
        <div v-if="loading" class="px-3 py-2 text-xs text-content-subtle">Loading...</div>
        <div v-else-if="projects.length === 0" class="px-3 py-2 text-xs text-content-subtle">No projects yet</div>
        <button
          v-for="p in projects"
          :key="p.id"
          @click="select(p.id)"
          class="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-subtle transition-colors"
          :class="p.id === currentId ? 'text-content' : 'text-content-muted'"
        >
          <span class="h-1.5 w-1.5 rounded-full shrink-0" :class="p.enabled ? 'bg-emerald-500' : 'bg-content-subtle'" />
          <span class="flex-1 min-w-0">
            <span class="block truncate font-medium">{{ p.name }}</span>
            <span class="block truncate text-[11px] text-content-subtle font-mono">{{ p.path }}</span>
          </span>
          <svg v-if="p.id === currentId" class="w-3.5 h-3.5 text-content-subtle shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
        </button>
      </div>
      <NuxtLink
        to="/projects"
        @click="open = false"
        class="block px-3 py-2 text-xs text-content-muted hover:text-content hover:bg-surface-subtle border-t border-border transition-colors"
      >
        Manage projects...
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  currentId?: string
  currentLabel?: string
}>()

const projectsApi = useProjects()

interface Project { id: string; name: string; path: string; enabled: boolean }

const projects = ref<Project[]>([])
const loading = ref(true)
const open = ref(false)
const rootEl = ref<HTMLElement | null>(null)

const currentLabel = computed(() => props.currentLabel || projects.value.find((p) => p.id === props.currentId)?.name || 'Projects')

async function load() {
  loading.value = true
  try {
    projects.value = await projectsApi.list()
  } catch {
    // ignore
  } finally {
    loading.value = false
  }
}

function select(id: string) {
  open.value = false
  if (id !== props.currentId) navigateTo(`/projects/${id}`)
}

function onClickOutside(e: MouseEvent) {
  if (rootEl.value && !rootEl.value.contains(e.target as Node)) open.value = false
}

onMounted(() => {
  load()
  document.addEventListener('click', onClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
})

watch(open, (v) => {
  if (v && projects.value.length === 0) load()
})
</script>
