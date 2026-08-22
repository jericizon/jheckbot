<template>
  <div class="markdown-body" v-html="html" ref="containerEl" @click="handleClick" />
  <Teleport to="body">
    <div
      v-if="lightboxSrc"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-fade-in"
      @click="closeLightbox"
    >
      <img :src="lightboxSrc" class="max-w-[95vw] max-h-[95vh] object-contain rounded-lg shadow-2xl" alt="screenshot" />
      <button
        class="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
        aria-label="Close"
        @click.stop="closeLightbox"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { marked } from 'marked'
import { computed, ref, onUnmounted } from 'vue'

const props = defineProps<{ content: string }>()

// GFM + line breaks; marked escapes raw HTML by default (no html option).
marked.setOptions({ breaks: true, gfm: true })

const containerEl = ref<HTMLElement | null>(null)
const lightboxSrc = ref<string | null>(null)

const html = computed(() => {
  const raw = props.content ?? ''
  // Defensive: strip any <script> blocks before parsing
  const cleaned = raw.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  return marked.parse(cleaned, { async: false }) as string
})

function handleClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.tagName === 'IMG') {
    const src = (target as HTMLImageElement).src
    if (src) {
      e.preventDefault()
      lightboxSrc.value = src
    }
  }
}

function closeLightbox() {
  lightboxSrc.value = null
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') closeLightbox()
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', onKey)
  onUnmounted(() => window.removeEventListener('keydown', onKey))
}
</script>

<style scoped>
.markdown-body :deep(p) { margin: 0 0 0.75rem; }
.markdown-body :deep(p:last-child) { margin-bottom: 0; }
.markdown-body :deep(ul),
.markdown-body :deep(ol) { margin: 0 0 0.75rem; padding-left: 1.25rem; }
.markdown-body :deep(li) { margin: 0.15rem 0; }
.markdown-body :deep(li:last-child) { margin-bottom: 0; }
.markdown-body :deep(ul) { list-style: disc; }
.markdown-body :deep(ol) { list-style: decimal; }
.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) { font-weight: 600; margin: 1rem 0 0.5rem; line-height: 1.3; }
.markdown-body :deep(h1) { font-size: 1.15rem; }
.markdown-body :deep(h2) { font-size: 1.05rem; }
.markdown-body :deep(h3) { font-size: 1rem; }
.markdown-body :deep(h4) { font-size: 0.95rem; }
.markdown-body :deep(pre) {
  background: rgb(var(--surface-subtle));
  border: 1px solid rgb(var(--border));
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  overflow-x: auto;
  margin: 0 0 0.75rem;
  font-size: 0.8125rem;
  line-height: 1.5;
}
.markdown-body :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.8125rem;
}
.markdown-body :deep(:not(pre) > code) {
  background: rgb(var(--surface-subtle));
  border-radius: 0.25rem;
  padding: 0.1rem 0.3rem;
}
.markdown-body :deep(blockquote) {
  border-left: 2px solid rgb(var(--border));
  padding-left: 0.75rem;
  margin: 0 0 0.75rem;
  color: rgb(var(--content-muted));
}
.markdown-body :deep(a) {
  color: rgb(var(--accent));
  text-decoration: underline;
  text-underline-offset: 2px;
}
.markdown-body :deep(a:hover) { opacity: 0.8; }
.markdown-body :deep(hr) {
  border: 0;
  border-top: 1px solid rgb(var(--border));
  margin: 1rem 0;
}
.markdown-body :deep(table) {
  border-collapse: collapse;
  margin: 0 0 0.75rem;
  font-size: 0.8125rem;
}
.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid rgb(var(--border));
  padding: 0.35rem 0.6rem;
  text-align: left;
}
.markdown-body :deep(th) {
  background: rgb(var(--surface-subtle));
  font-weight: 600;
}
.markdown-body :deep(img) {
  max-width: 100%;
  border-radius: 0.5rem;
  border: 1px solid rgb(var(--border));
  margin: 0 0 0.75rem;
  cursor: zoom-in;
  transition: opacity 0.15s;
}
.markdown-body :deep(img:hover) { opacity: 0.9; }
</style>
