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
            aria-label="Models"
            class="w-full max-w-lg rounded-t-xl sm:rounded-xl border border-border bg-surface-elevated shadow-xl flex flex-col max-h-[80dvh]"
          >
            <!-- Search + sort header -->
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
                placeholder="Search models..."
                class="flex-1 min-w-0 text-sm bg-transparent focus:outline-none text-content placeholder-content-subtle"
              />
              <select
                v-model="sortMode"
                aria-label="Sort within tier"
                class="text-xs text-content-muted bg-transparent border-none focus:outline-none cursor-pointer shrink-0"
                title="Sort families within each tier"
              >
                <option value="default" class="bg-surface-elevated text-content">Default</option>
                <option value="name" class="bg-surface-elevated text-content">Name</option>
                <option value="context" class="bg-surface-elevated text-content">Context</option>
                <option value="price" class="bg-surface-elevated text-content">Price</option>
              </select>
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
              <div v-if="families.length === 0" class="px-4 py-8 text-center">
                <p class="text-sm text-content-subtle">No models available.</p>
              </div>

              <div v-else-if="visibleGroups.length === 0" class="px-4 py-8 text-center">
                <p class="text-sm text-content-subtle">No models match "{{ query }}".</p>
              </div>

              <div v-else class="py-1">
                <div v-for="group in visibleGroups" :key="group.label">
                  <!-- Tier header -->
                  <div
                    class="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-content-subtle flex items-center gap-2"
                  >
                    <span>{{ group.label }}</span>
                    <span class="text-content-muted font-normal"
                      >{{ group.families.length }} model{{
                        group.families.length === 1 ? '' : 's'
                      }}</span
                    >
                  </div>

                  <ul>
                    <li v-for="item in group.items" :key="item.key">
                      <!-- Family row -->
                      <button
                        v-if="item.type === 'family'"
                        @click="toggleExpand(item.family.id)"
                        @mouseenter="activeIndex = item.flatIndex"
                        :class="
                          item.flatIndex === activeIndex
                            ? 'bg-surface-subtle'
                            : 'hover:bg-surface-subtle/50'
                        "
                        class="w-full text-left px-3 py-2.5 transition-colors"
                      >
                        <div class="flex items-center gap-2 min-w-0">
                          <svg
                            class="w-3 h-3 text-content-subtle shrink-0 transition-transform"
                            :class="expandedId === item.family.id ? 'rotate-90' : ''"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            viewBox="0 0 24 24"
                          >
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                          <span class="text-sm text-content shrink-0">{{ item.family.label }}</span>
                          <span
                            class="text-[10px] uppercase tracking-wide text-content-subtle bg-surface-subtle rounded px-1 py-0.5 shrink-0"
                            >{{ item.family.context }}</span
                          >
                          <span class="ml-auto shrink-0 flex items-center gap-1.5">
                            <template v-if="item.priceSummary">
                              <span
                                class="w-1.5 h-1.5 rounded-full"
                                :class="TIER_DOT[item.priceSummary.costTier]"
                                aria-hidden="true"
                              />
                              <span
                                class="text-[10px]"
                                :class="TIER_TEXT[item.priceSummary.costTier]"
                                >{{ item.priceSummary.variant.pricing }}</span
                              >
                              <span
                                class="text-[9px] uppercase tracking-wide rounded px-1 py-0.5"
                                :class="TIER_BG[item.priceSummary.costTier]"
                                >{{ costLabel(item.family, item.priceSummary.variant) }}</span
                              >
                            </template>
                            <template v-else>
                              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                              <span class="text-[10px] text-emerald-500">Free</span>
                              <span
                                class="text-[9px] uppercase tracking-wide rounded px-1 py-0.5 bg-emerald-500/10 text-emerald-500"
                                >Free</span
                              >
                            </template>
                            <svg
                              v-if="currentFamilyId === item.family.id"
                              class="w-3.5 h-3.5 text-accent"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2.5"
                              viewBox="0 0 24 24"
                            >
                              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                        </div>
                      </button>

                      <!-- Thinking-level rows (expanded) -->
                      <ul v-else class="ml-3 border-l border-border">
                        <li v-for="level in item.levels" :key="level.variant.id">
                          <button
                            @click="select(level.variant.id)"
                            @mouseenter="activeIndex = level.flatIndex"
                            :class="
                              level.flatIndex === activeIndex
                                ? 'bg-surface-subtle'
                                : 'hover:bg-surface-subtle/50'
                            "
                            class="w-full text-left pl-3 pr-3 py-2 transition-colors flex items-center gap-2"
                          >
                            <span class="text-xs text-content shrink-0">{{
                              levelLabel(level.variant.level)
                            }}</span>
                            <span
                              class="w-1.5 h-1.5 rounded-full shrink-0"
                              :class="variantDotClass(item.family, level.variant)"
                              aria-hidden="true"
                            />
                            <span
                              class="text-[10px] shrink-0"
                              :class="variantPricingClass(item.family, level.variant)"
                              >{{ level.variant.pricing }}</span
                            >
                            <span
                              v-if="!level.variant.free"
                              class="text-[9px] uppercase tracking-wide rounded px-1 py-0.5 shrink-0"
                              :class="variantBadgeClass(item.family, level.variant)"
                              >{{ costLabel(item.family, level.variant) }}</span
                            >
                            <svg
                              v-if="current === level.variant.id"
                              class="w-3.5 h-3.5 text-accent shrink-0 ml-auto"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2.5"
                              viewBox="0 0 24 24"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </button>
                        </li>
                      </ul>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <!-- Footer hint -->
            <div
              v-if="visibleGroups.length > 0"
              class="px-3 py-2 border-t border-border text-[11px] text-content-subtle shrink-0 flex items-center justify-between"
            >
              <span>{{ totalVisible }} model{{ totalVisible === 1 ? '' : 's' }}</span>
              <span v-if="currentLabel">Selected: {{ currentLabel }} · {{ currentPricing }}</span>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import {
  THINKING_LEVEL_LABELS,
  THINKING_LEVEL_ORDER,
  type ModelFamily,
  type ModelVariant,
  type ThinkingLevel,
} from '@jheckbot/shared'

interface Props {
  open: boolean
  families: ModelFamily[]
  current: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'select', variantId: string): void
  (e: 'close'): void
}>()

const TIER_LABELS: Record<ModelFamily['tier'], string> = {
  free: 'Free',
  budget: 'Budget',
  mid: 'Mid-range',
  premium: 'Premium',
}
const TIER_ORDER: ModelFamily['tier'][] = ['free', 'budget', 'mid', 'premium']

const TIER_TEXT: Record<ModelFamily['tier'], string> = {
  free: 'text-emerald-500',
  budget: 'text-amber-500',
  mid: 'text-orange-500',
  premium: 'text-rose-500',
}

const TIER_DOT: Record<ModelFamily['tier'], string> = {
  free: 'bg-emerald-500',
  budget: 'bg-amber-500',
  mid: 'bg-orange-500',
  premium: 'bg-rose-500',
}

const TIER_BG: Record<ModelFamily['tier'], string> = {
  free: 'bg-emerald-500/10 text-emerald-500',
  budget: 'bg-amber-500/10 text-amber-500',
  mid: 'bg-orange-500/10 text-orange-500',
  premium: 'bg-rose-500/10 text-rose-500',
}

type SortMode = 'default' | 'name' | 'context' | 'price'
const query = ref('')
const sortMode = ref<SortMode>('default')
const expandedId = ref<string | null>(null)
const activeIndex = ref(0)
const overlayEl = ref<HTMLElement | null>(null)
const searchEl = ref<HTMLInputElement | null>(null)

const levelRank = (level: ThinkingLevel) => {
  const idx = THINKING_LEVEL_ORDER.indexOf(level)
  return idx === -1 ? THINKING_LEVEL_ORDER.length : idx
}

function levelLabel(level: ThinkingLevel) {
  return THINKING_LEVEL_LABELS[level] ?? level
}

// Parse "200K" / "1M" / "400K" -> numeric K. Unknown -> 0.
function contextK(ctx: string): number {
  const m = /^(\d+(?:\.\d+)?)([KM])$/.exec(ctx.trim())
  if (!m) return 0
  const n = parseFloat(m[1])
  return m[2] === 'M' ? n * 1000 : n
}

// Parse the input $/MTok from a pricing string. "Free" -> 0.
function inputPrice(v: ModelVariant): number {
  if (v.free) return 0
  const m = /\$(\d+(?:\.\d+)?)/.exec(v.pricing)
  return m ? parseFloat(m[1]) : Number.POSITIVE_INFINITY
}

function familyMinPrice(f: ModelFamily): number {
  return Math.min(...f.variants.map(inputPrice))
}

// Cost tier used for UI coloring. Non-free variants in an otherwise free family
// are shown as budget so they don't appear free at a glance.
function variantCostTier(family: ModelFamily, variant: ModelVariant): ModelFamily['tier'] {
  if (variant.free) return 'free'
  return family.tier === 'free' ? 'budget' : family.tier
}

function variantPricingClass(family: ModelFamily, variant: ModelVariant): string {
  return TIER_TEXT[variantCostTier(family, variant)]
}

function variantDotClass(family: ModelFamily, variant: ModelVariant): string {
  return TIER_DOT[variantCostTier(family, variant)]
}

function variantBadgeClass(family: ModelFamily, variant: ModelVariant): string {
  return TIER_BG[variantCostTier(family, variant)]
}

function costLabel(family: ModelFamily, variant: ModelVariant): string {
  const costTier = variantCostTier(family, variant)
  if (costTier === 'free') return 'Free'
  return costTier === 'premium' ? 'Premium' : 'Paid'
}

// Cheapest paid variant for the family-row price preview, or null if every
// variant is free.
function familyPriceSummary(family: ModelFamily): { variant: ModelVariant; costTier: ModelFamily['tier'] } | null {
  const paid = family.variants.filter((v) => !v.free)
  if (paid.length === 0) return null
  const variant = [...paid].sort((a, b) => inputPrice(a) - inputPrice(b))[0]!
  return { variant, costTier: variantCostTier(family, variant) }
}

const sortedFamilies = computed(() => {
  const list = [...props.families]
  switch (sortMode.value) {
    case 'name':
      return list.sort((a, b) => a.label.localeCompare(b.label))
    case 'context':
      return list.sort((a, b) => contextK(b.context) - contextK(a.context))
    case 'price':
      return list.sort((a, b) => familyMinPrice(a) - familyMinPrice(b))
    default:
      return list
  }
})

const filteredFamilies = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return sortedFamilies.value
  return sortedFamilies.value.filter((f) =>
    [f.id, f.label, f.context, f.tier].join(' ').toLowerCase().includes(q),
  )
})

const currentFamilyId = computed(() => {
  for (const f of props.families) {
    if (f.variants.some((v) => v.id === props.current)) return f.id
  }
  return ''
})

const currentLabel = computed(() => {
  for (const f of props.families) {
    const v = f.variants.find((vr) => vr.id === props.current)
    if (v) return `${f.label} · ${levelLabel(v.level)}`
  }
  return ''
})

const currentPricing = computed(() => {
  for (const f of props.families) {
    const v = f.variants.find((vr) => vr.id === props.current)
    if (v) return v.pricing
  }
  return ''
})

// Build tier groups with a flat navigation index. Each group's `items` is a
// list of either family rows or expanded-level blocks; the flatIndex fields
// map into a parallel flat list used for keyboard nav.
interface FamilyItem {
  type: 'family'
  key: string
  family: ModelFamily
  flatIndex: number
  priceSummary: { variant: ModelVariant; costTier: ModelFamily['tier'] } | null
}
interface LevelsItem {
  type: 'levels'
  key: string
  family: ModelFamily
  levels: { variant: ModelVariant; flatIndex: number }[]
}
type GroupItem = FamilyItem | LevelsItem

const visibleGroups = computed(() => {
  const byTier = new Map<ModelFamily['tier'], ModelFamily[]>()
  for (const f of filteredFamilies.value) {
    const list = byTier.get(f.tier) ?? []
    list.push(f)
    byTier.set(f.tier, list)
  }
  const groups: { label: string; families: ModelFamily[]; items: GroupItem[] }[] = []
  let flat = 0
  for (const tier of TIER_ORDER) {
    const fams = byTier.get(tier)
    if (!fams || fams.length === 0) continue
    const items: GroupItem[] = []
    for (const family of fams) {
      const familyFlat = flat++
      items.push({
        type: 'family',
        key: family.id,
        family,
        flatIndex: familyFlat,
        priceSummary: familyPriceSummary(family),
      })
      if (expandedId.value === family.id) {
        const levels = [...family.variants]
          .sort((a, b) => levelRank(a.level) - levelRank(b.level))
          .map((variant) => ({ variant, flatIndex: flat++ }))
        items.push({ type: 'levels', key: `${family.id}-levels`, family, levels })
      }
    }
    groups.push({ label: TIER_LABELS[tier], families: fams, items })
  }
  return groups
})

const totalVisible = computed(() => filteredFamilies.value.length)

// Flat list of navigable targets for keyboard nav: family ids + variant ids.
type NavTarget = { kind: 'family'; id: string } | { kind: 'level'; id: string }
const flatTargets = computed<NavTarget[]>(() => {
  const out: NavTarget[] = []
  for (const group of visibleGroups.value) {
    for (const item of group.items) {
      if (item.type === 'family') {
        out.push({ kind: 'family', id: item.family.id })
      } else {
        for (const lvl of item.levels) out.push({ kind: 'level', id: lvl.variant.id })
      }
    }
  }
  return out
})

function toggleExpand(familyId: string) {
  expandedId.value = expandedId.value === familyId ? null : familyId
}

function close() {
  emit('close')
}

function select(variantId: string) {
  emit('select', variantId)
  emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (!props.open) return
  const targets = flatTargets.value
  if (targets.length === 0) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIndex.value = Math.min(activeIndex.value + 1, targets.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIndex.value = Math.max(activeIndex.value - 1, 0)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const target = targets[activeIndex.value]
    if (!target) return
    if (target.kind === 'family') toggleExpand(target.id)
    else select(target.id)
  }
}

watch(query, () => {
  activeIndex.value = 0
})

// Keep keyboard highlight in bounds when expand/collapse reshapes the flat list.
watch(expandedId, () => {
  const max = flatTargets.value.length - 1
  if (activeIndex.value > max) activeIndex.value = Math.max(0, max)
})

watch(
  () => props.open,
  (open) => {
    if (open) {
      query.value = ''
      sortMode.value = 'default'
      expandedId.value = currentFamilyId.value || null
      activeIndex.value = 0
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
