import { createApp, defineComponent, h, nextTick, reactive } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import TextPreview from './TextPreview.vue'

vi.mock('./FilePreviewSkeleton.vue', () => ({
  default: defineComponent({ template: '<div data-testid="skeleton" />' }),
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
  for (let i = 0; i < 10; i++) await Promise.resolve()
  await nextTick()
}

const cleanup: Array<() => void> = []

function mountPreview(name: string, metadata = {}) {
  const root = document.createElement('div')
  document.body.appendChild(root)
  const entity = reactive({ name, ...metadata })
  const app = createApp(
    defineComponent({
      setup: () => () => h(TextPreview, { previewEntity: entity }),
    }),
  )
  app.mount(root)
  cleanup.push(() => { app.unmount(); root.remove() })
  return { root, entity }
}

const response = (text: string) => ({
  ok: true,
  blob: async () => ({ text: async () => text }),
} as Response)

describe('Drive TextPreview', () => {
  afterEach(() => {
    cleanup.splice(0).forEach((dispose) => dispose())
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('fetches and renders the initial file content', async () => {
    const request = deferred<Response>()
    const fetchMock = vi.fn(() => request.promise)
    vi.stubGlobal('fetch', fetchMock)

    const { root } = mountPreview('file-a')
    await nextTick()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/method/suite.drive.api.files.get_file_content?entity_name=file-a',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Range: 'bytes=0-10000000' }),
      }),
    )

    request.resolve({
      ok: true,
      blob: async () => ({ text: async () => 'initial content' }),
    } as Response)
    await flushPromises()

    expect(root.querySelector('pre')?.textContent).toContain('initial content')
  })

  it('renders Markdown by default and retains the original source in its tab', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response('# Heading\n\n**Bold**')))
    const { root } = mountPreview('readme', { file_name: 'README.MD', mime_type: 'text/plain' })
    await flushPromises()
    expect(root.querySelector('h1')?.textContent).toBe('Heading')
    expect(root.querySelector('strong')?.textContent).toBe('Bold')
    const tabs = root.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    expect(tabs[0].getAttribute('aria-selected')).toBe('true')
    expect(tabs[1].textContent).toBe('Source')
    tabs[1].click()
    await nextTick()
    expect(root.querySelector('pre')?.textContent).toBe('# Heading\n\n**Bold**')
    expect(tabs[1].getAttribute('aria-selected')).toBe('true')
  })

  it('does not interpret Markdown syntax in ordinary text files', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response('# Plain text')))
    const { root } = mountPreview('notes', { file_name: 'notes.txt' })
    await flushPromises()
    expect(root.querySelector('h1')).toBeNull()
    expect(root.querySelector('[role="tab"]')).toBeNull()
    expect(root.querySelector('pre')?.textContent).toBe('# Plain text')
  })

  it('shows failed requests instead of an indefinite loading skeleton', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403 })))
    const { root } = mountPreview('private')
    await flushPromises()
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('403')
    expect(root.querySelector('[data-testid="skeleton"]')).toBeNull()
  })

  it('ignores stale file responses and resets new Markdown files to Preview', async () => {
    const oldRequest = deferred<Response>()
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => oldRequest.promise)
      .mockResolvedValueOnce(response('# Second'))
      .mockResolvedValueOnce(response('# Third'))
    vi.stubGlobal('fetch', fetchMock)
    const { root, entity } = mountPreview('first', { file_type: 'Markdown' })
    entity.name = 'second'
    await nextTick()
    await flushPromises()
    oldRequest.resolve(response('# First'))
    await flushPromises()
    expect(root.querySelector('h1')?.textContent).toBe('Second')
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true)
    root.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1].click()
    await nextTick()
    entity.name = 'third'
    await nextTick()
    await flushPromises()
    expect(root.querySelector('h1')?.textContent).toBe('Third')
    expect(root.querySelector('[role="tab"]')?.getAttribute('aria-selected')).toBe('true')
  })
})
