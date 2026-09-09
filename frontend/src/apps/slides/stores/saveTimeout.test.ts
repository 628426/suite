import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const server = vi.hoisted(() => ({ answer: null as ((options: any) => any) | null }))

vi.mock('frappe-ui', () => ({
	createResource: () => ({}),
	call: vi.fn(),
	// a push that never answers, unless its signal aborts it
	frappeRequest: (options: any) =>
		server.answer
			? Promise.resolve(server.answer(options))
			: new Promise((_, reject) => {
					options.signal?.addEventListener('abort', () => reject(options.signal.reason))
				}),
	toast: { warning: vi.fn(), error: vi.fn() },
}))
vi.mock('@/apps/slides/router', () => ({ router: { currentRoute: { value: { query: {} } } } }))
vi.mock('@/apps/slides/stores/slide', () => ({ slides: ref([]) }))
vi.mock('@/apps/slides/stores/historyMeta', () => ({ commandHistory: { clearHistory: vi.fn() } }))
vi.mock('@/apps/slides/stores/element', () => ({ normalizeZIndices: (els: any) => els }))
vi.mock('@/apps/slides/stores/saving', () => ({
	markDirty: vi.fn(),
	markClean: vi.fn(),
	getPresentationFromLocalDB: async () => null,
}))

const { savePresentationDoc, presentationDoc, presentationId, resetEditorState } =
	await import('./presentation')

describe('savePresentationDoc', () => {
	beforeEach(() => vi.useFakeTimers())
	afterEach(() => vi.useRealTimers())

	it('gives up on a push that never answers', async () => {
		presentationDoc.value = { name: 'p1', modified: 'M1' }

		const outcome = savePresentationDoc('p1', [], 'M1').then(
			() => 'saved',
			(err) => err.name,
		)
		await vi.advanceTimersByTimeAsync(30_000)

		// the save gate reopens on the rejection; a hung request would hold it forever
		expect(await outcome).toBe('AbortError')
	})

	it('stamps the presentation it pushed, not the one on screen', async () => {
		server.answer = (options) => ({ modified: `${options.params.name}-M2` })
		// the editor moved on before this push went out
		presentationDoc.value = { name: 'p2', modified: 'N1' }

		try {
			expect(await savePresentationDoc('p1', [], 'M1')).toBe('p1-M2')
		} finally {
			server.answer = null
		}
		expect(presentationDoc.value.modified).toBe('N1')
	})
})

describe('resetEditorState', () => {
	it('leaves no presentation for a push in flight to land on', () => {
		presentationId.value = 'p1'

		resetEditorState()

		// the blank slides would otherwise be read back as p1's latest edit
		expect(presentationId.value).toBe(null)
	})
})
