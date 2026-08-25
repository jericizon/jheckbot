<template>
  <AppHeader>
    <template #leading>
      <button
        @click="toggleSidebar"
        class="text-content-muted hover:text-content transition-colors p-1 -ml-1 rounded-md hover:bg-surface-subtle shrink-0"
        aria-label="Toggle sidebar"
        title="Toggle sidebar"
      >
        <svg
          class="w-5 h-5"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <button
        v-if="showBack"
        @click="navigateTo('/projects')"
        class="hidden sm:block text-content-subtle hover:text-content transition-colors p-1 rounded-md hover:bg-surface-subtle shrink-0"
        aria-label="Back to projects"
        title="Back to projects"
      >
        <svg
          class="w-5 h-5"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
    </template>

    <div class="flex flex-col min-w-0">
      <div class="flex items-center gap-2 min-w-0">
        <h1 class="text-sm font-semibold truncate text-content">
          {{ project?.name || 'Project' }}
        </h1>
        <button
          v-if="branch"
          @click="branchModalOpen = true"
          class="flex items-center gap-1 text-[11px] text-content-subtle bg-surface-subtle hover:text-content hover:bg-surface rounded px-1.5 py-0.5 min-w-0 shrink-[1] cursor-pointer transition-colors"
          title="Manage branches"
        >
          <svg
            class="w-3 h-3 shrink-0"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 3v12" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="6" r="3" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M18 9v3a3 3 0 01-3 3H6" />
          </svg>
          <span class="font-mono truncate">{{ branch }}</span>
        </button>
      </div>
      <div v-if="$slots.subtitle" class="min-w-0">
        <slot name="subtitle" />
      </div>
    </div>

    <template #actions>
      <button
        @click="settingsOpen = true"
        :disabled="!project"
        class="text-content-muted hover:text-content transition-colors p-1.5 rounded-md hover:bg-surface-subtle disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label="Project settings"
        title="Project settings"
      >
        <svg
          class="w-4 h-4"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
          />
        </svg>
      </button>
    </template>
  </AppHeader>

  <ProjectSettingsModal
    :open="settingsOpen"
    :project="project"
    @close="settingsOpen = false"
    @updated="onProjectUpdated"
    @deleted="onProjectDeleted"
  />

  <BranchModal
    :open="branchModalOpen"
    :project-id="project?.id"
    :current-branch="branch"
    @close="branchModalOpen = false"
    @switched="onBranchSwitched"
  />
</template>

<script setup lang="ts">
interface Project {
  id: string
  name: string
  path: string
  description: string | null
  enabled: boolean
}

interface Props {
  project: Project | null
  branch?: string | null
  showBack?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  branch: null,
  showBack: false,
})

const emit = defineEmits<{
  (e: 'project-updated', project: Project): void
  (e: 'project-deleted'): void
  (e: 'branch-switched', branch: string): void
}>()

const { toggle: toggleSidebar } = useSidebar()

const settingsOpen = ref(false)
const branchModalOpen = ref(false)

function onProjectUpdated(project: Project) {
  emit('project-updated', project)
  settingsOpen.value = false
}

function onProjectDeleted() {
  emit('project-deleted')
  settingsOpen.value = false
}

function onBranchSwitched(branch: string) {
  emit('branch-switched', branch)
}
</script>
