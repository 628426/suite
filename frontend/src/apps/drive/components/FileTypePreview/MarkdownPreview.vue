<template>
  <div>
    <FilePreviewSkeleton v-if="loading" />
    <template v-else>
      <TabButtons
        v-model="activeView"
        :options="[
          {
            label: 'Formatted',
            value: 'formatted',
          },
          {
            label: 'Raw',
            value: 'raw',
          },
        ]"
        class="mb-2"
      />
      <p v-if="error" class="text-sm text-ink-gray-7 p-3 border rounded-4">
        {{ error }}
      </p>
      <pre
        v-else-if="activeView === 'raw'"
        class="overflow-y-auto h-[80vh] font-[InterVar] text-p-base text-ink-gray-8 sm:w-full border p-3 rounded-4 overflow-x-auto"
        >{{ content }}</pre
      >
      <div
        v-else
        class="overflow-y-auto h-[80vh] border rounded-4 p-3 prose prose-sm max-w-none [&_a]:text-ink-blue-6 [&_a]:hover:underline"
        v-html="sanitizedContent"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import DOMPurify from 'dompurify'

import { TabButtons } from 'frappe-ui'
import FilePreviewSkeleton from '@/apps/drive/components/FileTypePreview/FilePreviewSkeleton.vue'

const props = defineProps({
  previewEntity: Object,
})

type MarkdownMode = 'formatted' | 'raw'

const activeView = ref<MarkdownMode>('formatted')
const content = ref('')
const loading = ref(true)
const error = ref('')

const sanitizedContent = computed(() => {
  const html = DOMPurify.sanitize(content.value || '', {
    ALLOWED_TAGS: [
      'a',
      'p',
      'br',
      'div',
      'span',
      'b',
      'strong',
      'i',
      'em',
      'u',
      's',
      'del',
      'ul',
      'ol',
      'li',
      'blockquote',
      'pre',
      'code',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'table',
      'thead',
      'tbody',
      'tfoot',
      'tr',
      'th',
      'td',
      'img',
    ],
    ALLOWED_ATTR: ['href', 'title', 'alt', 'src'],
    ALLOW_UNKNOWN_PROTOCOLS: false,
  })

  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  doc.querySelectorAll('a').forEach((anchor) => {
    anchor.setAttribute('target', '_blank')
    anchor.setAttribute('rel', 'noopener noreferrer')
  })
  return doc.body.innerHTML
})

function getMode() {
  return activeView.value === 'raw' ? 'raw' : 'html'
}

async function fetchContent() {
  loading.value = true
  error.value = ''

  try {
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Frappe-Site-Name': window.location.hostname,
    }
    const query = new URLSearchParams({
      entity_name: props.previewEntity.name,
      mode: getMode(),
    })
    const res = await fetch(`/api/method/suite.drive.api.files.get_markdown_preview?${query}`, {
      method: 'GET',
      headers,
    })

    if (!res.ok) {
      error.value = (await res.text()) || 'Could not load this markdown file.'
      return
    }

    const response = (await res.json()) as {
      content?: string
      error?: string
    }
    if (response.error) {
      error.value = response.error
      return
    }
    content.value = response.content || ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Could not load this markdown file.'
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.previewEntity, activeView.value],
  () => {
    fetchContent()
  },
  { deep: true },
)

onMounted(fetchContent)
</script>
