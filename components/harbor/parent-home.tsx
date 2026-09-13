'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight, Cloud, CloudLightning, CloudRain, CloudSun, Flame, Image as ImageIcon, MessageCircleQuestion, Mic, Phone, Puzzle, Sprout, Sun, X } from 'lucide-react'
import { toast } from 'sonner'
import { makeId, useHarbor } from '@/lib/harbor/store'
import {
 connectStreak, growingSeeds, localDay, personOf, personStatus, seedPhase, sharedAlerts,
 watchedPerson, weatherIndex, weatherOf, weathers, type Person, type Weather,
} from '@/lib/harbor/model'
import { Avatar } from './avatar'
import { VoiceNote } from './voice'
import { DayArc } from './day-arc'
import { PlantSeed, SeedGrowing } from './seed'

/** Relative time in the reader's own language, rather than English glued together
    by hand. "yesterday" and "2 days ago" both come out of the same call. */
const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'short' })
const since = (at: string, now = Date.now()) => {
 const mins = Math.round((Date.parse(at) - now) / 60000)
 if (mins > -1) return relative.format(0, 'minute')
 if (mins > -60) return relative.format(mins, 'minute')
 const hours = Math.round(mins / 60)
 if (hours > -24) return relative.format(hours, 'hour')
 return relative.format(Math.round(hours / 24), 'day')
}
function greeting(now = new Date()) {
 const h = now.getHours()
 return h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

/** The same five skies the other side sets, drawn small. */
function WeatherMark({ weather }: { weather: Weather }) {
 const Icon = { clear: Sun, bright: CloudSun, cloudy: Cloud, rain: CloudRain, storm: CloudLightning }[weather]
 return <span className="who-weather-mark" data-weather={weather} aria-hidden="true"><Icon/></span>
}

/** The whole of parent mode: who you care about, how they are right now, and the two
    ways to reach them. Everything else in Harbor is one tap further away, deliberately. */
export function ParentHome({ navigate, onCall, onOpenStory, onQuestion }: {
 navigate: (page: string) => void
 onCall: (personId: string) => void
 onOpenStory: () => void
 onQuestion: () => void
}) {
 const { state, update } = useHarbor()
 const [recording, setRecording] = useState<Person | null>(null)
 const [planting, setPlanting] = useState<Person | null>(null)
 const [check, setCheck] = useState<string | null>(null)
 if (!state) return null
 const feed = sharedAlerts(state).slice(0, 3)
 const streak = connectStreak(state)
 const day = localDay()
 const playedToday = state.puzzles.filter(p => p.day === day).length
 const growing = growingSeeds(state)
 const watched = watchedPerson(state)
 const checking = growing.find(s => s.id === check)
 const answered = !!state.games[day]

 return <div className="entrance">
  <div className="wrap flow stagger" style={{ gap: 20 }}>
   <div className="hello" style={{ ['--i' as string]: 0 }}>
    <h1>{greeting()}, {state.name.split(' ')[0]}</h1>
    {streak > 1 && <span className="hello-streak"><Flame aria-hidden="true"/>{streak} days in a row</span>}
   </div>

   <section className="people-list" aria-label="Your people" style={{ ['--i' as string]: 1 }}>
    {state.people.map(person => {
     const status = personStatus(state, person.id)
     const last = (state.messages[person.id] ?? []).at(-1)
     return <article key={person.id} className="who-block">
      <button type="button" className="who-head" onClick={() => navigate(`chat/${person.id}`)}>
       <Avatar person={person.id} size="lg"/>
       <span className="who-name">
        <b>{person.name}</b>
        <span className="who-status" data-busy={status.busy}>
         <i aria-hidden="true"/>{status.label}
        </span>
       </span>
       <ChevronRight className="caret" aria-hidden="true"/>
      </button>
      {/* What they said their week is like. It is their word, not a reading taken
          off them, and the field behind this card is their sky rather than ours. */}
      <button type="button" className="who-weather" aria-pressed={watched === person.id}
       onClick={() => update(s => ({ ...s, watching: person.id }))}>
       <WeatherMark weather={weatherOf(state, person.id)}/>
       <span className="who-weather-said"><b>{weathers[weatherIndex(weatherOf(state, person.id))].label}</b> {weathers[weatherIndex(weatherOf(state, person.id))].caption}</span>
       {watched === person.id && <i>in your field</i>}
      </button>
      {last && <p className="who-line">{last.mine ? 'You: ' : ''}{last.text}</p>}
      <div className="who-acts">
       <button type="button" className="btn" onClick={() => onCall(person.id)}>
        <Phone aria-hidden="true"/>Call
       </button>
       <button type="button" className="btn btn-soft" onClick={() => setRecording(person)}>
        <Mic aria-hidden="true"/>Voice note
       </button>
      </div>
      <button type="button" className="plant-link" onClick={() => setPlanting(person)}>
       <Sprout aria-hidden="true"/>Plant a seed for {person.name}
      </button>
     </article>
    })}
   </section>

   <div style={{ ['--i' as string]: 2 }}><DayArc/></div>

   {!!growing.length && <section aria-labelledby="growing-heading" style={{ ['--i' as string]: 3 }}>
    <div className="row-head"><h2 id="growing-heading">On its way</h2></div>
    <ul className="growing">
     {growing.map(seed => {
      const to = personOf(state, seed.person)
      return <li key={seed.id}>
       <button type="button" className="growing-row" onClick={() => setCheck(seed.id)}>
        <span className="growing-mark" data-phase={seedPhase(seed)} aria-hidden="true"><Sprout/></span>
        <span className="row-body">
         <b>A seed for {to?.name ?? 'them'}</b>
         <span>{seedPhase(seed) === 'seed' ? 'Just planted' : seedPhase(seed) === 'sprout' ? 'Sprouting' : 'Nearly open'}</span>
        </span>
        <ChevronRight className="caret" aria-hidden="true"/>
       </button>
      </li>
     })}
    </ul>
   </section>}

   <section aria-labelledby="today-feed" style={{ ['--i' as string]: 4 }}>
    <div className="row-head">
     <h2 id="today-feed">Lately</h2>
     <button type="button" className="text-link" onClick={() => navigate('activity')}>
      See all <ChevronRight aria-hidden="true"/>
     </button>
    </div>
    {feed.length ? <ul className="feed">
     {feed.map(item => <li key={item.id} className="feed-item">
      <Avatar person={item.person} size="sm"/>
      <span className="feed-body">
       <b>{item.title}</b>
       <span>{item.body}</span>
      </span>
      <time className="feed-when" dateTime={item.at}>{since(item.at)}</time>
     </li>)}
    </ul> : <p className="empty">Nothing new yet. When they share something it lands here.</p>}
   </section>

   <button type="button" className="row" style={{ ['--i' as string]: 5 }} onClick={onQuestion}>
    <span className="row-icon" style={{ background: 'var(--tint-lilac)' }}><MessageCircleQuestion aria-hidden="true"/></span>
    <span className="row-body">
     <b>Today&rsquo;s question</b>
     <span>{answered ? 'You answered. See what they said.' : 'One line each, from everybody at home'}</span>
    </span>
    <ChevronRight className="caret" aria-hidden="true"/>
   </button>

   <div className="two-up" style={{ ['--i' as string]: 6 }}>
    <button type="button" className="tile" onClick={onOpenStory}>
     <span className="tile-icon" style={{ background: 'var(--tint-blue)' }}><ImageIcon aria-hidden="true"/></span>
     <b>Photos</b>
     <span>{state.snaps.length} from this week</span>
    </button>
    <button type="button" className="tile" onClick={() => navigate('activity/play')}>
     <span className="tile-icon" style={{ background: 'var(--tint-yellow)' }}><Puzzle aria-hidden="true"/></span>
     <b>Puzzles</b>
     <span>{playedToday ? `${playedToday} of 3 done today` : 'Three small ones today'}</span>
    </button>
   </div>
  </div>

  {recording && <VoiceSheet person={recording} onClose={() => setRecording(null)}/>}
  {planting && <PlantSeed person={planting} onClose={() => setPlanting(null)}/>}
  {checking && <CheckSeed seedId={checking.id} onClose={() => setCheck(null)}/>}
 </div>
}

/** Checking on something already in the ground: the same four stages, read-only. */
function CheckSeed({ seedId, onClose }: { seedId: string; onClose: () => void }) {
 const { state } = useHarbor()
 const [host, setHost] = useState<HTMLElement | null>(null)
 useEffect(() => { setHost(document.body) }, [])
 useEffect(() => {
  const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
  document.addEventListener('keydown', key)
  return () => document.removeEventListener('keydown', key)
 }, [onClose])
 const seed = state?.seeds.find(x => x.id === seedId)
 if (!state || !host || !seed) return null
 return createPortal(<div className="curtain seed-curtain" role="dialog" aria-modal="true" aria-label="A seed you planted">
  <div className="curtain-sheet seed-sheet">
   <div className="voice-to">
    <Avatar person={seed.person} size="sm"/>
    <span>Growing for <b>{personOf(state, seed.person)?.name ?? 'them'}</b></span>
    <button type="button" className="ghost-btn" onClick={onClose} aria-label="Close"><X aria-hidden="true"/></button>
   </div>
   <SeedGrowing seed={seed} person={personOf(state, seed.person)} onDone={onClose}/>
  </div>
 </div>, host)
}

/** Recording takes over the screen, because talking into a phone while a list scrolls
    behind you is how people end up sending half a sentence. It is portalled to the
    body: rendered in place it would be trapped inside the sheet's own stacking
    context, which put the nav bar on top of a supposedly modal dialog. */
function VoiceSheet({ person, onClose }: { person: Person; onClose: () => void }) {
 const { state, update, log } = useHarbor()
 const [host, setHost] = useState<HTMLElement | null>(null)
 useEffect(() => { setHost(document.body) }, [])
 useEffect(() => {
  const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
  document.addEventListener('keydown', key)
  return () => document.removeEventListener('keydown', key)
 }, [onClose])
 if (!state || !host) return null
 return createPortal(<div className="curtain voice-curtain" role="dialog" aria-modal="true" aria-label={`Voice note to ${person.name}`}>
  <div className="curtain-sheet" onClick={e => e.stopPropagation()}>
   <div className="voice-to">
    <Avatar person={person.id} size="sm"/>
    <span>To <b>{person.name}</b></span>
    <button type="button" className="ghost-btn" onClick={onClose} aria-label="Close without sending"><X aria-hidden="true"/></button>
   </div>
   <VoiceNote onCancel={onClose} sendLabel={`Send to ${person.name}`} onKeep={take => {
    const at = new Date().toISOString()
    const text = take.text || 'Voice note'
    update(s => ({
     ...s,
     messages: { ...s.messages, [person.id]: [...(s.messages[person.id] ?? []), { id: makeId(), at, text, mine: true, voice: { mediaId: take.mediaId, seconds: take.seconds, edited: take.edited } }] },
    }))
    log({ id: makeId(), at, person: person.id, kind: 'message', text, source: 'manual' })
    onClose()
    toast.success(`Sent to ${person.name}.`)
   }}/>
  </div>
 </div>, host)
}
