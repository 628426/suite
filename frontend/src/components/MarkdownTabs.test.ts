import { createApp, defineComponent, h, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import MarkdownTabs from './MarkdownTabs.vue'
import MarkdownPreview from './MarkdownPreview.vue'

const cleanup: Array<() => void> = []
afterEach(() => cleanup.splice(0).forEach((dispose) => dispose()))

describe('Markdown tabs', () => {
  it('defaults to Preview and keeps the editor and its content across tab switches', async () => {
    let editorMounts = 0
    const Editor = defineComponent({
      setup() {
        editorMounts++
        const content = ref('original')
        return () => h('textarea', {
          value: content.value,
          onInput: (event: Event) => { content.value = (event.target as HTMLTextAreaElement).value },
        })
      },
    })
    const root = document.createElement('div')
    document.body.appendChild(root)
    const app = createApp({ render: () => h(MarkdownTabs, {}, {
      preview: () => h(MarkdownPreview, { source: '# Read me' }),
      editor: () => h(Editor),
    }) })
    app.mount(root)
    cleanup.push(() => { app.unmount(); root.remove() })
    await nextTick()
    const tabs = root.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    const panels = root.querySelectorAll<HTMLElement>('[role="tabpanel"]')
    expect(tabs[0].textContent).toBe('Preview')
    expect(tabs[0].getAttribute('aria-selected')).toBe('true')
    expect(tabs[1].textContent).toBe('Editor')
    expect(panels[1].style.display).toBe('none')
    expect(root.querySelector('h1')?.textContent).toBe('Read me')
    tabs[1].click()
    await nextTick()
    const input = root.querySelector('textarea')!
    input.value = 'unsaved changes'
    input.dispatchEvent(new Event('input'))
    await nextTick()
    tabs[0].click()
    await nextTick()
    tabs[1].click()
    await nextTick()
    expect(root.querySelector('textarea')).toBe(input)
    expect(input.value).toBe('unsaved changes')
    expect(editorMounts).toBe(1)
  })
})
