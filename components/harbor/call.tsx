'use client'
import { useEffect, useMemo, useState } from 'react'
import { Check, Minus, Phone, PhoneOff, Plus, Sparkles } from 'lucide-react'
import { makeId, useHarbor } from '@/lib/harbor/store'
import { bloomScale, feelings, flowerLibrary, flowerSpec, formatDuration, type Feeling, type FlowerKind } from '@/lib/harbor/model'
import { Avatar } from './avatar'
import { FlowerMark, FlowerPicker } from './flowers'

function clock(seconds: number) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` }

/** A call, then what it leaves behind: a reflection, a flower, and a bloom sized by how long you talked. */
export function CallFlow({ person, topic, onDone, onCancel }: { person: string; topic?: string; onDone: (momentId: string) => void; onCancel: () => void }) {
 const { state, log } = useHarbor()
 const [step, setStep] = useState<'calling' | 'reflect' | 'flower' | 'bloom'>('calling')
 const [seconds, setSeconds] = useState(0)
 const [minutesLong, setMinutesLong] = useState(1)
 const [feeling, setFeeling] = useState<Feeling>('steady')
 const [about, setAbout] = useState(topic ?? '')
 const [flower, setFlower] = useState<FlowerKind>('daisy')
 const [library, setLibrary] = useState(false)
 const [plantedId, setPlantedId] = useState<string>()

 useEffect(() => {
  if (step !== 'calling') return
  const timer = setInterval(() => setSeconds(s => s + 1), 1000)
  return () => clearInterval(timer)
 }, [step])

 const suggested = useMemo(() => {
  const primary = feelings.find(f => f.id === feeling)?.flower ?? 'daisy'
  const rest = flowerLibrary.map(f => f.id).filter(id => id !== primary).slice(0, 3)
  return [primary, ...rest]
 }, [feeling])

 if (!state) return null
 const who = state.people.find(p => p.id === person) ?? state.people[0]

 const endCall = () => { setMinutesLong(Math.max(1, Math.round(seconds / 60))); setStep('reflect') }
 const chooseFeeling = (next: Feeling) => { setFeeling(next); setFlower(feelings.find(f => f.id === next)?.flower ?? 'daisy') }
 const plant = () => {
  const id = makeId()
  log({
   id, at: new Date().toISOString(), person: who.id, kind: 'called', source: 'manual',
   text: about.trim() ? `A call about ${about.trim().toLowerCase()}.` : `A little time together, ${formatDuration(minutesLong)}.`,
   minutes: minutesLong, feeling, flower, topic: about.trim() || undefined,
  })
  setPlantedId(id); setStep('bloom')
 }

 return <div className="curtain" role="dialog" aria-modal="true" aria-label={`Call with ${who.name}`}>
  <div className="curtain-sheet">
   {step === 'calling' && <>
    <p className="eyebrow">Simulated call · no audio</p>
    <span className="halo"><Avatar person={who.id} size="xl"/></span>
    <h1 className="curtain-title">{who.name}</h1>
    <p className="call-timer" role="timer">{clock(seconds)}</p>
    {topic && <p className="small">about <b>{topic.toLowerCase()}</b></p>}
    <p className="curtain-sub">Talk for as long or as little as suits you. Two minutes counts.</p>
    <button type="button" className="btn btn-block" onClick={endCall}><PhoneOff/>End call</button>
    <button type="button" className="btn btn-quiet" onClick={onCancel}>never mind, back out</button>
   </>}

   {step === 'reflect' && <div className="flow" style={{ width: '100%' }}>
    <p className="eyebrow">Just for you</p>
    <h1 className="curtain-title" style={{ textAlign: 'left' }}>How did that feel?</h1>
    <div className="chips" role="radiogroup" aria-label="How the call felt">
     {feelings.map(f => <button key={f.id} type="button" role="radio" aria-checked={feeling === f.id} className="chip-choice" onClick={() => chooseFeeling(f.id)}>{f.label}</button>)}
    </div>
    <p className="small">{feelings.find(f => f.id === feeling)?.caption}</p>
    <div className="switch-row">
     <b>About how long?</b>
     <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <button type="button" className="icon-button" aria-label="Shorter" onClick={() => setMinutesLong(m => Math.max(1, m - (m > 15 ? 5 : 1)))}><Minus/></button>
      <span aria-live="polite" style={{ fontFamily: 'var(--font-round), sans-serif', fontWeight: 700, minWidth: 76, textAlign: 'center' }}>{formatDuration(minutesLong)}</span>
      <button type="button" className="icon-button" aria-label="Longer" onClick={() => setMinutesLong(m => Math.min(180, m + (m >= 15 ? 5 : 1)))}><Plus/></button>
     </span>
    </div>
    <div><label className="label" htmlFor="call-about">What was it about? (optional)</label>
     <input className="input" id="call-about" maxLength={90} placeholder="the tomatoes, mostly…" value={about} onChange={e => setAbout(e.target.value)} autoComplete="off"/></div>
    <button type="button" className="btn btn-block" onClick={() => setStep('flower')}>Choose a flower <Sparkles/></button>
   </div>}

   {step === 'flower' && <div className="flow" style={{ width: '100%' }}>
    <p className="eyebrow">{who.name}&apos;s patch</p>
    <h1 className="curtain-title" style={{ textAlign: 'left' }}>Which flower was it?</h1>
    <p className="small">{library ? 'The whole library. Pick whatever fits.' : `Picked for a ${feelings.find(f => f.id === feeling)?.label.toLowerCase()} call, or open the library.`}</p>
    <FlowerPicker value={flower} onChange={setFlower} suggested={library ? undefined : suggested}/>
    <button type="button" className="link" onClick={() => setLibrary(v => !v)}>{library ? 'Back to the suggestions' : 'Open the flower library'}</button>
    <button type="button" className="btn btn-block" onClick={plant}><Check/>Plant {flowerSpec(flower).name.toLowerCase()}</button>
   </div>}

   {step === 'bloom' && <>
    <p className="eyebrow">{formatDuration(minutesLong)} together</p>
    <div className="bloom-stage">
     <svg viewBox="-40 -104 80 112" className="bloom-svg" role="img" aria-label={`A ${flowerSpec(flower).name} blooming`}>
      <ellipse className="bloom-ground" cx={0} cy={2} rx={26} ry={7}/>
      <g transform={`scale(${bloomScale(minutesLong) * 2.4})`}><FlowerMark kind={flower} blooming/></g>
     </svg>
    </div>
    <h1 className="curtain-title">It opened.</h1>
    <p className="curtain-sub">A longer call opens a fuller bloom. This one is planted in {who.name}&apos;s patch, and it stays there.</p>
    <button type="button" className="btn btn-block" onClick={() => onDone(plantedId!)}><Phone/>Back to your garden</button>
   </>}
  </div>
 </div>
}
