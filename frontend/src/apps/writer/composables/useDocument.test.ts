import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ useDoc: vi.fn(), trackVisit: vi.fn(), updateRow: vi.fn() }))
vi.mock('frappe-ui', () => ({
  useDoc: mocks.useDoc,
  createResource: () => ({ submit: mocks.trackVisit }),
}))
vi.mock('@/boot/session', () => ({ useSessionStore: () => ({ isLoggedIn: true }) }))
vi.mock('@/apps/drive/sdk', () => ({ prettyData: (doc: unknown) => doc }))
vi.mock('@/apps/writer/resources/', () => ({ getDocuments: { updateRow: mocks.updateRow } }))

import useDocument from './useDocument'

describe('Writer file loading', () => {
  beforeEach(() => vi.clearAllMocks())

  it('opens uploaded Markdown without requesting a missing Writer Document', () => {
    let loaded!: (doc: object) => void
    mocks.useDoc.mockReturnValue({ onSuccess: (callback: typeof loaded) => { loaded = callback } })
    const { document } = useDocument('readme')
    const file = { name: 'readme', file_name: 'README.md', mime_type: 'text/plain' }
    loaded(file)
    expect(mocks.useDoc).toHaveBeenCalledTimes(1)
    expect(document.value.doc).toEqual(file)
    expect(mocks.trackVisit).toHaveBeenCalledWith('readme')
  })

  it('keeps native Writer documents on their existing resource and save methods', () => {
    let loaded!: (doc: object) => void
    mocks.useDoc.mockReturnValue({ onSuccess: (callback: typeof loaded) => { loaded = callback } })
    useDocument('native')
    loaded({ name: 'native', file_name: 'Notes.md', content_doctype: 'Writer Document', content_docname: 'writer-1' })
    expect(mocks.useDoc).toHaveBeenLastCalledWith(expect.objectContaining({
      doctype: 'Writer Document', name: 'writer-1',
      methods: expect.objectContaining({ saveHtml: 'save_html', saveDoc: 'save_doc' }),
    }))
  })
})
