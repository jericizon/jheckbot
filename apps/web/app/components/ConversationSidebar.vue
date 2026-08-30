<template>
  <!-- Sidebar overlay (mobile) -->
  <Transition
    enter-active-class="transition-opacity duration-200"
    leave-active-class="transition-opacity duration-200"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <button
      v-if="sidebarOpen"
      type="button"
      class="fixed inset-0 bg-black/40 z-40 md:hidden"
      aria-label="Close sidebar"
      @click="close"
    />
  </Transition>

  <!-- Sidebar -->
  <Transition
    enter-active-class="transition-transform duration-300 ease-out"
    leave-active-class="transition-transform duration-200 ease-in"
    enter-from-class="-translate-x-full"
    leave-to-class="-translate-x-full"
  >
    <aside
      v-if="sidebarOpen"
      class="fixed md:relative z-50 shrink-0 h-full bg-surface-elevated border-r border-border flex flex-col"
      :style="{ width: sidebarWidth + 'px' }"
    >
      <button
        type="button"
        @click="close"
        class="absolute top-2 right-2 z-10 p-1.5 rounded-md text-content-subtle hover:text-content hover:bg-surface-subtle transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label="Close sidebar"
        title="Close sidebar"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <!-- New conversation -->
      <div class="p-3">
        <slot name="new-button">
          <button
            @click="$emit('new')"
            class="w-full flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-content bg-accent-muted hover:bg-border-subtle transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg>
            New Conversation
          </button>
        </slot>
      </div>

      <!-- Active conversations (all projects, including current) -->
      <div v-if="activeConversationsList.length > 0" class="px-2 pb-2 shrink-0">
        <p class="px-3 py-2 text-[11px] font-medium text-content-subtle uppercase tracking-wide">Active</p>
        <div
          v-for="conv in activeConversationsList"
          :key="conv.id"
          class="group relative flex items-center rounded-lg mb-0.5"
          :class="conv.id === activeId && editingId !== conv.id ? 'bg-accent-muted' : ''"
        >
          <NuxtLink
            :to="`/conversations/${conv.id}`"
            class="flex-1 min-w-0 rounded-lg px-3 py-2 text-sm truncate transition-colors flex items-center gap-2"
            :class="conv.id === activeId ? 'text-content' : 'text-content-muted hover:bg-surface-subtle hover:text-content'"
          >
            <span
              class="relative flex h-2 w-2 shrink-0 items-center justify-center"
              title="Agent running"
            >
              <span class="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60 animate-ping" />
              <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            <div class="truncate flex-1 min-w-0">
              <span class="truncate block">{{ conv.title }}</span>
              <span class="text-[10px] text-content-subtle truncate block">{{ conv.project_name }}</span>
            </div>
            <span
              v-if="hasDraft(conv.id)"
              class="text-[10px] font-medium text-amber-500 shrink-0"
              title="Unsent draft"
            >Draft</span>
            <span
              v-if="conv.is_pinned"
              class="text-[10px] font-medium text-amber-500 shrink-0"
              title="Pinned conversation"
            >Pinned</span>
          </NuxtLink>
          <div
            class="flex items-center px-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
          >
            <button
              @click.prevent="togglePin(conv)"
              class="p-1.5 rounded-md text-content-subtle hover:text-content hover:bg-surface-subtle"
              :aria-label="conv.is_pinned ? 'Unpin conversation' : 'Pin conversation'"
              :title="conv.is_pinned ? 'Unpin conversation' : 'Pin conversation'"
            >
              <svg
                class="w-3.5 h-3.5"
                :fill="conv.is_pinned ? 'currentColor' : 'none'"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Divider between sections -->
      <div v-if="activeConversationsList.length > 0" class="mx-3 border-t border-border"></div>

      <!-- Current project conversations (inactive only — active ones live above) -->
      <div class="flex-1 overflow-y-auto px-2 pb-2 pt-2">
        <p class="px-3 py-2 text-[11px] font-medium text-content-subtle uppercase tracking-wide">This Project</p>
        <div v-if="loading" class="px-3 py-2 text-sm text-content-subtle">Loading...</div>
        <div v-else-if="inactiveConversations.length === 0" class="px-3 py-2 text-sm text-content-subtle">No conversations yet.</div>
        <div
          v-for="conv in inactiveConversations"
          :key="conv.id"
          class="group relative flex items-center rounded-lg mb-0.5"
          :class="conv.id === activeId && editingId !== conv.id ? 'bg-accent-muted' : ''"
        >
          <!-- Inline rename input -->
          <input
            v-if="editingId === conv.id"
            v-model="titleDraft"
            @blur="saveTitle(conv.id)"
            @keydown.enter.exact.prevent="saveTitle(conv.id)"
            @keydown.escape="cancelEdit"
            :ref="(el) => { if (el) titleInputEl = el as HTMLInputElement }"
            class="flex-1 min-w-0 rounded-lg px-3 py-2 text-sm bg-surface-elevated border border-content-subtle focus:outline-none focus:border-content text-content"
          />
          <NuxtLink
            v-else
            :to="`/conversations/${conv.id}`"
            class="flex-1 min-w-0 rounded-lg px-3 py-2 text-sm truncate transition-colors flex items-center gap-2"
            :class="conv.id === activeId ? 'text-content' : 'text-content-muted hover:bg-surface-subtle hover:text-content'"
          >
            <span
              class="relative flex h-2 w-2 shrink-0 items-center justify-center"
              :title="isAgentActive(conv) ? 'Agent running' : 'Idle'"
            >
              <span
                v-if="isAgentActive(conv)"
                class="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60 animate-ping"
              />
              <span
                class="relative inline-flex rounded-full h-1.5 w-1.5"
                :class="isAgentActive(conv) ? 'bg-emerald-500' : 'bg-content-subtle'"
              />
            </span>
            <span class="truncate flex-1">{{ conv.title }}</span>
            <span
              v-if="hasDraft(conv.id)"
              class="text-[10px] font-medium text-amber-500 shrink-0"
              title="Unsent draft"
            >Draft</span>
            <span
              v-if="isAgentActive(conv)"
              class="text-[10px] font-medium text-emerald-500 shrink-0"
            >Active</span>
          </NuxtLink>
          <!-- Hover actions -->
          <div
            v-if="editingId !== conv.id"
            class="flex items-center px-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
          >
            <button
              @click.prevent="togglePin(conv)"
              class="p-1.5 rounded-md"
              :class="conv.is_pinned ? 'text-amber-500 hover:bg-amber-500/10' : 'text-content-subtle hover:text-content hover:bg-surface-subtle'"
              :aria-label="conv.is_pinned ? 'Unpin conversation' : 'Pin conversation'"
              :title="conv.is_pinned ? 'Unpin conversation' : 'Pin conversation'"
            >
              <svg
                class="w-3.5 h-3.5"
                :fill="conv.is_pinned ? 'currentColor' : 'none'"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                />
              </svg>
            </button>
            <button
              @click.prevent="startEdit(conv)"
              class="p-1.5 rounded-md text-content-subtle hover:text-content hover:bg-surface-subtle"
              aria-label="Rename conversation"
              title="Rename conversation"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </button>
            <button
              @click.prevent="$emit('delete', conv.id)"
              class="p-1.5 rounded-md text-content-subtle hover:text-red-500 hover:bg-red-500/10"
              aria-label="Delete conversation"
              title="Delete conversation"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="p-3 border-t border-border flex items-center justify-between">
        <NuxtLink to="/" class="flex items-center gap-2 text-sm text-content-muted hover:text-content transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
          Home
        </NuxtLink>
        <div class="flex items-center gap-1">
          <button
            @click="toggleTheme"
            class="p-1.5 rounded-md text-content-subtle hover:text-content hover:bg-surface-subtle transition-colors"
            :aria-label="theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
            :title="theme === 'dark' ? 'Switch to light' : 'Switch to dark'"
          >
            <svg v-if="theme === 'dark'" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
          </button>
          <button
            @click="openSettings"
            class="p-1.5 rounded-md text-content-subtle hover:text-content hover:bg-surface-subtle transition-colors"
            aria-label="Settings"
            title="Settings"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
        </div>
      </div>

      <!-- Resize handle (desktop only) -->
      <div
        class="hidden md:flex absolute top-0 -right-1 w-2 h-full cursor-col-resize items-center justify-center group z-50"
        @mousedown.prevent="startResize"
        @touchstart.prevent="startResize"
        aria-hidden="true"
      >
        <div
          class="w-0.5 h-full bg-border transition-colors group-hover:bg-accent group-hover:w-1"
          :class="{ 'bg-accent w-1': resizing }"
        />
      </div>
    </aside>
  </Transition>
</template>

<script setup lang="ts">
interface Conversation {
  id: string
  title: string
  agent_status: string
  is_pinned: boolean
}

interface ActiveConversation {
  id: string
  project_id: string
  project_name: string
  title: string
  agent_status: string
  is_pinned: boolean
}

const props = defineProps<{
  conversations: Conversation[]
  activeConversations?: ActiveConversation[]
  currentProjectId?: string
  activeId?: string
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'new'): void
  (e: 'delete', id: string): void
  (e: 'rename', id: string, title: string): void
  (e: 'pin', id: string, isPinned: boolean): void
}>()

const { sidebarOpen, sidebarWidth, close, setWidth } = useSidebar()
const { theme, toggle: toggleTheme } = useTheme()
const { open: openSettings } = useSettingsModal()
const { hasDraft } = useConversationDrafts()

// --- Resize logic ---
const resizing = ref(false)
let startX = 0
let startWidth = 0

function onPointerMove(e: PointerEvent | MouseEvent | TouchEvent) {
  const clientX = 'touches' in e ? e.touches[0]?.clientX ?? 0 : (e as MouseEvent).clientX
  const delta = clientX - startX
  setWidth(startWidth + delta)
}

function onPointerUp() {
  resizing.value = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  window.removeEventListener('mousemove', onPointerMove)
  window.removeEventListener('mouseup', onPointerUp)
  window.removeEventListener('touchmove', onPointerMove)
  window.removeEventListener('touchend', onPointerUp)
}

function startResize(e: MouseEvent | TouchEvent) {
  resizing.value = true
  startX = 'touches' in e ? e.touches[0]?.clientX ?? 0 : (e as MouseEvent).clientX
  startWidth = sidebarWidth.value
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  window.addEventListener('mousemove', onPointerMove)
  window.addEventListener('mouseup', onPointerUp)
  window.addEventListener('touchmove', onPointerMove, { passive: false })
  window.addEventListener('touchend', onPointerUp)
}

onUnmounted(onPointerUp)

const ACTIVE_STATUSES = ['starting', 'running', 'stopping']
function isAgentActive(conv: Conversation) {
  return ACTIVE_STATUSES.includes(conv.agent_status)
}

// Active conversations across ALL projects (including the current one).
// Active conversations always surface in the "Active" section regardless of
// which project they belong to.
const activeConversationsList = computed(() => props.activeConversations ?? [])

// Current project conversations that are NOT actively running and NOT pinned.
// Active ones are shown above, and pinned ones live in the Active section.
const inactiveConversations = computed(() =>
  props.conversations.filter((c) => !isAgentActive(c) && !c.is_pinned),
)

function togglePin(conv: { id: string; is_pinned: boolean }) {
  emit('pin', conv.id, !conv.is_pinned)
}

const editingId = ref<string | null>(null)
const titleDraft = ref('')
let titleInputEl: HTMLInputElement | null = null

function startEdit(conv: Conversation) {
  editingId.value = conv.id
  titleDraft.value = conv.title
  nextTick(() => titleInputEl?.focus())
}

function cancelEdit() {
  editingId.value = null
  titleDraft.value = ''
}

async function saveTitle(id: string) {
  if (editingId.value !== id) return
  const newTitle = titleDraft.value.trim()
  editingId.value = null
  titleDraft.value = ''
  if (!newTitle) return
  const conv = props.conversations.find((c) => c.id === id)
  if (!conv || newTitle === conv.title) return
  emit('rename', id, newTitle)
}
</script>
