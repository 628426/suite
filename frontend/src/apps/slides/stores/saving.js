import { ref } from 'vue'
import {
	presentationId,
	savePresentationDoc,
	presentationDoc,
	inReadonlyMode,
} from '@/apps/slides/stores/presentation'
import { slides } from '@/apps/slides/stores/slide'
import { cloneObj } from '@/apps/slides/utils/helpers'
import { DRAFTS_DB_NAME } from '@/apps/slides/utils/slidesCaches'
import { getSessionUser } from '@/boot/session'

const DB_VERSION = 1
const STORE = 'presentations'

let db = null

const openDB = () => {
	if (db) {
		return Promise.resolve(db)
	}

	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DRAFTS_DB_NAME, DB_VERSION)

		req.onupgradeneeded = () => {
			const db = req.result

			if (!db.objectStoreNames.contains(STORE)) {
				db.createObjectStore(STORE, { keyPath: 'id' })
			}
		}

		req.onsuccess = () => {
			db = req.result
			// another user taking over deletes the database, which waits on this connection
			db.onversionchange = () => {
				db.close()
				db = null
			}
			resolve(db)
		}

		req.onerror = () => {
			reject(req.error)
		}
	})
}

const savePresentationToLocalDB = async (data) => {
	const db = await openDB()

	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, 'readwrite')
		const store = tx.objectStore(STORE)

		const req = store.put(data)
		req.onerror = () => {
			reject(req.error)
		}

		tx.oncomplete = () => {
			resolve()
		}

		tx.onerror = () => {
			reject(tx.error)
		}
	})
}

let persistRequested = false

// the draft is a copy of what the editor holds; a store that refuses it must not
// stop the push, which is what gets the edits somewhere durable
const writeDraft = (record) => {
	if (!persistRequested) {
		persistRequested = true
		navigator.storage?.persist?.().catch(() => {})
	}
	return savePresentationToLocalDB(record).catch(() => {})
}

const getPresentationFromLocalDB = async (id) => {
	if (id === undefined || id === null || id === '') {
		return null
	}

	const db = await openDB()

	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, 'readonly')
		const store = tx.objectStore(STORE)

		const req = store.get(id)

		req.onsuccess = () => {
			const record = req.result
			// stamped by whoever wrote it; a record another user of this browser left is not ours
			if (record?.user && record.user !== getSessionUser()) return resolve(null)
			resolve(record)
		}

		req.onerror = () => {
			reject(req.error)
		}
	})
}

// explicit dirty flag set by every mutation path
const dirty = ref(false)

const isSaving = ref(false)

// what the gate turned away, per presentation: a push that lands after the editor
// left takes over from here, since nothing else will push that presentation again
const queuedSnapshots = new Map()

// bumped on every markDirty so a save can tell if edits arrived while it was in flight;
// per presentation, since loading one marks it dirty and must not disturb another's save
const dirtyGenerations = new Map()

const generationFor = (id) => dirtyGenerations.get(id) ?? 0

const markDirty = () => {
	dirty.value = true
	const id = presentationId.value
	if (id) dirtyGenerations.set(id, generationFor(id) + 1)
}

const markClean = () => {
	dirty.value = false
	// a save in flight still has a generation to compare against, so leave it alone
	if (!isSaving.value) dirtyGenerations.delete(presentationId.value)
}

// true when an online save to the server failed; drives the "Not saved" indicator
const saveFailed = ref(false)

// the base version the server refused: pushing it again fails the same way however long
// we wait, so it is held until a reload or another presentation gives this tab a newer one
let refusedBase = null

const syncSnapshotToServer = async (snapshot, id, generation) => {
	// the version this save produced, read from its own response: presentationDoc
	// may already point at another presentation by the time it resolves
	const savedModified = await savePresentationDoc(
		snapshot.id,
		snapshot.content,
		snapshot.baseModified,
	)

	if (presentationId.value !== id) {
		// an edit made mid-save was queued as the editor left; it was built on what the
		// server just took, so it goes out on that base, stamped into the draft first so
		// a push that never lands still leaves the draft current for its next load
		const tail = queuedSnapshots.get(id)
		queuedSnapshots.delete(id)
		if (tail) {
			const next = { ...tail, baseModified: savedModified }
			await writeDraft(next)
			return syncSnapshotToServer(next, id, generationFor(id))
		}
		// slides.value belongs to another presentation now and can't be read back;
		// the server has this snapshot
		await writeDraft({
			...snapshot,
			dirty: false,
			updatedAt: Date.now(),
			baseModified: savedModified,
		})
		dirtyGenerations.delete(id)
		return
	}

	// an edit made mid-save isn't in the snapshot the server just took, so the
	// local copy has to keep it and stay dirty; baseModified tracks the server version
	const editedDuringSave = generationFor(id) !== generation
	queuedSnapshots.delete(id)

	await writeDraft({
		...snapshot,
		content: editedDuringSave ? getLatestSlideContent() : snapshot.content,
		dirty: editedDuringSave,
		updatedAt: Date.now(),
		baseModified: savedModified,
	})
}

const getLatestSlideContent = () => {
	const latestContent = slides.value
	return cloneObj(latestContent)
}

// the snapshot is pushed as held, never read back: another tab editing the same
// presentation shares this record and would hand us its content to send as ours
const takeSnapshot = () => {
	if (inReadonlyMode.value) return null
	if (!slides.value?.length || !presentationId.value) return null

	return {
		id: presentationId.value,
		user: getSessionUser(),
		content: getLatestSlideContent(),
		updatedAt: Date.now(),
		dirty: true,
		baseModified: presentationDoc.value?.modified,
	}
}

// the local copy alone, for when the edits must not go out yet
const saveDraft = async () => {
	const snapshot = takeSnapshot()
	if (snapshot) await writeDraft(snapshot)
}

const saveCurrentState = async () => {
	const snapshot = takeSnapshot()
	if (!snapshot) return

	const idAtSnapshot = snapshot.id
	const generationAtSnapshot = generationFor(idAtSnapshot)
	const baseAtSnapshot = snapshot.baseModified

	// written before the gate, so the draft follows the edits while a push is stuck
	await writeDraft(snapshot)

	if (isSaving.value) {
		queuedSnapshots.set(idAtSnapshot, snapshot)
		return
	}
	// if offline, stay dirty so we retry once back online
	if (!navigator.onLine) return
	if (baseAtSnapshot === refusedBase) return

	isSaving.value = true

	try {
		// only mark clean once the server actually has the changes,
		// and only if no edit arrived while this save was in flight
		await syncSnapshotToServer(snapshot, idAtSnapshot, generationAtSnapshot)
		saveFailed.value = false

		// dirty belongs to another presentation now, so it isn't ours to clear
		if (presentationId.value !== idAtSnapshot) return
		if (generationFor(idAtSnapshot) === generationAtSnapshot) markClean()
	} catch (err) {
		// keep dirty so autosave retries and beforeunload warns; log once per outage
		if (!saveFailed.value) console.error('Save failed: ', err)
		saveFailed.value = true
		if (err?.exc_type === 'TimestampMismatchError') refusedBase = baseAtSnapshot
	} finally {
		isSaving.value = false
	}
}

const saveChanges = async () => {
	if (!dirty.value) return
	await saveCurrentState()
}

// a text element kept focused, or a drag kept going, holds the push back; past this
// the draft is written anyway so a closed tab does not take the edits with it
const VALVE_MS = 10_000
let gatedSince = null

const autosave = (gated) => {
	if (!gated || !dirty.value) {
		gatedSince = null
		return saveChanges()
	}
	gatedSince ??= Date.now()
	if (Date.now() - gatedSince > VALVE_MS) return saveDraft()
}

export {
	saveCurrentState,
	saveChanges,
	saveDraft,
	autosave,
	isSaving,
	dirty,
	markDirty,
	markClean,
	saveFailed,
	getPresentationFromLocalDB,
}
