<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
        @click.self="close"
        @keydown.escape="close"
        tabindex="0"
        ref="overlayEl"
      >
        <Transition
          enter-active-class="transition-all duration-200 ease-out"
          leave-active-class="transition-all duration-150 ease-in"
          enter-from-class="opacity-0 scale-95"
          leave-to-class="opacity-0 scale-95"
        >
          <div
            v-if="open"
            role="dialog"
            aria-modal="true"
            :aria-label="`Diff for ${path}`"
            class="w-full max-w-4xl max-h-[85vh] flex flex-col rounded-xl border border-border bg-surface-elevated shadow-xl overflow-hidden"
          >
            <!-- Header -->
            <div class="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
              <StatusBadge :status="status" :staged="staged" />
              <span class="text-sm font-mono text-content truncate flex-1 min-w-0">{{ path }}</span>
              <button
                @click="close"
                class="p-1 rounded-md text-content-subtle hover:text-content hover:bg-surface-subtle transition-colors shrink-0"
                title="Close (Esc)"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <!-- Body -->
            <div class="overflow-auto flex-1 min-h-0">
              <div v-if="loading" class="flex items-center justify-center py-16 text-xs text-content-subtle">
                <span class="h-1.5 w-1.5 rounded-full bg-content-subtle animate-pulse" />
                <span class="ml-2">Loading diff...</span>
              </div>
              <div v-else-if="error" class="px-4 py-6 text-sm text-red-500">{{ error }}</div>
              <div v-else-if="!diffLines.length" class="px-4 py-6 text-xs text-content-subtle">No changes to display.</div>
              <table v-else class="w-full font-mono text-[11px] leading-[1.5] border-collapse">
                <tbody>
                  <tr
                    v-for="(line, i) in diffLines"
                    :key="i"
                    :class="lineClass(line)"
                  >
                    <td class="select-none text-right pr-2 pl-3 w-10 text-content-subtle/60">{{ line.oldNo || '' }}</td>
                    <td class="select-none text-right pr-2 w-10 text-content-subtle/60 border-l border-border/50">{{ line.newNo || '' }}</td>
                    <td class="whitespace-pre pl-2 pr-4" :class="lineSignClass(line)">{{ line.text }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
interface Props {
  open: boolean
  path: string
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'ignored'
  staged: boolean
  loading?: boolean
  diff?: string
  error?: string
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  diff: '',
  error: '',
})

const emit = defineEmits<{ (e: 'close'): void }>()

const overlayEl = ref<HTMLElement | null>(null)

interface DiffLine {
  kind: 'hunk' | 'add' | 'del' | 'context' | 'meta' | 'plain'
  text: string
  oldNo: number | null
  newNo: number | null
}

const diffLines = computed<DiffLine[]>(() => parseDiff(props.diff))

function parseDiff(raw: string): DiffLine[] {
  if (!raw) return []
  const lines = raw.split('\n')
  const out: DiffLine[] = []
  let oldNo = 0
  let newNo = 0
  for (const line of lines) {
    if (line.startsWith('@@')) {
      const m = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
      if (m) {
        oldNo = parseInt(m[1], 10)
        newNo = parseInt(m[2], 10)
      }
      out.push({ kind: 'hunk', text: line, oldNo: null, newNo: null })
    } else if (line.startsWith('+++') || line.startsWith('---')) {
      out.push({ kind: 'meta', text: line, oldNo: null, newNo: null })
    } else if (line.startsWith('+')) {
      out.push({ kind: 'add', text: line.slice(1), oldNo: null, newNo })
      newNo++
    } else if (line.startsWith('-')) {
      out.push({ kind: 'del', text: line.slice(1), oldNo, newNo: null })
      oldNo++
    } else if (line.startsWith(' ')) {
      out.push({ kind: 'context', text: line.slice(1), oldNo, newNo })
      oldNo++
      newNo++
    } else if (line.startsWith('\\')) {
      // "\\ No newline at end of file" marker
      out.push({ kind: 'meta', text: line, oldNo: null, newNo: null })
    } else if (line.length > 0) {
      out.push({ kind: 'plain', text: line, oldNo: null, newNo: null })
    }
  }
  return out
}

function lineClass(line: DiffLine): string {
  switch (line.kind) {
    case 'add': return 'bg-emerald-500/10'
    case 'del': return 'bg-red-500/10'
    case 'hunk': return 'bg-sky-500/10'
    case 'meta': return 'bg-surface-subtle/60'
    default: return ''
  }
}

function lineSignClass(line: DiffLine): string {
  switch (line.kind) {
    case 'add': return 'text-emerald-500'
    case 'del': return 'text-red-500'
    case 'hunk': return 'text-sky-500'
    case 'meta': return 'text-content-subtle'
    default: return 'text-content-muted'
  }
}

function close() {
  if (props.loading) return
  emit('close')
}

watch(() => props.open, (open) => {
  if (!open) return
  nextTick(() => overlayEl.value?.focus())
})
</script>
