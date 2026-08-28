<template>
  <div
    class="flex items-center justify-center gap-1 h-6"
    role="status"
    aria-label="Voice input active"
  >
    <span
      v-for="(bar, i) in bars"
      :key="i"
      class="w-1 rounded-full bg-emerald-500 will-change-[height]"
      :style="barStyle(i, bar)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'

// Number of bars in the waveform. Odd count centers nicely.
const BAR_COUNT = 7
const MIN_HEIGHT = 3
const MAX_HEIGHT = 22

const props = defineProps<{
  active: boolean
}>()

// Each bar's current height in px. Driven by live mic amplitude when
// available, otherwise by a decorative fallback animation.
const bars = ref<number[]>(new Array(BAR_COUNT).fill(MIN_HEIGHT))

let audioCtx: AudioContext | null = null
let analyser: AnalyserNode | null = null
let source: MediaStreamAudioSourceNode | null = null
let stream: MediaStream | null = null
let rafId = 0
let freqData: Uint8Array<ArrayBuffer> | null = null
let fallbackStart = 0

function barStyle(index: number, height: number) {
  // Stagger the emerald opacity slightly so the center bars read brightest.
  const distance = Math.abs(index - (BAR_COUNT - 1) / 2)
  const opacity = Math.max(0.55, 1 - distance * 0.12)
  return {
    height: `${height}px`,
    opacity,
    transition: 'height 60ms linear, opacity 200ms ease',
  }
}

async function startAnalysis() {
  stopAnalysis()
  fallbackStart = performance.now()

  // Try to drive the waveform from real mic input. If the mic is already
  // captured by the Web Speech API or permission is denied, fall back to a
  // purely decorative animation so the UI still shows "playing soundwaves".
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) throw new Error('no AudioContext')
    audioCtx = new Ctx()
    source = audioCtx.createMediaStreamSource(stream)
    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 64
    analyser.smoothingTimeConstant = 0.6
    source.connect(analyser)
    freqData = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount))
  } catch {
    // Real analysis unavailable — fallback loop still runs.
    analyser = null
    freqData = null
  }

  const tick = () => {
    rafId = requestAnimationFrame(tick)
    if (analyser && freqData) {
      analyser.getByteFrequencyData(freqData)
      // Spread bins across the bar count, mapping 0..255 to MIN..MAX.
      const next: number[] = []
      for (let i = 0; i < BAR_COUNT; i++) {
        const bin = Math.floor((i / BAR_COUNT) * freqData.length)
        const amp = freqData[bin] / 255
        // Emphasize quieter speech so the waveform stays lively.
        const scaled = Math.pow(amp, 0.6)
        next.push(Math.max(MIN_HEIGHT, scaled * MAX_HEIGHT))
      }
      bars.value = next
    } else {
      // Decorative fallback: smooth pseudo-random heights.
      const t = (performance.now() - fallbackStart) / 1000
      const next: number[] = []
      for (let i = 0; i < BAR_COUNT; i++) {
        const phase = i * 0.6
        const v = (Math.sin(t * 6 + phase) * 0.5 + 0.5) * 0.6
        const wobble = (Math.sin(t * 11 + phase * 1.7) * 0.5 + 0.5) * 0.4
        next.push(MIN_HEIGHT + (v + wobble) * (MAX_HEIGHT - MIN_HEIGHT))
      }
      bars.value = next
    }
  }
  rafId = requestAnimationFrame(tick)
}

function stopAnalysis() {
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = 0
  }
  source?.disconnect()
  analyser?.disconnect()
  source = null
  analyser = null
  freqData = null
  if (stream) {
    for (const track of stream.getTracks()) track.stop()
    stream = null
  }
  if (audioCtx) {
    audioCtx.close().catch(() => {})
    audioCtx = null
  }
  bars.value = new Array(BAR_COUNT).fill(MIN_HEIGHT)
}

watch(
  () => props.active,
  (active) => {
    if (active) startAnalysis()
    else stopAnalysis()
  },
  { immediate: true },
)

onUnmounted(stopAnalysis)
</script>
