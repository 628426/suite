<script setup>
import MarkdownTabs from '@/components/MarkdownTabs.vue'
import MarkdownPreview from '@/components/MarkdownPreview.vue'
import { useTextFile } from '@/composables/useTextFile'

const props = defineProps({
  document: Object,
  editable: Boolean,
})

const { source, loading, error } = useTextFile(() => props.document.doc.name)
</script>

<template>
  <MarkdownTabs :key="document.doc.name">
    <template #preview>
      <p v-if="loading" role="status" class="p-7 text-ink-gray-6">Loading preview…</p>
      <p v-else-if="error" role="alert" class="p-7 text-ink-red-4">{{ error }}</p>
      <MarkdownPreview v-else :source class="mx-auto w-full max-w-3xl p-7" />
    </template>
    <template #editor>
      <textarea
        v-if="!loading && !error"
        v-model="source"
        aria-label="Raw Markdown"
        :readonly="!editable"
        spellcheck="false"
        class="block min-h-[70vh] w-full resize-y bg-surface-base p-7 font-mono text-base text-ink-gray-9 focus:outline-none"
      />
    </template>
  </MarkdownTabs>
</template>
