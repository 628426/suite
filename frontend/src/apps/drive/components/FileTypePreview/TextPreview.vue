<template>
  <FilePreviewSkeleton v-if="loading" />
  <p v-else-if="error" role="alert" class="p-3 text-ink-red-4">{{ error }}</p>
  <MarkdownTabs v-else-if="isMarkdownFile(previewEntity)" :key="previewEntity.name"
    editor-label="Source" class="h-[80vh] rounded-4 border bg-surface-base">
    <template #preview><MarkdownPreview :source="blob" class="mx-auto max-w-3xl p-7" /></template>
    <template #editor><pre class="overflow-x-auto p-3 text-p-base text-ink-gray-8">{{ blob }}</pre></template>
  </MarkdownTabs>
  <pre
    v-else
    class="overflow-y-auto h-[80vh] font-[InterVar] text-p-base text-ink-gray-8 sm:w-full border p-3 rounded-4 overflow-x-auto"
    >{{ blob }}</pre
  >
</template>

<script setup>
/* Consider adding https://codemirror.net/ and add a mimetype eval list for all possible mimetypes */

import FilePreviewSkeleton from '@/apps/drive/components/FileTypePreview/FilePreviewSkeleton.vue'
import MarkdownPreview from '@/components/MarkdownPreview.vue'
import MarkdownTabs from '@/components/MarkdownTabs.vue'
import { useTextFile } from '@/composables/useTextFile'
import { isMarkdownFile } from '@/utils/markdown'

const props = defineProps({
  previewEntity: Object,
})

const { source: blob, loading, error } = useTextFile(() => props.previewEntity.name)
</script>
<style scoped></style>
