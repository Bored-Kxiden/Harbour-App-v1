export type Tone = 'green' | 'gold' | 'orange' | 'sky'
export type Person = { id: string; name: string; initials: string; tone: Tone; photoId?: string; note?: string }

export type Resolution = 'called' | 'reacted' | 'proposed_later' | 'message' | 'dismissed' | 'played'
export type Feeling = 'light' | 'warm' | 'steady' | 'tender'
export type Moment = {
 id: string; at: string; person: string; kind: Resolution; text: string
 source: 'manual' | 'walking_stop' | 'note' | 'game'
 proposedTime?: string; feedback?: 'good' | 'bad'; reminderDone?: boolean; cueId?: string
 minutes?: number; feeling?: Feeling; flower?: FlowerKind; topic?: string
}

/** A message carries text. When it started as a voice note it carries the recording
    too, and the text is the transcript the sender read back and kept or corrected. */
export type ChatMessage = { id: string; text: string; mine: boolean; at: string; liked?: boolean; voice?: VoiceClip }
export type VoiceClip = { mediaId?: string; seconds: number; edited?: boolean }
/** A block of time somebody is busy. The label is what they are doing; only they ever see it. */
export type Interval = { start: string; end: string; label?: string; linked?: boolean }
export type CalendarLink = { provider: CalendarProvider; connectedAt: string }
export type CalendarProvider = 'outlook' | 'google' | 'apple'
export const calendarProviders: { id: CalendarProvider; name: string }[] = [
 { id: 'outlook', name: 'Outlook' }, { id: 'google', name: 'Google Calendar' }, { id: 'apple', name: 'Apple Calendar' },
]
/** Two kinds of note, and the difference is who else can read it.
    A personal note travels between exactly two people and shows on that person's card
    in Your people. A shared note goes out to everyone you have added, and lives on the
    rail under A little something. Nothing turns one into the other. */
export type NoteScope = 'personal' | 'shared'
export type Note = { id: string; at: string; person: string; text: string; scope: NoteScope; flower?: FlowerKind }

/** A seed: a note a parent plants now for a flower that opens later. The child is
    never told when it will open, which is the whole point of it being a seed rather
    than a message. Once it blooms it reads as a personal note from that person,
    which is the only shape the other side ever needs to understand. */
export type Seed = {
 id: string; person: string; from: string
 at: string; bloomAt: string
 flower: FlowerKind; text: string
}
export type GrowthPhase = 'seed' | 'sprout' | 'growing' | 'bloom'
export const growthPhases: { id: GrowthPhase; label: string }[] = [
 { id: 'seed', label: 'Seed' }, { id: 'sprout', label: 'Sprout' },
 { id: 'growing', label: 'Growing' }, { id: 'bloom', label: 'Bloom' },
]
/** How far along a seed is, from the time it was planted to the time it opens. */
export function seedProgress(seed: Seed, now = Date.now()) {
 const from = Date.parse(seed.at), to = Date.parse(seed.bloomAt)
 if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return 1
 return Math.min(1, Math.max(0, (now - from) / (to - from)))
}
export function seedPhase(seed: Seed, now = Date.now()): GrowthPhase {
 const p = seedProgress(seed, now)
 return p >= 1 ? 'bloom' : p >= 0.66 ? 'growing' : p >= 0.33 ? 'sprout' : 'seed'
}
export function hasBloomed(seed: Seed, now = Date.now()) { return seedProgress(seed, now) >= 1 }
/** Seeds you planted that are still on their way. */
export function growingSeeds(state: HarborState, now = Date.now()) {
 return state.seeds.filter(s => s.from === 'you' && !hasBloomed(s, now)).sort((a, b) => a.bloomAt.localeCompare(b.bloomAt))
}

/** Something one of your people told you they are doing. Not your calendar, theirs:
    it arrives in your notifications and you can star it to keep it. */
export type Plan = { id: string; person: string; day: string; start: string; end: string; label: string }

/** An instant: one picture, taken now rather than chosen. Kept only if someone keeps it. */
export type Snap = { id: string; at: string; person: string; mediaId?: string; caption?: string; prompted?: boolean; promptDay?: string; saved?: boolean; simulated?: boolean }
/** A snap window only exists between two people who both said yes, and either can end it. */
export type SnapPact = { personId: string; status: 'invited' | 'active'; since: string }

export type Weather = 'clear' | 'bright' | 'cloudy' | 'rain' | 'storm'
export type Theme = 'system' | 'light' | 'dark'
export const themes: { id: Theme; label: string }[] = [
 { id: 'system', label: 'Auto' },
 { id: 'light', label: 'Day' },
 { id: 'dark', label: 'Dusk' },
]
export type FlowerKind = 'daisy' | 'tulip' | 'poppy' | 'cosmos' | 'marigold' | 'bluebell' | 'aster' | 'sunflower'

/** Who is holding the phone. A parent gets a shorter app: the people they care about,
    two ways to reach each one, and nothing else competing for the tap. A student gets
    the full set, because they are the one juggling a timetable. */
export type Mode = 'student' | 'parent'
export type PuzzleId = 'sudoku' | 'zip' | 'tango'
/** One solved puzzle. Only finished ones are recorded, so a row is always a win. */
export type PuzzleResult = { day: string; puzzle: PuzzleId; seconds: number; at: string }

/** One day, keyed by whose time it is: 'you', and one key per person you added.
    A day used to hold exactly two lists, yours and everybody else's, which meant
    three people at home shared one row and nobody could tell whose evening was
    taken. Keyed by person, the same block a parent marks on their own day is the
    block their child reads on that parent's card. */
export type DaySchedule = Record<string, Interval[]>

export type HarborState = {
 version: 7; name: string
 mode: Mode; setupDone: boolean
 /** Which sides of the phone have already been walked through once. The two modes
     are different enough to be different apps, so each gets its own first run. */
 toursSeen: Mode[]
 puzzles: PuzzleResult[]
 /** The code someone else types in to join you, and who has used it. */
 invite: { code: string; joined: string[] }
 people: Person[]
 sharing: boolean; momConsent: boolean; sharingSetupDone: boolean
 schedules: Record<string, DaySchedule>; calendar: CalendarLink | null
 /** Your own weather, and what each of your people last said theirs was. A parent
     never sets a weather of their own: the sky over their field is their child's. */
 weather: Weather; peopleWeather: Record<string, Weather>; watching: string
 milestone: { title: string; date: string }
 messages: Record<string, ChatMessage[]>; read: string[]; drafts: Record<string, string>
 moments: Moment[]; cues: { id: string; at: string }[]
 notes: Note[]; games: Record<string, string>
 /** Notes planted to open later. A bloomed one reads as a personal note. */
 seeds: Seed[]
 /** Their plans, and the handful of things you chose to keep an eye on. */
 plans: Plan[]; starred: string[]; seenAlerts: string
 snaps: Snap[]; pacts: SnapPact[]; snapWindows: Record<string, string>
 settings: { cuesEnabled: boolean; walkingMinutes: number; dailyCap: number; cooldownMinutes: number; sound: 'chime' | 'soft' | 'silent'; reducedMotion: boolean; theme: Theme }
}

/* ---------- how life feels, read as weather: a scale, not a score ---------- */
export const weathers: { id: Weather; label: string; caption: string }[] = [
 { id: 'clear', label: 'Clear', caption: 'Room to breathe. Nothing pressing.' },
 { id: 'bright', label: 'Bright', caption: 'Good and busy. The kind you chose.' },
 { id: 'cloudy', label: 'Cloudy', caption: 'A little grey around the edges.' },
 { id: 'rain', label: 'Rain', caption: 'Heavy going. Steady, but heavy.' },
 { id: 'storm', label: 'Storm', caption: 'Too much at once. This passes.' },
]
export function weatherIndex(value: Weather) { const i = weathers.findIndex(w => w.id === value); return i < 0 ? 0 : i }

/* ---------- the flower library: what a call becomes ---------- */
export type FlowerSpec = { id: FlowerKind; name: string; note: string; petal: string; petalDeep: string; heart: string; petals: number; shape: 'round' | 'point' | 'cup' }
export const flowerLibrary: FlowerSpec[] = [
 { id: 'daisy', name: 'Daisy', note: 'An ordinary, easy call.', petal: '#FFFFFF', petalDeep: '#F0F3E6', heart: '#F7C948', petals: 9, shape: 'round' },
 { id: 'marigold', name: 'Marigold', note: 'Warm, a little loud, full of news.', petal: '#F9C46A', petalDeep: '#EDA63F', heart: '#9A6526', petals: 11, shape: 'round' },
 { id: 'cosmos', name: 'Cosmos', note: 'Light and drifting. No agenda.', petal: '#F7C3D8', petalDeep: '#E9A0BF', heart: '#F7C948', petals: 7, shape: 'round' },
 { id: 'poppy', name: 'Poppy', note: 'Something honest got said.', petal: '#F08C79', petalDeep: '#DC6C58', heart: '#5E3F33', petals: 5, shape: 'cup' },
 { id: 'tulip', name: 'Tulip', note: 'Short, and enough.', petal: '#F3A0B6', petalDeep: '#DE7F99', heart: '#DE7F99', petals: 4, shape: 'cup' },
 { id: 'bluebell', name: 'Bluebell', note: 'Quiet. Mostly listening.', petal: '#A9C4EC', petalDeep: '#88A6DA', heart: '#6E86BE', petals: 5, shape: 'point' },
 { id: 'aster', name: 'Aster', note: 'Tangled, then untangled.', petal: '#C9AEE9', petalDeep: '#AC8CD6', heart: '#F7C948', petals: 13, shape: 'point' },
 { id: 'sunflower', name: 'Sunflower', note: 'The long, good kind.', petal: '#F7D35E', petalDeep: '#E2B733', heart: '#8A6230', petals: 14, shape: 'point' },
]
export function flowerSpec(kind: FlowerKind | undefined): FlowerSpec { return flowerLibrary.find(f => f.id === kind) ?? flowerLibrary[0] }

export const feelings: { id: Feeling; label: string; caption: string; flower: FlowerKind }[] = [
 { id: 'light', label: 'Lighter', caption: 'Something lifted.', flower: 'cosmos' },
 { id: 'warm', label: 'Warm', caption: 'Glad you picked up.', flower: 'marigold' },
 { id: 'steady', label: 'Steady', caption: 'Ordinary, in a good way.', flower: 'daisy' },
 { id: 'tender', label: 'Tender', caption: 'A lot, but worth it.', flower: 'poppy' },
]

/* ---------- topic shapes: the sender sets the shape before a call happens ---------- */
export const topics = ['Catch up', 'Ask for help', 'Share news', 'Just because']

export function localDay(date: Date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
export function minutes(value: string) { const [h, m] = value.split(':').map(Number); return h * 60 + m }
export function validIntervals(values: Interval[]) {
 if (!Array.isArray(values) || values.length > 40) return false
 return values.every(v => v && /^([01]\d|2[0-3]):[0-5]\d$/.test(v.start) && /^([01]\d|2[0-3]):[0-5]\d$/.test(v.end) && minutes(v.start) < minutes(v.end)
  && (v.label === undefined || (typeof v.label === 'string' && v.label.length <= 60)))
}

/* ---------- busy in, free out ----------
   Blocks are what somebody is doing. What matters to the other person is the gaps
   between them, so free time is worked out rather than entered. */
export const DAY_OPEN = '07:00'
export const DAY_CLOSE = '22:00'
export function freeWindows(busy: Interval[], open = DAY_OPEN, close = DAY_CLOSE): Interval[] {
 const sorted = busy.slice().sort((a, b) => minutes(a.start) - minutes(b.start))
 const out: Interval[] = []
 let cursor = minutes(open)
 const end = minutes(close)
 for (const block of sorted) {
  const from = Math.max(minutes(block.start), minutes(open)), to = Math.min(minutes(block.end), end)
  if (to <= cursor) continue
  if (from > cursor) out.push({ start: clockOf(cursor), end: clockOf(Math.min(from, end)) })
  cursor = Math.max(cursor, to)
  if (cursor >= end) break
 }
 if (cursor < end) out.push({ start: clockOf(cursor), end: clockOf(end) })
 return out.filter(v => minutes(v.end) - minutes(v.start) >= 20)
}
export function clockOf(total: number) { return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}` }
/** Whose time it is. 'you' is your own day; anything else is a person's id. */
export function blocksFor(state: HarborState, day: string, who: string) { return state.schedules[day]?.[who] ?? [] }
export function setBlocks(state: HarborState, day: string, who: string, blocks: Interval[]): HarborState {
 const sorted = blocks.slice().sort((a, b) => minutes(a.start) - minutes(b.start))
 return { ...state, schedules: { ...state.schedules, [day]: { ...(state.schedules[day] ?? {}), [who]: sorted } } }
}

/** A week of seven day keys, Monday first, around whatever day you are looking at. */
export function weekOf(day: string) {
 const base = new Date(`${day}T12:00:00`)
 const shift = (base.getDay() + 6) % 7
 base.setDate(base.getDate() - shift)
 return Array.from({ length: 7 }, (_, i) => { const d = new Date(base); d.setDate(d.getDate() + i); return localDay(d) })
}

/** What a connected calendar would drop in: a week of plausible, already-labelled blocks. */
export function linkedWeek(day: string): Record<string, Interval[]> {
 const template: Interval[][] = [
  [{ start: '09:00', end: '11:00', label: 'Design studio' }, { start: '14:00', end: '15:30', label: 'Seminar' }],
  [{ start: '10:00', end: '12:30', label: 'Lab' }, { start: '18:00', end: '19:00', label: 'Swim' }],
  [{ start: '09:00', end: '10:30', label: 'Lecture' }, { start: '13:00', end: '17:00', label: 'Shift at the cafe' }],
  [{ start: '11:00', end: '13:00', label: 'Studio crit' }],
  [{ start: '09:30', end: '11:00', label: 'Lecture' }, { start: '16:00', end: '18:30', label: 'Group project' }],
  [{ start: '12:00', end: '14:00', label: 'Groceries and laundry' }],
  [{ start: '19:00', end: '20:30', label: 'Dinner with friends' }],
 ]
 return Object.fromEntries(weekOf(day).map((key, i) => [key, template[i].map(v => ({ ...v, linked: true }))]))
}
export function overlaps(a: Interval[], b: Interval[]): Interval[] {
 const raw = a.flatMap(x => b.flatMap(y => {
  const start = x.start > y.start ? x.start : y.start; const end = x.end < y.end ? x.end : y.end
  return start < end ? [{ start, end }] : []
 })).sort((x, y) => x.start.localeCompare(y.start))
 return raw.reduce<Interval[]>((out, value) => { const last = out.at(-1); if (last && value.start <= last.end) last.end = last.end > value.end ? last.end : value.end; else out.push({ ...value }); return out }, [])
}
export function formatTime(value: string) { const m = minutes(value); return `${Math.floor(m / 60) % 12 || 12}:${String(m % 60).padStart(2, '0')} ${m >= 720 ? 'pm' : 'am'}` }
/** The quiet ground between two busy days: only ever computed when both people opted in.
    Without a name it answers for whoever is first in your people, which is the one
    the "you are both free" line on Share my load is about. */
export function sharedWindows(state: HarborState, day: string, personId = state.people[0]?.id) {
 if (!state.sharing || !state.momConsent || !personId) return []
 const mine = blocksFor(state, day, 'you'), theirs = blocksFor(state, day, personId)
 if (!mine.length && !theirs.length) return []
 return overlaps(freeWindows(mine), freeWindows(theirs)).filter(v => minutes(v.end) - minutes(v.start) >= 20)
}
export function isFuture(value: string, now = new Date()) { const t = new Date(value).getTime(); return Number.isFinite(t) && t > now.getTime() }
export function personOf(state: HarborState, id: string) { return state.people.find(p => p.id === id) }
export function initialsOf(name: string) { return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '·' }

/* ---------- notes, by who can read them ----------
   Personal notes are between two people and nobody else. Shared notes go to everyone
   you have added. Keeping the two apart is the whole point, so they are never mixed
   in one list and never queried without saying which kind you mean. */
export function sharedNotes(state: HarborState) {
 return state.notes.filter(n => n.scope === 'shared').slice().sort((a, b) => b.at.localeCompare(a.at))
}
export function personalNotes(state: HarborState, personId?: string, now = Date.now()) {
 /* A seed somebody planted for you is a personal note that simply had not arrived
    yet. Once it opens it joins the list, dated by the moment it opened rather than
    the moment it was planted, and carrying the flower that came with it. Nothing
    else in the app has to know seeds exist. */
 const bloomed: Note[] = state.seeds
  .filter(seed => seed.from !== 'you' && hasBloomed(seed, now) && (!personId || seed.person === personId))
  .map(seed => ({ id: `seed-${seed.id}`, at: seed.bloomAt, person: seed.person, text: seed.text, scope: 'personal' as const, flower: seed.flower }))
 return [...state.notes.filter(n => n.scope === 'personal' && (!personId || n.person === personId)), ...bloomed]
  .sort((a, b) => b.at.localeCompare(a.at))
}
/** The most recent thing this person left for you alone. What their card shows. */
export function latestPersonalNote(state: HarborState, personId: string) { return personalNotes(state, personId)[0] }

/* ---------- what your people are up to, and what you kept ----------
   Two feeds behind the bell. The first is theirs: plans they shared, notes they left,
   pictures they caught. The second is yours: the things you starred, from their week
   or from your own, so the ones that matter are not buried in a calendar. */
export type Alert = { id: string; at: string; person: string; kind: 'seed' | 'plan' | 'instant' | 'note'; title: string; body: string }

export function plansFor(state: HarborState, personId?: string) {
 return state.plans
  .filter(p => (!personId || p.person === personId) && state.people.some(x => x.id === p.person))
  .slice().sort((a, b) => (a.day + a.start).localeCompare(b.day + b.start))
}
/** A plan's own moment in time, so it can be sorted against notes and pictures. */
export function planAt(plan: Plan) { return `${plan.day}T${plan.start}:00` }

export function sharedAlerts(state: HarborState): Alert[] {
 const name = (id: string) => state.people.find(p => p.id === id)?.name ?? 'They'
 const out: Alert[] = []
 for (const note of personalNotes(state)) out.push({
  id: `seed-${note.id}`, at: note.at, person: note.person, kind: 'seed',
  title: `${name(note.person)} left you a note`,
  body: note.text,
 })
 for (const plan of plansFor(state)) out.push({
  id: `plan-${plan.id}`, at: planAt(plan), person: plan.person, kind: 'plan',
  title: `${name(plan.person)} shared their plans`,
  body: `${plan.label}, ${formatTime(plan.start)} to ${formatTime(plan.end)}`,
 })
 for (const snap of state.snaps.filter(s => s.person !== 'you')) out.push({
  id: `instant-${snap.id}`, at: snap.at, person: snap.person, kind: 'instant',
  title: `${name(snap.person)} sent a photo`,
  body: snap.caption ?? 'A picture of whatever they were doing.',
 })
 for (const note of sharedNotes(state).filter(n => n.person !== 'you')) out.push({
  id: `note-${note.id}`, at: note.at, person: note.person, kind: 'note',
  title: `${name(note.person)} posted to everyone`,
  body: note.text,
 })
 return out.sort((a, b) => b.at.localeCompare(a.at))
}

/** Everything somebody has today, whether they marked it on their own day or said it
    out loud as a plan. Both are the same thing to the person reading it. */
export function personDay(state: HarborState, personId: string, day = localDay()): Interval[] {
 const blocks = blocksFor(state, day, personId).map(b => ({ start: b.start, end: b.end, label: b.label }))
 const said = state.plans.filter(p => p.person === personId && p.day === day).map(p => ({ start: p.start, end: p.end, label: p.label }))
 const all = [...blocks, ...said].sort((a, b) => minutes(a.start) - minutes(b.start))
 /* The same hour can arrive twice: marked on their calendar and mentioned as a plan.
    Show it once, keeping whichever label came with it. */
 return all.filter((v, i) => i === 0 || v.start !== all[i - 1].start || v.end !== all[i - 1].end)
}
/** Free or busy, right now, from what they chose to share. The one thing anybody
    wants before dialling: is this a bad moment? */
export function personStatus(state: HarborState, personId: string, now = new Date()) {
 const clock = now.getHours() * 60 + now.getMinutes()
 const today = personDay(state, personId, localDay(now))
 const busy = today.find(p => minutes(p.start) <= clock && clock < minutes(p.end))
 if (busy) return { busy: true, label: `Busy until ${formatTime(busy.end)}`, detail: busy.label ?? 'Something on' }
 const next = today.find(p => minutes(p.start) > clock)
 if (next) return { busy: false, label: `Free until ${formatTime(next.start)}`, detail: next.label ? `then ${next.label.toLowerCase()}` : 'then something on' }
 return { busy: false, label: 'Free now', detail: 'Nothing shared for the rest of today' }
}

/* ---------- how they are, read off their own weather ----------
   A parent does not set a weather. The sky over their field is their child's, which
   is the only reading of it that means anything: you open the app and you can see
   at a glance what kind of week the person you are missing is having. */
export function weatherOf(state: HarborState, personId: string): Weather { return state.peopleWeather[personId] ?? 'clear' }
/** Whose weather the field is showing: yours if you are the one living it, and
    otherwise the person you are watching. */
export function fieldWeather(state: HarborState): Weather {
 if (state.mode !== 'parent') return state.weather
 return weatherOf(state, watchedPerson(state))
}
export function watchedPerson(state: HarborState) {
 return state.people.some(p => p.id === state.watching) ? state.watching : state.people[0]?.id ?? ''
}
export function unseenAlerts(state: HarborState) {
 return sharedAlerts(state).filter(a => a.at > (state.seenAlerts || '')).length
}

/** One stable name for a starred thing, whether it came from their week or yours. */
export const planStar = (plan: Plan) => `plan:${plan.id}`
export const blockStar = (day: string, block: Interval) => `mine:${day}:${block.start}:${block.end}`
export function isStarred(state: HarborState, key: string) { return state.starred.includes(key) }
/** Every starred thing, resolved back into something showable, soonest first. */
export function starredItems(state: HarborState) {
 const out: { key: string; person: string; day: string; start: string; end: string; label: string }[] = []
 for (const plan of plansFor(state)) {
  if (state.starred.includes(planStar(plan))) out.push({ key: planStar(plan), person: plan.person, day: plan.day, start: plan.start, end: plan.end, label: plan.label })
 }
 for (const [day, entries] of Object.entries(state.schedules)) {
  for (const block of entries.you ?? []) {
   const key = blockStar(day, block)
   if (state.starred.includes(key)) out.push({ key, person: 'you', day, start: block.start, end: block.end, label: block.label || 'Busy' })
  }
 }
 return out.sort((a, b) => (a.day + a.start).localeCompare(b.day + b.start))
}

/* ---------- calls, and what they grow into ---------- */
export function callsFor(state: HarborState, personId: string) { return state.moments.filter(m => m.kind === 'called' && m.person === personId && m.flower) }
export function usualCallMinutes(state: HarborState, personId: string) {
 const lengths = callsFor(state, personId).map(m => m.minutes).filter((n): n is number => Number.isFinite(n))
 if (!lengths.length) return null
 return Math.max(1, Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length))
}
export function dominantFlower(state: HarborState, personId: string): FlowerKind | null {
 const counts = new Map<FlowerKind, number>()
 for (const m of callsFor(state, personId)) counts.set(m.flower!, (counts.get(m.flower!) ?? 0) + 1)
 let best: FlowerKind | null = null; let top = 0
 for (const [kind, n] of counts) if (n > top) { top = n; best = kind }
 return best
}
/* ---------- the flower that shows how the calling itself is going ----------
   Not any one person's flower, the household's. Called today, and often lately,
   and it stands fully open; go quiet for a while and it wilts, sheds, dies back.
   The same six stages a real cut flower goes through, so no calling ever needed
   an explanation of what "withering" means. */
export type GrowthStage = 'bud' | 'blooming' | 'full' | 'withering' | 'shedding' | 'dying'
export const growthStages: { id: GrowthStage; label: string; caption: string }[] = [
 { id: 'bud', label: 'A bud', caption: 'Nothing planted yet. The first call opens it.' },
 { id: 'blooming', label: 'Blooming', caption: 'Coming along. A call would help it along further.' },
 { id: 'full', label: 'Fully bloomed', caption: 'You have been calling often. It shows.' },
 { id: 'withering', label: 'Withering', caption: 'A while since the last call. Worth a check-in.' },
 { id: 'shedding', label: 'Shedding', caption: 'It has been a long time since anyone called.' },
 { id: 'dying', label: 'Dying back', caption: 'Nobody has called in a long while. One call brings it back.' },
]
/** 0 (never, or long forgotten) to 1 (called today, and often this fortnight). A call
    today mostly resets it; the rest is how long ago that was and how often it happens. */
export function callingVitality(state: HarborState): number {
 const calls = state.moments.filter(m => m.kind === 'called').slice().sort((a, b) => b.at.localeCompare(a.at))
 if (!calls.length) return -1
 const daysSince = Math.max(0, (Date.now() - new Date(calls[0].at).getTime()) / 86400000)
 const freshness = Math.pow(2, -daysSince / 4)
 const cutoff = Date.now() - 14 * 86400000
 const recent = calls.filter(m => new Date(m.at).getTime() >= cutoff).length
 const frequency = Math.min(1, recent / 6)
 return Math.max(0, Math.min(1, freshness * 0.65 + frequency * 0.35))
}
export function callingStage(state: HarborState): GrowthStage {
 const v = callingVitality(state)
 if (v < 0) return 'bud'
 if (v >= 0.82) return 'full'
 if (v >= 0.56) return 'blooming'
 if (v >= 0.32) return 'withering'
 if (v >= 0.12) return 'shedding'
 return 'dying'
}

/** A longer call opens a fuller bloom. Bounded so a two-minute call is still a whole flower. */
export function bloomScale(minutesLong: number | undefined) {
 const m = Number.isFinite(minutesLong) ? (minutesLong as number) : 8
 return Math.round(Math.min(1.45, Math.max(0.68, 0.6 + Math.sqrt(m) / 7)) * 100) / 100
}
export function formatDuration(m: number | undefined) {
 if (!Number.isFinite(m)) return 'a little while'
 const n = m as number
 if (n < 60) return `${n} min`
 const h = Math.floor(n / 60); const rest = n % 60
 return rest ? `${h} hr ${rest} min` : `${h} hr`
}

/* ---------- snap windows: only ever between two people who both said yes ---------- */
export function activePacts(state: HarborState) { return state.pacts.filter(p => p.status === 'active' && state.people.some(x => x.id === p.personId)) }
/** A genuinely random moment, rolled once a day: not a slot anyone can plan around. */
export function rollSnapWindow(now = new Date()) {
 const earliest = now.getTime() + 2 * 60000
 const close = new Date(now); close.setHours(22, 30, 0, 0)
 const latest = close.getTime() > earliest + 60000 ? close.getTime() : earliest + 45 * 60000
 return new Date(earliest + Math.floor(Math.random() * (latest - earliest))).toISOString()
}
export function answeredWindow(state: HarborState, day: string) { return state.snaps.some(s => s.person === 'you' && s.promptDay === day) }
export function snapWindowDue(state: HarborState, now = new Date()) {
 if (!activePacts(state).length) return false
 const day = localDay(now)
 const at = state.snapWindows[day]
 return !!at && Date.parse(at) <= now.getTime() && !answeredWindow(state, day)
}

export function addMoment(state: HarborState, moment: Moment): HarborState {
 if (state.moments.some(x => x.id === moment.id)) return state
 return { ...state, moments: [...state.moments, moment] }
}

export function cueEligibility(state: HarborState, walked: number, stopped: boolean, now = new Date()) {
 if (!state.settings.cuesEnabled) return 'Cues are off. You can turn them on in Settings when you feel ready.'
 if (!stopped) return 'Still walking. A cue waits until you have fully stopped.'
 if (!Number.isFinite(walked) || walked < state.settings.walkingMinutes) return `Below your ${state.settings.walkingMinutes}-minute walking threshold.`
 const today = localDay(now)
 if (state.moments.some(m => localDay(new Date(m.at)) === today && ['called', 'reacted', 'message'].includes(m.kind))) return 'You already connected today. Enjoy the quiet.'
 if (state.moments.some(m => m.kind === 'proposed_later' && !m.reminderDone)) return 'You already have a gentle reminder planned.'
 const cues = state.cues.filter(c => localDay(new Date(c.at)) === today)
 if (cues.length >= state.settings.dailyCap) return 'Your daily cue limit is reached. No more nudges today.'
 const last = state.cues.at(-1)
 if (last && now.getTime() - new Date(last.at).getTime() < state.settings.cooldownMinutes * 60000) return 'Taking a little breathing room. Your cooldown is still active.'
 return null
}

/* ---------- daily family question: one shared prompt per day, no streak anywhere ---------- */
export type GamePrompt = { q: string; mom: string; dad: string }
export const gamePrompts: GamePrompt[] = [
 { q: 'Tea, coffee, or neither today?', mom: 'Chai, obviously. Extra ginger today.', dad: 'Black coffee. The tomatoes needed watering early.' },
 { q: 'Window seat or aisle?', mom: 'Window. I like watching the world go by.', dad: 'Aisle. More room for my knees.' },
 { q: 'One good thing about today, however small?', mom: 'The jasmine finally opened.', dad: 'Found my old radio in the garage. Still works.' },
 { q: 'Sweet or savory breakfast?', mom: 'Sweet. Always sweet.', dad: 'Savory, every time.' },
 { q: 'Beach or mountains?', mom: 'Mountains. Somewhere quiet.', dad: 'Beach. I like the noise, actually.' },
 { q: 'If today had a theme song, what would it be?', mom: 'Something old, from a film we watched together once.', dad: 'Whatever was on the radio in the car.' },
 { q: 'Early bird or night owl, honestly?', mom: 'Early bird. Mornings feel like mine.', dad: 'Night owl, but I pretend otherwise.' },
 { q: 'What smell reminds you of home right now?', mom: 'Whatever is simmering on the stove.', dad: 'Fresh-cut grass, if I am honest.' },
 { q: 'Rain or sunshine today?', mom: 'A little rain. Good for the garden.', dad: 'Sunshine. Always rooting for sunshine.' },
 { q: 'One word for how today felt?', mom: 'Full.', dad: 'Steady.' },
 { q: 'Cat person, dog person, or neither?', mom: 'Dog person, no contest.', dad: 'Whichever one leaves me alone the longest.' },
 { q: 'One small thing you are looking forward to?', mom: 'Hearing about your day, actually.', dad: 'The weekend. No particular reason.' },
]
export function gameForDay(day: string): GamePrompt { let h = 0; for (const c of day) h = (h * 31 + c.charCodeAt(0)) >>> 0; return gamePrompts[h % gamePrompts.length] }

/* ---------- keeping score, lightly ----------
   Nothing here is stored twice. A streak, a goal's progress and a puzzle's state are
   all read back out of what actually happened, so they cannot drift from the truth
   and there is no counter to reset when the demo starts fresh. */

/** Days you reached somebody, newest first, counted back from today. A day you
    did nothing ends the run, except today: an untouched today is the run so far. */
export function connectStreak(state: HarborState, now = new Date()): number {
 const days = new Set(state.moments
  .filter(m => ['called', 'message', 'reacted'].includes(m.kind))
  .map(m => localDay(new Date(m.at))))
 for (const p of state.puzzles) days.add(p.day)
 let run = 0
 const cursor = new Date(now)
 if (!days.has(localDay(cursor))) cursor.setDate(cursor.getDate() - 1)
 while (days.has(localDay(cursor))) { run++; cursor.setDate(cursor.getDate() - 1) }
 return run
}

/** Monday's date, used as the key a week's goals are measured inside. */
export function weekStart(day: string) { return weekOf(day)[0] }
function withinWeek(at: string, week: string[]) { return week.includes(localDay(new Date(at))) }

export type Goal = { id: string; label: string; hint: string; done: number; target: number }
/** Three small things, measured off real activity. Deliberately reachable: the point
    is to notice you already did them, not to set homework. */
export function weeklyGoals(state: HarborState, now = new Date()): Goal[] {
 const week = weekOf(localDay(now))
 const spoke = new Set(state.moments.filter(m => m.kind === 'called' && withinWeek(m.at, week)).map(m => m.person))
 const voices = Object.values(state.messages).flat().filter(m => m.mine && m.voice && withinWeek(m.at, week)).length
 const puzzleDays = new Set(state.puzzles.filter(p => week.includes(p.day)).map(p => p.day))
 return [
  { id: 'reach', label: 'Talk to two people', hint: 'A two-minute call counts', done: Math.min(spoke.size, 2), target: 2 },
  { id: 'voice', label: 'Send a voice note', hint: 'Faster than typing it out', done: Math.min(voices, 1), target: 1 },
  { id: 'play', label: 'Play on three days', hint: 'Any puzzle, any day', done: Math.min(puzzleDays.size, 3), target: 3 },
 ]
}
export function goalsWon(goals: Goal[]) { return goals.filter(g => g.done >= g.target).length }

export function puzzleResult(state: HarborState, day: string, puzzle: PuzzleId) {
 return state.puzzles.find(p => p.day === day && p.puzzle === puzzle)
}
/** A tidy code somebody can read down a phone line without spelling it out. */
export function makeInviteCode(seed = Math.random()) {
 const letters = 'ACDEFGHJKLMNPRTUVWXY'
 let out = ''
 let n = Math.floor(seed * 0xffffff)
 for (let i = 0; i < 3; i++) { out += letters[n % letters.length]; n = Math.floor(n / letters.length) }
 return `${out}-${String(Math.floor(seed * 9000) + 1000)}`
}

export const seedPeople: Person[] = [
 { id: 'mom', name: 'Mom', initials: 'M', tone: 'gold', note: 'Made your favorite today. Guess what it is?' },
 { id: 'dad', name: 'Dad', initials: 'D', tone: 'green', note: 'The tomatoes are finally growing!' },
 { id: 'aanya', name: 'Aanya', initials: 'A', tone: 'orange', note: 'Saving this story for our next call.' },
]
/** The same household from the other side of the phone. A parent's people are their
    kids, so the demo reads correctly the moment somebody picks parent at setup. */
export const seedFamily: Person[] = [
 { id: 'maya', name: 'Maya', initials: 'M', tone: 'orange', note: 'Studio ran late again. Calling after dinner!' },
 { id: 'rohan', name: 'Rohan', initials: 'R', tone: 'sky', note: 'Hostel food update: still bad. Still eating it.' },
]

export function seedState(now = new Date(), mode: Mode = 'student'): HarborState {
 const parent = mode === 'parent'
 const people = (parent ? seedFamily : seedPeople).map(p => ({ ...p }))
 const today = localDay(now); const milestone = new Date(now); milestone.setDate(milestone.getDate() + 21)
 const studentCalls: [string, number, Feeling, FlowerKind, string, string][] = [
  ['mom', 14, 'warm', 'marigold', 'Catch up', 'A long chat about absolutely nothing.'],
  ['mom', 6, 'steady', 'daisy', 'Just because', 'A quick hello between classes.'],
  ['mom', 31, 'tender', 'poppy', 'Ask for help', 'The one where I finally said it out loud.'],
  ['mom', 9, 'light', 'cosmos', 'Share news', 'Told her about the presentation.'],
  ['dad', 22, 'steady', 'sunflower', 'Catch up', 'The full tomato report.'],
  ['dad', 4, 'light', 'tulip', 'Just because', 'Two minutes, just to hear his voice.'],
  ['dad', 11, 'warm', 'daisy', 'Share news', 'He laughed at the same joke twice.'],
  ['aanya', 26, 'tender', 'aster', 'Ask for help', 'Untangling the whole week together.'],
  ['aanya', 8, 'light', 'bluebell', 'Just because', 'Mostly listening. That was the point.'],
 ]
 const parentCalls: [string, number, Feeling, FlowerKind, string, string][] = [
  ['maya', 18, 'warm', 'marigold', 'Catch up', 'She talked the whole time. Good sign.'],
  ['maya', 5, 'light', 'tulip', 'Just because', 'Between her classes. Short and sweet.'],
  ['maya', 27, 'tender', 'poppy', 'Ask for help', 'The hostel food conversation, again.'],
  ['rohan', 12, 'steady', 'daisy', 'Catch up', 'Exams start Monday. He sounded ready.'],
  ['rohan', 31, 'warm', 'sunflower', 'Share news', 'He got the internship. He buried the lede.'],
  ['rohan', 7, 'light', 'cosmos', 'Just because', 'Just to hear his voice before bed.'],
 ]
 const moments: Moment[] = (parent ? parentCalls : studentCalls).map(([person, mins, feeling, flower, topic, text], i) => {
  const at = new Date(now); at.setDate(at.getDate() - (i * 3 + 2)); at.setHours(17 + (i % 4), 20, 0, 0)
  return { id: `seed-call-${i}`, at: at.toISOString(), person, kind: 'called' as const, text, source: 'manual' as const, minutes: mins, feeling, flower, topic }
 })
 /* Personal notes are addressed to you alone; shared ones go to everybody you added. */
 const ago = (hours: number) => new Date(now.getTime() - hours * 3600000).toISOString()
 const notes: Note[] = parent ? [
  { id: 'seed-note-maya', at: ago(1), person: 'maya', scope: 'personal', text: 'Got the studio space! Will send pictures tonight.' },
  { id: 'seed-note-rohan', at: ago(5), person: 'rohan', scope: 'personal', text: 'Reached the hostel. Bus was late but fine.' },
  { id: 'seed-open-maya', at: ago(2), person: 'maya', scope: 'shared', text: 'Finally slept eight hours. Reporting it as news.' },
  { id: 'seed-open-rohan', at: ago(9), person: 'rohan', scope: 'shared', text: 'Exams Monday. Send snacks, not advice.' },
 ] : [
  { id: 'seed-note-mom', at: ago(1), person: 'mom', scope: 'personal', text: 'Made a little extra of your favorite, out of habit.' },
  { id: 'seed-note-dad', at: ago(5), person: 'dad', scope: 'personal', text: 'Proud of you this week. That is all, no reply needed.' },
  { id: 'seed-note-aanya', at: ago(26), person: 'aanya', scope: 'personal', text: 'saving a story for you' },
  { id: 'seed-open-mom', at: ago(2), person: 'mom', scope: 'shared', text: 'The jasmine finally opened this morning.' },
  { id: 'seed-open-dad', at: ago(9), person: 'dad', scope: 'shared', text: 'Radio still works. Unbelievable.' },
 ]
 /* One seed already on its way, so the idea is visible the first time a parent
    opens the app rather than only after they plant one. */
 const seeds: Seed[] = parent
  ? [{ id: 'seed-demo', person: people[0].id, from: 'you', at: ago(2), bloomAt: new Date(now.getTime() + 3 * 3600000).toISOString(), flower: 'poppy', text: 'Proud of you this week. No reply needed.' }]
  : [{ id: 'seed-demo', person: 'mom', from: 'mom', at: ago(6), bloomAt: new Date(now.getTime() + 2 * 3600000).toISOString(), flower: 'marigold', text: 'Something is on its way to you.' }]
 /* A few things your people said they would be doing, so the bell has something in it. */
 const planWeek = weekOf(today)
 const plans: Plan[] = parent ? [
  { id: 'seed-plan-maya-1', person: 'maya', day: today, start: '15:00', end: '17:30', label: 'Studio, then the library' },
  { id: 'seed-plan-rohan-1', person: 'rohan', day: today, start: '09:00', end: '12:00', label: 'Exams revision' },
  { id: 'seed-plan-maya-2', person: 'maya', day: planWeek[5], start: '11:00', end: '13:00', label: 'Free all morning' },
 ] : [
  { id: 'seed-plan-mom-1', person: 'mom', day: today, start: '18:00', end: '19:30', label: 'Cooking, then a walk' },
  { id: 'seed-plan-dad-1', person: 'dad', day: today, start: '07:30', end: '09:00', label: 'The garden, as always' },
  { id: 'seed-plan-mom-2', person: 'mom', day: planWeek[5], start: '10:00', end: '12:00', label: 'Market with your aunt' },
  { id: 'seed-plan-aanya-1', person: 'aanya', day: planWeek[4], start: '20:00', end: '22:00', label: 'Free all evening' },
 ]
 const snaps: Snap[] = parent ? [
  { id: 'seed-snap-maya', at: ago(2), person: 'maya', caption: 'my desk, finally tidy', simulated: true },
  { id: 'seed-snap-rohan', at: ago(30), person: 'rohan', caption: 'hostel chai. not yours, sorry', saved: true, simulated: true },
 ] : [
  { id: 'seed-snap-mom', at: ago(2), person: 'mom', caption: 'the jasmine, finally', simulated: true },
  { id: 'seed-snap-dad', at: ago(30), person: 'dad', caption: 'first tomato of the year', saved: true, simulated: true },
  { id: 'seed-snap-aanya', at: ago(52), person: 'aanya', caption: 'library, 1am, send help', simulated: true },
 ]
 /* A believable week of real life, so the calendar has something in it from the first run. */
 const week = weekOf(today)
 const yours: Interval[][] = [
  [{ start: '09:00', end: '11:00', label: 'Design studio' }, { start: '15:00', end: '17:00', label: 'Library' }],
  [{ start: '10:00', end: '12:30', label: 'Lab' }, { start: '18:30', end: '19:30', label: 'Run' }],
  [{ start: '09:00', end: '10:30', label: 'Lecture' }, { start: '13:00', end: '17:00', label: 'Shift at the cafe' }],
  [{ start: '11:00', end: '13:00', label: 'Studio crit' }],
  [{ start: '09:30', end: '11:00', label: 'Lecture' }, { start: '16:00', end: '18:00', label: 'Group project' }],
  [{ start: '12:00', end: '14:00', label: 'Laundry and groceries' }],
  [{ start: '19:00', end: '20:30', label: 'Dinner with friends' }],
 ]
 const theirs: Interval[][] = [
  [{ start: '08:00', end: '13:00', label: 'Work' }, { start: '18:00', end: '19:30', label: 'Dinner' }],
  [{ start: '08:00', end: '13:00', label: 'Work' }],
  [{ start: '08:00', end: '13:00', label: 'Work' }, { start: '17:00', end: '18:30', label: 'Temple' }],
  [{ start: '08:00', end: '13:00', label: 'Work' }, { start: '18:00', end: '19:00', label: 'Dinner' }],
  [{ start: '08:00', end: '13:00', label: 'Work' }],
  [{ start: '10:00', end: '12:00', label: 'Market' }],
  [{ start: '12:00', end: '15:00', label: 'Family lunch' }],
 ]
 /* A parent's own week is the working one; the student week is the one with a
    cafe shift in it. Whichever side you are on, "yours" is the one you can edit. */
 const mine = parent ? theirs : yours
 const others = parent ? yours : theirs
 /* Everybody's week is their own. Shifting each person by a day keeps two people
    from looking like one person entered twice. */
 const shifted = (offset: number) => (index: number) => others[(index + offset) % others.length]
 const schedules = Object.fromEntries(week.map((key, i) => [key, {
  you: mine[i],
  ...Object.fromEntries(people.map((p, n) => [p.id, shifted(n)(i)])),
 }]))
 /* How each of them said their week is going. A parent opens the app and the sky
    over the field is this, not a weather they set for themselves. */
 const moods: Weather[] = ['cloudy', 'bright', 'clear']
 return {
  version: 7, name: parent ? 'Asha' : 'Maya', mode, setupDone: false, toursSeen: [],
  puzzles: [], invite: { code: makeInviteCode(), joined: [] },
  people,
  sharing: false, momConsent: false, sharingSetupDone: false, calendar: null,
  schedules,
  weather: 'bright',
  peopleWeather: Object.fromEntries(people.map((p, i) => [p.id, moods[i % moods.length]])),
  watching: people[0].id,
  milestone: { title: parent ? 'Maya visits' : 'Midterms', date: localDay(milestone) },
  messages: Object.fromEntries(people.map(p => [p.id, [{ id: `hello-${p.id}`, text: p.note ?? 'Thinking of you.', mine: false, at: ago(1) }]])),
  read: [], drafts: {}, moments, cues: [], notes, games: {}, seeds, snaps, pacts: [], snapWindows: {},
  plans, starred: [`plan:${plans[0].id}`], seenAlerts: '',
  settings: { cuesEnabled: true, walkingMinutes: 10, dailyCap: 2, cooldownMinutes: 120, sound: 'chime', reducedMotion: false, theme: 'light' },
 }
}

/** Switching sides of the phone lays the household out again from the other end.
    What you marked as yourself does not vanish when you cross over: it becomes what
    the person on the other side reads on your card, which is the only way to see
    both halves of this app on one phone. Seeds you planted cross too, as seeds from
    the person you have just become. */
export function handOver(before: HarborState, after: HarborState): HarborState {
 const me = after.people[0]?.id
 if (!me) return after
 const schedules = { ...after.schedules }
 for (const [day, entries] of Object.entries(before.schedules)) {
  const mine = entries.you ?? []
  if (mine.length) schedules[day] = { ...(schedules[day] ?? {}), [me]: mine }
 }
 const crossing: Seed[] = before.seeds
  .filter(s => s.from === 'you')
  .map(s => ({ ...s, person: me, from: me }))
 return {
  ...after,
  schedules,
  /* The weather you were watching was theirs. Crossing over, it is yours. */
  weather: before.mode === 'parent' ? weatherOf(before, watchedPerson(before)) : after.weather,
  peopleWeather: { ...after.peopleWeather, [me]: before.mode === 'parent' ? weatherOf(after, me) : before.weather },
  seeds: [...after.seeds.filter(s => s.from !== me), ...crossing],
 }
}

export function parseState(raw: string): HarborState | null {
 try {
  const s = JSON.parse(raw) as HarborState
  if (s.version !== 7 || typeof s.name !== 'string' || typeof s.sharing !== 'boolean' || typeof s.momConsent !== 'boolean' || typeof s.sharingSetupDone !== 'boolean') return null
  if (!['student', 'parent'].includes(s.mode) || typeof s.setupDone !== 'boolean') return null
  if (!Array.isArray(s.puzzles) || !s.puzzles.every(p => p && /^\d{4}-\d{2}-\d{2}$/.test(p.day) && ['sudoku', 'zip', 'tango'].includes(p.puzzle) && Number.isFinite(p.seconds))) return null
  if (!s.invite || typeof s.invite.code !== 'string' || !Array.isArray(s.invite.joined) || !s.invite.joined.every(x => typeof x === 'string')) return null
  if (!s.settings || !s.schedules || !s.milestone || !s.messages || !s.drafts) return null
  if (s.calendar !== null && !(s.calendar && calendarProviders.some(c => c.id === s.calendar!.provider))) return null
  if (!Array.isArray(s.people) || !s.people.length || !s.people.every(p => p && typeof p.id === 'string' && typeof p.name === 'string' && typeof p.initials === 'string' && ['green', 'gold', 'orange', 'sky'].includes(p.tone))) return null
  if (!weathers.some(w => w.id === s.weather) || typeof s.milestone.title !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s.milestone.date)) return null
  if (!s.peopleWeather || typeof s.peopleWeather !== 'object' || Array.isArray(s.peopleWeather)
   || !Object.values(s.peopleWeather).every(w => weathers.some(x => x.id === w)) || typeof s.watching !== 'string') return null
  if (!Object.values(s.schedules).every(v => v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every(validIntervals))) return null
  if (!Object.values(s.messages).every(ms => Array.isArray(ms) && ms.every(m => typeof m.text === 'string' && typeof m.mine === 'boolean' && typeof m.id === 'string'
   && (m.voice === undefined || (m.voice && Number.isFinite(m.voice.seconds)))))) return null
  if (!Array.isArray(s.moments) || !s.moments.every(m => m && typeof m.id === 'string' && typeof m.text === 'string' && typeof m.person === 'string' && Number.isFinite(Date.parse(m.at)) && ['called', 'reacted', 'proposed_later', 'message', 'dismissed', 'played'].includes(m.kind) && (m.flower === undefined || flowerLibrary.some(f => f.id === m.flower)))) return null
  if (!Array.isArray(s.seeds) || !s.seeds.every(x => x && typeof x.id === 'string' && typeof x.person === 'string' && typeof x.from === 'string'
   && typeof x.text === 'string' && flowerLibrary.some(f => f.id === x.flower) && Number.isFinite(Date.parse(x.at)) && Number.isFinite(Date.parse(x.bloomAt)))) return null
  if (!Array.isArray(s.notes) || !s.notes.every(n => n && typeof n.id === 'string' && typeof n.person === 'string' && typeof n.text === 'string' && Number.isFinite(Date.parse(n.at)) && ['personal', 'shared'].includes(n.scope))) return null
  if (!Array.isArray(s.plans) || !s.plans.every(p => p && typeof p.id === 'string' && typeof p.person === 'string' && typeof p.label === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.day) && /^([01]\d|2[0-3]):[0-5]\d$/.test(p.start) && /^([01]\d|2[0-3]):[0-5]\d$/.test(p.end))) return null
  if (!Array.isArray(s.starred) || !s.starred.every(k => typeof k === 'string') || typeof s.seenAlerts !== 'string') return null
  if (!Array.isArray(s.snaps) || !s.snaps.every(x => x && typeof x.id === 'string' && typeof x.person === 'string' && Number.isFinite(Date.parse(x.at)))) return null
  if (!Array.isArray(s.pacts) || !s.pacts.every(p => p && typeof p.personId === 'string' && ['invited', 'active'].includes(p.status))) return null
  if (!s.snapWindows || typeof s.snapWindows !== 'object' || Array.isArray(s.snapWindows) || !Object.values(s.snapWindows).every(v => typeof v === 'string')) return null
  if (!s.games || typeof s.games !== 'object' || Array.isArray(s.games) || !Object.entries(s.games).every(([k, v]) => typeof k === 'string' && typeof v === 'string')) return null
  if (!Array.isArray(s.cues) || !s.cues.every(c => c && typeof c.id === 'string' && Number.isFinite(Date.parse(c.at)))) return null
  if (!Array.isArray(s.read) || !s.read.every(d => typeof d === 'string')) return null
  const v = s.settings
  if (typeof v.cuesEnabled !== 'boolean' || typeof v.reducedMotion !== 'boolean' || !['chime', 'soft', 'silent'].includes(v.sound)) return null
  /* Saved before the tour existed: carry it forward rather than throwing the demo away. */
  if (!Array.isArray(s.toursSeen) || !s.toursSeen.every(m => m === 'parent' || m === 'student')) s.toursSeen = []
  /* Saved before the theme existed: carry it forward rather than throwing the demo away. */
  if (!['system', 'light', 'dark'].includes(v.theme)) v.theme = 'system'
  if (![v.walkingMinutes, v.dailyCap, v.cooldownMinutes].every(n => Number.isFinite(n) && n >= 1) || v.dailyCap > 10) return null
  return s
 } catch { return null }
}
