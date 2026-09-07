import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const slides = ref<any[]>([])
const markDirty = vi.fn()
const markClean = vi.fn()
const warning = vi.fn()
let local: any = null
let served: any = null
let requests: any[] = []

vi.mock('frappe-ui', () => ({
	createResource: () => ({}),
	call: vi.fn(),
	frappeRequest: async (options: any) => {
		requests.push(options)
		if (options.url !== 'frappe.client.get') return {}
		return JSON.parse(JSON.stringify(served))
	},
	toast: { warning, error: vi.fn() },
}))
vi.mock('@/apps/slides/router', () => ({ router: { currentRoute: { value: { query: {} } } } }))
vi.mock('@/apps/slides/stores/slide', () => ({ slides }))
vi.mock('@/apps/slides/stores/historyMeta', () => ({ commandHistory: {} }))
vi.mock('@/apps/slides/stores/element', () => ({ normalizeZIndices: (els: any) => els }))
vi.mock('@/apps/slides/stores/saving', () => ({
	markDirty,
	markClean,
	getPresentationFromLocalDB: async () => local,
}))

const { initPresentationDoc } = await import('./presentation')

const slide = (background: string) => ({ clientId: 'c1', background, elements: [] })

describe('loading a presentation', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		slides.value = []
		local = null
		served = null
		requests = []
	})

	it('fetches over GET with the url and param order the offline copy pins', async () => {
		served = { modified: 'M1', slides: [] }

		await initPresentationDoc('p1')

		const [load] = requests
		expect(load.url).toBe('frappe.client.get')
		expect(load.method).toBe('GET')
		expect(Object.entries(load.params)).toEqual([
			['doctype', 'Presentation'],
			['name', 'p1'],
		])
	})

	it('prefers the local copy over a served document older than the last save', async () => {
		local = { dirty: false, baseModified: 'M2', content: [slide('#00ff00ff')] }
		served = { modified: 'M1', slides: [slide('#ff0000ff')] }

		const doc = await initPresentationDoc('p1')

		expect(slides.value[0].background).toBe('#00ff00ff')
		expect(doc.modified).toBe('M2')
		expect(markClean).toHaveBeenCalled()
		expect(markDirty).not.toHaveBeenCalled()
	})

	it('restores unsynced edits made on the served version', async () => {
		local = { dirty: true, baseModified: 'M1', content: [slide('#00ff00ff')] }
		served = { modified: 'M1', slides: [slide('#ff0000ff')] }

		await initPresentationDoc('p1')

		expect(slides.value[0].background).toBe('#00ff00ff')
		expect(markDirty).toHaveBeenCalled()
		expect(warning).not.toHaveBeenCalled()
	})

	it('discards unsynced edits once the server has moved past them', async () => {
		local = { dirty: true, baseModified: 'M1', content: [slide('#00ff00ff')] }
		served = { modified: 'M2', slides: [slide('#ff0000ff')] }

		await initPresentationDoc('p1')

		expect(slides.value[0].background).toBe('#ff0000ff')
		expect(warning).toHaveBeenCalled()
		expect(markClean).toHaveBeenCalled()
	})
})
