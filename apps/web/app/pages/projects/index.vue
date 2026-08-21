<template>
  <div class="pb-20">
    <header class="sticky top-0 bg-surface-elevated border-b border-border px-4 py-3 z-40">
      <h1 class="text-lg font-semibold">Projects</h1>
    </header>

    <div class="px-4 py-4 max-w-2xl mx-auto">
      <button
        @click="showAdd = !showAdd"
        class="w-full rounded-lg border border-dashed border-border py-3 text-sm text-content-muted hover:border-content-subtle hover:text-content transition-colors"
      >
        + Add Project
      </button>

      <div v-if="showAdd" class="rounded-lg border border-border bg-surface-elevated p-4 mt-3 space-y-3 animate-slide-up">
        <input v-model="newProject.name" placeholder="Project name" class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content placeholder-content-subtle focus:border-content-subtle focus:outline-none transition-colors" />
        <input v-model="newProject.path" placeholder="/projects/example-repo (relative to allowed root)" class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content placeholder-content-subtle font-mono focus:border-content-subtle focus:outline-none transition-colors" />
        <p class="text-xs text-content-subtle -mt-1">Must be a git repository under an allowed root. Full paths also accepted.</p>
        <input v-model="newProject.description" placeholder="Description (optional)" class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content placeholder-content-subtle focus:border-content-subtle focus:outline-none transition-colors" />
        <button @click="addProject" :disabled="adding" class="w-full rounded-lg bg-content text-surface py-2 text-sm font-medium hover:opacity-80 disabled:opacity-50 transition-opacity active:scale-[0.98]">
          {{ adding ? 'Adding...' : 'Add Project' }}
        </button>
        <p v-if="addError" class="text-sm text-red-500">{{ addError }}</p>
      </div>

      <div v-if="loading" class="space-y-2 mt-4">
        <div v-for="i in 3" :key="i" class="rounded-lg border border-border bg-surface-elevated p-3 animate-pulse">
          <div class="h-4 w-32 bg-surface-subtle rounded" />
          <div class="h-3 w-48 bg-surface-subtle rounded mt-2" />
        </div>
      </div>
      <div v-else class="space-y-2 mt-4">
        <NuxtLink
          v-for="project in projects"
          :key="project.id"
          :to="`/projects/${project.id}`"
          class="block rounded-lg border border-border bg-surface-elevated p-3 hover:border-content-subtle transition-colors"
        >
          <div class="flex items-center justify-between">
            <span class="font-medium text-sm">{{ project.name }}</span>
            <span class="h-1.5 w-1.5 rounded-full" :class="project.enabled ? 'bg-emerald-500' : 'bg-content-subtle'" />
          </div>
          <p class="text-xs text-content-subtle mt-1 font-mono truncate">{{ project.path }}</p>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const projectsApi = useProjects()

interface Project {
  id: string
  name: string
  slug: string
  path: string
  description: string | null
  enabled: boolean
}

const projects = ref<Project[]>([])
const loading = ref(true)
const showAdd = ref(false)
const adding = ref(false)
const addError = ref('')
const newProject = reactive({ name: '', path: '', description: '' })

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

async function addProject() {
  adding.value = true
  addError.value = ''
  try {
    await projectsApi.create({
      name: newProject.name,
      path: newProject.path,
      description: newProject.description || undefined,
    })
    newProject.name = ''
    newProject.path = ''
    newProject.description = ''
    showAdd.value = false
    await load()
  } catch (err: unknown) {
    addError.value = (err as { data?: { error?: string } })?.data?.error || 'Failed to add project'
  } finally {
    adding.value = false
  }
}

onMounted(load)
</script>
