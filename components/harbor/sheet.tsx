'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'

/* Exported so the meadow can work out how much of itself is actually uncovered
   right now, rather than only ever painting for the one position it used to be
   allowed to sit at. */
export const REST = 0.52   /* the sheet sits here, leaving the meadow the top half */
export const UP = 0.11     /* pulled up, it leaves a ribbon of sky */
const DOWN = -1.05  /* pulled down past rest, it all but leaves the stage: the whole field */
const SLOP = 6      /* below this, a drag was really a tap */

/** The card the app lives in. Drag the handle to move it; from the very top of the
    content, dragging down puts it back. Anything shorter than a few pixels is a tap. */
export function Sheet({ lift, onLift, onDragging, children, label, at }: {
 lift: number; onLift: (value: number) => void; onDragging: (value: boolean) => void; children: ReactNode; label: string
 /** Which screen is in the card. Changing it puts the card back at its own top. */
 at: string
}) {
 const scroller = useRef<HTMLDivElement>(null)
 const [dragging, setDragging] = useState(false)
 const report = (value: boolean) => { setDragging(value); onDragging(value) }
 const drag = useRef<{ y: number; from: number; at: number; last: number; v: number; moved: boolean; collapseOnly: boolean } | null>(null)
 const height = useRef(1)
 const liftRef = useRef(lift)
 liftRef.current = lift

 /* Scrolling the card brushes the flowers at the foot of the screen: the speed of
    the last frame becomes a lean, and the lean decays on its own. Written as a
    custom property so nothing re-renders to make it happen. */
 useEffect(() => {
  const el = scroller.current
  if (!el) return
  let last = el.scrollTop, at = performance.now(), idle = 0
  const stage = el.closest('.stage') as HTMLElement | null
  const onScroll = () => {
   const now = performance.now()
   const v = (el.scrollTop - last) / Math.max(now - at, 8)
   last = el.scrollTop; at = now
   stage?.style.setProperty('--brush', String(Math.max(-1, Math.min(1, v * 0.55))))
   clearTimeout(idle)
   idle = window.setTimeout(() => stage?.style.setProperty('--brush', '0'), 130)
  }
  el.addEventListener('scroll', onScroll, { passive: true })
  return () => { el.removeEventListener('scroll', onScroll); clearTimeout(idle) }
 }, [])

 /* One scroller holds every screen, so without this a new screen inherits how far
    down the last one you had read: you tap a person and land halfway through their
    conversation, past the heading and the way back. Each screen starts at its top. */
 useEffect(() => { scroller.current?.scrollTo({ top: 0, behavior: 'auto' }) }, [at])

 useEffect(() => {
  const measure = () => { height.current = window.innerHeight || 1 }
  measure()
  window.addEventListener('resize', measure)
  return () => window.removeEventListener('resize', measure)
 }, [])

 const start = (e: React.PointerEvent, collapseOnly: boolean) => {
  if (collapseOnly && (scroller.current?.scrollTop ?? 0) > 0) return
  drag.current = { y: e.clientY, from: lift, at: performance.now(), last: e.clientY, v: 0, moved: false, collapseOnly }
 }
 const move = (e: React.PointerEvent) => {
  const d = drag.current
  if (!d) return
  const dy = e.clientY - d.y
  /* From inside the scroller only a downward pull counts, so reading never fights the sheet. */
  if (d.collapseOnly && dy <= SLOP) return
  if (!d.moved && Math.abs(dy) < SLOP) return
  d.moved = true
  if (!dragging) report(true)
  const next = Math.min(1, Math.max(DOWN, d.from - dy / (height.current * (REST - UP))))
  if (next !== liftRef.current) onLift(next)
  const now = performance.now()
  d.v = (e.clientY - d.last) / Math.max(now - d.at, 1)
  d.last = e.clientY; d.at = now
 }
 const end = () => {
  const d = drag.current
  drag.current = null
  report(false)
  if (!d || !d.moved) return
  /* Thrown hard enough it goes all the way to the end it was thrown toward; a gentler
     drag settles at whichever of the three resting places, collapsed to show the whole
     field, at rest, or raised, it ends up nearest to. */
  if (Math.abs(d.v) > 0.5) { onLift(d.v < 0 ? 1 : DOWN); return }
  const cur = liftRef.current
  onLift([DOWN, 0, 1].reduce((best, stop) => Math.abs(stop - cur) < Math.abs(best - cur) ? stop : best))
 }
 /* A tap on the handle steps through the same three places: down at rest, it raises;
    anywhere else, it comes back to rest rather than jumping straight past it. */
 const tapNext = () => Math.abs(liftRef.current) < 0.05 ? 1 : 0

 /* The travel itself lives in CSS, off --lift, so it runs on the compositor. */
 return <section className="sheet" aria-label={label} data-lifted={lift > 0.5}>
  <button type="button" className="sheet-grab" aria-label={lift > 0.5 ? 'Lower the panel' : 'Raise the panel'} aria-expanded={lift > 0.5}
   onPointerDown={e => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); start(e, false) }}
   onPointerMove={move}
   onPointerUp={e => { const wasDrag = drag.current?.moved; end(); if (!wasDrag) onLift(tapNext()) }}
   onPointerCancel={end}
   onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onLift(tapNext()) } }}>
   <span aria-hidden="true"/>
  </button>
  <div ref={scroller} className="sheet-scroll"
   onPointerDown={e => start(e, true)} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
   {children}
  </div>
 </section>
}
