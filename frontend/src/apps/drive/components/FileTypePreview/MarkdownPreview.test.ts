import { createApp, defineComponent, h, nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import MarkdownPreview from './MarkdownPreview.vue'

vi.mock('frappe-ui', () => ({
  Skeleton: () => h('div', { class: 'skeleton' }),
  TabButtons: {
    props: ['modelValue', 'options'],
    emits: ['update:modelValue'],
    setup(props, { emit }) {
      return () =>
        (props.options ?? []).map((option: { label: string; value: string }) =>
          h('button', { onClick: () => emit('update:modelValue', option.value) }, option.label),
        )
    },
  },
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

async function flushPromises() {
  await Promise.resolve()
  await Promise.resolve()
  await nextTick()
}

function mountPreview(name: string) {
  const root = document.createElement('div')
  const app = createApp(
    defineComponent({
      setup: () => () => h(MarkdownPreview, { previewEntity: { name } }),
    }),
  )
  app.mount(root)
  return { app, root }
}

describe('Drive MarkdownPreview', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('fetches and renders formatted content by default', async () => {
    const request = deferred<Response>()
    const fetchMock = vi.fn(() => request.promise)
    vi.stubGlobal('fetch', fetchMock)

    const { app, root } = mountPreview('markdown-a')
    await nextTick()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/method/suite.drive.api.files.get_markdown_preview?entity_name=markdown-a&mode=html',
      expect.objectContaining({
        method: 'GET',
      }),
    )

    request.resolve({
      ok: true,
      json: async () => ({
        content: '<h1>Hello</h1>',
        mime_type: 'text/markdown',
      }),
    } as Response)
    await flushPromises()

    expect(root.querySelector('.prose')?.textContent).toContain('Hello')
    expect(root.querySelector('textarea')).toBeNull()
    app.unmount()
  })

  it('switches to raw mode when selected', async () => {
    const formatted = deferred<Response>()
    const raw = deferred<Response>()
    const fetchMock = vi.fn((url) => (url.includes('mode=html') ? formatted.promise : raw.promise))
    vi.stubGlobal('fetch', fetchMock)

    const { app, root } = mountPreview('markdown-b')
    await nextTick()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    formatted.resolve({
      ok: true,
      json: async () => ({
        content: '<h1>Hello</h1>',
        mime_type: 'text/markdown',
      }),
    } as Response)
    await flushPromises()

    const rawButton = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim().toLowerCase() === 'raw',
    )
    rawButton?.click()
    await nextTick()

    raw.resolve({
      ok: true,
      json: async () => ({
        content: 'Raw markdown text',
        mime_type: 'text/markdown',
      }),
    } as Response)
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/method/suite.drive.api.files.get_markdown_preview?entity_name=markdown-b&mode=raw',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(root.querySelector('pre')?.textContent).toContain('Raw markdown text')
    expect(root.querySelector('textarea')).toBeNull()
    app.unmount()
  })

  it('reports API errors cleanly', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: false,
        text: async () => 'bad request',
      } as Response),
    )
    vi.stubGlobal('fetch', fetchMock)

    const { app, root } = mountPreview('markdown-c')
    await nextTick()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/method/suite.drive.api.files.get_markdown_preview?entity_name=markdown-c&mode=html',
      expect.objectContaining({ method: 'GET' }),
    )
    await flushPromises()

    expect(root.textContent).toContain('bad request')
    app.unmount()
  })

  it('renders an empty payload safely', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          content: '',
          mime_type: 'text/markdown',
        }),
      } as Response),
    )
    vi.stubGlobal('fetch', fetchMock)

    const { app, root } = mountPreview('markdown-empty')
    await nextTick()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/method/suite.drive.api.files.get_markdown_preview?entity_name=markdown-empty&mode=html',
      expect.objectContaining({ method: 'GET' }),
    )
    await flushPromises()

    expect(root.querySelector('.prose')?.textContent).toBe('')
    app.unmount()
  })
})
