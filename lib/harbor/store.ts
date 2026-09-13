'use client'
import useSWR from 'swr'
import { toast } from 'sonner'
import { addMoment, parseState, type HarborState, type Mode, type Moment } from './model'
import { pull, push } from '@/lib/harbour/remote'
import { supabase } from '@/lib/harbour/supabase'

/** The one place the interface gets its state from.
 *
 *  Every screen calls useHarbor() and reads a plain HarborState, exactly as it
 *  did when this was a browser demo. What changed underneath is where that
 *  state comes from and where it goes:
 *
 *    Supabase is the truth.      It is pulled once on sign-in and on refocus.
 *    The phone keeps a copy.     So the app opens instantly and works offline.
 *    Writes go local first.      The screen never waits for a network round
 *                                trip; the write follows, and is retried from
 *                                an outbox if it did not land.
 *
 *  The contract that matters is that update() stays synchronous and total: it
 *  takes the whole state and returns the whole state. Diffing what actually
 *  changed is this file's problem, not the screens'.
 */

/* Keyed per account so two people signing into one phone never read each
   other's cached meadow. */
const cacheKey = (userId: string) => `harbour-cache-${userId}`
const outboxKey = (userId: string) => `harbour-outbox-${userId}`

let current: HarborState | undefined
let owner: string | undefined
let warned = false

function persist(userId: string, state: HarborState) {
  try { localStorage.setItem(cacheKey(userId), JSON.stringify(state)) } catch {
    if (!warned) { toast.error('This phone would not let Harbour save. Changes will last only while it is open.'); warned = true }
  }
}

/** A change that has not reached Supabase yet, kept so a tunnel or a dead spot
    costs nothing. Stored as the two states either side of it, because that is
    what push() knows how to read. */
type Pending = { before: HarborState; after: HarborState }
function queue(userId: string, job: Pending) {
  try {
    const held: Pending[] = JSON.parse(localStorage.getItem(outboxKey(userId)) ?? '[]')
    held.push(job)
    localStorage.setItem(outboxKey(userId), JSON.stringify(held.slice(-50)))
  } catch { /* If storage is gone the write is simply lost; the next pull wins. */ }
}

async function drain(userId: string) {
  let held: Pending[] = []
  try { held = JSON.parse(localStorage.getItem(outboxKey(userId)) ?? '[]') } catch { return }
  if (!held.length) return
  const left: Pending[] = []
  for (const job of held) {
    try { await push(job.before, job.after, userId) } catch { left.push(job) }
  }
  try { localStorage.setItem(outboxKey(userId), JSON.stringify(left)) } catch { /* nothing to do */ }
}

/** What the app shows while the first pull is in flight: the cached meadow if
    there is one, so a returning user sees their own data immediately. */
function cached(userId: string): HarborState | undefined {
  try {
    const raw = localStorage.getItem(cacheKey(userId))
    return raw ? parseState(raw) ?? undefined : undefined
  } catch { return undefined }
}

async function load(): Promise<HarborState> {
  const { data } = await supabase().auth.getUser()
  const userId = data.user?.id
  /* AuthGate does not render the app without a session, so this is a real
     fault rather than a state to design for. */
  if (!userId) throw new Error('Harbour tried to load a meadow with nobody signed in.')

  if (owner !== userId) { owner = userId; current = undefined }
  current ??= cached(userId)

  try {
    const fresh = await pull(userId)
    current = fresh
    persist(userId, fresh)
    void drain(userId)
  } catch {
    if (!current) throw new Error('Harbour could not reach your meadow, and this phone has no copy of it yet.')
    toast.info('Showing the copy on this phone. It will catch up when you are back online.')
  }
  return current
}

export function useHarbor() {
  const { data, mutate } = useSWR<HarborState>('harbour-state', load, {
    refreshInterval: 0,
    revalidateOnFocus: true,
    dedupingInterval: 2000,
  })

  const update = (fn: (state: HarborState) => HarborState) => {
    const before = current ?? data
    if (!before || !owner) return
    const after = fn(before)
    current = after
    persist(owner, after)
    void mutate(after, false)
    /* The screen has already moved. If this does not land, it waits in the
       outbox rather than surfacing as an error nobody can act on. */
    const userId = owner
    void push(before, after, userId).catch(() => queue(userId, { before, after }))
  }

  const log = (moment: Moment) => update(s => addMoment(s, moment))

  /** Finishing setup. The account already exists by this point; this records
      which side of the phone it is and what to call them. */
  const start = (mode: Mode, name: string) => {
    update(s => ({ ...s, mode, name: name.trim() || s.name, setupDone: true }))
  }

  /** Crossing to the other side of the phone. Nothing is re-seeded any more:
      the same account keeps its people, its days and its seeds, and only the
      shape of the app changes. */
  const swap = (mode: Mode) => update(s => ({ ...s, mode, setupDone: true }))

  /** Signing out is the only reset there is now. Demo data is gone: a meadow
      belongs to an account, and clearing one would mean deleting real rows. */
  const reset = () => {
    const userId = owner
    void (async () => {
      await supabase().auth.signOut()
      if (userId) { try { localStorage.removeItem(cacheKey(userId)); localStorage.removeItem(outboxKey(userId)) } catch { /* already gone */ } }
      current = undefined; owner = undefined
      void mutate(undefined, false)
    })()
  }

  return { state: data, update, log, reset, start, swap }
}

export function makeId() { return crypto.randomUUID() }

/* ---------------------------------------------------------------- sound ----
   Unchanged from the demo: the cue's chime and ring are generated rather than
   shipped as files, so they cost nothing and never fail to load. */

function tone(sound: string, at: number, ctx: AudioContext) {
 const osc = ctx.createOscillator(); const gain = ctx.createGain()
 osc.connect(gain); gain.connect(ctx.destination); osc.type = 'sine'
 osc.frequency.setValueAtTime(sound === 'soft' ? 440 : 660, at)
 osc.frequency.exponentialRampToValueAtTime(sound === 'soft' ? 330 : 495, at + 0.5)
 gain.gain.setValueAtTime(0.0001, at); gain.gain.exponentialRampToValueAtTime(0.09, at + 0.04); gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.9)
 osc.start(at); osc.stop(at + 0.95)
 return osc
}
export function chime(sound: string) {
 if (sound === 'silent') return
 try { const ctx = new AudioContext(); const osc = tone(sound, ctx.currentTime, ctx); osc.onended = () => void ctx.close() } catch { toast.info('Sound is not supported in this browser.') }
}
export function ring(sound: string, times = 3) {
 if (sound === 'silent') return () => {}
 try {
  const ctx = new AudioContext(); const start = ctx.currentTime
  let last: OscillatorNode | undefined
  for (let i = 0; i < times; i++) last = tone(sound, start + i * 1.25, ctx)
  if (last) last.onended = () => void ctx.close()
  return () => { try { void ctx.close() } catch { /* already closed */ } }
 } catch { return () => {} }
}
export function buzz(pattern: number[] = [180, 110, 180, 110, 260]) {
 try { navigator.vibrate?.(pattern) } catch { /* vibration is unavailable or blocked; the cue still shows */ }
}
