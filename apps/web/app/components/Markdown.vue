<template>
  <div class="markdown-body" v-html="html" />
</template>

<script setup lang="ts">
import { marked } from 'marked'
import { computed } from 'vue'

const props = defineProps<{ content: string }>()

// GFM + line breaks; marked escapes raw HTML by default (no html option).
marked.setOptions({ breaks: true, gfm: true })

const html = computed(() => {
  const raw = props.content ?? ''
  // Defensive: strip any <script> blocks before parsing
  const cleaned = raw.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  return marked.parse(cleaned, { async: false }) as string
})
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
</style>
