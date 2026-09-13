'use client'
import { useEffect, useState } from 'react'
import { CalendarClock, Camera, Inbox, MessageCircle, Puzzle, Sparkles, Star, Sprout } from 'lucide-react'
import { toast } from 'sonner'
import { useHarbor } from '@/lib/harbor/store'
import { formatTime, localDay, planStar, plansFor, sharedAlerts, starredItems, type Alert } from '@/lib/harbor/model'
import { Avatar } from './avatar'
import { BackBar } from './back'
import { GamesPanel } from './games'

const VIEWS = [
 { id: 'shared', label: 'Shared', icon: Inbox },
 { id: 'starred', label: 'Starred', icon: Star },
 { id: 'play', label: 'Play', icon: Puzzle },
] as const
type View = typeof VIEWS[number]['id']

const KIND_ICON = { seed: Sprout, plan: CalendarClock, instant: Camera, note: MessageCircle }
const KIND_TINT = { seed: 'var(--tint-mint)', plan: 'var(--tint-blue)', instant: 'var(--tint-peach)', note: 'var(--tint-yellow)' }

/** Activity: everything that happened while you were not looking, in one place.
    Shared is theirs, what they are doing and what they left. Starred is yours, the
    handful of things you chose to keep an eye on. Play is the day's puzzles, which
    belong here for the same reason as the rest: it is a thing to come back for, not
    a place in the app you navigate to on purpose. Nothing here expects a reply. */
export function AlertsScreen({ navigate, initial }: { navigate: (page: string) => void; initial?: View }) {
 const { state, update } = useHarbor()
 const [view, setView] = useState<View>(initial ?? 'shared')
 const [from, setFrom] = useState(0)
 const [fullscreenPlay, setFullscreenPlay] = useState(false)

 /* Opening the screen is what marks it read, so the dot on the bell means unseen
    rather than unanswered. */
 useEffect(() => {
  update(s => {
   const newest = sharedAlerts(s)[0]?.at ?? ''
   return newest && newest > s.seenAlerts ? { ...s, seenAlerts: newest } : s
  })
 }, [])

 if (!state) return null
 const index = VIEWS.findIndex(v => v.id === view)
 const choose = (next: View) => {
  if (next === view) return
  setFrom(Math.sign(VIEWS.findIndex(v => v.id === next) - index))
  setView(next)
 }

 return <div className="entrance">
  {/* A puzzle wants the whole screen. Everything above it folds away while one is
      open, and comes back when it closes. */}
  {!fullscreenPlay && <>
   <BackBar onBack={() => navigate('home')}/>
   <div className="page-head">
    <h1>Activity</h1>
    <p>What your people shared, what you kept, and today&rsquo;s puzzles.</p>
   </div>
  </>}

  <div className="wrap flow stagger">
   {!fullscreenPlay && <div className="segment" role="tablist" aria-label="Which activity" style={{ ['--i' as string]: 0 }}
    onKeyDown={e => {
     const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
     if (!step) return
     e.preventDefault()
     const next = VIEWS[(index + step + VIEWS.length) % VIEWS.length]
     choose(next.id)
     requestAnimationFrame(() => document.getElementById(`alert-tab-${next.id}`)?.focus())
    }}>
    <span className="segment-slide" style={{ ['--i' as string]: index }} aria-hidden="true"/>
    {VIEWS.map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab" id={`alert-tab-${id}`}
     className="segment-tab" aria-selected={view === id} aria-controls="alert-panel"
     tabIndex={view === id ? 0 : -1} onClick={() => choose(id)}>
     <Icon aria-hidden="true"/>{label}
    </button>)}
   </div>}

   <div className="panel-swap" key={view} id="alert-panel" role="tabpanel" aria-labelledby={`alert-tab-${view}`}
    style={{ ['--from' as string]: from, ['--i' as string]: 1 }}>
    {view === 'shared' && <SharedFeed navigate={navigate}/>}
    {view === 'starred' && <StarredFeed/>}
    {view === 'play' && <GamesPanel onPlaying={setFullscreenPlay}/>}
   </div>

   {!fullscreenPlay && <p className="fineprint" style={{ ['--i' as string]: 2 }}>A demo · nothing is sent or received for real</p>}
  </div>
 </div>
}

/** Theirs: what your people shared, newest first. */
function SharedFeed({ navigate }: { navigate: (page: string) => void }) {
 const { state, update } = useHarbor()
 if (!state) return null
 const alerts = sharedAlerts(state).slice(0, 24)
 if (!alerts.length) return <p className="empty">Nothing yet. When your people share a plan or leave a note, it arrives here.</p>

 const plans = plansFor(state)
 const star = (alert: Alert) => {
  const plan = plans.find(p => `plan-${p.id}` === alert.id)
  if (!plan) return null
  const key = planStar(plan)
  const on = state.starred.includes(key)
  return <button type="button" className="star" aria-pressed={on}
   aria-label={on ? `Stop watching ${plan.label}` : `Star ${plan.label} to keep an eye on it`}
   onClick={() => {
    update(s => ({ ...s, starred: on ? s.starred.filter(k => k !== key) : [...s.starred, key] }))
    toast.success(on ? 'Unstarred.' : 'Starred. It is in your Starred list now.')
   }}>
   <Star aria-hidden="true"/>
  </button>
 }

 return <div className="flow" style={{ gap: 9 }}>
  {alerts.map((alert, i) => {
   const Icon = KIND_ICON[alert.kind]
   return <div key={alert.id} className="alert" style={{ ['--i' as string]: i }}>
    <span className="row-icon" style={{ background: KIND_TINT[alert.kind] }}><Icon aria-hidden="true"/></span>
    <span className="alert-body">
     <b>{alert.title}</b>
     <span>{alert.body}</span>
     <span className="alert-when">{when(alert.at)}</span>
    </span>
    <span className="alert-acts">
     {star(alert)}
     <button type="button" className="star star-quiet" aria-label={`Open your conversation with ${alert.person}`}
      onClick={() => navigate(`chat/${alert.person}`)}><Avatar person={alert.person} size="xs"/></button>
    </span>
   </div>
  })}
 </div>
}

/** Yours: the things you starred, from their week or your own, soonest first. */
function StarredFeed() {
 const { state, update } = useHarbor()
 if (!state) return null
 const items = starredItems(state)
 if (!items.length) return <p className="empty">
  Nothing starred. Star a plan here, or any block in your own week, and it waits for you in this list.
 </p>
 const today = localDay()
 return <div className="flow" style={{ gap: 9 }}>
  {items.map((item, i) => <div key={item.key} className="alert" style={{ ['--i' as string]: i }}>
   <span className="row-icon" style={{ background: item.person === 'you' ? 'var(--tint-yellow)' : 'var(--tint-blue)' }}>
    {item.person === 'you' ? <Sparkles aria-hidden="true"/> : <Avatar person={item.person} size="xs"/>}
   </span>
   <span className="alert-body">
    <b>{item.label}</b>
    <span>{formatTime(item.start)} to {formatTime(item.end)} · {item.person === 'you' ? 'your week' : `${state.people.find(p => p.id === item.person)?.name ?? 'their'} week`}</span>
    <span className="alert-when">{item.day === today ? 'Today' : new Date(`${item.day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
   </span>
   <button type="button" className="star" aria-pressed="true" aria-label={`Stop watching ${item.label}`}
    onClick={() => { update(s => ({ ...s, starred: s.starred.filter(k => k !== item.key) })); toast.success('Unstarred.') }}>
    <Star aria-hidden="true"/>
   </button>
  </div>)}
 </div>
}

function when(at: string) {
 const mins = Math.round((Date.now() - new Date(at).getTime()) / 60000)
 if (mins < 0) return new Date(at).toLocaleDateString(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit' })
 if (mins < 60) return `${Math.max(mins, 1)} min ago`
 if (mins < 1440) return `${Math.round(mins / 60)} hr ago`
 return new Date(at).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}
