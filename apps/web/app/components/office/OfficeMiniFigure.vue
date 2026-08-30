<template>
  <svg
    viewBox="0 0 64 80"
    class="w-full h-full"
    role="img"
    :aria-label="ariaLabel"
  >
    <!-- Shadow (pulses independently so it shrinks when the body jumps) -->
    <ellipse
      cx="32"
      cy="76"
      rx="14"
      ry="3"
      :fill="shadowColor"
      opacity="0.25"
      :class="shadowClass"
      style="transform-origin: 32px 76px"
    />

    <!-- Body group — squash/stretch origin at the feet for grounded jumps -->
    <g :class="figureClass" style="transform-origin: 32px 74px">
      <!-- Chair (rendered behind the body when seated) -->
      <g v-if="seated" aria-hidden="true">
        <rect x="19" y="30" width="26" height="30" rx="4" :fill="chairColor" :stroke="chairStroke" stroke-width="1" />
        <rect x="17" y="56" width="30" height="6" rx="2.5" :fill="chairColor" :stroke="chairStroke" stroke-width="1" />
      </g>

      <!-- Legs -->
      <template v-if="seated">
        <!-- Seated: shorter legs bent over the chair seat -->
        <rect x="24" y="56" width="7" height="14" rx="2.5" :fill="legColor" />
        <rect x="33" y="56" width="7" height="14" rx="2.5" :fill="legColor" />
        <ellipse cx="27.5" cy="71" rx="5" ry="2.5" :fill="shoeColor" />
        <ellipse cx="36.5" cy="71" rx="5" ry="2.5" :fill="shoeColor" />
      </template>
      <template v-else>
        <rect x="24" y="52" width="7" height="20" rx="2.5" :fill="legColor" />
        <rect x="33" y="52" width="7" height="20" rx="2.5" :fill="legColor" />
        <!-- Shoes -->
        <ellipse cx="27.5" cy="73" rx="5" ry="2.5" :fill="shoeColor" />
        <ellipse cx="36.5" cy="73" rx="5" ry="2.5" :fill="shoeColor" />
      </template>

      <!-- Body / shirt -->
      <path
        d="M18 38 Q18 34 22 34 L42 34 Q46 34 46 38 L46 56 Q46 60 42 60 L22 60 Q18 60 18 56 Z"
        :fill="shirtColor"
        :stroke="shirtStroke"
        stroke-width="1.5"
      />

      <!-- Role accessory on body -->
      <!-- CEO: tie -->
      <g v-if="isCeo">
        <path d="M32 36 L29 40 L31 56 L33 56 L35 40 Z" :fill="tieColor" />
      </g>
      <!-- Dev: lanyard -->
      <g v-else-if="hasLanyard">
        <path d="M28 34 L32 40 L36 34" fill="none" :stroke="tieColor" stroke-width="1.5" />
        <rect x="30" y="40" width="4" height="6" rx="1" :fill="tieColor" opacity="0.8" />
      </g>

      <!-- Arms -->
      <rect x="13" y="38" width="6" height="18" rx="3" :fill="shirtColor" :stroke="shirtStroke" stroke-width="1" />
      <rect x="45" y="38" width="6" height="18" rx="3" :fill="shirtColor" :stroke="shirtStroke" stroke-width="1" />
      <!-- Hands -->
      <circle cx="16" cy="58" r="3.5" :fill="skinColor" />
      <circle cx="48" cy="58" r="3.5" :fill="skinColor" />

      <!-- Neck -->
      <rect x="29" y="30" width="6" height="6" rx="2" :fill="skinColor" />

      <!-- Head -->
      <circle cx="32" cy="22" r="13" :fill="skinColor" :stroke="skinStroke" stroke-width="1" />

      <!-- Hair -->
      <path
        d="M19 20 Q19 10 32 9 Q45 10 45 20 Q45 16 40 15 Q36 13 32 14 Q28 13 24 15 Q19 16 19 20 Z"
        :fill="hairColor"
      />

      <!-- Face -->
      <!-- Eyes -->
      <circle cx="27" cy="22" r="1.8" :fill="eyeColor" />
      <circle cx="37" cy="22" r="1.8" :fill="eyeColor" />
      <!-- Eye shine -->
      <circle cx="27.5" cy="21.5" r="0.6" fill="white" opacity="0.8" />
      <circle cx="37.5" cy="21.5" r="0.6" fill="white" opacity="0.8" />

      <!-- Glasses (QA, review, security) -->
      <g v-if="hasGlasses">
        <circle cx="27" cy="22" r="3.5" fill="none" :stroke="eyeColor" stroke-width="1.2" />
        <circle cx="37" cy="22" r="3.5" fill="none" :stroke="eyeColor" stroke-width="1.2" />
        <line x1="30.5" y1="22" x2="33.5" y2="22" :stroke="eyeColor" stroke-width="1.2" />
      </g>

      <!-- Mouth (smile / talking) -->
      <path
        d="M27 27 Q32 30 37 27"
        fill="none"
        :stroke="mouthColor"
        stroke-width="1.5"
        stroke-linecap="round"
        :class="{ 'animate-talk-mouth origin-center': talking }"
      />

      <!-- CEO crown -->
      <g v-if="isCeo" transform="translate(0, -2)">
        <path
          d="M24 10 L24 6 L28 9 L32 4 L36 9 L40 6 L40 10 Z"
          :fill="crownColor"
          :stroke="crownStroke"
          stroke-width="0.8"
        />
        <circle cx="32" cy="5" r="1.2" :fill="crownGem" />
      </g>

      <!-- Headphones (devops, security) -->
      <g v-else-if="hasHeadphones">
        <path d="M19 22 Q19 12 32 12 Q45 12 45 22" fill="none" :stroke="headphoneColor" stroke-width="2" />
        <rect x="17" y="20" width="4" height="6" rx="2" :fill="headphoneColor" />
        <rect x="43" y="20" width="4" height="6" rx="2" :fill="headphoneColor" />
      </g>
    </g>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    role?: string
    isCeo?: boolean
    active?: boolean
    walking?: boolean
    talking?: boolean
    busy?: boolean
    seated?: boolean
    variant?: number
  }>(),
  {
    role: '',
    isCeo: false,
    active: false,
    walking: false,
    talking: false,
    busy: false,
    seated: false,
    variant: 0,
  },
)

const ariaLabel = computed(() => `Mini figure: ${props.isCeo ? 'CEO' : props.role || 'employee'}`)

// Figure animation is driven by walking/seated state, not the global busy
// flag. Only characters that are explicitly walking or have a working status
// (via the walking prop set by the parent) should bounce.
const figureClass = computed(() => {
  if (props.seated) return 'animate-unit-bob'
  if (props.walking) return 'animate-walk-bounce'
  return 'animate-unit-bob'
})

// Shadow shrinks when the body is in the air (walking); stays still when
// seated or idle so the breathing doesn't look floaty.
const shadowClass = computed(() => {
  if (props.seated) return ''
  if (props.walking) return 'animate-shadow-pulse'
  return ''
})

const roleLower = computed(() => props.role.toLowerCase())

const hasGlasses = computed(
  () => roleLower.value.includes('qa') || roleLower.value.includes('review') || roleLower.value.includes('security'),
)
const hasHeadphones = computed(
  () => roleLower.value.includes('devops') || roleLower.value.includes('security'),
)
const hasLanyard = computed(
  () =>
    roleLower.value.includes('dev') ||
    roleLower.value.includes('frontend') ||
    roleLower.value.includes('backend') ||
    roleLower.value.includes('full'),
)

// Rotate hair/skin colors by variant so employees look distinct
const skinTones = [
  { fill: '#FCD9B6', stroke: '#E5B58C' },
  { fill: '#F5C0A0', stroke: '#D9A07A' },
  { fill: '#E0B088', stroke: '#C08866' },
  { fill: '#C89060', stroke: '#A07040' },
  { fill: '#A07050', stroke: '#805030' },
]
const hairColors = ['#3B2A20', '#5C3A20', '#1A1A1A', '#8B4513', '#D4A017', '#6B4423']
const shirtColors = [
  { fill: '#3B82F6', stroke: '#1E40AF' },
  { fill: '#10B981', stroke: '#047857' },
  { fill: '#8B5CF6', stroke: '#6D28D9' },
  { fill: '#F59E0B', stroke: '#B45309' },
  { fill: '#EC4899', stroke: '#BE185D' },
  { fill: '#06B6D4', stroke: '#0E7490' },
]
const tieColors = ['#DC2626', '#1E40AF', '#047857', '#7C3AED', '#B45309']

const skin = computed(() => skinTones[props.variant % skinTones.length])
const skinColor = computed(() => skin.value.fill)
const skinStroke = computed(() => skin.value.stroke)
const hairColor = computed(() => hairColors[props.variant % hairColors.length])

const shirt = computed(() => {
  if (props.isCeo) return { fill: '#1E293B', stroke: '#0F172A' }
  return shirtColors[props.variant % shirtColors.length]
})
const shirtColor = computed(() => shirt.value.fill)
const shirtStroke = computed(() => shirt.value.stroke)

const tieColor = computed(() => tieColors[props.variant % tieColors.length])
const legColor = computed(() => '#374151')
const shoeColor = computed(() => '#1F2937')
const eyeColor = computed(() => '#1F2937')
const mouthColor = computed(() => '#9C4221')
const shadowColor = computed(() => '#000000')

const crownColor = computed(() => '#FBBF24')
const crownStroke = computed(() => '#B45309')
const crownGem = computed(() => '#EF4444')
const headphoneColor = computed(() => '#4B5563')
const chairColor = computed(() => '#6B7280')
const chairStroke = computed(() => '#374151')
</script>
