/* The meadow, painted.

   The land and the lens live in terrain.ts; this file is only ever asked to put
   paint on what the lens hands back. One rule holds the illustration together:
   nothing is a hard edge. Hills, petals and water all get soft shoulders, because
   the reference is watercolour, not vector.

   The same cell is a dab of colour at distance and a handful of blades close up.
   That is the whole trick: no second renderer for the zoomed-in view, just paint
   that knows how much room it has been given. */
import { flowerSpec, type FlowerKind, type Weather } from './model'
import {
 CELL, clamp01, hash2, heightAt, HORIZON, project, smooth,
 type Cell, type Lens, type Point, type View,
} from './terrain'

function hash(i: number, seed: number) {
 let h = seed ^ Math.imul(i, 374761393)
 h = Math.imul(h ^ (h >>> 13), 1274126177)
 return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

/* ---------- the five skies ---------- */
export type Palette = {
 sky: [string, string, string]
 sun: string; sunGlow: string
 cloud: string; cloudCount: number
 hills: string[]; trees: string[]
 field: string[]; fieldDeep: string[]; water: string; reed: string
 wild: string
 haze: [number, number, number]
 light: number
}
const PALETTES: Record<Weather, Palette> = {
 clear: {
  sky: ['#8EC9EC', '#B9DFF1', '#E4F1F0'],
  sun: '#FFE9A8', sunGlow: 'rgba(255,224,150,.55)',
  cloud: 'rgba(255,255,255,.92)', cloudCount: 5,
  hills: ['#BFD9C4', '#A6CCA4', '#8FBE86', '#7BAE6E'],
  trees: ['#6FA26A', '#5C9159', '#4F8350'],
  field: ['#9CC77E', '#8ABB6C', '#7BAE60'], fieldDeep: ['#7FAE64', '#6E9F55', '#5F914B'],
  water: '#B7DCE8', reed: '#8FB877', wild: '#FFFFFF',
  haze: [240, 248, 236], light: 1,
 },
 bright: {
  sky: ['#7CC0E8', '#AEDAF0', '#EAF4E8'],
  sun: '#FFDE8A', sunGlow: 'rgba(255,214,120,.62)',
  cloud: 'rgba(255,255,255,.85)', cloudCount: 3,
  hills: ['#C7DCB8', '#AFD096', '#98C27C', '#85B369'],
  trees: ['#74A868', '#5F9556', '#52874C'],
  field: ['#A6CE80', '#93C26A', '#83B65D'], fieldDeep: ['#88B567', '#77A857', '#699C4C'],
  water: '#AFD9E8', reed: '#98C07C', wild: '#FFFDF4',
  haze: [250, 247, 230], light: 1.05,
 },
 cloudy: {
  sky: ['#A9BCC8', '#C4D3D9', '#DFE6E0'],
  sun: '#F2EBD8', sunGlow: 'rgba(236,232,214,.4)',
  cloud: 'rgba(252,252,250,.95)', cloudCount: 6,
  hills: ['#B3C2B0', '#9DB295', '#89A37F', '#78946D'],
  trees: ['#6B8C66', '#5A7D57', '#4E7049'],
  field: ['#93AE7E', '#84A36D', '#769863'], fieldDeep: ['#7C9868', '#6E8D59', '#62834F'],
  water: '#AEC4CC', reed: '#84A06E', wild: '#F6F7F1',
  haze: [226, 232, 226], light: 0.93,
 },
 rain: {
  sky: ['#8496A4', '#A6B6BE', '#C6D0C9'],
  sun: '#DDE0DA', sunGlow: 'rgba(220,224,216,.22)',
  cloud: 'rgba(236,240,240,.96)', cloudCount: 7,
  hills: ['#98A89A', '#869A85', '#748A72', '#657C62'],
  trees: ['#5C7A58', '#4E6C4B', '#446141'],
  field: ['#7E9770', '#728C63', '#668158'], fieldDeep: ['#6A8460', '#5F7A53', '#556F4A'],
  water: '#98B2BC', reed: '#6F8A60', wild: '#EDF0EA',
  haze: [206, 216, 212], light: 0.85,
 },
 storm: {
  sky: ['#5E6C79', '#7C8892', '#A3ABA4'],
  sun: '#C3C7C0', sunGlow: 'rgba(190,194,186,.16)',
  cloud: 'rgba(214,220,222,.96)', cloudCount: 8,
  hills: ['#7D8B80', '#6C7C6E', '#5C6D5D', '#4E5F4F'],
  trees: ['#48613F', '#3E5537', '#364A30'],
  field: ['#657C58', '#5B724E', '#526845'], fieldDeep: ['#546A49', '#4B6141', '#43583A'],
  water: '#7D939C', reed: '#5A7050', wild: '#E2E7E0',
  haze: [178, 188, 184], light: 0.76,
 },
}
export const paletteFor = (w: Weather) => PALETTES[w]
export const WEATHER_ORDER: Weather[] = ['clear', 'bright', 'cloudy', 'rain', 'storm']

/* ---------- wind ----------
   One field everything reads from, so a gust crosses the whole meadow at once
   instead of every flower having its own private breeze. */
export function windAt(x: number, y: number, t: number, strength: number) {
 const gust = 0.6 + 0.4 * Math.sin(t * 0.00042) + 0.22 * Math.sin(t * 0.0017 + 1.3)
 return (Math.sin(t * 0.0016 + x * 0.0042 + y * 0.008) + 0.45 * Math.sin(t * 0.0031 + x * 0.0095)) * gust * strength
}
export const windStrength: Record<Weather, number> = { clear: 0.24, bright: 0.34, cloudy: 0.46, rain: 0.66, storm: 1.15 }

/* ---------- the sky ---------- */
export function paintSky(ctx: CanvasRenderingContext2D, view: View, weather: Weather, tilt: number) {
 if (tilt < 0.02) return
 const p = PALETTES[weather]
 const horizon = view.h * HORIZON
 /* Flat out, you are looking down at ground, so the sky is only a wash at the edges.
    As the lens tilts the real sky comes up behind it. */
 const grad = ctx.createLinearGradient(0, 0, 0, horizon + 70)
 grad.addColorStop(0, p.sky[0]); grad.addColorStop(0.58, p.sky[1]); grad.addColorStop(1, p.sky[2])
 ctx.save()
 ctx.globalAlpha = tilt
 ctx.fillStyle = grad
 ctx.fillRect(0, 0, view.w, horizon + 70)
 ctx.restore()
}

/* ---------- the weather wheel ----------
   The five skies ride the rim of one wheel that stands behind the land. Choosing a
   weather turns the wheel; the new one climbs up over the hills and the old one goes
   down the other side. Nothing fades, it travels, which is why it reads as a change
   of day rather than a change of image. */
export const WHEEL_STEP = (Math.PI * 2) / 5
export const wheelAngleFor = (index: number) => -index * WHEEL_STEP

/** Where a wheel position lands on screen, and how far risen it is. Shared by the
   wheel's own paint and by the weather effects, so the sun disc the shaft comes
   from is the same sun disc drawn on the rim, not a second, uncoordinated one. */
export function wheelPoint(view: View, angle: number, index: number) {
 const horizon = view.h * HORIZON
 const R = view.h * 0.64
 const cx = view.w * 0.5, cy = horizon + R * 0.78
 const r = view.band * 0.078
 const a = -Math.PI / 2 + index * WHEEL_STEP + angle
 const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R
 const rise = clamp01((horizon + 90 - y) / 130)
 return { x, y, r, rise, visible: y <= horizon + 90 }
}

export function paintWheel(ctx: CanvasRenderingContext2D, view: View, angle: number, t: number, tilt: number) {
 if (tilt < 0.04) return
 const horizon = view.h * HORIZON
 const R = view.h * 0.64
 const cx = view.w * 0.5, cy = horizon + R * 0.78

 ctx.save()
 /* The rim, barely there: enough to say the five skies are on one wheel and not
    five pictures that swap. */
 ctx.globalAlpha = tilt * 0.9
 ctx.strokeStyle = 'rgba(255,255,255,.09)'
 ctx.lineWidth = 1.3
 ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.283185); ctx.stroke()

 WEATHER_ORDER.forEach((id, i) => {
  const { x, y, r, rise, visible } = wheelPoint(view, angle, i)
  if (!visible) return
  const a = -Math.PI / 2 + i * WHEEL_STEP + angle
  /* A spoke, so the turn is legible even when the emblem is a cloud among clouds. */
  ctx.globalAlpha = rise * tilt * 0.3
  ctx.strokeStyle = 'rgba(255,255,255,.5)'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(cx + Math.cos(a) * (R - r * 2.4), cy + Math.sin(a) * (R - r * 2.4))
  ctx.lineTo(cx + Math.cos(a) * (R - r * 1.5), cy + Math.sin(a) * (R - r * 1.5))
  ctx.stroke()
  /* And a halo, so it reads as carried rather than as weather that drifted in. */
  const halo = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 2.5)
  halo.addColorStop(0, 'rgba(255,255,255,.5)')
  halo.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.globalAlpha = rise * tilt * 0.42
  ctx.fillStyle = halo
  ctx.beginPath(); ctx.arc(x, y, r * 2.5, 0, 6.283185); ctx.fill()

  ctx.globalAlpha = rise * tilt
  paintEmblem(ctx, id, x, y, r, t)
 })
 ctx.restore()
}

function paintEmblem(ctx: CanvasRenderingContext2D, id: Weather, x: number, y: number, r: number, t: number) {
 const p = PALETTES[id]
 ctx.save()
 ctx.translate(x, y)
 if (id === 'clear' || id === 'bright') {
  const glow = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 2.2)
  glow.addColorStop(0, p.sunGlow); glow.addColorStop(1, 'rgba(255,224,150,0)')
  ctx.fillStyle = glow
  ctx.beginPath(); ctx.arc(0, 0, r * 2.2, 0, 6.283185); ctx.fill()
  ctx.fillStyle = p.sun
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283185); ctx.fill()
  ctx.restore(); return
 }
 /* The grey three are a cloud, with more weather under it the worse it gets. */
 const puffs: [number, number, number][] = [[-r * 0.7, r * 0.12, r * 0.62], [0, -r * 0.22, r * 0.86], [r * 0.72, r * 0.1, r * 0.66], [r * 0.2, r * 0.3, r * 0.6]]
 ctx.fillStyle = id === 'storm' ? 'rgba(170,180,186,.95)' : p.cloud
 ctx.beginPath()
 for (const [dx, dy, rr] of puffs) ctx.arc(dx, dy, rr, 0, 6.283185)
 ctx.fill()
 if (id === 'rain' || id === 'storm') {
  ctx.strokeStyle = 'rgba(226,238,244,.75)'
  ctx.lineWidth = r * 0.1; ctx.lineCap = 'round'
  for (let i = 0; i < 4; i++) {
   const dx = (-1.1 + i * 0.72) * r * 0.6
   const drop = ((t * 0.09 + i * 40) % 60) / 60
   ctx.globalAlpha = 0.9 * (1 - drop)
   ctx.beginPath()
   ctx.moveTo(dx, r * 0.7 + drop * r * 0.9)
   ctx.lineTo(dx - r * 0.09, r * 1.0 + drop * r * 0.9)
   ctx.stroke()
  }
  ctx.globalAlpha = 1
 }
 if (id === 'storm') {
  ctx.fillStyle = '#F7D35E'
  ctx.beginPath()
  ctx.moveTo(r * 0.1, r * 0.55); ctx.lineTo(-r * 0.3, r * 1.5)
  ctx.lineTo(r * 0.02, r * 1.42); ctx.lineTo(-r * 0.22, r * 2.2)
  ctx.lineTo(r * 0.45, r * 1.15); ctx.lineTo(r * 0.1, r * 1.2)
  ctx.closePath(); ctx.fill()
 }
 ctx.restore()
}

/* ---------- the far country ----------
   Bands of hill and a treeline, drawn in screen space and brought in by the tilt,
   so the back of the field reads as distance rather than as a cut edge. */
export function paintDistance(ctx: CanvasRenderingContext2D, view: View, weather: Weather, tilt: number, panX: number) {
 if (tilt < 0.02) return
 const p = PALETTES[weather]
 const horizon = view.h * HORIZON
 ctx.save()
 ctx.globalAlpha = tilt
 const bands = [
  { col: p.hills[0], amp: 20, off: 2, freq: 1.4, drift: 0.0004 },
  { col: p.hills[1], amp: 15, off: 12, freq: 2.2, drift: 0.0008 },
  { col: p.hills[2], amp: 10, off: 23, freq: 3.3, drift: 0.0014 },
 ]
 for (const band of bands) {
  const top = horizon + band.off - band.amp
  const grad = ctx.createLinearGradient(0, top, 0, top + 150)
  grad.addColorStop(0, band.col)
  grad.addColorStop(0.6, band.col + 'cc')
  grad.addColorStop(1, band.col + '00')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.moveTo(-10, horizon + band.off + band.amp)
  for (let x = -10; x <= view.w + 10; x += 12) {
   const u = (x / view.w) * band.freq + panX * band.drift
   ctx.lineTo(x, horizon + band.off - Math.sin(u * 3.1) * band.amp * 0.6 - Math.sin(u * 1.3 + 1.4) * band.amp * 0.5)
  }
  ctx.lineTo(view.w + 10, horizon + 170)
  ctx.lineTo(-10, horizon + 170)
  ctx.closePath(); ctx.fill()
 }
 /* Tree clumps on the skyline, parallaxing slower than the ground. */
 ctx.fillStyle = p.trees[0]
 for (let i = 0; i < 9; i++) {
  const tx = (((i * 121 + 37) - panX * 0.018) % (view.w + 160) + view.w + 160) % (view.w + 160) - 80
  const ty = horizon + 9 + (i % 3) * 5
  const rr = 12 + (i % 4) * 5
  ctx.beginPath()
  ctx.arc(tx, ty, rr, 0, 6.283185)
  ctx.arc(tx + rr * 0.8, ty + 3, rr * 0.7, 0, 6.283185)
  ctx.arc(tx - rr * 0.8, ty + 4, rr * 0.64, 0, 6.283185)
  ctx.fill()
 }
 ctx.restore()
}

export function paintHaze(ctx: CanvasRenderingContext2D, view: View, weather: Weather, tilt: number) {
 if (tilt < 0.02) return
 const [r, g, b] = PALETTES[weather].haze
 const horizon = view.h * HORIZON
 const grad = ctx.createLinearGradient(0, horizon - 34, 0, horizon + 96)
 grad.addColorStop(0, `rgba(${r},${g},${b},0)`)
 grad.addColorStop(0.3, `rgba(${r},${g},${b},${(0.68 * tilt).toFixed(3)})`)
 grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
 ctx.fillStyle = grad
 ctx.fillRect(0, horizon - 34, view.w, 130)
}

export function paintClouds(ctx: CanvasRenderingContext2D, view: View, weather: Weather, t: number, tilt: number) {
 if (tilt < 0.04) return
 const p = PALETTES[weather]
 const horizon = view.h * HORIZON
 ctx.save()
 ctx.globalAlpha = tilt
 ctx.fillStyle = p.cloud
 for (let i = 0; i < p.cloudCount; i++) {
  const s = 0.55 + hash(i, 811) * 0.75
  const y = horizon * (0.16 + hash(i, 822) * 0.62)
  const x = ((hash(i, 833) * (view.w + 340) + t * (0.0022 + hash(i, 844) * 0.0032) * 30) % (view.w + 340)) - 170
  ctx.beginPath()
  for (let k = 0; k < 4; k++) {
   const dx = (k - 1.5) * 26 * s
   const dy = (k === 1 || k === 2 ? -8 : 2) * s
   ctx.arc(x + dx, y + dy, (k === 1 || k === 2 ? 26 : 19) * s, 0, 6.283185)
  }
  ctx.fill()
 }
 ctx.restore()
}

/** The ground itself, before anything grows on it. Flat out it is the whole field
    seen from above; stood up it recedes to the horizon, which is the only place the
    two readings need different paint. */
export function paintPlane(ctx: CanvasRenderingContext2D, view: View, weather: Weather, tilt: number) {
 const p = PALETTES[weather]
 if (tilt < 0.02) return
 /* Started a little above the horizon and faded in, so the ground meets the sky on a
    ramp rather than on a line. A seam there is the one thing that says "two layers". */
 const top = view.h * HORIZON * tilt - 22
 const grad = ctx.createLinearGradient(0, top, 0, view.h)
 grad.addColorStop(0, p.hills[3] + '00')
 grad.addColorStop(0.045, p.hills[3])
 grad.addColorStop(0.2, p.field[0])
 grad.addColorStop(0.55, p.field[1])
 grad.addColorStop(1, p.fieldDeep[1])
 ctx.save()
 ctx.globalAlpha = tilt
 ctx.fillStyle = grad
 ctx.fillRect(0, top, view.w, view.h - top)
 ctx.restore()
}

/* ---------- the ground ----------
   Every cell is projected once. Far off it lands as a dab, batched by colour into
   one path so the whole back of the field costs five fills. Close in there is room
   for blades, and the same cell is drawn as a handful of grass leaning on the gust
   that is crossing the rest of the meadow at that instant. */
const dot: Point = { x: 0, y: 0, s: 1 }

export function paintGround(ctx: CanvasRenderingContext2D, lens: Lens, cells: Cell[], weather: Weather, t: number) {
 const p = PALETTES[weather]
 const { view } = lens
 const strength = windStrength[weather]
 const near: { c: Cell; x: number; y: number; r: number; s: number }[] = []
 const dabs: number[][] = [[], [], [], [], [], []]  /* three greens, deep, water, wild */
 /* Below the sheet's lip nothing is normally seen, and that is exactly where the
    projection blows up, so the cull is what keeps the near rows from becoming a
    wall. reveal tracks that lip's actual current position rather than assuming
    it never moves, so pulling the card down past rest paints the rest of the
    ground instead of leaving it blank. */
 const floor = view.reveal + 70

 for (let i = 0; i < cells.length; i++) {
  const c = cells[i]
  project(lens, c.x, c.y, c.z, dot)
  if (dot.x < -40 || dot.x > view.w + 40 || dot.y < -30 || dot.y > floor) continue
  /* A handful is at least as wide as the gap to the next one, so the plan reads as
     ground rather than as polka dots. */
  const tile = Math.min(CELL * dot.s * 0.66, 5)
  const raw = c.size * 3.2 * dot.s
  const r = Math.max(raw, tile)
  if (r < 0.3) continue
  /* The raw size decides what gets blades, not the tiled one: otherwise the whole
     field qualifies the moment the dabs start touching, and there is no near and far. */
  if (raw > 2.2 && lens.tilt > 0.12) { near.push({ c, x: dot.x, y: dot.y, r: Math.max(raw, 3), s: dot.s }); continue }
  const bucket = c.kind === 'water' ? 4 : c.kind === 'bloom' && raw > 0.8 ? 5 : c.kind === 'grove' ? 3 : c.tone
  /* Wild flowers keep their own size: tiled up to close the ground they would read
     as drifts of snow rather than as specks of colour in the grass. */
  dabs[bucket].push(dot.x, dot.y, bucket === 5 ? Math.max(raw * 0.6, 0.7) : r)
 }

 const colours = [p.field[0], p.field[1], p.field[2], p.fieldDeep[2], p.water, p.wild]
 for (let b = 0; b < dabs.length; b++) {
  const list = dabs[b]
  if (!list.length) continue
  ctx.fillStyle = colours[b]
  ctx.globalAlpha = [0.52, 0.52, 0.52, 0.34, 0.95, 0.62][b]
  ctx.beginPath()
  for (let i = 0; i < list.length; i += 3) {
   ctx.moveTo(list[i] + list[i + 2], list[i + 1])
   ctx.arc(list[i], list[i + 1], list[i + 2], 0, 6.283185)
  }
  ctx.fill()
 }
 ctx.globalAlpha = 1

 /* Painter's order: what is nearest is drawn last, so blades overlap the right way. */
 near.sort((a, b) => a.y - b.y)
 for (const n of near) {
  const c = n.c
  if (c.kind === 'water') {
   ctx.fillStyle = p.water
   ctx.beginPath(); ctx.ellipse(n.x, n.y, n.r * 1.3, n.r * 0.5, 0, 0, 6.283185); ctx.fill()
   continue
  }
  const gust = windAt(c.x, c.y, t, strength)
  if (c.kind === 'grove') {
   /* A bush, not a hole: three overlapping crowns leaning on the same gust. */
   const rr = Math.min(n.r * 0.85, 22)
   const sway = gust * rr * 0.18
   ctx.fillStyle = p.fieldDeep[2]
   ctx.beginPath()
   ctx.ellipse(n.x + sway, n.y - rr * 0.75, rr * 0.9, rr * 0.78, 0, 0, 6.283185)
   ctx.ellipse(n.x - rr * 0.62 + sway * 0.7, n.y - rr * 0.4, rr * 0.66, rr * 0.6, 0, 0, 6.283185)
   ctx.ellipse(n.x + rr * 0.66 + sway * 0.7, n.y - rr * 0.46, rr * 0.6, rr * 0.56, 0, 0, 6.283185)
   ctx.fill()
   ctx.fillStyle = p.field[2]
   ctx.beginPath()
   ctx.ellipse(n.x + sway - rr * 0.2, n.y - rr * 1.02, rr * 0.5, rr * 0.42, 0, 0, 6.283185)
   ctx.fill()
   continue
  }

  /* A tuft is filled, not stroked: a stroke of even width reads as a tally mark,
     and grass is wide at the root and nothing at the tip. */
  const base = Math.min(c.tall * 34 * n.s, 58)
  const blades = n.r > 10 ? 5 : n.r > 6 ? 4 : 3
  const spread = Math.min(n.r * 0.9, 11)
  ctx.fillStyle = c.kind === 'reed' ? p.reed : p.field[c.tone]
  for (let k = 0; k < blades; k++) {
   const seed = (c.bloom * 13.37 + k * 0.618) % 1
   const off = (k / (blades - 1) - 0.5) * spread + (seed - 0.5) * spread * 0.3
   const tall = base * (0.55 + seed * 0.85)
   const wide = Math.max(0.6, tall * 0.075)
   const bend = gust * tall * 0.42 + (c.lean + (seed - 0.5) * 0.5) * tall * 0.34
   const bx = n.x + off
   ctx.beginPath()
   ctx.moveTo(bx - wide, n.y + wide)
   ctx.quadraticCurveTo(bx - wide + bend * 0.34, n.y - tall * 0.56, bx + bend, n.y - tall)
   ctx.quadraticCurveTo(bx + wide + bend * 0.34, n.y - tall * 0.56, bx + wide, n.y + wide)
   ctx.closePath()
   ctx.fill()
  }

  if (c.kind === 'bloom' && n.r > 3.4) {
   const kind = WILD[Math.floor(c.bloom * WILD.length) % WILD.length]
   const f = flowerSpec(kind)
   const tall = base * 1.15
   const bend = gust * tall * 0.42
   const hx = n.x + bend, hy = n.y - tall
   const rr = Math.max(1.4, Math.min(n.r * 0.32, 7))
   ctx.strokeStyle = p.fieldDeep[0]
   ctx.lineWidth = Math.max(0.7, rr * 0.16)
   ctx.beginPath()
   ctx.moveTo(n.x, n.y)
   ctx.quadraticCurveTo(n.x + bend * 0.34, n.y - tall * 0.56, hx, hy)
   ctx.stroke()
   if (rr > 3) {
    for (let i = 0; i < 6; i++) {
     const a = (i / 6) * 6.283185 + c.bloom * 6
     ctx.fillStyle = i % 2 ? f.petal : f.petalDeep
     ctx.beginPath()
     ctx.ellipse(hx + Math.cos(a) * rr * 0.62, hy + Math.sin(a) * rr * 0.62, rr * 0.5, rr * 0.36, a, 0, 6.283185)
     ctx.fill()
    }
   } else {
    ctx.fillStyle = c.bloom > 0.5 ? f.petal : f.petalDeep
    ctx.beginPath(); ctx.arc(hx, hy, rr, 0, 6.283185); ctx.fill()
   }
   ctx.fillStyle = f.heart
   ctx.beginPath(); ctx.arc(hx, hy, rr * 0.34, 0, 6.283185); ctx.fill()
  }
 }
 ctx.lineCap = 'butt'
}

const WILD: FlowerKind[] = ['daisy', 'cosmos', 'tulip', 'marigold', 'bluebell', 'aster']

/* ---------- the sections, seen from above ----------
   Only in the plan. Once the lens tilts these dissolve, because standing in a field
   you do not see whose patch you are in, you see flowers. */
export function paintPlots(
 ctx: CanvasRenderingContext2D, lens: Lens, plots: { id: string; ring: [number, number][]; x: number; y: number }[],
 tintOf: (id: string) => string, alpha: number,
) {
 if (alpha < 0.02) return
 ctx.save()
 ctx.globalAlpha = alpha
 for (const plot of plots) {
  ctx.beginPath()
  plot.ring.forEach(([rx, ry], i) => {
   project(lens, rx, ry, heightAt(rx, ry), dot)
   if (i === 0) ctx.moveTo(dot.x, dot.y); else ctx.lineTo(dot.x, dot.y)
  })
  ctx.closePath()
  ctx.fillStyle = tintOf(plot.id)
  ctx.globalAlpha = alpha * 0.26
  ctx.fill()
  ctx.globalAlpha = alpha * 0.8
  ctx.setLineDash([6, 5])
  ctx.lineWidth = 2
  ctx.strokeStyle = tintOf(plot.id)
  ctx.stroke()
  ctx.setLineDash([])
 }
 ctx.restore()
}

/* ---------- a call, as a flower ---------- */
export function paintBloom(
 ctx: CanvasRenderingContext2D, x: number, y: number, size: number, kind: FlowerKind, spin: number, gust: number, open: number,
) {
 const f = flowerSpec(kind)
 const s = size * open
 if (s < 0.9) return
 const stem = s * 2.2
 const bend = gust * stem * 0.34
 const hx = x + bend, hy = y - stem

 if (s > 2) {
  ctx.strokeStyle = '#5F9457'
  ctx.lineWidth = Math.max(1, s * 0.17)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.quadraticCurveTo(x + bend * 0.3, y - stem * 0.55, hx, hy)
  ctx.stroke()
  ctx.fillStyle = '#6FA765'
  ctx.beginPath()
  ctx.ellipse(x + bend * 0.28 - s * 0.42, y - stem * 0.5, s * 0.44, s * 0.2, -0.5, 0, 6.283185)
  ctx.fill()
 }
 if (s < 3.2) {
  ctx.fillStyle = f.petal === '#FFFFFF' ? f.petalDeep : f.petal
  ctx.beginPath(); ctx.arc(hx, hy, Math.max(s * 0.6, 1.3), 0, 6.283185); ctx.fill()
  return
 }
 for (let i = 0; i < f.petals; i++) {
  const a = (i / f.petals) * 6.283185 + spin + gust * 0.12
  ctx.fillStyle = i % 2 ? f.petal : f.petalDeep
  ctx.beginPath()
  ctx.ellipse(hx + Math.cos(a) * s * 0.5, hy + Math.sin(a) * s * 0.5, s * 0.4, s * 0.29, a, 0, 6.283185)
  ctx.fill()
 }
 ctx.fillStyle = f.heart
 ctx.beginPath(); ctx.arc(hx, hy, s * 0.27, 0, 6.283185); ctx.fill()
}

/* ---------- weather you can feel ---------- */
export function paintWeather(ctx: CanvasRenderingContext2D, view: View, weather: Weather, t: number, tilt: number, sun?: { x: number; y: number }) {
 const { w, h } = view
 if (weather === 'clear' || weather === 'bright') {
  /* The shaft has to come from where the sun disc actually sits on the wheel, or
     it reads as two suns that don't agree with each other. */
  const sx = sun?.x ?? w * 0.6, sy = sun?.y ?? h * 0.12
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.beginPath(); ctx.rect(0, 0, w, h * HORIZON); ctx.clip()
  for (let i = 0; i < 2; i++) {
   const a = 2.05 + i * 0.5 + Math.sin(t * 0.00016 + i * 2) * 0.07
   const grad = ctx.createLinearGradient(sx, sy, sx + Math.cos(a) * 320, sy + Math.sin(a) * 320)
   grad.addColorStop(0, `rgba(255,242,206,${(0.06 * (0.3 + tilt * 0.7)).toFixed(3)})`)
   grad.addColorStop(1, 'rgba(255,242,206,0)')
   ctx.fillStyle = grad
   ctx.beginPath(); ctx.moveTo(sx, sy)
   ctx.lineTo(sx + Math.cos(a - 0.16) * 380, sy + Math.sin(a - 0.16) * 380)
   ctx.lineTo(sx + Math.cos(a + 0.16) * 380, sy + Math.sin(a + 0.16) * 380)
   ctx.closePath(); ctx.fill()
  }
  ctx.restore()
  return
 }
 if (weather === 'cloudy') {
  ctx.save()
  ctx.fillStyle = 'rgba(226,232,230,.18)'
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
  return
 }
 const heavy = weather === 'storm'
 const drops = heavy ? 150 : 84
 ctx.save()
 ctx.strokeStyle = heavy ? 'rgba(226,238,244,.55)' : 'rgba(226,238,244,.42)'
 ctx.lineWidth = heavy ? 1.5 : 1.1
 ctx.lineCap = 'round'
 for (let i = 0; i < drops; i++) {
  const speed = heavy ? 1.35 : 0.85
  const len = (heavy ? 26 : 17) * (0.6 + hash(i, 4100) * 0.9)
  const x = (hash(i, 4200) * (w + 120) + t * 0.035 * (heavy ? 1.6 : 1)) % (w + 120) - 60
  const y = (hash(i, 4300) * h + t * speed * 0.42) % (h + 60) - 30
  ctx.globalAlpha = 0.35 + hash(i, 4400) * 0.5
  ctx.beginPath()
  ctx.moveTo(x, y); ctx.lineTo(x - len * 0.22, y + len)
  ctx.stroke()
 }
 ctx.restore()
 if (heavy) {
  const beat = Math.sin(t * 0.00052) * Math.sin(t * 0.00017)
  if (beat > 0.986) {
   ctx.save()
   ctx.fillStyle = `rgba(255,255,255,${((beat - 0.986) / 0.014 * 0.3).toFixed(3)})`
   ctx.fillRect(0, 0, w, h)
   ctx.restore()
  }
 }
}

/** Cloud shadows crossing the plan, so the weather is legible even looking straight down. */
export function paintShadows(ctx: CanvasRenderingContext2D, view: View, weather: Weather, t: number, tilt: number) {
 const flat = 1 - tilt
 if (flat < 0.02) return
 const p = PALETTES[weather]
 ctx.save()
 ctx.globalAlpha = flat * (1 - p.light) * 1.6 + flat * 0.1
 ctx.fillStyle = 'rgba(58,86,64,.5)'
 for (let i = 0; i < p.cloudCount; i++) {
  const s = 70 + hash(i, 909) * 90
  const x = ((hash(i, 919) * (view.w + 420) + t * 0.012 * (1 + hash(i, 929))) % (view.w + 420)) - 210
  const y = ((hash(i, 939) * (view.h + 300) + t * 0.005) % (view.h + 300)) - 150
  ctx.beginPath()
  ctx.ellipse(x, y, s, s * 0.62, hash(i, 949) * 3, 0, 6.283185)
  ctx.fill()
 }
 ctx.restore()
}

export { smooth, clamp01 }

/** Dusk. The same painting, lit later: a cool multiply over everything, a warm
    band left on the horizon where the sun just went, and a few stars once it is
    properly dark. Repainting five night palettes would say less and cost more. */
export function paintDusk(ctx: CanvasRenderingContext2D, view: View, amount: number, t: number) {
 if (amount < 0.01) return
 const { w, h } = view
 const horizon = h * HORIZON
 ctx.save()
 ctx.globalCompositeOperation = 'multiply'
 const cool = ctx.createLinearGradient(0, 0, 0, h)
 cool.addColorStop(0, `rgba(58,74,104,${(0.82 * amount).toFixed(3)})`)
 cool.addColorStop(0.3, `rgba(74,86,102,${(0.7 * amount).toFixed(3)})`)
 cool.addColorStop(1, `rgba(40,56,50,${(0.86 * amount).toFixed(3)})`)
 ctx.fillStyle = cool
 ctx.fillRect(0, 0, w, h)
 ctx.globalCompositeOperation = 'lighter'
 const warm = ctx.createLinearGradient(0, horizon - 90, 0, horizon + 26)
 warm.addColorStop(0, 'rgba(0,0,0,0)')
 warm.addColorStop(0.7, `rgba(214,132,74,${(0.16 * amount).toFixed(3)})`)
 warm.addColorStop(1, `rgba(240,178,104,${(0.1 * amount).toFixed(3)})`)
 ctx.fillStyle = warm
 ctx.fillRect(0, horizon - 90, w, 116)
 /* Stars only once it is dark enough to have any. */
 if (amount > 0.5) {
  ctx.fillStyle = '#FFFDF2'
  for (let i = 0; i < 26; i++) {
   const x = hash(i, 6100) * w
   const y = hash(i, 6200) * horizon * 0.82
   const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(t * 0.0004 + i * 1.7))
   ctx.globalAlpha = (amount - 0.5) * 2 * twinkle * 0.75
   ctx.beginPath(); ctx.arc(x, y, 0.7 + hash(i, 6300) * 0.9, 0, 6.283185); ctx.fill()
  }
 }
 ctx.restore()
}
