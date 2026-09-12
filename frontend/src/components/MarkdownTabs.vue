<script setup lang="ts">
import { ref, useId } from 'vue'

withDefaults(defineProps<{ editorLabel?: string }>(), { editorLabel: 'Editor' })

const selectedIndex = ref(0)
const id = useId()

function selectTab(index: number) {
  selectedIndex.value = index
}

function handleKeydown(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const nextIndex = event.key === 'Home' ? 0
    : event.key === 'End' ? 1
      : (selectedIndex.value + (event.key === 'ArrowLeft' ? -1 : 1) + 2) % 2
  selectTab(nextIndex)
  const tabs = (event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('[role="tab"]')
  tabs[nextIndex]?.focus()
}
</script>

<template>
  <div class="flex min-h-0 w-full flex-col">
    <div role="tablist" aria-label="Markdown view" class="flex shrink-0 gap-4 border-b border-outline-gray-2 px-4"
      @keydown="handleKeydown">
      <button v-for="(label, index) in ['Preview', editorLabel]" :id="`${id}-tab-${index}`" :key="label"
        type="button" role="tab" :aria-selected="selectedIndex === index" :aria-controls="`${id}-panel-${index}`"
        :tabindex="selectedIndex === index ? 0 : -1"
        class="border-b-2 px-1 py-3 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        :class="selectedIndex === index ? 'border-ink-gray-9 text-ink-gray-9' : 'border-transparent text-ink-gray-6'"
        @click="selectTab(index)">{{ label }}</button>
    </div>
    <div class="min-h-0 flex-1 overflow-y-auto">
      <div :id="`${id}-panel-0`" role="tabpanel" :aria-labelledby="`${id}-tab-0`" v-show="selectedIndex === 0">
        <slot name="preview" />
      </div>
      <!-- Keep the editor mounted so tab switches retain content, selection and undo history. -->
      <div :id="`${id}-panel-1`" role="tabpanel" :aria-labelledby="`${id}-tab-1`" v-show="selectedIndex === 1">
        <slot name="editor" />
      </div>
    </div>
  </div>
</template>
