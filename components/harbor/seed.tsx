'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Clock3, Sprout, X } from 'lucide-react'
import { toast } from 'sonner'
import { makeId, useHarbor } from '@/lib/harbor/store'
import { flowerLibrary, growthPhases, seedPhase, seedProgress, type FlowerKind, type Person, type Seed } from '@/lib/harbor/model'
import { Avatar } from './avatar'
import { FlowerGlyph } from './flowers'

/** When it opens. Deliberately vague on the child's side and exact on the parent's:
    they choose the hour, and the other person only ever finds a flower already open. */
const WHEN = [
 { id: 'soon', label: 'In a few hours', hours: 3 },
 { id: 'evening', label: 'This evening', hours: 8 },
 { id: 'tomorrow', label: 'Tomorrow morning', hours: 16 },
 { id: 'custom', label: 'Pick a time', hours: 0 },
] as const

function bloomTime(hours: number, now = new Date()) { return new Date(now.getTime() + hours * 3600000).toISOString() }
/** A time of day, turned into the next moment it happens. Ask for eight in the
    morning at lunchtime and you mean tomorrow morning, so that is what it means. */
function bloomAtClock(clock: string, now = new Date()) {
 const [h, m] = clock.split(':').map(Number)
 const at = new Date(now)
 at.setHours(h ?? 0, m ?? 0, 0, 0)
 if (at.getTime() <= now.getTime() + 60000) at.setDate(at.getDate() + 1)
 return at
}
const dayWord = (at: Date, now = new Date()) => at.getDate() === now.getDate() ? 'today' : 'tomorrow'
const clockWord = (at: Date) => at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

/** Plant a seed: pick a flower, write the line that comes with it, choose roughly when
    it opens. The point is that the other person cannot watch the clock for it. */
export function PlantSeed({ person, onClose }: { person: Person; onClose: () => void }) {
 const { update } = useHarbor()
 const [flower, setFlower] = useState<FlowerKind>('poppy')
 const [text, setText] = useState('')
 const [when, setWhen] = useState<typeof WHEN[number]['id']>('soon')
 const [clock, setClock] = useState('19:30')
 const [planted, setPlanted] = useState<Seed | null>(null)
 const [host, setHost] = useState<HTMLElement | null>(null)
 useEffect(() => { setHost(document.body) }, [])
 useEffect(() => {
  const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
  document.addEventListener('keydown', key)
  return () => document.removeEventListener('keydown', key)
 }, [onClose])
 if (!host) return null

 const opensAt = when === 'custom' ? bloomAtClock(clock) : null
 const plant = () => {
  const hours = WHEN.find(w => w.id === when)!.hours
  const seed: Seed = {
   id: makeId(), person: person.id, from: 'you',
   at: new Date().toISOString(), bloomAt: opensAt ? opensAt.toISOString() : bloomTime(hours),
   flower, text: text.trim() || 'Thinking of you.',
  }
  update(s => ({ ...s, seeds: [...s.seeds, seed] }))
  setPlanted(seed)
 }

 return createPortal(<div className="curtain seed-curtain" role="dialog" aria-modal="true"
  aria-label={planted ? `Your flower for ${person.name} is growing` : `Plant a seed for ${person.name}`}>
  <div className="curtain-sheet seed-sheet">
   {planted
    ? <SeedGrowing seed={planted} person={person} onDone={onClose}/>
    : <>
     <div className="voice-to">
      <Avatar person={person.id} size="sm"/>
      <span>A seed for <b>{person.name}</b></span>
      <button type="button" className="ghost-btn" onClick={onClose} aria-label="Close without planting"><X aria-hidden="true"/></button>
     </div>

     <div className="seed-stage" aria-hidden="true">
      <FlowerGlyph kind={flower} size={104}/>
     </div>
     <p className="seed-name">{flowerLibrary.find(f => f.id === flower)?.name}</p>

     <div className="seed-picks" role="radiogroup" aria-label="Which flower">
      {flowerLibrary.map(spec => <button key={spec.id} type="button" role="radio" className="seed-pick"
       aria-checked={flower === spec.id} aria-label={spec.name} onClick={() => setFlower(spec.id)}>
       <FlowerGlyph kind={spec.id} size={30}/>
      </button>)}
     </div>

     <div>
      <label className="label" htmlFor="seed-text">Your message for {person.name}</label>
      <textarea className="input" id="seed-text" rows={3} maxLength={200} value={text}
       placeholder="They read this when it opens…" onChange={e => setText(e.target.value)}/>
     </div>

     <div>
      <span className="label" id="seed-when">When should it open?</span>
      <div className="chips" role="radiogroup" aria-labelledby="seed-when">
       {WHEN.map(w => <button key={w.id} type="button" role="radio" className="chip-choice"
        aria-checked={when === w.id} onClick={() => setWhen(w.id)}>{w.label}</button>)}
      </div>
      {/* An exact hour, for the parent who knows when their kid finishes class.
          The other side still learns nothing about it. */}
      {when === 'custom' && <div className="seed-clock">
       <label className="label" htmlFor="seed-time" style={{ margin: 0 }}>Open it at</label>
       <input className="input" id="seed-time" type="time" step={300} value={clock}
        onChange={e => setClock(e.target.value || '19:30')}/>
       {opensAt && <p className="small">{clockWord(opensAt)} {dayWord(opensAt)}</p>}
      </div>}
     </div>
     <p className="note-strip"><Clock3 aria-hidden="true"/>{person.name} is not told when it will open. They just find it already grown.</p>

     <button type="button" className="btn btn-block" onClick={plant}>
      <Sprout aria-hidden="true"/>Plant this flower for {person.name}
     </button>
    </>}
  </div>
 </div>, host)
}

/** What the parent sees the moment it is in the ground, and again any time they check
    on it from home: four stages, and which one it has reached. */
export function SeedGrowing({ seed, person, onDone }: { seed: Seed; person?: Person; onDone?: () => void }) {
 const [now, setNow] = useState(() => Date.now())
 useEffect(() => {
  const timer = setInterval(() => setNow(Date.now()), 20000)
  return () => clearInterval(timer)
 }, [])
 const phase = seedPhase(seed, now)
 const progress = seedProgress(seed, now)
 const reached = growthPhases.findIndex(p => p.id === phase)
 const who = person?.name ?? 'They'

 return <>
  <div className="seed-stage seed-stage-growing" aria-hidden="true" data-phase={phase}>
   {phase === 'bloom'
    ? <FlowerGlyph kind={seed.flower} size={104}/>
    : <SeedArt phase={phase}/>}
  </div>
  <div className="seed-said">
   <span className="label" style={{ margin: 0 }}>Your message for {who}</span>
   <p>{seed.text}</p>
  </div>
  <div className="seed-track">
   <b>{phase === 'bloom' ? 'It opened' : 'Your flower is growing'}</b>
   <p className="small">{phase === 'bloom'
    ? `${who} can see it now, and the line that came with it.`
    : `${who} will see it once it is fully grown.`}</p>
   <ol className="seed-steps">
    {growthPhases.map((step, i) => <li key={step.id} data-on={i <= reached} data-at={i === reached}>
     <span className="seed-dot">{i < reached || phase === 'bloom' ? <Check aria-hidden="true"/> : <SeedDot index={i}/>}</span>
     {step.label}
    </li>)}
   </ol>
   <span className="seed-bar" aria-hidden="true"><i style={{ ['--p' as string]: progress }}/></span>
  </div>
  {onDone && <button type="button" className="btn btn-block" onClick={onDone}>Done</button>}
 </>
}

/** The seed before it is a flower: a mound, then a shoot, then a bud. */
function SeedArt({ phase }: { phase: 'seed' | 'sprout' | 'growing' }) {
 return <svg viewBox="0 0 120 120" width="104" height="104" aria-hidden="true">
  <ellipse cx="60" cy="96" rx="34" ry="12" fill="#8A6A4A" opacity=".5"/>
  <path d="M26 96c0-14 15-24 34-24s34 10 34 24z" fill="#9A7551"/>
  {phase === 'seed' && <ellipse cx="60" cy="82" rx="8" ry="10" fill="#E8C88A" stroke="#C7A469" strokeWidth="2"/>}
  {phase !== 'seed' && <path d="M60 84V58" stroke="#6FA765" strokeWidth="5" strokeLinecap="round"/>}
  {phase !== 'seed' && <path d="M59 70c-6-8-15-11-25-10 1 11 9 16 25 10z" fill="#9CCB8F"/>}
  {phase === 'growing' && <>
   <path d="M61 66c6-8 15-11 25-10-1 11-9 16-25 10z" fill="#8FBE7C"/>
   <ellipse cx="60" cy="48" rx="11" ry="15" fill="#B7D3A6"/>
   <ellipse cx="60" cy="46" rx="6" ry="11" fill="#CFE2C1"/>
  </>}
 </svg>
}
function SeedDot({ index }: { index: number }) {
 return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
  {index === 0 && <ellipse cx="12" cy="12" rx="5" ry="6.5" fill="currentColor" stroke="none"/>}
  {index === 1 && <><path d="M12 19v-7"/><path d="M11 14c-3-4-7-5-11-5 1 5 4 7 11 5z" fill="currentColor" stroke="none"/></>}
  {index === 2 && <><path d="M12 20V9"/><circle cx="12" cy="6" r="4"/></>}
  {index === 3 && <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>}
 </svg>
}
