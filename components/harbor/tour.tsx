'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Mode } from '@/lib/harbor/model'

/** One stop on the tour. A step with no target is spoken to the middle of the screen;
    everything else is anchored to something real on the page, because a tour that
    describes the app in the abstract teaches nothing about where anything is. */
type Step = { id: string; target?: string; title: string; body: string }

const PARENT: Step[] = [
 { id: 'hello', title: 'This is all of Harbor', body: 'Four stops, and the people you care about on the first one. It takes about twenty seconds to learn.' },
 { id: 'people', target: '.who-block', title: 'How they are, in their words', body: 'Each person says what kind of week they are having. The sky behind the card is whoever you tapped last.' },
 { id: 'reach', target: '.who-acts', title: 'Two taps to reach them', body: 'Call dials straight out. Voice note records, writes itself out as text, and lets you fix the text before it goes.' },
 { id: 'seed', target: '.plant-link', title: 'Leave something for later', body: 'Plant a seed and it opens on their phone at the hour you pick. They are never told when it is coming.' },
 { id: 'day', target: '.arc-card', title: 'Say when you are free', body: 'Mark the hours you are busy. Your people see the gaps on their side, never what is in them.' },
]

const STUDENT: Step[] = [
 { id: 'hello', title: 'This is all of Harbor', body: 'Your people, your week, and a field that keeps score of the calls. About twenty seconds to learn.' },
 { id: 'people', target: '.people-grid .person', title: 'A note meant for you alone', body: 'Each card carries the last thing that person left for you, and a button that skips the dialling.' },
 { id: 'field', target: '.meadow-chip', title: 'The field behind the card', body: 'Every call you finish plants a flower in it. Pull the card down to see the whole thing, or tap here to fly to somebody.' },
 { id: 'share', target: '.nav-share', title: 'Say the heavy thing once', body: 'Share my load sends it to whoever you pick, in your voice or in text, and you are done with the asking.' },
 { id: 'activity', target: 'button[aria-label^="Activity"]', title: 'What landed while you were out', body: 'Everything they shared, everything you kept, and the three small puzzles everyone at home is playing today.' },
]

const GAP = 14, EDGE = 16

/** The first run, once per side of the phone. It moves a hole around the screen and
    talks about whatever is inside it. Everything is measured live, so a step still
    lands correctly if the page scrolled, the keyboard opened, or the phone turned. */
export function Tour({ mode, onDone }: { mode: Mode; onDone: () => void }) {
 const steps = mode === 'parent' ? PARENT : STUDENT
 const [at, setAt] = useState(0)
 const [hole, setHole] = useState<DOMRect | null>(null)
 const [ready, setReady] = useState(false)
 const [host, setHost] = useState<HTMLElement | null>(null)
 const card = useRef<HTMLDivElement>(null)
 const step = steps[Math.min(at, steps.length - 1)]

 useEffect(() => { setHost(document.body) }, [])
 /* The home screen stages itself in when it mounts. Starting the tour on top of that
    would measure elements that are still sliding, so it waits for the page to settle. */
 useEffect(() => { const t = setTimeout(() => setReady(true), 780); return () => clearTimeout(t) }, [])

 const measure = useCallback(() => {
  if (!step.target) { setHole(null); return }
  const el = document.querySelector(step.target)
  if (!el) { setHole(null); return }
  setHole(el.getBoundingClientRect())
 }, [step.target])

 /* Bring the step's subject into view first, then measure it, then keep measuring
    while anything moves underneath. */
 useEffect(() => {
  if (!ready) return
  const el = step.target ? document.querySelector(step.target) : null
  el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  const settle = setTimeout(measure, el ? 420 : 0)
  measure()
  window.addEventListener('resize', measure)
  window.addEventListener('scroll', measure, true)
  return () => { clearTimeout(settle); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true) }
 }, [ready, step.target, measure])

 useEffect(() => { if (ready) card.current?.focus() }, [ready, at])

 const next = useCallback(() => { if (at + 1 >= steps.length) onDone(); else setAt(n => n + 1) }, [at, steps.length, onDone])
 useEffect(() => {
  const key = (e: KeyboardEvent) => {
   if (e.key === 'Escape') { e.preventDefault(); onDone() }
   if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); next() }
   if (e.key === 'ArrowLeft') { e.preventDefault(); setAt(n => Math.max(0, n - 1)) }
   if (e.key === 'Tab') {
    const stops = card.current?.querySelectorAll<HTMLElement>('button')
    if (!stops?.length) return
    const first = stops[0], last = stops[stops.length - 1]
    const on = document.activeElement
    if (e.shiftKey && (on === first || on === card.current)) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && on === last) { e.preventDefault(); first.focus() }
   }
  }
  document.addEventListener('keydown', key)
  return () => document.removeEventListener('keydown', key)
 }, [next, onDone])

 if (!host || !ready) return null

 const pad = 8
 const box = hole ? { x: hole.x - pad, y: hole.y - pad, w: hole.width + pad * 2, h: hole.height + pad * 2 } : null
 /* Under the subject if there is room for the card, otherwise above it. */
 const below = !box || box.y + box.h + GAP + 180 < window.innerHeight
 const style: React.CSSProperties = box
  ? below ? { top: box.y + box.h + GAP } : { bottom: window.innerHeight - box.y + GAP }
  : { top: '50%', transform: 'translateY(-50%)' }

 return createPortal(<div className="tour" role="dialog" aria-modal="true" aria-label="A quick tour of Harbor">
  <svg className="tour-scrim" aria-hidden="true">
   <defs><mask id="tour-hole">
    <rect x="0" y="0" width="100%" height="100%" fill="#fff"/>
    {box && <rect x={box.x} y={box.y} width={box.w} height={box.h} rx="18" fill="#000"/>}
   </mask></defs>
   <rect x="0" y="0" width="100%" height="100%" mask="url(#tour-hole)"/>
  </svg>
  {box && <span className="tour-ring" key={step.id} aria-hidden="true"
   style={{ top: box.y, left: box.x, width: box.w, height: box.h }}/>}

  <div className="tour-card" ref={card} tabIndex={-1} style={{ ...style, left: EDGE, right: EDGE }}>
   <h2>{step.title}</h2>
   <p>{step.body}</p>
   <div className="tour-acts">
    <span className="tour-dots" aria-label={`Step ${at + 1} of ${steps.length}`}>
     {steps.map((s, i) => <i key={s.id} data-on={i <= at} aria-hidden="true"/>)}
    </span>
    <button type="button" className="tour-skip" onClick={onDone}>Skip</button>
    <button type="button" className="btn tour-next" onClick={next}>{at + 1 === steps.length ? 'Start using it' : 'Next'}</button>
   </div>
  </div>
 </div>, host)
}
