import { ref } from 'vue'

// another tab of this browser holds the presentation open for editing
const lockedElsewhere = ref(false)

let heldId = null
let releaseHeld = () => {}
let requests = 0

// one request at a time: a second one in the same tick would find this tab's own grant
let lastRequest = Promise.resolve()

const lockName = (id) => `presentation-${id}`

const releaseEditLock = () => {
	requests++
	heldId = null
	lockedElsewhere.value = false
	releaseHeld()
}

// resolves true once this tab may write; onLost fires if another tab takes the lock over
const acquireEditLock = (id, onLost, { steal = false } = {}) => {
	if (!navigator.locks) {
		console.warn('Web Locks unavailable: another tab may edit this presentation too')
		return Promise.resolve(true)
	}
	if (heldId === id) return Promise.resolve(true)
	releaseEditLock()
	const request = requests
	const options = steal ? { steal: true } : { ifAvailable: true }

	return new Promise((resolve) => {
		lastRequest = lastRequest
			.then(() =>
				navigator.locks.request(lockName(id), options, (lock) => {
					// the editor moved on before the grant arrived; returning releases it
					if (request !== requests) return resolve(false)
					if (!lock) {
						lockedElsewhere.value = true
						return resolve(false)
					}
					heldId = id
					lockedElsewhere.value = false
					resolve(true)
					return new Promise((done) => (releaseHeld = done))
				}),
			)
			.catch(() => {
				if (request !== requests) return resolve(false)
				// refused before any grant: edit without the lock
				if (heldId !== id) return resolve(true)
				// a granted lock only rejects when another tab steals it
				heldId = null
				onLost?.()
				lockedElsewhere.value = true
			})
	})
}

export { lockedElsewhere, acquireEditLock, releaseEditLock }
