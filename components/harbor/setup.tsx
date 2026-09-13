'use client'
import { useState } from 'react'
import { ArrowRight, GraduationCap, House, Phone, Sparkle } from 'lucide-react'
import { useHarbor } from '@/lib/harbor/store'
import type { Mode } from '@/lib/harbor/model'

/** The first screen anyone sees, and the only one that decides what the rest of the
    app looks like. One question per step, because the person answering step one may
    be sixty years old and have installed this because their kid asked them to. */
export function Setup() {
 const { start } = useHarbor()
 const [step, setStep] = useState<0 | 1>(0)
 const [mode, setMode] = useState<Mode>('parent')
 const [name, setName] = useState('')

 const choose = (next: Mode) => { setMode(next); setStep(1) }

 return <div className="setup">
  <div className="setup-inner">
   <div className="setup-brand">
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" width="26" height="26">
     <path d="M16 29V14" stroke="#1F6B43" strokeWidth="3" strokeLinecap="round"/>
     <path d="M15 15.5c-1.2-5-5-7.6-11-8 .4 6.6 3.8 10 11 8z" fill="#59A468"/>
     <path d="M17 13c1-5.6 4.8-8.8 11.6-9.4C28.2 11 24.4 15 17 13z" fill="#79BC7F"/>
    </svg>
    <span>harbor</span>
   </div>

   {step === 0 ? <div className="setup-step" key="who">
    <h1>Who is using this phone?</h1>
    <p className="setup-sub">It changes what you see. You can switch later.</p>
    <div className="setup-picks">
     <button type="button" className="setup-pick" onClick={() => choose('parent')}>
      <span className="setup-pick-icon" data-tone="warm"><House aria-hidden="true"/></span>
      <b>I am a parent</b>
      <span>Call or message my child, see their photos, nothing else in the way.</span>
      <ArrowRight className="setup-pick-go" aria-hidden="true"/>
     </button>
     <button type="button" className="setup-pick" onClick={() => choose('student')}>
      <span className="setup-pick-icon" data-tone="cool"><GraduationCap aria-hidden="true"/></span>
      <b>I am away from home</b>
      <span>Share when I am free, keep up with family, and grow the meadow.</span>
      <ArrowRight className="setup-pick-go" aria-hidden="true"/>
     </button>
    </div>
   </div> : <div className="setup-step" key="name">
    <h1>What should they call you?</h1>
    <p className="setup-sub">This is the name on your messages. Nothing leaves this phone.</p>
    <label className="label" htmlFor="setup-name">Your name</label>
    {/* Deliberately not autofocused: on a phone that throws the keyboard over the
        screen before the question above it has been read. */}
    <input className="input setup-name" id="setup-name" maxLength={40} autoComplete="given-name" spellCheck={false}
     placeholder={mode === 'parent' ? 'Asha' : 'Maya'} value={name}
     onChange={e => setName(e.target.value)}
     onKeyDown={e => { if (e.key === 'Enter') start(mode, name) }}/>
    <ul className="setup-list">
     <li><Phone aria-hidden="true"/>Two taps to call anybody you add</li>
     <li><Sparkle aria-hidden="true"/>A sample family is already set up, so you can try it now</li>
    </ul>
    <button type="button" className="btn btn-block setup-go" onClick={() => start(mode, name)}>
     Start <ArrowRight aria-hidden="true"/>
    </button>
    <button type="button" className="btn btn-quiet btn-block" onClick={() => setStep(0)}>Back</button>
   </div>}
  </div>
 </div>
}
