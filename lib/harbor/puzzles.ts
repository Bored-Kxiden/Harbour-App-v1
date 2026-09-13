import type { PuzzleId } from './model'

/* ================================================================
   Three small puzzles, generated fresh from the date.
   Everyone on the same day gets the same board, which is the only
   reason comparing times with your family means anything. Nothing
   here is stored: the day is the seed, so the board is reproducible
   on any device without a server handing it out.
   ================================================================ */

/** Deterministic, seeded from a string. Not cryptographic, just stable. */
export function seedRandom(seed: string) {
 let h = 2166136261
 for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) }
 return () => {
  h ^= h << 13; h ^= h >>> 17; h ^= h << 5
  return ((h >>> 0) % 100000) / 100000
 }
}
function shuffled<T>(list: T[], random: () => number) {
 const out = list.slice()
 for (let i = out.length - 1; i > 0; i--) {
  const j = Math.floor(random() * (i + 1));
  [out[i], out[j]] = [out[j], out[i]]
 }
 return out
}

export const puzzleMeta: { id: PuzzleId; name: string; blurb: string; rule: string }[] = [
 { id: 'sudoku', name: 'Four', blurb: 'Mini sudoku, four by four', rule: 'Every row, column and box holds 1 to 4 once each.' },
 { id: 'zip', name: 'Zip', blurb: 'One line through every square', rule: 'Draw one path that hits 1, 2, 3… in order and fills every square.' },
 { id: 'tango', name: 'Tango', blurb: 'Suns and moons, kept even', rule: 'Three of each per row and column, and never three of a kind in a row.' },
]

/* ---------- Four: a 4x4 sudoku ---------- */
export type SudokuBoard = { given: (number | null)[]; solution: number[] }
export function makeSudoku(day: string): SudokuBoard {
 const random = seedRandom(`four-${day}`)
 const base = [1, 2, 3, 4]
 /* Any 4x4 solution is a band-and-stack shuffle of one canonical grid, which is
    both faster and safer than backtracking into a grid that has no solution. */
 const rows = [[0, 1, 2, 3], [2, 3, 0, 1], [1, 0, 3, 2], [3, 2, 1, 0]]
 const digits = shuffled(base, random)
 const rowOrder = [...shuffled([0, 1], random), ...shuffled([2, 3], random)]
 const colSwap = random() > 0.5
 const solution: number[] = []
 for (const r of rowOrder) {
  const row = rows[r].map(i => digits[i])
  const laid = colSwap ? [row[1], row[0], row[3], row[2]] : row
  solution.push(...laid)
 }
 /* Six clues is the sweet spot for 4x4: solvable by looking, not by guessing. */
 const hidden = new Set(shuffled([...Array(16).keys()], random).slice(0, 10))
 return { solution, given: solution.map((v, i) => hidden.has(i) ? null : v) }
}

/* ---------- Zip: one path, in order, through every square ---------- */
export type ZipBoard = { size: number; marks: Record<number, number>; path: number[] }
export function makeZip(day: string, size = 5): ZipBoard {
 const random = seedRandom(`zip-${day}`)
 const cells = size * size
 const neighbours = (i: number) => {
  const x = i % size, y = Math.floor(i / size)
  const out: number[] = []
  if (x > 0) out.push(i - 1)
  if (x < size - 1) out.push(i + 1)
  if (y > 0) out.push(i - size)
  if (y < size - 1) out.push(i + size)
  return out
 }
 /* Randomised depth-first search for a Hamiltonian path. The dead-end check below is
    what keeps it quick: a square with no way out, that is not the one we are about to
    finish on, means this branch can never cover the grid. */
 const path: number[] = []
 const seen = new Array<boolean>(cells).fill(false)
 let steps = 0
 const walk = (at: number): boolean => {
  path.push(at); seen[at] = true
  if (path.length === cells) return true
  if (++steps < 400000) {
   for (const next of shuffled(neighbours(at), random)) {
    if (seen[next]) continue
    const stuck = neighbours(next).every(n => seen[n] && n !== at) && path.length + 1 < cells
    if (stuck) continue
    if (walk(next)) return true
   }
  }
  path.pop(); seen[at] = false
  return false
 }
 const starts = shuffled([...Array(cells).keys()], random)
 let found = false
 for (const start of starts) { if (walk(start)) { found = true; break } }
 if (!found) {
  /* A boustrophedon always exists, so the day still has a puzzle even in the
     vanishingly unlikely case the search budget runs out. */
  path.length = 0
  for (let y = 0; y < size; y++) {
   for (let x = 0; x < size; x++) path.push(y * size + (y % 2 ? size - 1 - x : x))
  }
 }
 const stops = Math.min(6, Math.max(4, Math.round(size * 1.2)))
 const marks: Record<number, number> = {}
 for (let n = 0; n < stops; n++) {
  const at = Math.round((n / (stops - 1)) * (cells - 1))
  marks[path[at]] = n + 1
 }
 return { size, marks, path }
}

/* ---------- Tango: suns and moons, three of each, never three together ---------- */
export type TangoBoard = { size: number; given: (0 | 1 | null)[]; solution: (0 | 1)[] }
function rowPatterns(size: number): number[][] {
 const out: number[][] = []
 const build = (row: number[], ones: number) => {
  if (row.length === size) { if (ones === size / 2) out.push(row.slice()); return }
  if (ones > size / 2 || row.length - ones > size / 2) return
  for (const v of [0, 1]) {
   const n = row.length
   if (n >= 2 && row[n - 1] === v && row[n - 2] === v) continue
   row.push(v); build(row, ones + v); row.pop()
  }
 }
 build([], 0)
 return out
}
export function makeTango(day: string, size = 6): TangoBoard {
 const random = seedRandom(`tango-${day}`)
 const patterns = shuffled(rowPatterns(size), random)
 const grid: number[][] = []
 const fits = (row: number[]) => row.every((v, x) => {
  const column = grid.map(r => r[x])
  if (column.filter(c => c === v).length + 1 > size / 2) return false
  const n = column.length
  return !(n >= 2 && column[n - 1] === v && column[n - 2] === v)
 })
 const build = (): boolean => {
  if (grid.length === size) return true
  for (const row of patterns) {
   if (!fits(row)) continue
   grid.push(row)
   if (build()) return true
   grid.pop()
  }
  return false
 }
 build()
 const solution = grid.flat() as (0 | 1)[]
 /* Half the board is given. Tango is a deduction puzzle, not a memory test, and a
    sparser board on a phone is mostly an invitation to guess. */
 const hidden = new Set(shuffled([...Array(size * size).keys()], random).slice(0, Math.round(size * size * 0.55)))
 return { size, solution, given: solution.map((v, i) => hidden.has(i) ? null : v) }
}

/** Whether a filled Tango grid obeys the rules, so a wrong cell can be pointed at
    rather than the whole board simply refusing to be finished. */
export function tangoFaults(cells: (0 | 1 | null)[], size: number): Set<number> {
 const bad = new Set<number>()
 const at = (x: number, y: number) => cells[y * size + x]
 for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
   const v = at(x, y)
   if (v === null) continue
   if (x >= 2 && at(x - 1, y) === v && at(x - 2, y) === v) { bad.add(y * size + x); bad.add(y * size + x - 1); bad.add(y * size + x - 2) }
   if (y >= 2 && at(x, y - 1) === v && at(x, y - 2) === v) { bad.add(y * size + x); bad.add((y - 1) * size + x); bad.add((y - 2) * size + x) }
  }
 }
 for (let i = 0; i < size; i++) {
  for (const v of [0, 1] as const) {
   const row = [...Array(size).keys()].filter(x => at(x, i) === v)
   if (row.length > size / 2) for (const x of row) bad.add(i * size + x)
   const col = [...Array(size).keys()].filter(y => at(i, y) === v)
   if (col.length > size / 2) for (const y of col) bad.add(y * size + i)
  }
 }
 return bad
}
