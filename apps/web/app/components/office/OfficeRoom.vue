<template>
  <div
    class="absolute rounded-lg overflow-hidden border-2 border-border/70 bg-surface-elevated/30 pointer-events-none"
    :style="{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }"
    aria-hidden="true"
  >
    <!-- Floor texture: subtle tile pattern -->
    <div
      class="absolute inset-0 opacity-30"
      style="background-image: linear-gradient(var(--border-subtle, #e5e7eb) 1px, transparent 1px), linear-gradient(90deg, var(--border-subtle, #e5e7eb) 1px, transparent 1px); background-size: 20px 20px;"
    />

    <!-- Room label badge -->
    <span
      class="absolute top-1 left-1/2 -translate-x-1/2 z-10 text-[9px] font-semibold text-content-subtle uppercase tracking-wide whitespace-nowrap px-1.5 py-0.5 rounded bg-surface/80"
    >{{ label }}</span>

    <!-- Top-view furniture: desk against the back wall -->
    <div
      class="absolute rounded-sm bg-surface-elevated border border-border shadow-sm"
      :style="{ left: `${deskLeft}%`, top: `${deskTop}%`, width: `${deskWidth}%`, height: `${deskHeight}%` }"
    >
      <!-- Desk surface highlight -->
      <div class="absolute inset-0 rounded-sm bg-gradient-to-br from-white/10 to-transparent" />
      <!-- Laptop on desk (top view: small rectangle) -->
      <div
        class="absolute rounded-[2px] bg-slate-700 border border-slate-900"
        :style="{ left: '35%', top: '20%', width: '30%', height: '55%' }"
      />
    </div>

    <!-- Office chair (top view: small circle behind desk) -->
    <div
      class="absolute rounded-full bg-content-subtle/40 border border-border"
      :style="{ left: `${chairLeft}%`, top: `${chairTop}%`, width: `${chairSize}%`, height: `${chairSize}%` }"
    />

    <!-- Potted plant in the corner (top view: circle with leaves) -->
    <div
      class="absolute rounded-full bg-emerald-500/30 border border-emerald-700/40 flex items-center justify-center"
      :style="{ left: `${plantLeft}%`, top: `${plantTop}%`, width: `${plantSize}%`, height: `${plantSize}%` }"
    >
      <span class="text-[8px]">🪴</span>
    </div>

    <!-- Rug under the desk area -->
    <div
      class="absolute rounded-md bg-accent-muted/10 border border-border/30"
      :style="{ left: `${rugLeft}%`, top: `${rugTop}%`, width: `${rugWidth}%`, height: `${rugHeight}%` }"
    />
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    left: number
    top: number
    width: number
    height: number
  }>(),
  {},
)

// Furniture positions as percentages within the room box (top-view layout).
// Desk sits against the back wall; chair behind it; plant in a corner; rug below.
const deskLeft = 20
const deskTop = 25
const deskWidth = 60
const deskHeight = 18
const chairLeft = 45
const chairTop = 46
const chairSize = 12
const plantLeft = 6
const plantTop = 70
const plantSize = 14
const rugLeft = 15
const rugTop = 60
const rugWidth = 70
const rugHeight = 30
</script>
