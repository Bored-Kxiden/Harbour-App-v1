'use client'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { useHarbor } from '@/lib/harbor/store'
import { callsFor, type FlowerKind, type Moment, type Person, type Weather } from '@/lib/harbor/model'
import { REST, UP } from './sheet'
import {
 assignPlots, buildCells, buildLens, buildPlots, clampZoom, FIELD_H, FIELD_W, hash2, heightAt,
 HORIZON, MAX_REL, overviewZoom, project, tiltFor,
 type Camera, type Cell, type Lens, type Plot, type Point, type View,
} from '@/lib/harbor/terrain'
import {
 paintBloom, paintClouds, paintDistance, paintGround, paintHaze, paintPlane, paintPlots,
 paintDusk, paintShadows, paintSky, paintWeather, paintWheel, wheelAngleFor, wheelPoint, WHEEL_STEP, windAt, windStrength,
} from '@/lib/harbor/scene'

/* How far in the camera rests, in multiples of the overview zoom. Past TILT_TO the
   lens is fully stood up, so the app opens on the landscape and pulling back is what
   flattens it into the plan. */
const REST_REL = 9.5
const TAGS_FADE = 14

type Blossom = { moment: Moment; person: Person; x: number; y: number; z: number; kind: FlowerKind; size: number; spin: number }
type Hit = { x: number; y: number; r: number; moment: Moment }
type Tag = { x: number; y: number; w: number; h: number; id: string }

const TONE: Record<string, string> = { gold: '#E0AE39', green: '#4E9A5E', orange: '#D9813F', sky: '#5B8FC9' }
const WEATHERS: Weather[] = ['clear', 'bright', 'cloudy', 'rain', 'storm']

/** What the field lets the rest of the app do to it from outside: fly the camera
    to someone's plot, step the zoom in or out, or pull all the way back to the plan.
    Everything a finger can do, a button (or the sections list) can do too. */
export type MeadowHandle = { flyTo: (personId: string) => void; zoomBy: (factor: number) => void; recenter: () => void }

/** The meadow behind everything. Pull back and it lies down into a plan of who grows
    where; push in and it stands up into country you are walking through, bumps and all.
    It is one projection the whole way, which is why the change reads as the ground
    tipping rather than as two pictures swapped. */
export const Meadow = forwardRef<MeadowHandle, {
 weather: Weather; sheetLift: number; freshBloomId?: string
 /** With the camera open the meadow is scenery, not a map: the name tags step out. */
 bare?: boolean
 /** In dusk the same meadow is painted after sunset rather than repainted. */
 night?: boolean
 onOpenBloom: (moment: Moment) => void
}>(function Meadow({ weather, sheetLift, freshBloomId, bare, night, onOpenBloom }, ref) {
 const { state } = useHarbor()
 const holder = useRef<HTMLDivElement>(null)
 const canvas = useRef<HTMLCanvasElement>(null)

 const live = useRef({ weather, sheetLift, freshBloomId, bare: false, night: false, people: state?.people ?? [], calls: [] as Moment[], reduced: false })
 live.current.weather = weather
 live.current.sheetLift = sheetLift
 live.current.freshBloomId = freshBloomId
 live.current.bare = !!bare
 live.current.night = !!night
 live.current.people = state?.people ?? []
 live.current.calls = state ? state.people.flatMap(x => callsFor(state, x.id)) : []
 live.current.reduced = !!state?.settings.reducedMotion

 const hits = useRef<Hit[]>([])
 const tagHits = useRef<Tag[]>([])
 const openBloom = useRef(onOpenBloom); openBloom.current = onOpenBloom
 const api = useRef<MeadowHandle>({ flyTo: () => {}, zoomBy: () => {}, recenter: () => {} })
 useImperativeHandle(ref, () => api.current, [])

 useEffect(() => {
  const node = holder.current, el = canvas.current
  if (!node || !el) return
  const ctx = el.getContext('2d', { alpha: true })
  if (!ctx) return

  let view: View = { w: 0, h: 0, band: 0, reveal: 0, base: 0.2 }
  let dpr = 1
  const cam: Camera = { x: FIELD_W * 0.5, y: FIELD_H * 0.62, zoom: 0.2 }
  const goal: Camera = { ...cam }
  let started = false

  const cells: Cell[] = buildCells()
  let plots: Plot[] = []
  let blossoms: Blossom[] = []
  let plotTints: (string | null)[] = []
  let signature = ''
  let wheel = 0, wheelGoal = 0, wheelIndex = 0, wheelSet = false
  let tagFade = 1, duskFade = night ? 1 : 0

  /* Canvas cannot read custom properties, so the two colours the tags need are
     lifted out of the stylesheet and refreshed whenever the theme actually moves. */
  let ink = { face: '#FEFCF5', text: '#13492C' }
  const readTheme = () => {
   const cs = getComputedStyle(el)
   const face = cs.getPropertyValue('--tag-face').trim()
   const text = cs.getPropertyValue('--tag-ink').trim()
   if (face) ink = { face, text: text || ink.text }
  }
  readTheme()
  const themeWatch = new MutationObserver(readTheme)
  themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] })
  const scheme = window.matchMedia('(prefers-color-scheme: dark)')
  scheme.addEventListener('change', readTheme)
  const opened = new Map<string, number>()
  const p: Point = { x: 0, y: 0, s: 1 }

  /* ---------- who grows where ---------- */
  function lay() {
   const { people, calls } = live.current
   const sig = people.map(x => x.id).join(',') + '|' + calls.length
   if (sig === signature) return
   signature = sig
   plots = buildPlots(people.map(x => x.id))
   assignPlots(cells, plots)
   plotTints = plots.map(plot => {
    const person = people.find(x => x.id === plot.id)
    return person ? (TONE[person.tone] ?? null) : null
   })
   blossoms = []
   plots.forEach((plot, pi) => {
    const person = people.find(x => x.id === plot.id)
    if (!person) return
    const mine = calls.filter(c => c.person === plot.id).slice().sort((a, b) => a.at.localeCompare(b.at))
    mine.forEach((moment, i) => {
     const r1 = hash2(i, 1, 9100 + pi * 211), r2 = hash2(i, 2, 9100 + pi * 211)
     const reach = plot.radius * 0.74 * Math.sqrt((i + 0.7) / Math.max(mine.length, 7))
     const angle = i * 2.399963 + r1 * 0.6
     const x = plot.x + Math.cos(angle) * reach + (r1 - 0.5) * 14
     const y = plot.y + Math.sin(angle) * reach + (r2 - 0.5) * 14
     blossoms.push({
      moment, person, x, y, z: heightAt(x, y),
      kind: moment.flower ?? 'daisy',
      size: Math.min(1.5, Math.max(0.72, 0.6 + Math.sqrt(moment.minutes ?? 12) / 7)),
      spin: r2 * 6.283,
     })
    })
   })
   blossoms.sort((a, b) => a.y - b.y)
  }

  /** The camera cannot leave the field, and the further back it goes the more it is
      pulled to the middle, so the plan always arrives centred. */
  function hold(c: Camera) {
   c.zoom = clampZoom(c.zoom, view.base)
   const rel = c.zoom / view.base
   const home = Math.max(0, Math.min(1, (3.4 - rel) / 2.2))
   c.x = Math.min(FIELD_W - 90, Math.max(90, c.x)) * (1 - home) + FIELD_W * 0.44 * home
   c.y = Math.min(FIELD_H - 90, Math.max(90, c.y)) * (1 - home) + FIELD_H * 0.46 * home
  }

  /* useImperativeHandle read this object's identity once, at mount, so the methods
     have to be written onto it, never replaced wholesale, or the ref outside keeps
     pointing at the original no-op stub forever. */
  /* What both the sections list and a tap on a name tag in the field itself do:
     walk the camera to that person's plot. One place to keep it right. */
  function flyToPlot(personId: string) {
   lay()
   const plot = plots.find(pl => pl.id === personId)
   if (!plot) return
   goal.x = plot.x; goal.y = plot.y
   goal.zoom = view.base * REST_REL
   hold(goal)
  }
  Object.assign(api.current, {
   flyTo: flyToPlot,
   zoomBy(factor: number) {
    goal.zoom = clampZoom(goal.zoom * factor, view.base)
    hold(goal)
   },
   recenter() {
    goal.zoom = view.base
    hold(goal)
   },
  })

  const ro = new ResizeObserver(entries => {
   const rect = entries[0].contentRect
   if (!rect.width || !rect.height) return
   dpr = Math.min(window.devicePixelRatio || 1, 2)
   /* The sheet's lip is where the meadow stops being seen, so the plan fits that band. */
   const band = rect.height * 0.54
   view = { w: rect.width, h: rect.height, band, reveal: band, base: overviewZoom(rect.width, band) }
   el.width = Math.round(rect.width * dpr)
   el.height = Math.round(rect.height * dpr)
   if (!started) {
    started = true
    lay()
    const home = plots[0] ?? { x: FIELD_W * 0.5, y: FIELD_H * 0.5 }
    cam.x = goal.x = home.x
    cam.y = goal.y = home.y + 170
    cam.zoom = goal.zoom = view.base * REST_REL
   } else { hold(cam); hold(goal) }
  })
  ro.observe(node)

  /* ---------- one frame ---------- */
  let raf = 0
  const draw = (now: number) => {
   raf = requestAnimationFrame(draw)
   const { w, h } = view
   if (!w || !h) return
   const { weather: sky, sheetLift, freshBloomId, bare: hidden, night: dusk, reduced } = live.current
   lay()

   /* How much of the canvas the card is actually leaving open right now, in the
      same terms the card itself moves in. It only ever grows past the fixed
      band the plan is composed to fit, since band was already safe for every
      position the card could take before it could be pulled down this far. */
   view.reveal = Math.max(view.band, view.h * Math.min(1, Math.max(0, REST - (REST - UP) * sheetLift)))

   const t = reduced ? 4000 : now
   const ease = reduced ? 1 : 0.11
   cam.x += (goal.x - cam.x) * ease
   cam.y += (goal.y - cam.y) * ease
   cam.zoom += (goal.zoom - cam.zoom) * ease
   const lens: Lens = buildLens(cam, view)
   const tilt = lens.tilt

   /* The wheel turns the short way round, the way a dial would. */
   const index = Math.max(0, WEATHERS.indexOf(sky))
   if (!wheelSet) { wheelIndex = index; wheel = wheelGoal = wheelAngleFor(index); wheelSet = true }
   else if (index !== wheelIndex) {
    let step = index - wheelIndex
    if (step > 2) step -= 5
    if (step < -2) step += 5
    wheelGoal -= step * WHEEL_STEP
    wheelIndex = index
   }
   wheel += (wheelGoal - wheel) * (reduced ? 1 : 0.05)

   ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
   ctx.clearRect(0, 0, w, h)

   /* Sky, then the wheel, then the hills: the weather climbs up out of the far
      country rather than appearing on top of it. */
   paintSky(ctx, view, sky, tilt)
   paintWheel(ctx, view, wheel, t, tilt)
   paintClouds(ctx, view, sky, t, tilt)
   paintPlane(ctx, view, sky, tilt)
   paintDistance(ctx, view, sky, tilt, cam.x)
   paintHaze(ctx, view, sky, tilt)

   /* A hair of lift when the sheet comes up, so the ground answers the gesture. */
   ctx.save()
   ctx.translate(0, -sheetLift * 34)

   paintPlots(ctx, lens, plots, id => plotTints[plots.findIndex(q => q.id === id)] ?? '#7BAE60', 1 - tilt)
   paintGround(ctx, lens, cells, sky, t)

   const strength = windStrength[sky]
   hits.current.length = 0
   for (const b of blossoms) {
    project(lens, b.x, b.y, b.z, p)
    if (p.x < -60 || p.x > w + 60 || p.y < -60 || p.y > h + 60) continue
    const size = b.size * 7.4 * p.s
    if (size < 0.7 || p.y > view.reveal + 70) continue
    let open = 1
    if (b.moment.id === freshBloomId) {
     let at = opened.get(b.moment.id)
     if (at === undefined) { at = now; opened.set(b.moment.id, at) }
     const k = Math.min(1, (now - at) / 900)
     open = k * k * (3 - 2 * k) * (1 + 0.22 * Math.sin(k * Math.PI))
    }
    paintBloom(ctx, p.x, p.y, size, b.kind, b.spin, windAt(b.x, b.y, t, strength), Math.max(open, 0.02))
    if (size > 2.4) hits.current.push({ x: p.x, y: p.y - size * 2.2, r: Math.max(16, size), moment: b.moment })
   }
   ctx.restore()

   /* ---------- who lives here ---------- */
   tagFade += ((hidden ? 0 : 1) - tagFade) * 0.14
   const rel = cam.zoom / view.base
   const alpha = tagFade * (rel > TAGS_FADE ? Math.max(0, 1 - (rel - TAGS_FADE) / 6) : 1)
   tagHits.current.length = 0
   if (alpha > 0.02) {
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.font = "700 12px var(--font-round), ui-rounded, sans-serif"
    const laid: { x: number; y: number }[] = []
    for (const plot of plots) {
     const person = live.current.people.find(x => x.id === plot.id)
     if (!person) continue
     const count = blossoms.reduce((n, b) => n + (b.person.id === plot.id ? 1 : 0), 0)
     if (!count) continue
     project(lens, plot.x, plot.y, heightAt(plot.x, plot.y), p)
     const label = `${person.name} · ${count}`
     const wide = ctx.measureText(label).width + 34
     const sx = Math.min(w - wide / 2 - 12, Math.max(wide / 2 + 12, p.x))
     /* A tag that would sit under the card is pulled up to its lip instead of
        vanishing: you should always be able to see whose meadow you are looking at. */
     /* Above the chip, not on it: the tag ceiling stops where the chip's shoulder is. */
     let sy = Math.min(view.band - 96, Math.max(30, p.y - 40 - sheetLift * 34))
     for (const q of laid) if (Math.abs(q.x - sx) < wide * 0.72 && Math.abs(q.y - sy) < 30) sy = q.y - 32
     if (sy < 26) continue
     laid.push({ x: sx, y: sy })

     ctx.fillStyle = ink.face
     ctx.beginPath(); ctx.roundRect(sx - wide / 2, sy - 13, wide, 26, 13); ctx.fill()
     ctx.beginPath()
     ctx.moveTo(sx - 5, sy + 13); ctx.lineTo(sx + 5, sy + 13); ctx.lineTo(sx, sy + 19)
     ctx.closePath(); ctx.fill()
     paintBloom(ctx, sx - wide / 2 + 15, sy + 6, 7, dominantOf(blossoms, plot.id), 0.4, 0, 1)
     ctx.fillStyle = ink.text
     ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
     ctx.fillText(label, sx + 7, sy)
     ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic'
     tagHits.current.push({ x: sx - wide / 2, y: sy - 13, w: wide, h: 26, id: plot.id })
    }
    ctx.restore()
   }

   paintShadows(ctx, view, sky, t, tilt)
   /* Dusk before the weather, so rain still catches what light is left. */
   duskFade += ((dusk ? 1 : 0) - duskFade) * (reduced ? 1 : 0.08)
   paintDusk(ctx, view, duskFade, t)
   /* The shaft has to come from the sun disc actually on the wheel, not a second,
      uncoordinated point, or the two suns disagree with each other. */
   const sunPoint = wheelPoint(view, wheel, index)
   paintWeather(ctx, view, sky, t, tilt, sunPoint.visible ? sunPoint : undefined)
  }
  raf = requestAnimationFrame(draw)

  /* ---------- push it around ---------- */
  const pointers = new Map<number, { x: number; y: number }>()
  let drag: { x: number; y: number; moved: number } | null = null
  let pinch: { gap: number; zoom: number } | null = null
  let lastTap = 0
  const local = (e: PointerEvent) => { const r = node.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }

  const down = (e: PointerEvent) => {
   node.setPointerCapture(e.pointerId)
   const pt = local(e)
   pointers.set(e.pointerId, pt)
   if (pointers.size === 2) {
    const [a, b] = [...pointers.values()]
    pinch = { gap: Math.hypot(a.x - b.x, a.y - b.y), zoom: goal.zoom }
    drag = null
   } else drag = { ...pt, moved: 0 }
  }
  const move = (e: PointerEvent) => {
   if (!pointers.has(e.pointerId)) return
   const pt = local(e)
   pointers.set(e.pointerId, pt)
   if (pinch && pointers.size === 2) {
    const [a, b] = [...pointers.values()]
    goal.zoom = pinch.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / Math.max(pinch.gap, 1))
    hold(goal)
    return
   }
   if (!drag) return
   const dx = pt.x - drag.x, dy = pt.y - drag.y
   drag.moved += Math.hypot(dx, dy); drag.x = pt.x; drag.y = pt.y
   /* Standing up, a finger travels much further into the field than across it. */
   goal.x -= dx / goal.zoom
   goal.y -= (dy / goal.zoom) * (1 + tiltFor(goal.zoom, view.base) * 2.2)
   hold(goal)
  }
  const up = (e: PointerEvent) => {
   const pt = pointers.get(e.pointerId)
   const begun = drag
   pointers.delete(e.pointerId)
   if (pointers.size < 2) pinch = null
   drag = null
   if (!begun || !pt || begun.moved >= 6) return

   /* A name tag is the field's own way to reach that person's section, the same
      trip the sections list offers, not a shortcut past the field into their
      chat: that stays reachable from Your People. */
   for (const tag of tagHits.current) {
    if (pt.x >= tag.x && pt.x <= tag.x + tag.w && pt.y >= tag.y && pt.y <= tag.y + tag.h) { flyToPlot(tag.id); return }
   }
   let found: Moment | null = null, best = Infinity
   for (const hit of hits.current) {
    const d = Math.hypot(hit.x - pt.x, hit.y - pt.y)
    if (d < hit.r * 1.4 && d < best) { best = d; found = hit.moment }
   }
   if (found) { openBloom.current(found); return }

   /* Double tap is the only zoom control there is: down into the grass where you
      tapped, or all the way back out to the plan. */
   const now = performance.now()
   if (now - lastTap < 320) {
    const rel = goal.zoom / view.base
    const world = unproject(buildLens(cam, view), pt.x, pt.y)
    goal.x = world.x; goal.y = world.y
    goal.zoom = view.base * (rel > MAX_REL * 0.45 ? 1 : rel < 3.2 ? REST_REL : MAX_REL * 0.62)
    hold(goal)
    lastTap = 0
    return
   }
   lastTap = now
  }

  node.addEventListener('pointerdown', down)
  node.addEventListener('pointermove', move)
  node.addEventListener('pointerup', up)
  node.addEventListener('pointercancel', up)
  const spin = (e: WheelEvent) => {
   e.preventDefault()
   goal.zoom = clampZoom(goal.zoom * (e.deltaY < 0 ? 1.13 : 1 / 1.13), view.base)
   hold(goal)
  }
  node.addEventListener('wheel', spin, { passive: false })

  /* Everything the meadow offers by drag and pinch it also offers by key, so it is
     not a picture only a pointer can walk into. */
  const key = (e: KeyboardEvent) => {
   const stride = 120 / Math.max(goal.zoom, 0.2)
   if (e.key === 'ArrowLeft') goal.x -= stride
   else if (e.key === 'ArrowRight') goal.x += stride
   else if (e.key === 'ArrowUp') goal.y -= stride * (1 + tiltFor(goal.zoom, view.base) * 2.2)
   else if (e.key === 'ArrowDown') goal.y += stride * (1 + tiltFor(goal.zoom, view.base) * 2.2)
   else if (e.key === '+' || e.key === '=') goal.zoom *= 1.3
   else if (e.key === '-' || e.key === '_') goal.zoom /= 1.3
   else if (e.key === 'Home') { goal.zoom = view.base }
   else if (e.key === 'End') { goal.zoom = view.base * REST_REL }
   else return
   e.preventDefault()
   hold(goal)
  }
  el.addEventListener('keydown', key)

  return () => {
   cancelAnimationFrame(raf)
   ro.disconnect()
   themeWatch.disconnect()
   scheme.removeEventListener('change', readTheme)
   node.removeEventListener('pointerdown', down)
   node.removeEventListener('pointermove', move)
   node.removeEventListener('pointerup', up)
   node.removeEventListener('pointercancel', up)
   node.removeEventListener('wheel', spin)
   el.removeEventListener('keydown', key)
  }
 }, [])

 return <div ref={holder} className="meadow">
  <canvas ref={canvas} className="meadow-canvas" tabIndex={0} role="application"
   aria-label="Your meadow. Arrow keys walk it, plus and minus go in and out, Home pulls back to the whole plan. Every flower here is also a row in the panel below."/>
 </div>
})

function dominantOf(blossoms: Blossom[], id: string): FlowerKind {
 const tally = new Map<FlowerKind, number>()
 for (const b of blossoms) if (b.person.id === id) tally.set(b.kind, (tally.get(b.kind) ?? 0) + 1)
 let top: FlowerKind = 'daisy', best = 0
 for (const [kind, n] of tally) if (n > best) { best = n; top = kind }
 return top
}

/** Screen back to world. Exact in the plan; close enough under the tilt that a double
    tap lands where you meant, which is all it is asked for. */
function unproject(lens: Lens, sx: number, sy: number) {
 const { cam, view } = lens
 if (lens.tilt <= 0.02) {
  return { x: cam.x + (sx - view.w / 2) / cam.zoom, y: cam.y + (sy - view.band / 2) / cam.zoom }
 }
 const below = Math.max(sy - view.h * HORIZON, 8)
 const d = lens.focal * (lens.eye + lens.camZ) / below
 return {
  x: cam.x + (sx - view.w / 2) * d / lens.focal,
  y: Math.max(0, cam.y + lens.back - d),
 }
}
