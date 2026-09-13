/* The land itself.

   Two readings of one world. Pull back and the lens flattens: you are looking
   straight down at a plan, every person's patch laid out like plots on a map.
   Push in and it tilts up into the landscape, and the ground stops being a plane,
   because the height field was under it the whole time. Nothing is swapped out
   between the two; `tilt` just moves from 0 to 1 and the same points land
   somewhere else.

   Everything here is deterministic off one seed, so the meadow you learn is the
   meadow you come back to. */

const SEED = 20260911

/* ---------- noise ---------- */
export function hash2(xi: number, yi: number, seed: number) {
 let h = seed ^ Math.imul(xi, 374761393) ^ Math.imul(yi, 668265263)
 h = Math.imul(h ^ (h >>> 13), 1274126177)
 return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}
function noise(x: number, y: number, seed: number) {
 const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi
 const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
 const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed)
 const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed)
 return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v
}
function fbm(x: number, y: number, seed: number, oct = 4) {
 let sum = 0, amp = 1, freq = 1, norm = 0
 for (let i = 0; i < oct; i++) { sum += noise(x * freq, y * freq, seed + i * 101) * amp; norm += amp; amp *= 0.5; freq *= 2 }
 return sum / norm
}
export const clamp01 = (n: number) => n < 0 ? 0 : n > 1 ? 1 : n
export const smooth = (n: number) => { const t = clamp01(n); return t * t * (3 - 2 * t) }

/* ---------- the shape of the ground ---------- */
export const CELL = 15, COLS = 150, ROWS = 112
export const FIELD_W = COLS * CELL, FIELD_H = ROWS * CELL
const N = 1250

/** A stream finds the low ground on the left, and everything drains toward it. */
export const riverAt = (wy: number) => FIELD_W * 0.12 + fbm(wy / 900 * 1.7, 3.2, SEED + 505, 3) * FIELD_W * 0.26

export function landAt(wx: number, wy: number) {
 const dx = (wx - FIELD_W / 2) / (FIELD_W * 0.52), dy = (wy - FIELD_H / 2) / (FIELD_H * 0.52)
 return (1 - Math.sqrt(dx * dx + dy * dy)) * 0.72 + fbm(wx / N * 1.9 + 41, wy / N * 1.9 + 41, SEED + 2200, 4) * 0.5 - 0.16
}

/** The bump under everything. Ridged folds plus a rise toward the back, cut by the stream. */
export function heightAt(wx: number, wy: number) {
 const base = fbm(wx / N * 2.1, wy / N * 2.1, SEED, 5)
 const folds = fbm(wx / N * 1.3 + 9, wy / N * 1.3 + 9, SEED + 77, 4)
 const ridge = 1 - Math.abs(folds * 2 - 1)
 let h = base * 0.42 + ridge * ridge * 0.3 + smooth(1 - wy / (FIELD_H * 0.58)) * 0.5
 h *= 0.46 + 0.54 * smooth(wx / FIELD_W * 1.9)
 const bank = Math.abs(wx - riverAt(wy))
 if (bank < 58) h = Math.min(h, 0.2 + bank / 58 * 0.16)
 return clamp01(h)
}
export const moistureAt = (wx: number, wy: number) => fbm(wx / N * 3.3 + 21, wy / N * 3.3 + 21, SEED + 311, 4)
export const grovesAt = (wx: number, wy: number) => fbm(wx / N * 9.5 + 4, wy / N * 9.5 + 4, SEED + 907, 3)
export const meadowAt = (wx: number, wy: number) => fbm(wx / N * 6.2 + 71, wy / N * 6.2 + 71, SEED + 1601, 3)

/* ---------- the lens ----------
   One projection with a dial on it. At tilt 0 it is an orthographic plan; at tilt 1
   a camera standing in the field looking out. In between it is the honest average of
   the two, which is what makes the change of view read as the ground tipping up
   rather than as a cut between two pictures. */
export const TILT_FROM = 2.2, TILT_TO = 4.6, MAX_REL = 26
const EYE = 300, SET_BACK = 2.4, ELEVATION = 168
export const HORIZON = 0.3

export type Camera = { x: number; y: number; zoom: number }
/** `band` is the height the plan is composed to fit: a fixed proportion the lens
    is framed and zoomed against, chosen once so the layout never shifts as the card
    moves. `reveal` is the separate, live question of how much of the canvas the
    card is actually leaving uncovered right now; it only ever grows past band,
    since band was already the safe default before the card could be pulled down
    past where it used to rest. */
export type View = { w: number; h: number; band: number; reveal: number; base: number }
export type Lens = { tilt: number; focal: number; eye: number; back: number; camZ: number; cam: Camera; view: View }
export type Point = { x: number; y: number; s: number }

export const overviewZoom = (w: number, band: number) => (!w || !band) ? 0.2 : Math.min(w / FIELD_W, band / FIELD_H) * 0.96
export const clampZoom = (z: number, base: number) => Math.min(base * MAX_REL, Math.max(base, z))
export const tiltFor = (zoom: number, base: number) => smooth((zoom / base - TILT_FROM) / (TILT_TO - TILT_FROM))

export function buildLens(cam: Camera, view: View): Lens {
 const rel = Math.max(cam.zoom / view.base, 0.6)
 const eye = Math.max(34, EYE * TILT_TO / rel)
 return {
  tilt: tiltFor(cam.zoom, view.base),
  focal: view.h * 0.92, eye, back: eye * SET_BACK,
  camZ: heightAt(cam.x, cam.y) * ELEVATION,
  cam, view,
 }
}

export function project(lens: Lens, wx: number, wy: number, wz: number, out: Point): Point {
 const { cam, view } = lens
 const flatX = view.w / 2 + (wx - cam.x) * cam.zoom
 const flatY = view.band * 0.5 + (wy - cam.y) * cam.zoom
 if (lens.tilt <= 0.002) { out.x = flatX; out.y = flatY; out.s = cam.zoom; return out }
 const d = Math.max(lens.eye * 0.3, cam.y + lens.back - wy)
 const tx = view.w / 2 + lens.focal * (wx - cam.x) / d
 const ty = view.h * HORIZON + lens.focal * (lens.eye + lens.camZ - wz * ELEVATION) / d
 const ts = lens.focal / d
 out.x = flatX + (tx - flatX) * lens.tilt
 out.y = flatY + (ty - flatY) * lens.tilt
 out.s = cam.zoom + (ts - cam.zoom) * lens.tilt
 return out
}

/* ---------- what grows where ----------
   A cell is one handful of ground. Far away it is a dab of colour; close up the
   same handful becomes blades you can count, which is how the plan turns into a
   meadow without anything being swapped. */
export type Ground = 'grass' | 'bloom' | 'water' | 'reed' | 'grove'
export type Cell = {
 x: number; y: number; z: number
 size: number      /* world-space spread of the handful */
 tone: 0 | 1 | 2   /* which of the palette's three field greens */
 kind: Ground
 bloom: number     /* 0-1, picks the wild flower and its colour */
 lean: number      /* the blade's own idea of straight */
 tall: number
 plot: number      /* which person's clearing this handful stands in, or -1 */
}

export function buildCells(): Cell[] {
 const out: Cell[] = []
 for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
   const x = col * CELL + (hash2(col, row, SEED + 5) - 0.5) * CELL * 0.6
   const y = row * CELL + (hash2(col, row, SEED + 6) - 0.5) * CELL * 0.6
   if (landAt(x, y) < 0.2) continue
   const z = heightAt(x, y)
   const m = moistureAt(x, y), grove = grovesAt(x, y), meadow = meadowAt(x, y)
   const chance = hash2(col, row, SEED + 7)
   const roll = hash2(col, row, SEED + 8)

   let kind: Ground = 'grass', size = 0.5, tone: 0 | 1 | 2 = 1, tall = 0.6
   if (z < 0.3) { kind = 'water'; size = 0.9 + (0.3 - z) * 2; tone = 0; tall = 0.2 }
   else if (z < 0.355) { kind = 'reed'; size = 0.5; tone = 2; tall = 1.1 }
   else if (meadow > 0.62 && chance > 0.44) { kind = 'bloom'; size = 0.5 + (meadow - 0.62) * 1.4; tone = 1; tall = 0.9 }
   else if (grove > 0.66) { kind = 'grove'; size = 0.7 + (grove - 0.66) * 2.2 + m * 0.3; tone = 2; tall = 1.5 }
   else { size = 0.3 + m * 0.5; tone = (Math.min(2, Math.floor(z * 2.4 + chance * 1.2)) || 0) as 0 | 1 | 2; tall = 0.45 + m * 0.7 }

   out.push({
    x, y, z, kind, tone, tall,
    size: Math.min(size, 2.3),
    bloom: roll,
    lean: (hash2(col, row, SEED + 9) - 0.5) * 0.5,
    plot: -1,
   })
  }
 }
 return out
}

/* ---------- the sections of the plan ---------- */
export type Plot = { id: string; x: number; y: number; radius: number; ring: [number, number][] }

/** Each person gets a clearing on good ground, shaped by the same noise the land is,
    so the plots look grown rather than stamped. */
export function buildPlots(ids: string[]): Plot[] {
 const spots: Plot[] = []
 const wide = FIELD_W * 0.62, tall = FIELD_H * 0.5
 ids.forEach((id, i) => {
  const turn = i * 2.399963 + 0.7
  const reach = 0.34 + (i % 2) * 0.26
  let x = FIELD_W * 0.52 + Math.cos(turn) * wide * reach * 0.5
  let y = FIELD_H * 0.5 + Math.sin(turn) * tall * reach * 0.62
  /* Walk off water and off the stream before settling. */
  for (let step = 0; step < 12; step++) {
   if (heightAt(x, y) > 0.42 && Math.abs(x - riverAt(y)) > 130) break
   x += 46; y -= 22
   if (x > FIELD_W * 0.9) x -= FIELD_W * 0.5
  }
  const radius = 118 + hash2(i, 3, SEED + 60) * 34
  const ring: [number, number][] = []
  for (let a = 0; a < 22; a++) {
   const ang = (a / 22) * Math.PI * 2
   const wobble = 0.72 + fbm(Math.cos(ang) * 1.4 + i * 9, Math.sin(ang) * 1.4 + i * 9, SEED + 700, 3) * 0.62
   ring.push([x + Math.cos(ang) * radius * wobble, y + Math.sin(ang) * radius * wobble])
  }
  spots.push({ id, x, y, radius, ring })
 })
 return spots
}

/** Tag every handful of ground with whose clearing it stands in, once, after the
    plots are known. Doing it here keeps the per-frame path free of lookups. */
export function assignPlots(cells: Cell[], plots: Plot[]) {
 for (const c of cells) {
  c.plot = -1
  for (let i = 0; i < plots.length; i++) {
   const p = plots[i]
   if (Math.abs(c.x - p.x) > p.radius * 1.6 || Math.abs(c.y - p.y) > p.radius * 1.6) continue
   if (inRing(p.ring, c.x, c.y)) { c.plot = i; break }
  }
 }
}

export function inRing(ring: [number, number][], px: number, py: number) {
 let inside = false
 for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
  const [xi, yi] = ring[i], [xj, yj] = ring[j]
  if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
 }
 return inside
}
