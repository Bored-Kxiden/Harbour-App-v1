'use client'
import { ArrowRight, GraduationCap, House } from 'lucide-react'
import { useHarbor } from '@/lib/harbor/store'
import type { Mode } from '@/lib/harbor/model'

/** The first screen anyone sees, and the only one that decides what the rest of
 *  the app looks like.
 *
 *  It used to ask for a name as well, on a second step. That question is now
 *  answered when the account is made -- it has to be, since the account is what
 *  the name is stored against -- so asking again here was asking somebody to
 *  type their own name twice in the same minute. Account keeps the field for
 *  changing it later.
 *
 *  What is left is one question, which is the right size for a screen that may
 *  be answered by somebody sixty years old who installed this because their kid
 *  asked them to. Neither answer is final: Account can switch sides.
 */
export function Setup() {
 const { start } = useHarbor()

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

   <div className="setup-step" key="who">
    <h1>Who is using this phone?</h1>
    <p className="setup-sub">It changes what you see. You can switch later.</p>
    <div className="setup-picks">
     <button type="button" className="setup-pick" onClick={() => start('parent')}>
      <span className="setup-pick-icon" data-tone="warm"><House aria-hidden="true"/></span>
      <b>I am a parent</b>
      <span>Call or message my child, see their photos, nothing else in the way.</span>
      <ArrowRight className="setup-pick-go" aria-hidden="true"/>
     </button>
     <button type="button" className="setup-pick" onClick={() => start('student')}>
      <span className="setup-pick-icon" data-tone="cool"><GraduationCap aria-hidden="true"/></span>
      <b>I am away from home</b>
      <span>Share when I am free, keep up with family, and grow the meadow.</span>
      <ArrowRight className="setup-pick-go" aria-hidden="true"/>
     </button>
    </div>
   </div>
  </div>
 </div>
}
