<script setup lang="ts">
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/vue'

withDefaults(defineProps<{ editorLabel?: string }>(), { editorLabel: 'Editor' })
</script>

<template>
  <TabGroup as="div" :default-index="0" class="flex min-h-0 w-full flex-col">
    <TabList aria-label="Markdown view" class="flex shrink-0 gap-4 border-b border-outline-gray-2 px-4">
      <Tab v-for="label in ['Preview', editorLabel]" :key="label" v-slot="{ selected }" as="template">
        <button
          type="button"
          class="border-b-2 px-1 py-3 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          :class="selected ? 'border-ink-gray-9 text-ink-gray-9' : 'border-transparent text-ink-gray-6'"
        >{{ label }}</button>
      </Tab>
    </TabList>
    <TabPanels class="min-h-0 flex-1 overflow-y-auto">
      <TabPanel :unmount="false"><slot name="preview" /></TabPanel>
      <!-- Keep the editor mounted so tab switches retain content, selection and undo history. -->
      <TabPanel :unmount="false"><slot name="editor" /></TabPanel>
    </TabPanels>
  </TabGroup>
</template>
