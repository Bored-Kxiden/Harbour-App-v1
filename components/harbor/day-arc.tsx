'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useHarbor } from '@/lib/harbor/store'
import { blocksFor, DAY_CLOSE, DAY_OPEN, formatTime, freeWindows, localDay, minutes, setBlocks, type Interval } from '@/lib/harbor/model'

const OPEN = minutes(DAY_OPEN), CLOSE = minutes(DAY_CLOSE)
/* The scene is drawn once in a 320 by 196 box and scaled to whatever width the card
   is given, so it holds its proportions on a 320px phone and on a tablet alike. */
const CX = 160, CY = 146, R = 112
const SWEEP = Math.PI * R

/** A point on the day's arc. Morning sits on the left, evening on the right, and the
    sun climbs over the middle, which is the shape everybody already carries in their
    head for a day. It reads at a glance, which a grid of half-hour cells does not. */
function point(m: number) {
 const t = Math.min(1, Math.max(0, (m - OPEN) / (CLOSE - OPEN)))
 const angle = Math.PI - t * Math.PI
 return { x: CX + Math.cos(angle) * R, y: CY - Math.sin(angle) * R }
}
function arcPath(from: number, to: number) {
 const a = point(from), b = point(to)
 const large = (to - from) / (CLOSE - OPEN) > 0.5 ? 1 : 0
 return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} A${R} ${R} 0 ${large} 1 ${b.x.toFixed(1)} ${b.y.toFixed(1)}`
}
const mid = (block: Interval) => (minutes(block.start) + minutes(block.end)) / 2
const covers = (block: Interval, m: number) => minutes(block.start) <= m && m < minutes(block.end)
const span = (block: Interval) => minutes(block.end) - minutes(block.start)
/* Four quiet drop lines, at the hours a day tends to turn: mid morning, after lunch,
   late afternoon, evening. They give the arc something to stand on. */
const TICKS = [10 * 60, 13 * 60, 16 * 60, 19 * 60]

/** The parent's own day: when they are free, and how to say when they are not.
    A student marks busy time by dragging across a week grid. A parent gets this. */
export function DayArc() {
 const { state, update } = useHarbor()
 const [adding, setAdding] = useState(false)
 const [now, setNow] = useState(() => new Date())
 useEffect(() => {
  const timer = setInterval(() => setNow(new Date()), 60000)
  return () => clearInterval(timer)
 }, [])
 if (!state) return null

 const day = localDay(now)
 const busy = blocksFor(state, day, 'you').slice().sort((a, b) => minutes(a.start) - minutes(b.start))
 const free = freeWindows(busy)
 const clock = now.getHours() * 60 + now.getMinutes()
 const withinDay = clock >= OPEN && clock <= CLOSE
 const busyNow = busy.find(b => covers(b, clock))
 /* The gap worth pointing at: the longest one still ahead of you, or the longest of
    the day once the day is behind you. */
 const ahead = free.filter(w => minutes(w.end) > clock)
 const focus = (ahead.length ? ahead : free).slice().sort((a, b) => span(b) - span(a))[0]
 const freeNow = !!focus && !busyNow && withinDay && covers(focus, clock)
 const marker = focus && !freeNow && busy.length ? point(mid(focus)) : null
 const sun = point(Math.min(CLOSE, Math.max(OPEN, clock)))

 /* The line under the scene names what the green mark is pointing at, so it says
    something the sentence above the card has not already said. */
 const caption = !busy.length ? 'Nothing marked today'
  : marker ? `Free again from ${formatTime(focus.start)}`
   : freeNow ? `Free until ${formatTime(focus.end)}`
    : busyNow ? 'Booked for the rest of today'
     : 'Outside the hours you share'

 const standing = busyNow
  ? `Busy with ${busyNow.label || 'something'} until ${formatTime(busyNow.end)}.`
  : focus
   ? `Free ${formatTime(focus.start)} to ${formatTime(focus.end)}.`
   : 'Every hour today is marked busy.'

 const remove = (block: Interval) => {
  update(s => setBlocks(s, day, 'you', blocksFor(s, day, 'you').filter(b => !(b.start === block.start && b.end === block.end))))
  toast.success('That time is yours again.')
 }

 return <section className="flow day-arc" aria-labelledby="arc-heading">
  <header className="arc-head">
   <span className="eyebrow">Your day</span>
   <h2 id="arc-heading">When you are free.</h2>
   <p>{standing} They see the gaps, never what is in them.</p>
  </header>

  <div className="arc-card">
   <svg viewBox="0 0 320 186" className="arc" role="img"
    aria-label={busy.length
     ? `Your day from ${formatTime(DAY_OPEN)} to ${formatTime(DAY_CLOSE)}, with ${busy.length} busy block${busy.length === 1 ? '' : 's'} marked. ${caption}.`
     : `Your day from ${formatTime(DAY_OPEN)} to ${formatTime(DAY_CLOSE)}, nothing marked busy.`}>
    <defs>
     {/* Left to right, the colours a day actually passes through: first light, the
         flat white of the middle of it, then the blue that comes down at the end. */}
     <linearGradient id="arc-day" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stopColor="var(--arc-dawn-c)"/>
      <stop offset="38%" stopColor="var(--arc-noon-c)"/>
      <stop offset="100%" stopColor="var(--arc-dusk-c)"/>
     </linearGradient>
     <radialGradient id="arc-sun-glow">
      <stop offset="0%" stopColor="var(--arc-sun-c)" stopOpacity=".55"/>
      <stop offset="100%" stopColor="var(--arc-sun-c)" stopOpacity="0"/>
     </radialGradient>
    </defs>

    {/* the hours a day turns on, dropped quietly to the ground */}
    <g className="arc-ticks">
     {TICKS.map(m => { const p = point(m); return <line key={m} x1={p.x} y1={p.y + 6} x2={p.x} y2="168"/> })}
    </g>

    {/* the whole day, drawn once soft and once sharp, then the hours already spoken
        for painted back over it */}
    <path className="arc-halo" d={arcPath(OPEN, CLOSE)} style={{ ['--sweep' as string]: SWEEP }}/>
    <path className="arc-line" d={arcPath(OPEN, CLOSE)} style={{ ['--sweep' as string]: SWEEP }}/>
    {busy.map((block, i) => <path key={i} className="arc-busy" d={arcPath(minutes(block.start), minutes(block.end))}/>)}

    {/* three ridges, the same soft ones the meadow paints, so the arc has ground to
        set behind rather than ending in mid air */}
    <g className="arc-land" aria-hidden="true">
     <path className="arc-ridge-1" d="M-10 146 Q38 130 82 140 Q126 150 162 134 Q202 116 244 136 Q284 154 330 140 L330 190 L-10 190Z"/>
     <path className="arc-ridge-2" d="M-10 158 Q44 146 96 155 Q144 163 190 150 Q234 138 278 152 Q306 161 330 154 L330 190 L-10 190Z"/>
     <path className="arc-ridge-3" d="M-10 170 Q56 160 112 167 Q170 174 222 165 Q276 156 330 168 L330 190 L-10 190Z"/>
    </g>

    {marker && <g className="arc-mark" style={{ ['--x' as string]: `${marker.x}px`, ['--y' as string]: `${marker.y}px` }}>
     <circle className="arc-mark-halo" cx={marker.x} cy={marker.y} r="13"/>
     <circle className="arc-mark-dot" cx={marker.x} cy={marker.y} r="5.5"/>
    </g>}

    {/* Where you are in the day. Before it opens and after it closes the sun is not
        up, and drawing one anyway would be the kind of small lie that makes a screen
        feel made up, so the moon takes the same place instead. */}
    <g className="arc-sun" transform={`translate(${sun.x.toFixed(1)} ${sun.y.toFixed(1)})`}>
     <circle r="21" fill="url(#arc-sun-glow)"/>
     {withinDay ? <>
      {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => <line key={deg} className="arc-ray"
       x1="0" y1="-11.5" x2="0" y2="-16" transform={`rotate(${deg})`}/>)}
      <circle className="arc-sun-disc" r="7.5"/>
     </> : <>
      <path className="arc-moon" d="M3.4-7.2A7.6 7.6 0 1 0 6.9 2.6 6 6 0 0 1 3.4-7.2z"/>
      <path className="arc-moon-spark" d="M-7.4-8.6l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z"/>
     </>}
    </g>
   </svg>

   <div className="arc-foot">
    <span className="arc-end">
     <svg viewBox="0 0 20 14" aria-hidden="true"><path className="arc-glyph-line" d="M2 12h16"/><path className="arc-glyph-fill" d="M4.5 9.5a5.5 5.5 0 0 1 11 0z"/><path className="arc-glyph-line" d="M10 1v1.8M3.6 3.6l1.3 1.3M16.4 3.6l-1.3 1.3"/></svg>
     morning
    </span>
    <span className="arc-caption">{caption}</span>
    <span className="arc-end">
     <svg viewBox="0 0 20 16" aria-hidden="true"><path className="arc-glyph-fill" d="M13.6 1.6a6.6 6.6 0 1 0 4.3 8.7 5.3 5.3 0 0 1-4.3-8.7z"/><path className="arc-glyph-spark" d="M5 2.2l.7 1.6L7.3 4.5l-1.6.7L5 6.8l-.7-1.6L2.7 4.5l1.6-.7z"/></svg>
     evening
    </span>
   </div>
  </div>

  <button type="button" className="arc-add-btn" onClick={() => setAdding(true)}>
   <span className="arc-add-ring"><Plus aria-hidden="true"/></span>
   Add your own busy time
  </button>

  {!!busy.length && <ul className="arc-list">
   {busy.map((block, i) => <li key={i}>
    <span className="arc-list-bar" data-on={covers(block, clock)} aria-hidden="true"/>
    <b>{block.label || 'Busy'}</b>
    <span className="arc-time">{formatTime(block.start)} to {formatTime(block.end)}</span>
    <button type="button" className="ghost-btn" onClick={() => remove(block)} aria-label={`Clear ${block.label || 'this block'}`}>
     <Trash2 aria-hidden="true"/>
    </button>
   </li>)}
  </ul>}

  {adding && <AddBusy day={day} onClose={() => setAdding(false)}/>}
 </section>
}

const PRESETS: { label: string; start: string; end: string }[] = [
 { label: 'Morning', start: '09:00', end: '12:00' },
 { label: 'Afternoon', start: '13:00', end: '17:00' },
 { label: 'Evening', start: '18:00', end: '21:00' },
]

/** Two time fields and three shortcuts, in the same sheet every other small job in
    Harbor opens in. No dragging, no grid: the native time picker is a control every
    phone already taught its owner how to use. */
function AddBusy({ day, onClose }: { day: string; onClose: () => void }) {
 const { update } = useHarbor()
 const [start, setStart] = useState('09:00')
 const [end, setEnd] = useState('12:00')
 const [label, setLabel] = useState('')
 const [error, setError] = useState<string>()
 const [host, setHost] = useState<HTMLElement | null>(null)
 useEffect(() => { setHost(document.body) }, [])
 useEffect(() => {
  const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
  document.addEventListener('keydown', key)
  return () => document.removeEventListener('keydown', key)
 }, [onClose])
 if (!host) return null

 const save = () => {
  if (minutes(start) >= minutes(end)) { setError('The end has to come after the start.'); return }
  update(s => setBlocks(s, day, 'you', [...blocksFor(s, day, 'you'), { start, end, label: label.trim() }]))
  toast.success(`Marked busy ${formatTime(start)} to ${formatTime(end)}.`)
  onClose()
 }

 return createPortal(<div className="curtain seed-curtain" role="dialog" aria-modal="true" aria-label="Mark busy time">
  <div className="curtain-sheet seed-sheet">
   <div className="sheet-head">
    <span>Mark busy time</span>
    <button type="button" className="ghost-btn" onClick={onClose} aria-label="Close without marking"><X aria-hidden="true"/></button>
   </div>

   <div>
    <span className="label" id="busy-rough">A rough time of day</span>
    <div className="chips" role="radiogroup" aria-labelledby="busy-rough">
     {PRESETS.map(p => <button key={p.label} type="button" role="radio" className="chip-choice"
      aria-checked={start === p.start && end === p.end}
      onClick={() => { setStart(p.start); setEnd(p.end); setError(undefined) }}>{p.label}</button>)}
    </div>
   </div>

   <div className="arc-times">
    <div>
     <label className="label" htmlFor="busy-from">From</label>
     <input className="input" id="busy-from" type="time" value={start} step={900}
      onChange={e => { setStart(e.target.value); setError(undefined) }}/>
    </div>
    <div>
     <label className="label" htmlFor="busy-to">Until</label>
     <input className="input" id="busy-to" type="time" value={end} step={900}
      onChange={e => { setEnd(e.target.value); setError(undefined) }}/>
    </div>
   </div>

   <div>
    <label className="label" htmlFor="busy-what">What is it? (optional)</label>
    <input className="input" id="busy-what" maxLength={40} value={label} autoComplete="off"
     placeholder="Work, temple, market…" onChange={e => setLabel(e.target.value)}/>
   </div>
   {error && <p className="field-error" role="alert">{error}</p>}

   <button type="button" className="btn btn-block" onClick={save}>Mark this time</button>
   <button type="button" className="btn btn-quiet btn-block" onClick={onClose}>Cancel</button>
  </div>
 </div>, host)
}
