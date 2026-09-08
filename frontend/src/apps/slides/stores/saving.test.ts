import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const presentationId = ref('p1')
const presentationDoc = ref<any>({ modified: 'M1' })
const inReadonlyMode = ref(false)
const slides = ref<any[]>([{ clientId: 'c1', background: '#ff0000ff', elements: [] }])

let serverSave: (content: any, baseModified?: string) => Promise<string | undefined>

vi.mock('@/apps/slides/stores/presentation', () => ({
	presentationId,
	presentationDoc,
	inReadonlyMode,
	savePresentationDoc: (content: any, baseModified?: string) => serverSave(content, baseModified),
}))

vi.mock('@/apps/slides/stores/slide', () => ({ slides }))

vi.mock('@/apps/slides/utils/helpers', () => ({
	cloneObj: (obj: any) => JSON.parse(JSON.stringify(obj)),
}))

const { saveCurrentState, markDirty, dirty, saveFailed, getPresentationFromLocalDB } =
	await import('./saving')

const conflict = () => Object.assign(new Error('stale'), { exc_type: 'TimestampMismatchError' })

describe('saveCurrentState', () => {
	// a refused base is held for good, so each test opens on a version of its own
	let base = ''
	let opens = 0

	beforeEach(() => {
		base = `M${++opens}`
		saveFailed.value = false
		presentationId.value = 'p1'
		presentationDoc.value = { modified: base }
		slides.value = [{ clientId: 'c1', background: '#ff0000ff', elements: [] }]
		serverSave = async () => {
			presentationDoc.value = { modified: 'M2' }
			return 'M2'
		}
	})

	it('persists edits made while the server save is in flight', async () => {
		markDirty()

		serverSave = async () => {
			// the user picks a second color while the first save is still in flight
			slides.value[0].background = '#00ff00ff'
			markDirty()
			presentationDoc.value = { modified: 'M2' }
			return 'M2'
		}

		await saveCurrentState()

		const local: any = await getPresentationFromLocalDB('p1')
		expect(dirty.value).toBe(true)
		expect(local.dirty).toBe(true)
		expect(local.content[0].background).toBe('#00ff00ff')
	})

	it('records the version the server took when the editor moved on mid-save', async () => {
		markDirty()

		serverSave = async () => {
			// resetEditorState() blanks slides, then the editor loads another presentation
			slides.value = []
			markDirty()
			presentationId.value = 'p2'
			// presentationDoc belongs to p2 by now, so baseModified has to come
			// from what this save returned
			presentationDoc.value = { modified: 'M9' }
			return 'M2'
		}

		await saveCurrentState()

		const local: any = await getPresentationFromLocalDB('p1')
		// the snapshot the server took, not the blanked slides of the presentation
		// the editor moved on to
		expect(local.content).toHaveLength(1)
		expect(local.dirty).toBe(false)
		expect(local.baseModified).toBe('M2')
	})

	it('marks the local copy clean when nothing changed during the save', async () => {
		markDirty()

		await saveCurrentState()

		const local: any = await getPresentationFromLocalDB('p1')
		expect(dirty.value).toBe(false)
		expect(local.dirty).toBe(false)
		expect(local.baseModified).toBe('M2')
	})

	it('pushes the content and version it snapshotted, not what it can read back later', async () => {
		markDirty()

		let sent: any
		serverSave = async (content, baseModified) => {
			sent = { content, baseModified }
			// a rename lands between the draft write and the push
			presentationDoc.value = { modified: 'M9' }
			return 'M2'
		}

		await saveCurrentState()

		expect(sent.content[0].background).toBe('#ff0000ff')
		expect(sent.baseModified).toBe(base)
	})

	it('keeps a snapshot the server refused as stale', async () => {
		markDirty()

		serverSave = async () => {
			throw conflict()
		}

		await saveCurrentState()

		const local: any = await getPresentationFromLocalDB('p1')
		// the edits are still the only copy of the user's work; discarding them loses it
		expect(local.dirty).toBe(true)
		expect(local.content[0].background).toBe('#ff0000ff')
		expect(dirty.value).toBe(true)
		expect(saveFailed.value).toBe(true)
	})

	it('stops pushing once the server refuses this tab as stale', async () => {
		markDirty()

		let pushes = 0
		serverSave = async () => {
			pushes++
			throw conflict()
		}

		await saveCurrentState()
		// the base this tab holds never catches up on its own, so retrying it is wasted
		await saveCurrentState()
		expect(pushes).toBe(1)

		// the edits still go to the draft, they just aren't offered to the server again
		slides.value[0].background = '#00ff00ff'
		markDirty()
		await saveCurrentState()
		const local: any = await getPresentationFromLocalDB('p1')
		expect(local.content[0].background).toBe('#00ff00ff')
		expect(local.dirty).toBe(true)
		expect(pushes).toBe(1)

		// a reload, or opening another presentation, gives this tab a base the server
		// hasn't moved past, and the hold is on the refused version only
		presentationDoc.value = { modified: 'M-reloaded' }
		serverSave = async () => {
			pushes++
			return 'M-next'
		}
		markDirty()
		await saveCurrentState()
		expect(pushes).toBe(2)
	})
})
