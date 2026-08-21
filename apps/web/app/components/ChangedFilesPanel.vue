<template>
  <div class="shrink-0 border-t border-border">
    <button
      @click="toggleOpen"
      class="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-content-muted hover:text-content transition-colors"
    >
      <svg
        class="w-3.5 h-3.5 transition-transform"
        :class="open ? 'rotate-90' : ''"
        fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
      ><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
      <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
      <span>Changed files</span>
      <span v-if="count > 0" class="text-[10px] font-medium bg-surface-subtle text-content-muted rounded-full px-1.5 py-0.5">{{ count }}</span>
      <span v-if="loading" class="flex items-center gap-1 ml-1">
        <span class="h-1.5 w-1.5 rounded-full bg-content-subtle animate-pulse" />
      </span>
      <button
        v-if="open"
        @click.stop="refresh"
        :disabled="loading"
        class="ml-auto p-1 rounded-md text-content-subtle hover:text-content hover:bg-surface-subtle transition-colors disabled:opacity-50"
        title="Refresh"
      >
        <svg class="w-3.5 h-3.5" :class="loading ? 'animate-spin' : ''" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
      </button>
    </button>
    <div v-show="open" class="px-4 pb-3 max-h-64 overflow-y-auto bg-surface-subtle/50">
      <div v-if="error" class="text-[11px] text-red-500 py-2">{{ error }}</div>
      <div v-else-if="loading && tree.length === 0" class="text-[11px] text-content-subtle py-2">Loading...</div>
      <div v-else-if="tree.length === 0" class="text-[11px] text-content-subtle py-2">No changes. Working tree clean.</div>
      <div v-else class="py-2 space-y-0.5">
        <template v-for="node in tree" :key="node.key">
          <!-- Directory -->
          <div v-if="node.type === 'dir'" class="select-none">
            <button
              @click="toggleDir(node.key)"
              class="flex items-center gap-1 w-full text-left py-0.5 text-[11px] font-mono text-content-muted hover:text-content transition-colors"
            >
              <svg class="w-3 h-3 shrink-0 transition-transform" :class="collapsedDirs.has(node.key) ? '' : 'rotate-90'" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
              <svg class="w-3.5 h-3.5 shrink-0 text-content-subtle" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
              <span>{{ node.name }}/</span>
              <span class="text-[10px] text-content-subtle">{{ dirCounts[node.key] }}</span>
            </button>
            <div v-show="!collapsedDirs.has(node.key)" class="ml-3 border-l border-border pl-2">
              <template v-for="child in node.children" :key="child.key">
                <div v-if="child.type === 'dir'" class="select-none">
                  <button
                    @click="toggleDir(child.key)"
                    class="flex items-center gap-1 w-full text-left py-0.5 text-[11px] font-mono text-content-muted hover:text-content transition-colors"
                  >
                    <svg class="w-3 h-3 shrink-0 transition-transform" :class="collapsedDirs.has(child.key) ? '' : 'rotate-90'" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
                    <svg class="w-3.5 h-3.5 shrink-0 text-content-subtle" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                    <span>{{ child.name }}/</span>
                  </button>
                  <div v-show="!collapsedDirs.has(child.key)" class="ml-3 border-l border-border pl-2">
                    <button
                      v-for="file in child.children"
                      :key="file.key"
                      @click="openDiff(file.key)"
                      class="flex items-center gap-1.5 w-full text-left py-0.5 text-[11px] font-mono text-content-muted hover:text-content hover:bg-surface-subtle/60 rounded transition-colors"
                      :title="`View diff: ${file.key}`"
                    >
                      <StatusBadge :status="file.status" :staged="file.staged" />
                      <span class="truncate">{{ file.name }}</span>
                    </button>
                  </div>
                </div>
                <button
                  v-else
                  @click="openDiff(child.key)"
                  class="flex items-center gap-1.5 w-full text-left py-0.5 text-[11px] font-mono text-content-muted hover:text-content hover:bg-surface-subtle/60 rounded transition-colors"
                  :title="`View diff: ${child.key}`"
                >
                  <StatusBadge :status="child.status" :staged="child.staged" />
                  <span class="truncate">{{ child.name }}</span>
                </button>
              </template>
            </div>
          </div>
          <!-- Top-level file -->
          <button
            v-else
            @click="openDiff(node.key)"
            class="flex items-center gap-1.5 w-full text-left py-0.5 text-[11px] font-mono text-content-muted hover:text-content hover:bg-surface-subtle/60 rounded transition-colors"
            :title="`View diff: ${node.key}`"
          >
            <StatusBadge :status="node.status" :staged="node.staged" />
            <span class="truncate">{{ node.name }}</span>
          </button>
        </template>
      </div>
    </div>

    <!-- Diff viewer modal -->
    <DiffModal
      :open="diffOpen"
      :path="diffTarget.path"
      :status="diffTarget.status"
      :staged="diffTarget.staged"
      :loading="diffLoading"
      :diff="diffContent"
      :error="diffError"
      @close="closeDiff"
    />
  </div>
</template>

<script setup lang="ts">
interface FileChange {
  path: string
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'ignored'
  staged: boolean
}

type TreeNode =
  | { type: 'dir'; key: string; name: string; children: TreeNode[] }
  | { type: 'file'; key: string; name: string; status: FileChange['status']; staged: boolean }

const props = defineProps<{ projectId: string | null | undefined }>()

const projectsApi = useProjects()
const open = ref(false)
const loading = ref(false)
const error = ref('')
const changes = ref<FileChange[]>([])
const collapsedDirs = ref(new Set<string>())

const diffOpen = ref(false)
const diffLoading = ref(false)
const diffError = ref('')
const diffContent = ref('')
const diffTarget = ref<{ path: string; status: FileChange['status']; staged: boolean }>({
  path: '',
  status: 'modified',
  staged: false,
})

const count = computed(() => changes.value.length)

const tree = computed<TreeNode[]>(() => buildTree(changes.value))

const dirCounts = computed<Record<string, number>>(() => {
  const counts: Record<string, number> = {}
  for (const c of changes.value) {
    const parts = c.path.split('/')
    if (parts.length > 1) {
      const top = parts[0]
      counts[top] = (counts[top] ?? 0) + 1
    }
  }
  return counts
})

function buildTree(files: FileChange[]): TreeNode[] {
  const root: TreeNode[] = []
  // Sort: dirs first, then files, alphabetically
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path))

  for (const file of sorted) {
    // Handle rename display "old -> new" — treat as a single leaf at top level
    if (file.path.includes(' -> ')) {
      root.push({ type: 'file', key: file.path, name: file.path, status: file.status, staged: file.staged })
      continue
    }
    const parts = file.path.split('/')
    if (parts.length === 1) {
      root.push({ type: 'file', key: file.path, name: parts[0], status: file.status, staged: file.staged })
    } else {
      // Two-level grouping: top dir / nested dir / file
      const topDir = parts[0]
      let dirNode = root.find((n): n is Extract<TreeNode, { type: 'dir' }> => n.type === 'dir' && n.name === topDir)
      if (!dirNode) {
        dirNode = { type: 'dir', key: topDir, name: topDir, children: [] }
        root.push(dirNode)
      }
      if (parts.length === 2) {
        dirNode.children.push({ type: 'file', key: file.path, name: parts[1], status: file.status, staged: file.staged })
      } else {
        const nestedDir = parts.slice(0, 2).join('/')
        let nestedNode = dirNode.children.find((n): n is Extract<TreeNode, { type: 'dir' }> => n.type === 'dir' && n.key === nestedDir)
        if (!nestedNode) {
          nestedNode = { type: 'dir', key: nestedDir, name: parts[1], children: [] }
          dirNode.children.push(nestedNode)
        }
        nestedNode.children.push({ type: 'file', key: file.path, name: parts.slice(2).join('/'), status: file.status, staged: file.staged })
      }
    }
  }
  return root
}

function toggleDir(key: string) {
  const next = new Set(collapsedDirs.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  collapsedDirs.value = next
}

function toggleOpen() {
  open.value = !open.value
  if (open.value && changes.value.length === 0 && !loading.value) {
    refresh()
  }
}

async function openDiff(path: string) {
  if (!props.projectId) return
  const change = changes.value.find((c) => c.path === path)
  if (!change) return
  diffTarget.value = { path, status: change.status, staged: change.staged }
  diffContent.value = ''
  diffError.value = ''
  diffLoading.value = true
  diffOpen.value = true
  try {
    const result = await projectsApi.diff(props.projectId, path)
    diffContent.value = result.diff
  } catch (err: unknown) {
    diffError.value = (err as { data?: { error?: string } })?.data?.error || 'Failed to load diff'
  } finally {
    diffLoading.value = false
  }
}

function closeDiff() {
  if (diffLoading.value) return
  diffOpen.value = false
  diffContent.value = ''
  diffError.value = ''
}

async function refresh() {
  if (!props.projectId) return
  loading.value = true
  error.value = ''
  try {
    const result = await projectsApi.changes(props.projectId)
    changes.value = result.changes
  } catch (err: unknown) {
    error.value = (err as { data?: { error?: string } })?.data?.error || 'Failed to load changes'
  } finally {
    loading.value = false
  }
}

watch(() => props.projectId, (id) => {
  if (id && open.value) refresh()
})

defineExpose({ refresh })
</script>
