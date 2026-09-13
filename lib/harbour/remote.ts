'use client'
/** Harbour's state, read from and written back to Supabase.
 *
 *  The interface was built against one plain object -- HarborState -- held in
 *  localStorage, and every screen still reads exactly that. So rather than
 *  rewrite the screens, this file translates in both directions:
 *
 *    pull()  builds a HarborState out of the tables the signed-in user can see
 *    push()  compares the state before and after a change and writes the
 *            difference back
 *
 *  Diffing rather than asking each screen to call an API keeps the interface
 *  untouched, which is the whole point of the port. It works because the state
 *  is small and everything in it is keyed by id.
 */
import {
  initialsOf, localDay, makeInviteCode, weekOf,
  type ChatMessage, type FlowerKind, type HarborState, type Interval, type Mode,
  type Moment, type Note, type Person, type PuzzleResult, type Seed, type Snap,
  type Tone, type Weather,
} from '@/lib/harbor/model'
import { supabase } from './supabase'

/* Postgres `time` comes back as 09:00:00; the model speaks 09:00. */
const hhmm = (t: string) => t.slice(0, 5)
const asTone = (t: string): Tone => (['green', 'gold', 'orange', 'sky'].includes(t) ? t : 'green') as Tone

/** Everything the app shows, assembled from what this user is allowed to read. */
export async function pull(userId: string): Promise<HarborState> {
  const db = supabase()

  const [profile, settings, contacts, theirProfiles, myBlocks, sharedBlocks, plans,
         notes, seeds, messages, snaps, moments, puzzles, answers] = await Promise.all([
    db.from('profiles').select('*').eq('id', userId).single(),
    db.from('user_settings').select('*').eq('user_id', userId).single(),
    db.from('contacts').select('*').eq('user_id', userId).order('created_at'),
    db.from('shared_profiles').select('*'),
    db.from('busy_blocks').select('*').eq('user_id', userId),
    db.from('shared_busy').select('*').neq('user_id', userId),
    db.from('plans').select('*'),
    db.from('notes').select('*').order('at', { ascending: false }),
    db.from('seeds').select('*'),
    db.from('messages').select('*').order('at'),
    db.from('snaps').select('*').order('at', { ascending: false }),
    db.from('moments').select('*').eq('user_id', userId).order('at'),
    db.from('puzzle_results').select('*'),
    db.from('daily_answers').select('*').eq('user_id', userId),
  ])

  const p = profile.data
  /* A contact is identified by the account behind it when there is one, so
     every shared row (which is keyed by user id) lines up with a person. */
  const idOf = (c: { id: string; linked_user_id: string | null }) => c.linked_user_id ?? c.id
  const people: Person[] = (contacts.data ?? []).map(c => ({
    id: idOf(c),
    name: c.label,
    initials: initialsOf(c.label),
    tone: asTone(c.tone),
    phone: c.phone_e164 ?? undefined,
    /* Somebody with an account of their own, who has added you back. Anything
       the app sends -- a note, a seed, a message -- can only reach a person
       this is true of, so the screens check it before offering. */
    linked: !!c.linked_user_id,
  }))
  const mine = new Set(people.map(x => x.id))

  const schedules: HarborState['schedules'] = {}
  const put = (day: string, who: string, block: Interval) => {
    schedules[day] ??= {}
    ;(schedules[day][who] ??= []).push(block)
  }
  for (const b of myBlocks.data ?? [])
    put(b.day, 'you', { start: hhmm(b.starts_at), end: hhmm(b.ends_at), label: b.label ?? undefined, linked: b.linked })
  for (const b of sharedBlocks.data ?? [])
    /* No label here by design: shared_busy does not carry one. */
    if (mine.has(b.user_id)) put(b.day, b.user_id, { start: hhmm(b.starts_at), end: hhmm(b.ends_at) })

  const peopleWeather: Record<string, Weather> = {}
  for (const q of theirProfiles.data ?? []) if (q.id !== userId) peopleWeather[q.id] = q.weather

  const messagesByPerson: Record<string, ChatMessage[]> = {}
  for (const person of people) messagesByPerson[person.id] = []
  for (const m of messages.data ?? []) {
    const other = m.from_id === userId ? m.to_id : m.from_id
    ;(messagesByPerson[other] ??= []).push({
      id: m.id, at: m.at, text: m.body, mine: m.from_id === userId, liked: m.liked,
      voice: m.voice_path || m.voice_seconds != null
        ? { mediaId: m.voice_path ?? undefined, seconds: m.voice_seconds ?? 0, edited: m.voice_edited }
        : undefined,
    })
  }

  return {
    version: 7,
    name: p?.display_name ?? '',
    mode: (p?.mode ?? 'student') as Mode,
    setupDone: p?.setup_done ?? false,
    toursSeen: (p?.tours_seen ?? []) as Mode[],
    weather: (p?.weather ?? 'bright') as Weather,
    peopleWeather,
    watching: p?.watching ?? people[0]?.id ?? '',
    milestone: { title: p?.milestone_title ?? '', date: p?.milestone_date ?? localDay() },
    invite: { code: p?.invite_code ?? makeInviteCode(), joined: [] },
    people,
    schedules,
    calendar: null,
    sharing: settings.data?.sharing ?? false,
    momConsent: settings.data?.sharing ?? false,
    sharingSetupDone: settings.data?.sharing ?? false,
    settings: {
      cuesEnabled: settings.data?.cues_enabled ?? false,
      walkingMinutes: settings.data?.walking_minutes ?? 10,
      dailyCap: settings.data?.daily_cap ?? 2,
      cooldownMinutes: settings.data?.cooldown_minutes ?? 120,
      sound: (settings.data?.sound ?? 'chime') as 'chime' | 'soft' | 'silent',
      reducedMotion: settings.data?.reduced_motion ?? false,
      theme: (settings.data?.theme ?? 'light') as HarborState['settings']['theme'],
    },
    notes: (notes.data ?? []).map((n): Note => ({
      id: n.id, at: n.at, text: n.body, scope: n.scope,
      /* A note you wrote belongs to whoever it was for; one written for you
         belongs to whoever wrote it. Either way the card shows the other end. */
      person: n.user_id === userId ? (n.audience_id ?? userId) : n.user_id,
      flower: (n.flower ?? undefined) as FlowerKind | undefined,
    })),
    seeds: (seeds.data ?? []).map((s): Seed => ({
      id: s.id, at: s.planted_at, bloomAt: s.bloom_at, flower: s.flower, text: s.body,
      person: s.from_id === userId ? s.to_id : s.from_id,
      from: s.from_id === userId ? 'you' : s.from_id,
    })),
    messages: messagesByPerson,
    read: [], drafts: {},
    moments: (moments.data ?? []).map((m): Moment => ({
      id: m.id, at: m.at, person: m.contact_id ?? '', kind: m.kind, text: m.body,
      source: 'manual',
      minutes: m.minutes ?? undefined,
      feeling: (m.feeling ?? undefined) as Moment['feeling'],
      flower: (m.flower ?? undefined) as FlowerKind | undefined,
      topic: m.topic ?? undefined,
    })),
    cues: [],
    snaps: (snaps.data ?? []).map((s): Snap => ({
      id: s.id, at: s.at, person: s.user_id === userId ? 'you' : s.user_id,
      mediaId: s.media_path ?? undefined, caption: s.caption ?? undefined,
      promptDay: s.prompt_day ?? undefined,
    })),
    pacts: [], snapWindows: {},
    plans: (plans.data ?? []).filter(x => x.user_id !== userId).map(x => ({
      id: x.id, person: x.user_id, day: x.day,
      start: hhmm(x.starts_at), end: hhmm(x.ends_at), label: x.label,
    })),
    starred: [], seenAlerts: '',
    puzzles: (puzzles.data ?? []).filter(x => x.user_id === userId).map((x): PuzzleResult => ({
      day: x.day, puzzle: x.puzzle, seconds: x.seconds, at: x.at,
    })),
    games: Object.fromEntries((answers.data ?? []).map(a => [a.day, a.body])),
  }
}

/* ---------------------------------------------------------------- writing */

const byId = <T extends { id: string }>(xs: T[]) => new Map(xs.map(x => [x.id, x]))
/** Rows in `after` that are new or changed, and the ids that disappeared. */
function changed<T extends { id: string }>(before: T[], after: T[]) {
  const was = byId(before)
  const added = after.filter(x => JSON.stringify(was.get(x.id)) !== JSON.stringify(x))
  const now = new Set(after.map(x => x.id))
  const gone = before.filter(x => !now.has(x.id)).map(x => x.id)
  return { added, gone }
}

/** Write back whatever this change actually touched. Anything that throws is
    left to the caller to queue: a phone with no signal must still feel instant. */
export async function push(before: HarborState, after: HarborState, userId: string) {
  const db = supabase()
  const jobs: PromiseLike<unknown>[] = []
  /* Every query here goes through throwOnError, and that is load-bearing rather
     than a style choice: without it a rejected insert resolves with an { error }
     in hand instead of throwing, allSettled below counts it a success, and a
     write that never landed looks exactly like one that did. The outbox would
     then stay empty on a phone with no signal, which is the one case it exists
     for. */
  const run = (q: { throwOnError: () => PromiseLike<unknown> }) => { jobs.push(q.throwOnError()) }
  /* Only a person with an account of their own can be written to: notes, seeds
     and messages are addressed by user id and the database has nowhere to put
     one aimed at a name on a list. Writes to anybody else are dropped here
     rather than retried forever by the outbox. */
  const reachable = new Set(after.people.filter(x => x.linked !== false).map(x => x.id))

  /* -------- the profile, and the things that live on it -------- */
  const profileMoved =
    before.name !== after.name || before.mode !== after.mode ||
    before.setupDone !== after.setupDone || before.weather !== after.weather ||
    before.watching !== after.watching ||
    JSON.stringify(before.toursSeen) !== JSON.stringify(after.toursSeen)
  if (profileMoved) {
    run(db.from('profiles').update({
      display_name: after.name, mode: after.mode, setup_done: after.setupDone,
      tours_seen: after.toursSeen, weather: after.weather,
      watching: after.watching || null,
    }).eq('id', userId))
  }

  if (JSON.stringify(before.settings) !== JSON.stringify(after.settings) || before.sharing !== after.sharing) {
    run(db.from('user_settings').update({
      cues_enabled: after.settings.cuesEnabled,
      walking_minutes: after.settings.walkingMinutes,
      daily_cap: after.settings.dailyCap,
      cooldown_minutes: after.settings.cooldownMinutes,
      sound: after.settings.sound,
      reduced_motion: after.settings.reducedMotion,
      theme: after.settings.theme,
      sharing: after.sharing,
    }).eq('user_id', userId))
  }

  /* -------- your list -------- */
  /* Adding somebody used to live only in this phone's memory: the next pull
     rebuilt the list from the contacts table and they were simply gone. A
     person added by name is a real row with no account behind it yet, which is
     what linked_user_id being null means, and the row is theirs to rename, give
     a number to, or take off the list again.

     The one thing that cannot be written back is a link. Those are made by
     redeem_invite, on both sides at once, and a client that could set
     linked_user_id itself could put anybody's id there. */
  const list = changed(before.people, after.people)
  for (const person of list.added) {
    const was = before.people.find(x => x.id === person.id)
    if (was?.linked || person.linked) {
      /* Linked people are keyed by their account id, not by the row's, so the
         row is found through it and the link itself is left alone. */
      run(db.from('contacts').update({ label: person.name, tone: person.tone, phone_e164: person.phone ?? null })
        .eq('user_id', userId).eq('linked_user_id', person.id))
    } else {
      run(db.from('contacts').upsert({
        id: person.id, user_id: userId, linked_user_id: null,
        label: person.name, tone: person.tone, phone_e164: person.phone ?? null,
      }))
    }
  }
  if (list.gone.length) {
    const byId = new Map(before.people.map(x => [x.id, x]))
    const rows = list.gone.filter(id => !byId.get(id)?.linked)
    const links = list.gone.filter(id => byId.get(id)?.linked)
    /* Taking a linked person off your list drops your side of it only. Theirs
       is theirs to drop, and the link test needs both rows to agree, so the
       two of you stop sharing the moment either one goes. */
    if (rows.length) run(db.from('contacts').delete().eq('user_id', userId).in('id', rows))
    if (links.length) run(db.from('contacts').delete().eq('user_id', userId).in('linked_user_id', links))
  }

  /* -------- your own day -------- */
  /* Blocks have no stable id in the model, so a day is replaced wholesale when
     anything in it moves. Days are small and this is one round trip. */
  for (const day of new Set([...Object.keys(before.schedules), ...Object.keys(after.schedules)])) {
    const was = before.schedules[day]?.you ?? []
    const now = after.schedules[day]?.you ?? []
    if (JSON.stringify(was) === JSON.stringify(now)) continue
    jobs.push((async () => {
      await db.from('busy_blocks').delete().eq('user_id', userId).eq('day', day).throwOnError()
      if (now.length) {
        await db.from('busy_blocks').insert(now.map(b => ({
          user_id: userId, day, starts_at: b.start, ends_at: b.end,
          label: b.label || null, linked: !!b.linked,
        }))).throwOnError()
      }
    })())
  }

  /* -------- notes, seeds, messages, pictures, calls, puzzles -------- */
  const notes = changed(before.notes, after.notes)
  for (const n of notes.added.filter(x => !x.id.startsWith('seed-') && (x.scope === 'shared' || reachable.has(x.person)))) {
    run(db.from('notes').upsert({
      id: n.id, user_id: userId, scope: n.scope,
      audience_id: n.scope === 'personal' ? n.person : null,
      body: n.text, flower: n.flower ?? null, at: n.at,
    }))
  }
  if (notes.gone.length) run(db.from('notes').delete().in('id', notes.gone.filter(id => !id.startsWith('seed-'))))

  for (const s of changed(before.seeds, after.seeds).added.filter(x => x.from === 'you' && reachable.has(x.person))) {
    run(db.from('seeds').upsert({
      id: s.id, from_id: userId, to_id: s.person, flower: s.flower,
      body: s.text, planted_at: s.at, bloom_at: s.bloomAt,
    }))
  }

  for (const [personId, thread] of Object.entries(after.messages)) {
    if (!reachable.has(personId)) continue
    const was = before.messages[personId] ?? []
    for (const m of changed(was, thread).added.filter(x => x.mine)) {
      run(db.from('messages').upsert({
        id: m.id, from_id: userId, to_id: personId, body: m.text, liked: m.liked ?? false,
        voice_path: m.voice?.mediaId ?? null,
        voice_seconds: m.voice?.seconds ?? null,
        voice_edited: m.voice?.edited ?? false,
        at: m.at,
      }))
    }
  }

  for (const s of changed(before.snaps, after.snaps).added.filter(x => x.person === 'you')) {
    run(db.from('snaps').upsert({
      id: s.id, user_id: userId, media_path: s.mediaId ?? null,
      caption: s.caption ?? null, prompt_day: s.promptDay ?? null, at: s.at,
    }))
  }

  for (const m of changed(before.moments, after.moments).added) {
    run(db.from('moments').upsert({
      id: m.id, user_id: userId, kind: m.kind, body: m.text,
      minutes: m.minutes ?? null, feeling: m.feeling ?? null,
      flower: m.flower ?? null, topic: m.topic ?? null, at: m.at,
      /* contact_id points at a contacts row; the model carries the person's
         account id, which is not the same thing, so it is left out rather
         than written wrongly. */
      contact_id: null,
    }))
  }

  const playedBefore = new Set(before.puzzles.map(p => `${p.day}:${p.puzzle}`))
  for (const p of after.puzzles.filter(x => !playedBefore.has(`${x.day}:${x.puzzle}`))) {
    run(db.from('puzzle_results').upsert({
      user_id: userId, day: p.day, puzzle: p.puzzle, seconds: p.seconds, at: p.at,
    }))
  }

  for (const [day, body] of Object.entries(after.games)) {
    if (before.games[day] === body) continue
    run(db.from('daily_answers').upsert({ user_id: userId, day, body }))
  }

  const results = await Promise.allSettled(jobs)
  const failed = results.filter(r => r.status === 'rejected')
  if (failed.length) throw new Error(`${failed.length} of ${results.length} writes did not land`)
}

/** Join somebody by the code they read out to you. */
export async function redeemInvite(code: string, myName: string) {
  const { data, error } = await supabase().rpc('redeem_invite', { code, my_label: myName })
  if (error) throw error
  return data as string
}

/** A fresh week of day keys, so a caller can ask for the days that matter. */
export const thisWeek = () => weekOf(localDay())
