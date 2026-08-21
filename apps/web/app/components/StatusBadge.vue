<template>
  <span
    class="shrink-0 inline-flex items-center justify-center w-4 h-4 rounded text-[9px] font-bold leading-none"
    :class="badgeClass"
    :title="title"
  >{{ letter }}</span>
</template>

<script setup lang="ts">
type Status = 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'ignored'

const props = withDefaults(defineProps<{
  status: Status
  staged?: boolean
}>(), { staged: false })

const letter = computed(() => {
  switch (props.status) {
    case 'modified': return 'M'
    case 'added': return 'A'
    case 'deleted': return 'D'
    case 'renamed': return 'R'
    case 'untracked': return '?'
    case 'ignored': return '!'
  }
})

const badgeClass = computed(() => {
  switch (props.status) {
    case 'modified': return props.staged ? 'bg-emerald-500/20 text-emerald-500' : 'bg-amber-500/20 text-amber-500'
    case 'added': return 'bg-emerald-500/20 text-emerald-500'
    case 'deleted': return 'bg-red-500/20 text-red-500'
    case 'renamed': return 'bg-sky-500/20 text-sky-500'
    case 'untracked': return 'bg-content-subtle/20 text-content-subtle'
    case 'ignored': return 'bg-content-subtle/10 text-content-subtle'
  }
})

const title = computed(() => {
  const state = props.staged ? 'Staged ' : 'Unstaged '
  return state + props.status
})
</script>
