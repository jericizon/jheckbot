<template>
  <!-- Sidebar overlay (mobile) -->
  <Transition
    enter-active-class="transition-opacity duration-200"
    leave-active-class="transition-opacity duration-200"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <div v-if="sidebarOpen" class="fixed inset-0 bg-black/40 z-30 md:hidden" @click="close" />
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
      class="fixed md:relative z-40 w-64 shrink-0 h-full bg-surface-elevated border-r border-border flex flex-col"
    >
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

      <!-- Conversation list -->
      <div class="flex-1 overflow-y-auto px-2 pb-2">
        <p class="px-3 py-2 text-[11px] font-medium text-content-subtle uppercase tracking-wide">Conversations</p>
        <div v-if="loading" class="px-3 py-2 text-sm text-content-subtle">Loading...</div>
        <div v-else-if="conversations.length === 0" class="px-3 py-2 text-sm text-content-subtle">No conversations yet.</div>
        <div
          v-for="conv in conversations"
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
      <div class="p-3 border-t border-border">
        <NuxtLink to="/" class="flex items-center gap-2 text-sm text-content-muted hover:text-content transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
          Home
        </NuxtLink>
      </div>
    </aside>
  </Transition>
</template>

<script setup lang="ts">
interface Conversation {
  id: string
  title: string
  agent_status: string
}

const props = defineProps<{
  conversations: Conversation[]
  activeId?: string
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'new'): void
  (e: 'delete', id: string): void
  (e: 'rename', id: string, title: string): void
}>()

const { sidebarOpen, close } = useSidebar()

const ACTIVE_STATUSES = ['starting', 'running', 'stopping']
function isAgentActive(conv: Conversation) {
  return ACTIVE_STATUSES.includes(conv.agent_status)
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
