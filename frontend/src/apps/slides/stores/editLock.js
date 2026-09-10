import { ref } from 'vue'

// another tab of this browser holds the presentation open for editing
const lockedElsewhere = ref(false)

let heldId = null
let releaseHeld = () => {}
let requests = 0

// one request at a time: the manager holds a grant from the moment it is made, so a
// second request sent in the same tick finds the lock taken by this tab's own first one
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
	if (!navigator.locks) return Promise.resolve(true)
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
				// a granted lock only rejects when another tab steals it
				if (request !== requests || heldId !== id) return
				heldId = null
				// the editor writes its last edits to the draft first, while it may still write
				onLost?.()
				lockedElsewhere.value = true
			})
	})
}

export { lockedElsewhere, acquireEditLock, releaseEditLock }
