import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

vi.mock('frappe-ui', () => ({
	createResource: () => ({}),
	call: vi.fn(),
	// a push that never answers, unless its signal aborts it
	frappeRequest: (options: any) =>
		new Promise((_, reject) => {
			options.signal?.addEventListener('abort', () => reject(options.signal.reason))
		}),
	toast: { warning: vi.fn(), error: vi.fn() },
}))
vi.mock('@/apps/slides/router', () => ({ router: { currentRoute: { value: { query: {} } } } }))
vi.mock('@/apps/slides/stores/slide', () => ({ slides: ref([]) }))
vi.mock('@/apps/slides/stores/historyMeta', () => ({ commandHistory: {} }))
vi.mock('@/apps/slides/stores/element', () => ({ normalizeZIndices: (els: any) => els }))
vi.mock('@/apps/slides/stores/saving', () => ({
	markDirty: vi.fn(),
	markClean: vi.fn(),
	getPresentationFromLocalDB: async () => null,
}))

const { savePresentationDoc, presentationDoc } = await import('./presentation')

describe('savePresentationDoc', () => {
	beforeEach(() => vi.useFakeTimers())
	afterEach(() => vi.useRealTimers())

	it('gives up on a push that never answers', async () => {
		presentationDoc.value = { name: 'p1', modified: 'M1' }

		const outcome = savePresentationDoc([], 'M1').then(
			() => 'saved',
			(err) => err.name,
		)
		await vi.advanceTimersByTimeAsync(30_000)

		// the save gate reopens on the rejection; a hung request would hold it forever
		expect(await outcome).toBe('AbortError')
	})
})
