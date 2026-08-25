<template>
  <div class="flex h-[100dvh] overflow-hidden bg-surface text-content">
    <ConversationSidebar
      :conversations="conversations"
      :active-conversations="activeConversations"
      :current-project-id="id"
      :loading="convLoading"
      @new="newConversation"
      @delete="deleteConversation"
      @rename="handleSidebarRename"
    />

    <!-- Main content area -->
    <div class="flex-1 flex flex-col h-full min-w-0">
      <!-- Header -->
      <ProjectHeader
        :project="project"
        :branch="projectBranch"
        show-back
        @project-updated="onProjectUpdated"
        @project-deleted="onProjectDeleted"
        @branch-switched="handleBranchSwitched"
      />

      <!-- Content -->
      <div class="flex-1 overflow-y-auto">
        <div class="max-w-2xl mx-auto px-4 py-8 space-y-6">
          <!-- Conversation box -->
          <div
            v-if="project"
            class="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in"
          >
            <div
              class="w-12 h-12 rounded-full bg-surface-subtle flex items-center justify-center mb-4"
            >
              <svg
                class="w-6 h-6 text-content-subtle"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 3v-3z"
                />
              </svg>
            </div>
            <p class="text-content text-sm font-medium mb-1">{{ project.name }}</p>
            <p v-if="project.description" class="text-content-muted text-xs mb-1">
              {{ project.description }}
            </p>
            <p class="text-content-subtle text-xs font-mono break-all mb-2">{{ project.path }}</p>
            <p class="mb-6" />

            <!-- Input box -->
            <div
              class="w-full relative rounded-2xl border border-border bg-surface-elevated focus-within:border-content-subtle transition-colors"
            >
              <textarea
                v-model="input"
                @keydown.enter.exact.prevent="sendMessage"
                @keydown.enter.shift.exact="input += '\n'"
                @input="autoResize"
                placeholder="Message Devin..."
                rows="1"
                ref="inputEl"
                :disabled="sending"
                class="w-full rounded-2xl px-4 py-3.5 pr-12 text-sm text-content placeholder-content-subtle focus:outline-none resize-none max-h-32 overflow-y-auto disabled:opacity-50"
                style="min-height: 52px"
              />
              <button
                @click="sendMessage"
                :disabled="!input.trim() || sending"
                class="absolute right-2 bottom-2 rounded-lg w-8 h-8 flex items-center justify-center transition-all shrink-0 active:scale-95"
                :class="
                  input.trim() && !sending
                    ? 'bg-content text-surface hover:opacity-80'
                    : 'bg-surface-subtle text-content-subtle'
                "
              >
                <svg
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M5 10l7-7m0 0l7 7m-7-7v18"
                  />
                </svg>
              </button>
            </div>

            <!-- Model selector + bypass toggle + hint -->
            <MessageToolbar
              v-model="selectedModel"
              :families="availableFamilies"
              v-model:bypass-mode="bypassMode"
              :disabled="sending"
              @open-skills="skillsPickerOpen = true"
              @open-models="modelPickerOpen = true"
            />

            <p v-if="sendError" class="mt-3 text-sm text-red-500">{{ sendError }}</p>
          </div>
        </div>
      </div>

      <!-- Changed files panel (list, diff preview, commit) -->
      <ChangedFilesPanel :project-id="project?.id" />
    </div>

    <!-- Delete conversation modal -->
    <ConfirmModal
      :open="convDeleteModalOpen"
      title="Delete Conversation"
      :message="
        convDeleteTarget
          ? `Delete \u201C${convDeleteTargetTitle}\u201D? This cannot be undone.`
          : 'Delete this conversation? This cannot be undone.'
      "
      confirm-label="Yes, delete"
      loading-label="Deleting..."
      :loading="deletingConv"
      :error="convDeleteError"
      @confirm="confirmDeleteConversation"
      @cancel="closeConvDeleteModal"
    />

    <!-- Skills picker -->
    <SkillsPicker
      :open="skillsPickerOpen"
      @select="insertSkill"
      @close="skillsPickerOpen = false"
    />

    <!-- Model picker -->
    <ModelPicker
      :open="modelPickerOpen"
      :families="availableFamilies"
      :current="selectedModel"
      @select="selectedModel = $event"
      @close="modelPickerOpen = false"
    />

  </div>
</template>

<script setup lang="ts">
import type { ModelFamily } from '~/components/MessageToolbar.vue'

const route = useRoute()
const projectsApi = useProjects()
const convApi = useConversations()
const { activeConversations } = useActiveConversations()

const id = computed(() => route.params.id as string)

interface Project {
  id: string
  name: string
  path: string
  description: string | null
  enabled: boolean
}
interface Conversation {
  id: string
  title: string
  agent_status: string
  last_message_at: string | null
  created_at: string
}

const project = ref<Project | null>(null)
const conversations = ref<Conversation[]>([])
const convLoading = ref(true)
const projectBranch = ref<string | null>(null)

// Refresh sidebar statuses periodically so background agent runs in any
// conversation of this project surface without a manual reload.
useConversationPolling(
  () => project.value?.id,
  (convs) => {
    conversations.value = convs
  },
)

const input = ref('')
const inputEl = ref<HTMLTextAreaElement | null>(null)
const sending = ref(false)
const sendError = ref('')
const skillsPickerOpen = ref(false)
const modelPickerOpen = ref(false)
const { bypassMode } = useBypassMode()

const availableFamilies = ref<ModelFamily[]>([])
const { selectedModel, ensureDefault } = useSelectedModel()

function autoResize() {
  const el = inputEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 128) + 'px'
}

// Insert a selected skill slash command into the input and focus it so the
// user can immediately append their prompt.
function insertSkill(command: string) {
  input.value = input.value ? `${input.value} ${command}`.trim() : command
  nextTick(() => {
    inputEl.value?.focus()
    autoResize()
  })
}

async function load() {
  try {
    const [proj, convs, modelsRes] = await Promise.all([
      projectsApi.get(id.value),
      convApi.listByProject(id.value),
      convApi.models(),
    ])
    project.value = proj
    conversations.value = convs
    availableFamilies.value = modelsRes.families
    ensureDefault(modelsRes.default)
    // Load branch best-effort; non-git projects just leave it null.
    projectsApi
      .branch(id.value)
      .then((r) => {
        projectBranch.value = r.branch
      })
      .catch(() => {
        projectBranch.value = null
      })
  } catch {
    // ignore
  } finally {
    convLoading.value = false
  }
}

function handleBranchSwitched(branch: string) {
  projectBranch.value = branch
}

function onProjectUpdated(updated: Project) {
  project.value = updated
}

async function onProjectDeleted() {
  await navigateTo('/projects')
}

function newConversation() {
  // Focus the create-conversation input box instead of creating an empty conversation via API.
  input.value = ''
  sendError.value = ''
  nextTick(() => {
    inputEl.value?.focus()
    inputEl.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

async function handleSidebarRename(convId: string, newTitle: string) {
  try {
    const updated = await convApi.update(convId, { title: newTitle })
    const conv = conversations.value.find((c) => c.id === convId)
    if (conv) conv.title = updated.title
  } catch {
    // Keep old title on failure
  }
}

const convDeleteModalOpen = ref(false)
const convDeleteTarget = ref<string | null>(null)
const deletingConv = ref(false)
const convDeleteError = ref('')

const convDeleteTargetTitle = computed(
  () =>
    conversations.value.find((c) => c.id === convDeleteTarget.value)?.title ?? 'this conversation',
)

function deleteConversation(convId: string) {
  convDeleteTarget.value = convId
  convDeleteError.value = ''
  convDeleteModalOpen.value = true
}

function closeConvDeleteModal() {
  if (deletingConv.value) return
  convDeleteModalOpen.value = false
  convDeleteTarget.value = null
  convDeleteError.value = ''
}

async function confirmDeleteConversation() {
  const convId = convDeleteTarget.value
  if (!convId) return
  deletingConv.value = true
  convDeleteError.value = ''
  try {
    await convApi.delete(convId)
    conversations.value = conversations.value.filter((c) => c.id !== convId)
    convDeleteModalOpen.value = false
    convDeleteTarget.value = null
  } catch (err: unknown) {
    convDeleteError.value =
      (err as { data?: { error?: string } })?.data?.error || 'Failed to delete conversation'
  } finally {
    deletingConv.value = false
  }
}

async function sendMessage() {
  const prompt = input.value.trim()
  if (!prompt || sending.value) return

  sending.value = true
  sendError.value = ''
  try {
    const conv = await convApi.create(id.value)
    await convApi.sendMessage(conv.id, prompt, selectedModel.value, bypassMode.value)
    await navigateTo(`/conversations/${conv.id}`)
  } catch (err: unknown) {
    const message =
      err && typeof err === 'object' && 'data' in err
        ? (err as { data?: { error?: string } }).data?.error
        : err instanceof Error
          ? err.message
          : 'Failed to start conversation'
    sendError.value = message ?? 'Failed to start conversation'
    sending.value = false
  }
}

onMounted(load)
</script>
