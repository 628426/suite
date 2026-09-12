import { createApp, h, nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import MarkdownEditor from './MarkdownEditor.vue'

const cleanup: Array<() => void> = []
afterEach(() => {
  cleanup.splice(0).forEach((dispose) => dispose())
  vi.unstubAllGlobals()
})

async function mountEditor(editable = true) {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    blob: async () => ({ text: async () => '# Original\n\n- [x] Done' }),
  })))
  const root = document.createElement('div')
  document.body.appendChild(root)
  const app = createApp({ render: () => h(MarkdownEditor, {
    document: { doc: { name: 'readme' } }, editable,
  }) })
  app.mount(root)
  cleanup.push(() => { app.unmount(); root.remove() })
  for (let i = 0; i < 10; i++) await Promise.resolve()
  await nextTick()
  return root
}

describe('Writer Markdown preview and editor', () => {
  it('renders original Markdown and previews editor changes without remounting it', async () => {
    const root = await mountEditor()
    const tabs = root.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    expect(tabs[0].getAttribute('aria-selected')).toBe('true')
    expect(root.querySelector('article h1')?.textContent).toBe('Original')
    expect(root.querySelector('article input[type="checkbox"]')).not.toBeNull()
    tabs[1].click()
    await nextTick()
    const editor = root.querySelector('textarea')!
    expect(editor.value).toBe('# Original\n\n- [x] Done')
    editor.value = '# Changed\n\n<img src="x" onerror="alert(1)">'
    editor.dispatchEvent(new Event('input'))
    await nextTick()
    tabs[0].click()
    await nextTick()
    expect(root.querySelector('article h1')?.textContent).toBe('Changed')
    expect(root.querySelector('article [onerror]')).toBeNull()
    tabs[1].click()
    await nextTick()
    expect(root.querySelector('textarea')).toBe(editor)
    expect(editor.value).toContain('Changed')
  })

  it('keeps the existing editor read-only without write permission', async () => {
    const root = await mountEditor(false)
    expect(root.querySelector('textarea')?.readOnly).toBe(true)
    expect(root.querySelector('[role="toolbar"]')).toBeNull()
  })
})
