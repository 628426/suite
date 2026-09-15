import { getRepeatMessage } from '@/apps/calendar/utils/format'

/**
 * What a listed event says about itself beyond its title.
 *
 * The phone's agenda, the desktop agenda and the day view's schedule rail all
 * show an event as a row, and a row has a second line. This is what goes on it,
 * kept in one place so the three surfaces cannot drift into describing the same
 * event three different ways.
 *
 * frappe-ui derives what it can from its own generic event shape; everything
 * here needs suite's — locations, participants, meet links, recurrence — and so
 * reaches the calendar through its `#event-description` and `#event-suffix`
 * slots.
 */

interface MetaEvent {
	locations?: Array<{ _name?: string }>
	links?: Array<{ href?: string }>
	recurrence_rule?: { frequency?: string }
	organizer?: string
	participants?: Array<{
		participation_status?: string
		email?: string
		_name?: string
		user_image?: string
	}>
}

/**
 * The second line: whatever the row can say in a few words about where the
 * event is and who else is in it — the location, else the meeting, else how
 * often it repeats. A row without any of that stays one line tall.
 */
/** Where it is: the location, else the meeting it happens in. */
export const eventPlace = (event: MetaEvent): string => {
	const place = event.locations?.find((l) => l._name)?._name
	if (place) return place
	if (event.links?.some((l) => l?.href?.includes('/meet/'))) return __('Frappe Meet')
	return ''
}

/** How often it comes round, as the formatter writes it — "Every week on Thursday". */
export const eventRepeat = (event: MetaEvent): string => {
	if (!event.recurrence_rule?.frequency) return ''
	return getRepeatMessage(event.recurrence_rule) || ''
}

const people = (event: MetaEvent) => event.participants ?? []

/**
 * How many are in it — everyone invited, whatever they answered: a row says
 * who the event is with, and the answers are the card's to show. Worth saying
 * only once it is a crowd rather than a pair. The row's far end shows this
 * unless the host replaces it with faces.
 */
export const eventPeople = (event: MetaEvent): string => {
	const count = people(event).length
	return count > 1 ? __('{0} people', [String(count)]) : ''
}

/**
 * The first few of them, for a stack of faces at the row's far end: the
 * organizer first, since theirs is the face a reader knows the event by, then
 * the rest in the order the event lists them.
 */
export const eventFaces = (event: MetaEvent, count = 3) => {
	const all = people(event)
	// Either side may carry the mailto: the server sends on an organizer.
	const address = (email?: string) => email?.replace('mailto:', '')
	const host = all.find((p) => address(p.email) === address(event.organizer))
	return [...(host ? [host] : []), ...all.filter((p) => p !== host)].slice(0, count)
}

/** How many beyond the faces shown, for the "+N" after them. */
export const eventMore = (event: MetaEvent, shown = 3) => Math.max(people(event).length - shown, 0)

/**
 * The line, in reading order: where, then how often. Not how many: that is a
 * count, and the row sets it at its far end from `participant` — see the event
 * transform in CalendarView — where the counts of a day's rows line up. The
 * desktop composes these parts around the calendar's own note about an event
 * running on past the day.
 */
export const eventDescription = (event: MetaEvent): string =>
	[eventPlace(event), eventRepeat(event)].filter(Boolean).join(' · ')
