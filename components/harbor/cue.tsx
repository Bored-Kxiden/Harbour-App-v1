'use client'
import { useEffect, useRef, useState } from 'react'
import { CalendarClock, Check, ChevronRight, Footprints, Heart, Phone, ShieldCheck, Sprout, Waves } from 'lucide-react'
import { toast } from 'sonner'
import { buzz, makeId, ring, useHarbor } from '@/lib/harbor/store'
import { cueEligibility, isFuture, topics, usualCallMinutes, type Moment } from '@/lib/harbor/model'
import { Avatar } from './avatar'
import { BackBar } from './back'

export type Cue = { id: string; person: string }

/** The cue itself: it buzzes, rings two or three times, then takes the whole screen 
    the person's name and face first, and three equal ways through. */
export function CueOverlay({ cue, onDismiss, onCall }: { cue: Cue; onDismiss: () => void; onCall: (topic?: string) => void }) {
 const { state, log } = useHarbor()
 const [step, setStep] = useState<'cue' | 'react' | 'later'>('cue')
 const [topic, setTopic] = useState<string>()
 const [line, setLine] = useState('')
 const [when, setWhen] = useState('')
 const [error, setError] = useState('')
 const settled = useRef(false)

 useEffect(() => {
  buzz()
  const stop = ring(state?.settings.sound ?? 'chime', 3)
  return () => stop()
 }, [])

 if (!state) return null
 const person = state.people.find(p => p.id === cue.person) ?? state.people[0]
 const usual = usualCallMinutes(state, person.id)

 const finish = (moment: Omit<Moment, 'id' | 'at' | 'person' | 'source' | 'cueId'>) => {
  settled.current = true
  log({ ...moment, id: makeId(), at: new Date().toISOString(), person: person.id, source: 'walking_stop', cueId: cue.id })
 }
 const leave = () => {
  if (!settled.current) log({ id: `dismiss-${cue.id}`, at: new Date().toISOString(), person: person.id, kind: 'dismissed', text: 'Kept a little space for yourself.', source: 'walking_stop', cueId: cue.id })
  onDismiss()
 }

 return <div className="curtain" role="dialog" aria-modal="true" aria-label={`A quiet moment to call ${person.name}`}>
  <div className="curtain-sheet">
   <div className="curtain-top">
    <span className="brand"><Sprout style={{ width: 20, height: 20, color: 'var(--leaf)' }}/>harbor</span>
    <span>now</span>
   </div>

   <span className="halo"><Avatar person={person.id} size="xl"/></span>
   <p className="curtain-name">{person.name}</p>

   {step === 'cue' && <>
    <h1 className="curtain-title">Looks like you&apos;re free.</h1>
    <p className="curtain-sub">You just stopped walking. A good moment, if you want it.</p>
    <p className="small">calls with {person.name} usually run <b>~{usual ?? 12} min</b></p>

    <div className="chips" role="group" aria-label="Give the call a shape, before it starts">
     {topics.map(t => <button key={t} type="button" className="chip-choice" aria-pressed={topic === t} onClick={() => setTopic(topic === t ? undefined : t)}>{t}</button>)}
    </div>

    <div className="paths">
     <button type="button" className="path" onClick={() => { settled.current = true; onCall(topic) }}>
      <span className="path-icon"><Phone/></span>
      <b>Call now</b><span>~{usual ?? 12} min, usually</span>
     </button>
     <button type="button" className="path" onClick={() => setStep('react')}>
      <span className="path-icon"><Heart/></span>
      <b>Send a reaction</b><span>a photo, one line</span>
     </button>
     <button type="button" className="path" onClick={() => setStep('later')}>
      <span className="path-icon"><CalendarClock/></span>
      <b>Propose a later time</b><span>becomes today&apos;s next nudge</span>
     </button>
    </div>

    <button type="button" className="btn btn-quiet" onClick={leave}>not now</button>
    <p className="note-strip"><ShieldCheck/>Your walking stays on this phone. {person.name} never sees it.</p>
   </>}

   {step === 'react' && <div className="flow" style={{ width: '100%' }}>
    <h1 className="curtain-title">A little love, then.</h1>
    <p className="curtain-sub">One line is plenty. No call, no explanation.</p>
    <div><label className="label" htmlFor="cue-line">Your line</label>
     <input className="input" id="cue-line" maxLength={120} placeholder="thinking of you, that’s all…" value={line} onChange={e => setLine(e.target.value)} autoComplete="off"/></div>
    <button type="button" className="btn btn-block" disabled={!line.trim()} onClick={() => { finish({ kind: 'reacted', text: line.trim(), topic }); toast.success('Sent. Nothing owed either way.'); onDismiss() }}><Check/>Send it</button>
    <button type="button" className="btn btn-quiet btn-block" onClick={() => setStep('cue')}>back</button>
   </div>}

   {step === 'later' && <div className="flow" style={{ width: '100%' }}>
    <h1 className="curtain-title">When would suit you?</h1>
    <p className="curtain-sub">A possibility, not a promise. It becomes today&apos;s next nudge and nothing more.</p>
    <div><label className="label" htmlFor="cue-when">A better time</label>
     <input className="input" id="cue-when" type="datetime-local" autoComplete="off" value={when} onChange={e => { setWhen(e.target.value); setError('') }} aria-invalid={!!error}/></div>
    {error && <p className="small" style={{ color: 'var(--destructive)' }} role="alert">{error}</p>}
    <button type="button" className="btn btn-block" onClick={() => {
     if (!isFuture(when)) { setError('Choose a time still ahead of you.'); return }
     finish({ kind: 'proposed_later', text: 'Made a little room to talk later.', proposedTime: new Date(when).toISOString(), topic })
     toast.success('Saved. You will see it when the time comes.')
     onDismiss()
    }}><CalendarClock/>Hold that time</button>
    <button type="button" className="btn btn-quiet btn-block" onClick={() => setStep('cue')}>back</button>
   </div>}
  </div>
 </div>
}

/** The demo trigger. A real build watches for the walking-to-still transition; here you stand in for the sensor. */
export function CueScreen({ navigate, onFire }: { navigate: (page: string) => void; onFire: (personId: string) => void }) {
 const { state, update } = useHarbor()
 const [walked, setWalked] = useState('12')
 const [stopped, setStopped] = useState(true)
 const [reason, setReason] = useState('')
 if (!state) return null
 const person = state.people[0]

 const check = () => {
  const blocked = cueEligibility(state, Number(walked), stopped)
  if (blocked) { setReason(blocked); return }
  setReason(''); onFire(person.id)
 }

 return <div className="entrance">
  <BackBar onBack={() => navigate('home')}/>
  <div className="page-head">
   <p className="eyebrow">A pause, not a push</p>
   <h1>Find your slack tide.</h1>
   <p>Sometimes the right moment is just after you stop.</p>
  </div>
  <div className="wrap flow">
   <div className="tint-card flow">
    <Waves className="size-9" strokeWidth={1.2} style={{ color: 'var(--ink)' }}/>
    <h2 style={{ fontSize: 24, color: 'var(--ink)' }}>Nothing to catch up on.</h2>
    <p className="small">When a walk ends, your phone buzzes and rings the sound you chose, and the cue takes over the screen. A call, a little love, or a plan for later: all are welcome. So is doing nothing.</p>
   </div>
   <section className="card card-pad flow">
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Footprints className="size-5" style={{ color: 'var(--ink)' }}/><h2 style={{ fontSize: 19 }}>Try a walking-stop moment</h2></div>
    <p className="small">Manual simulation only. No sensors are active in this web demo.</p>
    <div><label className="label" htmlFor="walk-demo">Minutes walked</label>
     <input className="input" id="walk-demo" type="number" inputMode="numeric" min={0} max={300} autoComplete="off" value={walked} onChange={e => setWalked(e.target.value)}/></div>
    <div className="switch-row">
     <label htmlFor="stopped" style={{ fontSize: 15 }}>I have fully stopped walking</label>
     <button type="button" id="stopped" className="toggle" aria-pressed={stopped} aria-label="I have fully stopped walking" onClick={() => setStopped(v => !v)}/>
    </div>
    <button type="button" className="btn btn-block" onClick={check}>Ring the cue</button>
    {reason && <p className="small" role="status">{reason}</p>}
    {!state.settings.cuesEnabled && <button type="button" className="btn btn-soft btn-block" onClick={() => update(s => ({ ...s, settings: { ...s.settings, cuesEnabled: true } }))}>Turn cues on</button>}
    <button type="button" className="text-link" onClick={() => navigate('account')}>Adjust my pace, sound and limits <ChevronRight aria-hidden="true"/></button>
   </section>
   <p className="note-strip"><ShieldCheck/>Your walking activity is never shared. Cues respect your daily limit, your cooldown, and any connection you have already made today.</p>
  </div>
 </div>
}
