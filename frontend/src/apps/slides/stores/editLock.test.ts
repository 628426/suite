import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const abortError = () => Object.assign(new Error('stolen'), { name: 'AbortError' })

// the browser's lock manager: a plain request waits, ifAvailable gets null, steal evicts the holder
const makeLockManager = () => {
	const held = new Map<string, { steal: (err: Error) => void; done: Promise<void> }>()
	return {
		request: async (name: string, options: any, callback: (lock: any) => any) => {
			await Promise.resolve()
			const current = held.get(name)
			if (current) {
				if (options.steal) current.steal(abortError())
				else if (options.ifAvailable) return callback(null)
				else await current.done
			}
			let steal: (err: Error) => void = () => {}
			const lost = new Promise<never>((_, reject) => (steal = reject))
			const done = Promise.resolve(callback({ name })).then(() => {})
			const entry = { steal, done: Promise.race([done, lost]).catch(() => {}) }
			held.set(name, entry)
			entry.done.then(() => {
				if (held.get(name) === entry) held.delete(name)
			})
			return Promise.race([done, lost])
		},
	}
}

const { lockedElsewhere, acquireEditLock, releaseEditLock } = await import('./editLock')

const settle = () => new Promise((resolve) => setTimeout(resolve))

describe('acquireEditLock', () => {
	let locks: ReturnType<typeof makeLockManager>
	const otherTab = (id: string, options = {}) => {
		let release: () => void = () => {}
		const held = locks.request(
			`presentation-${id}`,
			options,
			() => new Promise<void>((resolve) => (release = resolve)),
		)
		held.catch(() => {})
		return { release: () => release(), held }
	}

	beforeEach(() => {
		locks = makeLockManager()
		Object.defineProperty(navigator, 'locks', { value: locks, configurable: true })
	})

	afterEach(async () => {
		releaseEditLock()
		await settle()
	})

	it('leaves a second tab read-only', async () => {
		otherTab('p1')
		await settle()

		expect(await acquireEditLock('p1')).toBe(false)
		expect(lockedElsewhere.value).toBe(true)
	})

	it('takes over from the holding tab', async () => {
		const other = otherTab('p1')
		await settle()

		expect(await acquireEditLock('p1', undefined, { steal: true })).toBe(true)
		expect(lockedElsewhere.value).toBe(false)
		await expect(other.held).rejects.toMatchObject({ name: 'AbortError' })
	})

	it('reports the lock lost before it reads as locked out', async () => {
		// the editor writes its last edits to the draft from onLost, and a locked-out tab writes nothing
		const onLost = vi.fn(() => lockedElsewhere.value)
		await acquireEditLock('p1', onLost)

		otherTab('p1', { steal: true })
		await settle()

		expect(onLost).toHaveReturnedWith(false)
		expect(lockedElsewhere.value).toBe(true)
	})

	it('holds nothing when the editor moved on before the grant', async () => {
		const pending = acquireEditLock('p1')
		releaseEditLock()
		expect(await pending).toBe(false)
		await settle()

		otherTab('p1')
		await settle()
		expect(await acquireEditLock('p1')).toBe(false)
	})

	it('edits normally when the editor asks twice in one tick', async () => {
		// a keep-alive re-entry fires the route and the props watcher together
		acquireEditLock('p1')
		expect(await acquireEditLock('p1')).toBe(true)
		expect(lockedElsewhere.value).toBe(false)
	})

	it('edits normally when the manager refuses the request outright', async () => {
		// a document that is not fully active, or a partitioned frame, rejects before any grant
		locks.request = async () => {
			throw Object.assign(new Error('not active'), { name: 'InvalidStateError' })
		}
		expect(await acquireEditLock('p1')).toBe(true)
	})
})
