<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-150"
      leave-active-class="transition-opacity duration-100"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40"
        @click.self="close"
        @keydown.escape.prevent="close"
        tabindex="0"
        ref="overlayEl"
      >
        <Transition
          enter-active-class="transition-all duration-200 ease-out"
          leave-active-class="transition-all duration-150 ease-in"
          enter-from-class="opacity-0 translate-y-2 sm:scale-95"
          leave-to-class="opacity-0 translate-y-2 sm:scale-95"
        >
          <div
            v-if="open"
            role="dialog"
            aria-modal="true"
            aria-label="Skills"
            class="w-full max-w-lg rounded-t-xl sm:rounded-xl border border-border bg-surface-elevated shadow-xl flex flex-col max-h-[80dvh]"
          >
            <!-- Search header -->
            <div class="flex items-center gap-2 px-3 py-2.5 border-b border-border shrink-0">
              <svg
                class="w-4 h-4 text-content-subtle shrink-0"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
                />
              </svg>
              <input
                v-model="query"
                ref="searchEl"
                placeholder="Search skills..."
                class="flex-1 min-w-0 text-sm bg-transparent focus:outline-none text-content placeholder-content-subtle"
              />
              <button
                @click="refresh"
                :disabled="loading"
                :title="cached ? 'Refresh skills list' : 'Loading...'"
                class="text-content-subtle hover:text-content transition-colors p-1 rounded-md hover:bg-surface-subtle disabled:opacity-50 shrink-0"
              >
                <svg
                  class="w-4 h-4"
                  :class="loading ? 'animate-spin' : ''"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M4 4v5h5M20 20v-5h-5M20 9A8 8 0 005.6 5.6M4 15a8 8 0 0014.4 3.4"
                  />
                </svg>
              </button>
              <button
                @click="close"
                class="text-content-subtle hover:text-content transition-colors p-1 rounded-md hover:bg-surface-subtle shrink-0"
                title="Close"
              >
                <svg
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <!-- Results -->
            <div class="overflow-y-auto flex-1 min-h-0">
              <div v-if="loading && skills.length === 0" class="px-4 py-8 text-center">
                <p class="text-sm text-content-subtle">Loading skills...</p>
              </div>

              <div v-else-if="!loading && skills.length === 0" class="px-4 py-8 text-center">
                <p class="text-sm text-content-subtle">
                  No skills found. Make sure the Devin CLI is installed and authenticated.
                </p>
              </div>

              <div v-else-if="filtered.length === 0" class="px-4 py-8 text-center">
                <p class="text-sm text-content-subtle">No skills match "{{ query }}".</p>
              </div>

              <ul v-else class="py-1">
                <li v-for="skill in filtered" :key="skill.name">
                  <button
                    @click="select(skill)"
                    @mouseenter="activeIndex = filtered.indexOf(skill)"
                    :class="
                      filtered.indexOf(skill) === activeIndex
                        ? 'bg-surface-subtle'
                        : 'hover:bg-surface-subtle/50'
                    "
                    class="w-full text-left px-3 py-2.5 transition-colors"
                  >
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="font-mono text-sm text-accent shrink-0"
                        >/{{ skill.display_name }}</span
                      >
                      <span
                        v-if="skill.triggers.length > 0"
                        class="flex items-center gap-1 shrink-0"
                      >
                        <span
                          v-for="t in skill.triggers"
                          :key="t"
                          class="text-[9px] uppercase tracking-wide text-content-subtle bg-surface-subtle rounded px-1 py-0.5"
                          >{{ t }}</span
                        >
                      </span>
                    </div>
                    <p class="mt-1 text-xs text-content-muted line-clamp-2 leading-relaxed">
                      {{ skill.description }}
                    </p>
                  </button>
                </li>
              </ul>
            </div>

            <!-- Footer hint -->
            <div
              v-if="filtered.length > 0"
              class="px-3 py-2 border-t border-border text-[11px] text-content-subtle shrink-0 flex items-center justify-between"
            >
              <span>{{ filtered.length }} skill{{ filtered.length === 1 ? '' : 's' }}</span>
              <span v-if="cached">Cached · click refresh to reload</span>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
interface Skill {
  name: string
  description: string
  triggers: string[]
  provider: string
  base_dir: string
  display_name: string
  warnings: string[]
  errors: string[]
}

interface Props {
  open: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'select', command: string): void
  (e: 'close'): void
}>()

const skillsApi = useSkills()
const skills = ref<Skill[]>([])
const loading = ref(false)
const cached = ref(false)
const query = ref('')
const activeIndex = ref(0)
const overlayEl = ref<HTMLElement | null>(null)
const searchEl = ref<HTMLInputElement | null>(null)

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return skills.value
  return skills.value.filter(
    (s) =>
      s.display_name.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q),
  )
})

async function load(refresh = false) {
  loading.value = true
  try {
    const result = await skillsApi.list(refresh)
    skills.value = result.skills
    cached.value = result.cached
    activeIndex.value = 0
  } catch {
    skills.value = []
    cached.value = false
  } finally {
    loading.value = false
  }
}

async function refresh() {
  await load(true)
}

function close() {
  emit('close')
}

function select(skill: Skill) {
  emit('select', `/${skill.display_name} `)
  emit('close')
}

// Keyboard navigation: arrow up/down to move, Enter to select
function onKeydown(e: KeyboardEvent) {
  if (!props.open) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIndex.value = Math.min(activeIndex.value + 1, filtered.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIndex.value = Math.max(activeIndex.value - 1, 0)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const skill = filtered.value[activeIndex.value]
    if (skill) select(skill)
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      query.value = ''
      activeIndex.value = 0
      if (skills.value.length === 0) {
        load(false)
      }
      nextTick(() => searchEl.value?.focus())
      window.addEventListener('keydown', onKeydown)
    } else {
      window.removeEventListener('keydown', onKeydown)
    }
  },
)

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>
