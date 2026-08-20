<template>
  <div class="pb-20">
    <header class="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 z-40">
      <h1 class="text-lg font-bold">Projects</h1>
    </header>

    <div class="px-4 py-4">
      <button
        @click="showAdd = !showAdd"
        class="w-full rounded-lg border-2 border-dashed border-gray-300 py-3 text-sm text-gray-600 hover:border-indigo-400 hover:text-indigo-600 mb-4"
      >
        + Add Project
      </button>

      <div v-if="showAdd" class="rounded-lg border border-gray-200 bg-white p-4 mb-4 space-y-3">
        <input v-model="newProject.name" placeholder="Project name" class="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
        <input v-model="newProject.path" placeholder="/home/jeric/Workspace/..." class="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono" />
        <input v-model="newProject.description" placeholder="Description (optional)" class="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
        <button @click="addProject" :disabled="adding" class="w-full rounded bg-indigo-600 text-white py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
          {{ adding ? 'Adding...' : 'Add Project' }}
        </button>
        <p v-if="addError" class="text-sm text-red-600">{{ addError }}</p>
      </div>

      <div v-if="loading" class="text-gray-500 text-sm">Loading...</div>
      <div v-else class="space-y-2">
        <NuxtLink
          v-for="project in projects"
          :key="project.id"
          :to="`/projects/${project.id}`"
          class="block rounded-lg border border-gray-200 bg-white p-3 hover:border-indigo-300"
        >
          <div class="flex items-center justify-between">
            <span class="font-medium text-sm">{{ project.name }}</span>
            <span class="h-2 w-2 rounded-full" :class="project.enabled ? 'bg-green-500' : 'bg-gray-300'" />
          </div>
          <p class="text-xs text-gray-500 mt-1 font-mono truncate">{{ project.path }}</p>
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
