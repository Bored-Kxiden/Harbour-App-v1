'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check, Copy, Flame, Medal, RotateCcw, Timer } from 'lucide-react'
import { toast } from 'sonner'
import { useHarbor } from '@/lib/harbor/store'
import { connectStreak, goalsWon, localDay, puzzleResult, weeklyGoals, type PuzzleId } from '@/lib/harbor/model'
import { makeSudoku, makeTango, makeZip, puzzleMeta, seedRandom, tangoFaults } from '@/lib/harbor/puzzles'
import { Avatar } from './avatar'

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/** Three puzzles a day, the same three for everyone in the house. Short on purpose:
    the point is a reason to open the app on a day nobody has news, not a time sink.
    This is a panel rather than a page: it lives as one section of Activity, next to
    what your people shared and what you starred. While a puzzle is open it wants the
    whole screen, so it says so and Activity folds its own heading away. */
export function GamesPanel({ onPlaying }: { onPlaying?: (open: boolean) => void }) {
 const { state, update } = useHarbor()
 const [playing, setPlaying] = useState<PuzzleId | null>(null)
 const day = localDay()
 useEffect(() => { onPlaying?.(!!playing) }, [playing, onPlaying])
 if (!state) return null

 const finish = (puzzle: PuzzleId, seconds: number) => {
  update(s => s.puzzles.some(p => p.day === day && p.puzzle === puzzle) ? s
   : { ...s, puzzles: [...s.puzzles, { day, puzzle, seconds, at: new Date().toISOString() }] })
  setPlaying(null)
  toast.success(`Solved in ${clock(seconds)}.`)
 }

 if (playing) return <PuzzlePlayer id={playing} day={day} onDone={finish} onBack={() => setPlaying(null)}/>

 const done = state.puzzles.filter(p => p.day === day)
 const streak = connectStreak(state)
 return <>
  <div className="flow stagger" style={{ gap: 14 }}>
   <div className="score-row" style={{ ['--i' as string]: 0 }}>
    <div className="score">
     <b>{done.length}<span>/3</span></b>
     <span>done today</span>
    </div>
    <div className="score">
     <b><Flame aria-hidden="true"/>{streak}</b>
     <span>day streak</span>
    </div>
    <div className="score">
     <b>{state.puzzles.length}</b>
     <span>solved in all</span>
    </div>
   </div>

   <ul className="puzzle-list" style={{ ['--i' as string]: 1 }}>
    {puzzleMeta.map(meta => {
     const result = puzzleResult(state, day, meta.id)
     return <li key={meta.id}>
      <button type="button" className="puzzle-row" onClick={() => setPlaying(meta.id)} data-done={!!result}>
       <PuzzleMark id={meta.id}/>
       <span className="puzzle-body">
        <b>{meta.name}</b>
        <span>{meta.blurb}</span>
       </span>
       {result
        ? <span className="puzzle-time"><Check aria-hidden="true"/>{clock(result.seconds)}</span>
        : <span className="puzzle-go">Play</span>}
      </button>
     </li>
    })}
   </ul>

   <section aria-labelledby="board-heading" style={{ ['--i' as string]: 2 }}>
    <div className="row-head"><h2 id="board-heading">Today at home</h2></div>
    <Leaderboard day={day}/>
   </section>

   <section aria-labelledby="goals-heading" style={{ ['--i' as string]: 3 }}>
    <div className="row-head">
     <h2 id="goals-heading">This week</h2>
     <span className="small">{goalsWon(weeklyGoals(state))} of 3 done</span>
    </div>
    <ul className="goals">
     {weeklyGoals(state).map(goal => {
      const done = goal.done >= goal.target
      return <li key={goal.id} className="goal" data-done={done}>
       <span className="goal-tick" aria-hidden="true">{done ? <Check/> : <span className="goal-count">{goal.done}/{goal.target}</span>}</span>
       <span className="goal-body">
        <b>{goal.label}</b>
        <span>{goal.hint}</span>
       </span>
       <span className="goal-bar" aria-hidden="true"><i style={{ ['--p' as string]: goal.done / goal.target }}/></span>
      </li>
     })}
    </ul>
   </section>

   <Invite/>
  </div>
 </>
}

/** The one growth loop here that is not a game: a code somebody reads down the phone,
    and the other person is in your list. No points, no tier, nothing invented. */
function Invite() {
 const { state } = useHarbor()
 const [copied, setCopied] = useState(false)
 if (!state) return null
 const code = state.invite.code
 const copy = async () => {
  try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2200) }
  catch { toast.info(`Your code is ${code}. Copying is blocked in this browser.`) }
 }
 return <section className="card card-pad flow invite" style={{ ['--i' as string]: 4 }} aria-labelledby="invite-heading">
  <div>
   <h2 id="invite-heading" style={{ fontSize: 17 }}>Add someone to your home</h2>
   <p className="small">Read them this code. They type it in when they open Harbor and you are both in each other&rsquo;s list, playing the same puzzles.</p>
  </div>
  <div className="invite-code">
   <b>{code}</b>
   <button type="button" className="btn btn-soft" onClick={copy}>
    {copied ? <><Check aria-hidden="true"/>Copied</> : <><Copy aria-hidden="true"/>Copy</>}
   </button>
  </div>
  <p className="small">
   {state.invite.joined.length
    ? `${state.invite.joined.length} ${state.invite.joined.length === 1 ? 'person has' : 'people have'} joined with it.`
    : 'Nobody has used it yet.'}
  </p>
 </section>
}

/** A small square mark per puzzle, so the row is recognisable before it is read. */
function PuzzleMark({ id }: { id: PuzzleId }) {
 return <span className="puzzle-mark" data-kind={id} aria-hidden="true">
  {id === 'sudoku' && <svg viewBox="0 0 24 24"><path d="M3 3h18v18H3z" fill="none" stroke="currentColor" strokeWidth="1.6"/><path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="1.6"/><text x="7.5" y="10" fontSize="6" fill="currentColor" stroke="none" textAnchor="middle">1</text><text x="16.5" y="19" fontSize="6" fill="currentColor" stroke="none" textAnchor="middle">4</text></svg>}
  {id === 'zip' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 5h6v6H5zM5 19h14v-8"/><circle cx="5" cy="5" r="1.6" fill="currentColor"/><circle cx="19" cy="19" r="1.6" fill="currentColor"/></svg>}
  {id === 'tango' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="8" cy="8" r="3.4" fill="currentColor" stroke="none"/><path d="M19 13.5a4 4 0 1 1-4.4-4 3.2 3.2 0 0 0 4.4 4z"/></svg>}
 </span>
}

/** The household, ranked by how much of today they have finished. Everyone but you is
    playing a simulated day, which is what a demo can honestly offer. */
function Leaderboard({ day }: { day: string }) {
 const { state } = useHarbor()
 if (!state) return null
 const random = seedRandom(`board-${day}`)
 const rows = [
  { id: 'you', name: 'You', done: state.puzzles.filter(p => p.day === day).length, seconds: state.puzzles.filter(p => p.day === day).reduce((n, p) => n + p.seconds, 0) },
  ...state.people.map(person => {
   const done = Math.floor(random() * 4)
   return { id: person.id, name: person.name, done, seconds: done ? Math.round(60 + random() * 240) * done : 0 }
  }),
 ].sort((a, b) => b.done - a.done || (a.seconds || 1e9) - (b.seconds || 1e9))

 return <ol className="board">
  {rows.map((row, i) => <li key={row.id} className="board-row" data-you={row.id === 'you'}>
   <span className="board-rank">{i === 0 && row.done ? <Medal aria-hidden="true"/> : i + 1}</span>
   <Avatar person={row.id} size="sm"/>
   <b>{row.name}</b>
   <span className="board-score">{row.done ? `${row.done}/3 · ${clock(row.seconds)}` : 'not yet'}</span>
  </li>)}
 </ol>
}

/* ============================ playing ============================ */

function PuzzlePlayer({ id, day, onDone, onBack }: { id: PuzzleId; day: string; onDone: (id: PuzzleId, seconds: number) => void; onBack: () => void }) {
 const meta = puzzleMeta.find(m => m.id === id)!
 const [seconds, setSeconds] = useState(0)
 const [reset, setReset] = useState(0)
 useEffect(() => {
  const started = Date.now()
  const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000)
  return () => clearInterval(timer)
 }, [reset])
 const solved = () => onDone(id, seconds)

 return <div className="entrance puzzle-screen">
  <div className="puzzle-bar">
   <button type="button" className="ghost-btn" onClick={onBack} aria-label="Back to puzzles"><ArrowLeft aria-hidden="true"/></button>
   <b>{meta.name}</b>
   <span className="puzzle-clock"><Timer aria-hidden="true"/>{clock(seconds)}</span>
   <button type="button" className="ghost-btn" onClick={() => setReset(n => n + 1)} aria-label="Start this puzzle again"><RotateCcw aria-hidden="true"/></button>
  </div>
  <p className="puzzle-rule">{meta.rule}</p>
  <div className="wrap" key={reset}>
   {id === 'sudoku' && <SudokuGame day={day} onSolved={solved}/>}
   {id === 'zip' && <ZipGame day={day} onSolved={solved}/>}
   {id === 'tango' && <TangoGame day={day} onSolved={solved}/>}
  </div>
 </div>
}

function SudokuGame({ day, onSolved }: { day: string; onSolved: () => void }) {
 const board = useMemo(() => makeSudoku(day), [day])
 const [cells, setCells] = useState<(number | null)[]>(() => board.given.slice())
 const [at, setAt] = useState<number | null>(null)
 const won = useRef(false)

 const write = (value: number) => {
  if (at === null || board.given[at] !== null) return
  const next = cells.slice()
  next[at] = next[at] === value ? null : value
  setCells(next)
  if (!won.current && next.every((v, i) => v === board.solution[i])) { won.current = true; onSolved() }
 }
 const wrong = (i: number) => cells[i] !== null && cells[i] !== board.solution[i]

 return <div className="game">
  <div className="grid-4" role="group" aria-label="Mini sudoku">
   {cells.map((value, i) => <button key={i} type="button" className="cell-4"
    data-given={board.given[i] !== null} data-at={at === i} data-wrong={wrong(i)}
    aria-label={`Row ${Math.floor(i / 4) + 1}, column ${(i % 4) + 1}${value ? `, ${value}` : ', empty'}`}
    onClick={() => setAt(board.given[i] === null ? i : null)}>{value ?? ''}</button>)}
  </div>
  <div className="pad">
   {[1, 2, 3, 4].map(n => <button key={n} type="button" className="pad-key" onClick={() => write(n)} disabled={at === null}>{n}</button>)}
  </div>
 </div>
}

function ZipGame({ day, onSolved }: { day: string; onSolved: () => void }) {
 const board = useMemo(() => makeZip(day), [day])
 const [path, setPath] = useState<number[]>([])
 const grid = useRef<HTMLDivElement>(null)
 const drawing = useRef(false)
 const won = useRef(false)
 const size = board.size
 const total = size * size
 const highest = Math.max(...Object.values(board.marks))

 /* Extending is the only move: step onto a neighbour of the end, or back onto the
    square before it to rub the last step out. Everything else is ignored, which is
    what lets the same code answer a drag and a tap. */
 const extend = (cell: number) => {
  setPath(prev => {
   if (!prev.length) return board.marks[cell] === 1 ? [cell] : prev
   if (prev.length > 1 && cell === prev[prev.length - 2]) return prev.slice(0, -1)
   const end = prev[prev.length - 1]
   if (cell === end || prev.includes(cell)) return prev
   const adjacent = Math.abs(cell - end) === size || (Math.abs(cell - end) === 1 && Math.floor(cell / size) === Math.floor(end / size))
   if (!adjacent) return prev
   /* A numbered square can only be stepped on when every earlier number is behind us. */
   const mark = board.marks[cell]
   if (mark) {
    const reached = prev.filter(c => board.marks[c]).length
    if (mark !== reached + 1) return prev
   }
   const next = [...prev, cell]
   if (!won.current && next.length === total && board.marks[cell] === highest) { won.current = true; onSolved() }
   return next
  })
 }
 const cellAt = (x: number, y: number) => {
  const box = grid.current?.getBoundingClientRect()
  if (!box) return null
  const col = Math.floor(((x - box.left) / box.width) * size)
  const row = Math.floor(((y - box.top) / box.height) * size)
  if (col < 0 || row < 0 || col >= size || row >= size) return null
  return row * size + col
 }

 return <div className="game">
  <div ref={grid} className="grid-zip" style={{ ['--n' as string]: size }} role="application"
   tabIndex={0}
   aria-label={`Zip. ${path.length} of ${total} squares filled. Arrow keys draw the line, Backspace steps back.`}
   /* Drawing is a drag, which leaves a keyboard with nothing to do, so the arrows
      walk the same line one square at a time and Backspace rubs the last one out. */
   onKeyDown={e => {
    const end = path[path.length - 1]
    const step = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' ? -size : e.key === 'ArrowDown' ? size : 0
    if (step) {
     e.preventDefault()
     if (!path.length) { const first = Number(Object.keys(board.marks).find(c => board.marks[Number(c)] === 1)); extend(first); return }
     const next = end + step
     if (next >= 0 && next < total) extend(next)
    }
    if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); setPath(prev => prev.slice(0, -1)) }
   }}
   onPointerDown={e => {
    /* The sheet this grid sits in drags itself downward on any pointer that starts
       at the top of its scroller, and it captures the pointer to do it. Drawing a
       line downward is the same gesture, so without this the first stroke pulled
       the whole screen down instead. The grid owns its own pointers. */
    e.stopPropagation()
    drawing.current = true
    grid.current?.setPointerCapture(e.pointerId)
    const c = cellAt(e.clientX, e.clientY)
    if (c !== null) extend(c)
   }}
   onPointerMove={e => { if (!drawing.current) return; const c = cellAt(e.clientX, e.clientY); if (c !== null) extend(c) }}
   onPointerUp={() => { drawing.current = false }}
   onPointerCancel={() => { drawing.current = false }}>
   {[...Array(total).keys()].map(i => {
    const step = path.indexOf(i)
    return <div key={i} className="cell-zip" data-on={step >= 0} data-end={step === path.length - 1 && step >= 0}>
     {board.marks[i] ? <span className="zip-mark">{board.marks[i]}</span> : null}
    </div>
   })}
  </div>
  <div className="game-foot">
   <span>{path.length} of {total} squares</span>
   <button type="button" className="btn btn-soft" onClick={() => setPath([])} disabled={!path.length}>Clear the line</button>
  </div>
 </div>
}

function TangoGame({ day, onSolved }: { day: string; onSolved: () => void }) {
 const board = useMemo(() => makeTango(day), [day])
 const [cells, setCells] = useState<(0 | 1 | null)[]>(() => board.given.slice())
 const won = useRef(false)
 const faults = tangoFaults(cells, board.size)

 const cycle = (i: number) => {
  if (board.given[i] !== null) return
  const next = cells.slice()
  next[i] = next[i] === null ? 0 : next[i] === 0 ? 1 : null
  setCells(next)
  if (!won.current && next.every(v => v !== null) && !tangoFaults(next, board.size).size) { won.current = true; onSolved() }
 }

 return <div className="game">
  <div className="grid-tango" style={{ ['--n' as string]: board.size }} role="group" aria-label="Tango">
   {cells.map((value, i) => <button key={i} type="button" className="cell-tango"
    data-given={board.given[i] !== null} data-bad={faults.has(i)}
    aria-label={`Row ${Math.floor(i / board.size) + 1}, column ${(i % board.size) + 1}: ${value === 0 ? 'sun' : value === 1 ? 'moon' : 'empty'}`}
    onClick={() => cycle(i)}>
    {value === 0 && <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6" fill="currentColor"/></svg>}
    {value === 1 && <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M19 14.5A7.5 7.5 0 1 1 10.4 5a6 6 0 0 0 8.6 9.5z"/></svg>}
   </button>)}
  </div>
  <div className="game-foot">
   <span>{cells.filter(v => v === null).length} squares left</span>
   <button type="button" className="btn btn-soft" onClick={() => setCells(board.given.slice())}>Start over</button>
  </div>
 </div>
}
