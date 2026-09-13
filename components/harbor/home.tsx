'use client'
import { useState } from 'react'
import { CalendarDays, ChevronRight, Clock3, Images, Lock, MessageCircleQuestion, Phone, Puzzle, Sprout, Users, Waves } from 'lucide-react'
import { useHarbor } from '@/lib/harbor/store'
import {
 blocksFor, callingStage, callsFor, dominantFlower, formatTime, freeWindows, latestPersonalNote, localDay,
 minutes, personDay, personStatus, weatherIndex, weathers,
} from '@/lib/harbor/model'
import { Avatar } from './avatar'
import { FlowerGlyph } from './flowers'
import { NotesRail } from './notes-rail'
import { GrowthFlower } from './growth-flower'
import { Sprig } from './sprigs'

const TINTS = ['gold', 'green', 'orange', 'sky'] as const
const SPRIGS = ['tulip', 'leaf', 'cosmos', 'bell'] as const
const TABS = [
 { id: 'people', label: 'People', icon: Users },
 { id: 'schedule', label: 'Schedule', icon: CalendarDays },
] as const
type Tab = typeof TABS[number]['id']

export function Home({ navigate, onCall, onOpenCamera, onOpenStory, onWeatherShown, onExpand, onQuestion }: {
 navigate: (page: string) => void
 onCall: (personId: string) => void
 onOpenCamera: () => void
 onOpenStory: () => void
 onWeatherShown: () => void
 onExpand: () => void
 onQuestion: () => void
}) {
 const { state } = useHarbor()
 const [tab, setTab] = useState<Tab>('people')
 /* Which way the panel should arrive: tabs are a row, so the new view comes in
    from the side it lives on and the old one leaves the other way. */
 const [from, setFrom] = useState(0)
 const index = TABS.findIndex(t => t.id === tab)
 const choose = (next: Tab) => {
  if (next === tab) return
  setFrom(Math.sign(TABS.findIndex(t => t.id === next) - index))
  setTab(next)
 }
 if (!state) return null
 const played = state.puzzles.filter(p => p.day === localDay()).length

 return <div className="entrance">
  <div className="wrap flow stagger">
   <section aria-labelledby="people-heading" style={{ ['--i' as string]: 0 }}>
    <div className="row-head">
     <h2 id="people-heading">Your people</h2>
     <button type="button" className="pill-link" onClick={onExpand}>View all <ChevronRight aria-hidden="true"/></button>
    </div>
    <p className="small section-note">Private between you and them.</p>

    <div className="segment" role="tablist" aria-label="Your people"
     onKeyDown={e => {
      /* A tablist is one stop with arrows inside it, not three stops. */
      const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'Home' ? -index : e.key === 'End' ? TABS.length - 1 - index : 0
      if (!step) return
      e.preventDefault()
      const next = TABS[(index + step + TABS.length) % TABS.length]
      choose(next.id)
      requestAnimationFrame(() => document.getElementById(`tab-${next.id}`)?.focus())
     }}>
     <span className="segment-slide" style={{ ['--i' as string]: index }} aria-hidden="true"/>
     {TABS.map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab" id={`tab-${id}`}
      className="segment-tab" aria-selected={tab === id} aria-controls="people-panel"
      tabIndex={tab === id ? 0 : -1} onClick={() => choose(id)}>
      <Icon aria-hidden="true"/>{label}
     </button>)}
    </div>

    {/* Only this panel is replaced when the tab moves. Keying it on the tab is what
        makes the entrance run again; nothing above or below it is touched, so the
        card does not re-enter and the scroll stays where you left it. */}
    <div className="panel-swap" key={tab} id="people-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}
     style={{ ['--from' as string]: from }}>
    {tab === 'people' && <div className="people-grid">
     {state.people.map((person, i) => {
      const flower = dominantFlower(state, person.id)
      const calls = callsFor(state, person.id).length
      const last = (state.messages[person.id] ?? []).at(-1)
      const unread = !!last && !last.mine && !state.read.includes(person.id)
      /* Their card carries what they said to you alone. Anything they said to
         everyone lives on the rail under A little something, never here. */
      const personal = latestPersonalNote(state, person.id)
      const status = personStatus(state, person.id)
      return <div key={person.id} className={`person tint-${TINTS[i % TINTS.length]}`}>
       <Sprig kind={SPRIGS[i % SPRIGS.length]} className="person-sprig"/>
       <button type="button" className="person-top" onClick={() => navigate(`chat/${person.id}`)}
        aria-label={`Open your conversation with ${person.name}`}>
        <span style={{ position: 'relative' }}>
         <Avatar person={person.id}/>
         {unread && <span className="unread"/>}
        </span>
        <ChevronRight style={{ width: 15, height: 15, color: 'var(--ink-faint)' }} aria-hidden="true"/>
       </button>
       <h3>{person.name}</h3>
       {/* What they marked on their own day, read from here. A parent marking an
           afternoon busy at home is this line changing on their kid's phone. */}
       <span className="who-status person-status" data-busy={status.busy}>
        <i aria-hidden="true"/>{status.label}
       </span>
       {personal
        ? <><span className="person-tag"><Lock aria-hidden="true"/>just for you</span>
         <p className="person-note">{personal.text}</p></>
        : <><span className="person-tag person-tag-quiet">no note yet</span>
         <p className="person-note">{last?.mine ? 'You: ' : ''}{last?.text ?? 'Say hello whenever.'}</p></>}
       <span className="person-foot">
        {flower ? <FlowerGlyph kind={flower} size={13}/> : <Sprout aria-hidden="true"/>}
        {calls ? `${calls} ${calls === 1 ? 'flower' : 'flowers'} in their path` : 'No flowers yet'}
       </span>
       <button type="button" className="call-now" onClick={() => onCall(person.id)}>
        <Phone aria-hidden="true"/>Call {person.name}
       </button>
      </div>
     })}
    </div>}

    {tab === 'schedule' && <TodayAtAGlance navigate={navigate}/>}
    </div>
   </section>

   <section aria-labelledby="something-heading" style={{ ['--i' as string]: 1 }}>
    <div className="row-head">
     <h2 id="something-heading">Notes everyone sees</h2>
     <button type="button" className="text-link" onClick={() => navigate('saved')}>
      Everything saved <ChevronRight aria-hidden="true"/>
     </button>
    </div>
    <p className="small section-note"><Users aria-hidden="true"/>One line, read by everyone you added.</p>
    <NotesRail navigate={navigate} onOpenCamera={onOpenCamera}/>
    <button type="button" className="row" style={{ marginTop: 12 }} onClick={onOpenStory}>
     <span className="row-icon" style={{ background: 'var(--tint-blue)' }}><Images aria-hidden="true"/></span>
     <span className="row-body"><b>Photos from today</b><span>{state.snaps.length} from your people, before they fade</span></span>
     <ChevronRight className="caret" aria-hidden="true"/>
    </button>
   </section>

   <div className="flow" style={{ gap: 9, ['--i' as string]: 2 }}>
    <button type="button" className="row" onClick={onQuestion}>
     <span className="row-icon" style={{ background: 'var(--tint-lilac)' }}><MessageCircleQuestion aria-hidden="true"/></span>
     <span className="row-body">
      <b>Today&rsquo;s question</b>
      <span>{state.games[localDay()] ? 'You answered. See what they said.' : 'One line each, from everybody at home'}</span>
     </span>
     <ChevronRight className="caret" aria-hidden="true"/>
    </button>
    <button type="button" className="row" onClick={() => navigate('cue')}>
     <span className="row-icon" style={{ background: 'var(--tint-blue)' }}><Waves aria-hidden="true"/></span>
     <span className="row-body"><b>Good time to call</b><span>A nudge when you stop walking, never a demand</span></span>
     <ChevronRight className="caret" aria-hidden="true"/>
    </button>
    <button type="button" className="row" onClick={() => navigate('activity/play')}>
     <span className="row-icon" style={{ background: 'var(--tint-yellow)' }}><Puzzle aria-hidden="true"/></span>
     <span className="row-body">
      <b>Today&rsquo;s puzzles</b>
      <span>{played ? `${played} of 3 done` : 'Three small ones, the same three at home'}</span>
     </span>
     <ChevronRight className="caret" aria-hidden="true"/>
    </button>
   </div>

   {/* How life feels, kept where it belongs: a thing you can say, not the headline
       of the whole app. */}
   <div style={{ ['--i' as string]: 3 }}><Feelings onWeatherShown={onWeatherShown}/></div>

   <p className="fineprint" style={{ ['--i' as string]: 4 }}>An interactive demo · saved only on this device</p>
  </div>
 </div>
}

/** The sky you set by hand. Moving it turns the weather over behind the sheet. */
function Feelings({ onWeatherShown }: { onWeatherShown: () => void }) {
 const { state, update } = useHarbor()
 const [dragging, setDragging] = useState(false)
 const [track, setTrack] = useState<HTMLDivElement | null>(null)
 if (!state) return null
 const last = weathers.length - 1
 const index = weatherIndex(state.weather)
 const current = weathers[index]

 const setIndex = (next: number) => {
  const clamped = Math.min(last, Math.max(0, next))
  if (weathers[clamped].id !== state.weather) { update(s => ({ ...s, weather: weathers[clamped].id })); onWeatherShown() }
 }
 const fromX = (clientX: number) => {
  const rect = track?.getBoundingClientRect()
  if (!rect || rect.width <= 48) return
  setIndex(Math.round(((clientX - rect.left - 24) / (rect.width - 48)) * last))
 }

 const stage = callingStage(state)
 return <section className="card feelings" aria-labelledby="feelings-heading">
  <GrowthFlower stage={stage} className="feelings-sprig"/>
  <span className="eyebrow" id="feelings-heading">Your feelings right now</span>
  <h2>{current.label}</h2>
  <p>{current.caption}</p>
  <div ref={setTrack} className="mood" data-dragging={dragging}
   role="slider" tabIndex={0} aria-valuemin={0} aria-valuemax={last} aria-valuenow={index}
   aria-valuetext={`${current.label}. ${current.caption}`} aria-label="How life feels right now"
   onPointerDown={e => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); setDragging(true); fromX(e.clientX) }}
   onPointerMove={e => { if (dragging) fromX(e.clientX) }}
   onPointerUp={() => setDragging(false)} onPointerCancel={() => setDragging(false)}
   onKeyDown={e => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); setIndex(index - 1) }
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); setIndex(index + 1) }
    if (e.key === 'Home') { e.preventDefault(); setIndex(0) }
    if (e.key === 'End') { e.preventDefault(); setIndex(last) }
   }}>
   <span className="mood-rail"/>
   <span className="mood-fill" style={{ ['--p' as string]: index / last }}/>
   <span className="mood-run" style={{ ['--p' as string]: index / last }}>
    <span className="mood-knob"><Sprout aria-hidden="true"/></span>
   </span>
  </div>
  <div className="mood-scale"><span>Low</span><span>On your path</span><span>Easy</span></div>
 </section>
}

/** Today in three lines: the same read the schedule screen keeps in full. */
function TodayAtAGlance({ navigate }: { navigate: (page: string) => void }) {
 const { state } = useHarbor()
 if (!state) return null
 const day = localDay()
 const mine = blocksFor(state, day, 'you').slice().sort((a, b) => minutes(a.start) - minutes(b.start))
 const free = freeWindows(mine)
 return <section aria-labelledby="today-heading" style={{ ['--i' as string]: 4 }}>
  <div className="row-head">
   <h2 id="today-heading" style={{ fontSize: 20 }}>Today</h2>
   <button type="button" className="text-link" onClick={() => navigate('schedule')}>the whole week <ChevronRight aria-hidden="true"/></button>
  </div>
  <div className="flow" style={{ gap: 9 }}>
   {mine.length ? mine.slice(0, 2).map((block, i) => <div key={i} className="row">
    <span className="row-icon" style={{ background: 'var(--tint-yellow)' }}><Clock3 aria-hidden="true"/></span>
    <span className="row-body"><b>{block.label || 'Busy'}</b><span>{formatTime(block.start)} – {formatTime(block.end)}</span></span>
   </div>) : <p className="empty">Nothing marked today. A whole open day.</p>}
   {!!free.length && <div className="row" style={{ background: 'var(--tint-mint)', boxShadow: 'none' }}>
    <span className="row-icon" style={{ background: 'rgb(254 252 245 / .7)' }}><Sprout aria-hidden="true"/></span>
    <span className="row-body"><b>{formatTime(free[0].start)} – {formatTime(free[0].end)}</b><span>Your longest open stretch</span></span>
   </div>}
  </div>

  {/* Their day, from their side of the phone. The hours a parent marked busy on
      their own screen are these, which is the point of them marking anything. */}
  <div className="row-head" style={{ marginTop: 16 }}>
   <h2 style={{ fontSize: 20 }}>Them today</h2>
  </div>
  <ul className="their-day">
   {state.people.map(person => {
    const theirs = personDay(state, person.id, day)
    const status = personStatus(state, person.id)
    return <li key={person.id}>
     <Avatar person={person.id} size="sm"/>
     <span className="row-body">
      <b>{person.name}</b>
      <span>{theirs.length
       ? theirs.slice(0, 2).map(b => `${b.label || 'Busy'} ${formatTime(b.start)}`).join(' · ')
       : 'Nothing marked today'}</span>
     </span>
     <span className="who-status" data-busy={status.busy}><i aria-hidden="true"/>{status.busy ? 'Busy' : 'Free'}</span>
    </li>
   })}
  </ul>
 </section>
}
