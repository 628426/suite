<script setup lang="ts">
import { computed } from 'vue'
import { renderMarkdown } from '@/utils/markdown'

const props = defineProps<{ source: string }>()
const rendered = computed(() => renderMarkdown(props.source))
</script>

<template>
  <article class="markdown-preview prose prose-sm max-w-none text-ink-gray-9" v-html="rendered" />
</template>

<style scoped>
.markdown-preview {
  overflow-wrap: anywhere;
}
.markdown-preview :deep(pre) {
  overflow-x: auto;
  border-radius: 0.375rem;
  padding: 1rem;
  background: var(--surface-gray-2);
  color: var(--ink-gray-9);
}
.markdown-preview :deep(table) {
  display: block;
  overflow-x: auto;
  border-collapse: collapse;
}
.markdown-preview :deep(th),
.markdown-preview :deep(td) {
  border: 1px solid var(--outline-gray-2);
  padding: 0.5rem 0.75rem;
}
.markdown-preview :deep(img) {
  max-width: 100%;
  height: auto;
}
.markdown-preview :deep(input[type='checkbox']) {
  margin-right: 0.4rem;
}
</style>
