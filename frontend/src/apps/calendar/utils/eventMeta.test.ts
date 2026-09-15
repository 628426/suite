import { describe, expect, it, vi } from 'vitest'

import { eventDescription, eventFaces, eventMore, eventPeople } from './eventMeta'

// The formatter calls the global `__()` the translation boot installs at app start.
vi.stubGlobal('__', (text: string, args?: string[]) =>
	args ? text.replace('{0}', args[0]!) : text,
)

describe('eventDescription', () => {
	it('says nothing about an event with nowhere to be', () => {
		expect(eventDescription({})).toBe('')
	})

	it('prefers the location to the meeting link', () => {
		expect(
			eventDescription({
				locations: [{ _name: 'Hall 2' }],
				links: [{ href: 'https://example.com/meet/abc' }],
			}),
		).toBe('Hall 2')
	})

	it('falls back to the meeting when there is no location', () => {
		expect(
			eventDescription({ links: [{ href: 'https://example.com/meet/abc' }] }),
		).toBe('Frappe Meet')
	})

	it('adds how often it repeats, as the formatter writes it', () => {
		const line = eventDescription({
			locations: [{ _name: 'Hall 2' }],
			recurrence_rule: { frequency: 'weekly' },
		})
		expect(line.startsWith('Hall 2 · Every ')).toBe(true)
	})

	// The count stands at the row's far end, not on this line.
	it('leaves who is coming to the count', () => {
		expect(
			eventDescription({
				locations: [{ _name: 'Hall 2' }],
				participants: Array.from({ length: 14 }, () => ({
					participation_status: 'ACCEPTED',
				})),
			}),
		).toBe('Hall 2')
	})
})

describe('eventPeople', () => {
	// One other person is not worth counting out loud; a crowd is.
	it('counts the crowd, but only once there is one', () => {
		const of = (n: number) => ({
			participants: Array.from({ length: n }, () => ({ participation_status: 'ACCEPTED' })),
		})
		expect(eventPeople(of(1))).toBe('')
		expect(eventPeople(of(14))).toBe('14 people')
	})

	it('counts everyone invited, whatever they answered', () => {
		expect(
			eventPeople({
				participants: [
					{ participation_status: 'ACCEPTED' },
					{ participation_status: 'NEEDS-ACTION' },
					{ participation_status: 'DECLINED' },
				],
			}),
		).toBe('3 people')
	})
})

describe('eventFaces', () => {
	const one = (email: string, status = 'ACCEPTED') => ({ email, participation_status: status })

	it('leads with the organizer and stops at three', () => {
		const faces = eventFaces({
			organizer: 'mailto:host@x.io',
			participants: [one('a@x.io'), one('b@x.io'), one('host@x.io'), one('c@x.io')],
		})
		expect(faces.map((p) => p.email)).toEqual(['host@x.io', 'a@x.io', 'b@x.io'])
	})

	it('shows a face whatever the answer', () => {
		const faces = eventFaces({
			organizer: 'host@x.io',
			participants: [one('host@x.io', 'DECLINED'), one('a@x.io', 'NEEDS-ACTION')],
		})
		expect(faces.map((p) => p.email)).toEqual(['host@x.io', 'a@x.io'])
	})
})

describe('eventMore', () => {
	const of = (n: number) => ({
		participants: Array.from({ length: n }, (_, i) => ({ email: `${i}@x.io` })),
	})

	it('counts only past the faces on show', () => {
		expect(eventMore(of(2))).toBe(0)
		expect(eventMore(of(3))).toBe(0)
		expect(eventMore(of(14))).toBe(11)
	})
})
