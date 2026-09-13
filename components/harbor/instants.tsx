'use client'
import { useEffect, useRef, useState } from 'react'
import { Camera, ChevronDown, Heart, RefreshCw, Send, Settings2, X, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { makeId, useHarbor } from '@/lib/harbor/store'
import { saveMedia } from '@/lib/harbor/media'
import type { Snap } from '@/lib/harbor/model'
import { Avatar } from './avatar'
import { useEscape } from './use-escape'
import { LocalPhoto } from './media-view'

const STORY_MS = 5200

/** The viewer: timed bars across the top, tap right to go on, tap left to go back,
    press and hold to stop the clock. Swipe or press escape to leave. */
export function StoryViewer({ start, onClose }: { start: number; onClose: () => void }) {
 const { state, update } = useHarbor()
 const snaps = (state?.snaps ?? []).slice().sort((a, b) => b.at.localeCompare(a.at)).slice(0, 4)
 const [index, setIndex] = useState(Math.min(start, Math.max(snaps.length - 1, 0)))
 const [held, setHeld] = useState(false)
 const [progress, setProgress] = useState(0)
 const [reply, setReply] = useState('')
 const frame = useRef(0)
 const began = useRef(performance.now())
 const elapsed = useRef(0)

 useEffect(() => { began.current = performance.now(); elapsed.current = 0; setProgress(0) }, [index])
 useEffect(() => {
  const tick = () => {
   frame.current = requestAnimationFrame(tick)
   if (held) { began.current = performance.now() - elapsed.current; return }
   elapsed.current = performance.now() - began.current
   const p = Math.min(1, elapsed.current / STORY_MS)
   setProgress(p)
   if (p >= 1) { if (index + 1 < snaps.length) setIndex(i => i + 1); else onClose() }
  }
  frame.current = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(frame.current)
 }, [held, index, snaps.length])
 useEffect(() => {
  const key = (e: KeyboardEvent) => {
   if (e.key === 'Escape') onClose()
   if (e.key === 'ArrowRight') setIndex(i => Math.min(i + 1, snaps.length - 1))
   if (e.key === 'ArrowLeft') setIndex(i => Math.max(i - 1, 0))
  }
  window.addEventListener('keydown', key)
  return () => window.removeEventListener('keydown', key)
 }, [snaps.length])

 if (!state || !snaps.length) return null
 const snap = snaps[index]
 const who = state.people.find(p => p.id === snap.person)
 const keep = () => {
  update(s => ({ ...s, snaps: s.snaps.map(x => x.id === snap.id ? { ...x, saved: !x.saved } : x) }))
  toast.success(snap.saved ? 'Let it fade.' : 'Kept in your scrapbook.')
 }

 return <div className="story" role="dialog" aria-modal="true" aria-label={`Instants from ${who?.name ?? 'your people'}`}>
  <div className="story-bars">
   {snaps.map((s, i) => <span key={s.id} className="story-bar">
    <i style={{ width: i < index ? '100%' : i === index ? `${progress * 100}%` : '0%' }}/>
   </span>)}
  </div>
  <div className="story-head">
   <Avatar person={snap.person} size="sm"/>
   <span className="story-who"><b>{who?.name ?? 'Family'}</b><span>{relative(snap.at)}</span></span>
   <button type="button" className="story-icon" aria-label="Close instants" onClick={onClose}><X/></button>
  </div>

  <div className="story-stage"
   onPointerDown={() => setHeld(true)} onPointerUp={() => setHeld(false)} onPointerCancel={() => setHeld(false)}>
   <div className={`story-frame tint-${who?.tone ?? 'green'}`}>
    {snap.mediaId ? <LocalPhoto id={snap.mediaId} className="story-photo"/> : <span className="story-empty"/>}
    {snap.caption && <span className="story-caption">{snap.caption}</span>}
   </div>
   <button type="button" className="story-half story-prev" aria-label="Previous instant" onClick={() => setIndex(i => Math.max(i - 1, 0))}/>
   <button type="button" className="story-half story-next" aria-label="Next instant"
    onClick={() => index + 1 < snaps.length ? setIndex(i => i + 1) : onClose()}/>
  </div>

  <form className="story-reply" onSubmit={e => { e.preventDefault(); if (!reply.trim()) return; setReply(''); toast.success(`Sent to ${who?.name ?? 'them'}.`) }}>
   <input className="story-input" value={reply} onChange={e => setReply(e.target.value)} spellCheck={false}
    placeholder={`Reply to ${who?.name ?? 'them'}…`} aria-label={`Reply to ${who?.name ?? 'them'}`} autoComplete="off"/>
   <button type="button" className="story-icon" aria-label={snap.saved ? 'Remove from your scrapbook' : 'Keep in your scrapbook'} aria-pressed={!!snap.saved} onClick={keep}>
    <Heart style={{ fill: snap.saved ? '#F0A24B' : 'none', color: snap.saved ? '#F0A24B' : undefined }}/>
   </button>
   <button type="submit" className="story-icon" aria-label="Send reply" disabled={!reply.trim()}><Send/></button>
  </form>
 </div>
}

function relative(at: string) {
 const mins = Math.round((Date.now() - new Date(at).getTime()) / 60000)
 if (mins < 60) return `${Math.max(mins, 1)}m`
 if (mins < 1440) return `${Math.round(mins / 60)}h`
 return `${Math.round(mins / 1440)}d`
}

/** The camera: a viewfinder on the meadow, one shutter, and a note about who sees it. */
export function CameraScreen({ promptDay, onClose }: { promptDay?: string; onClose: () => void }) {
 const { state, update } = useHarbor()
 const video = useRef<HTMLVideoElement>(null)
 const stream = useRef<MediaStream | null>(null)
 const [failed, setFailed] = useState(false)
 const [shot, setShot] = useState<{ url: string; blob: Blob } | null>(null)
 const [caption, setCaption] = useState('')
 const [audience, setAudience] = useState<'people' | 'close'>('people')
 const [busy, setBusy] = useState(false)
 useEscape(onClose)

 useEffect(() => {
  if (shot) return
  let live = true
  navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'user' }, audio: false })
   .then(s => {
    if (!live) { s.getTracks().forEach(t => t.stop()); return }
    stream.current = s
    if (video.current) { video.current.srcObject = s; void video.current.play().catch(() => {}) }
   })
   .catch(() => setFailed(true))
  if (!navigator.mediaDevices) setFailed(true)
  return () => { live = false; stream.current?.getTracks().forEach(t => t.stop()); stream.current = null }
 }, [shot])
 useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url) }, [shot])

 const shoot = async () => {
  const el = video.current
  if (!el || !el.videoWidth) { toast.error('The camera is not ready yet. Give it a second.'); return }
  const side = Math.min(el.videoWidth, el.videoHeight)
  const board = document.createElement('canvas'); board.width = 900; board.height = 900
  const ctx = board.getContext('2d'); if (!ctx) return
  ctx.translate(900, 0); ctx.scale(-1, 1)
  ctx.drawImage(el, (el.videoWidth - side) / 2, (el.videoHeight - side) / 2, side, side, 0, 0, 900, 900)
  const blob = await new Promise<Blob | null>(r => board.toBlob(r, 'image/jpeg', 0.88))
  if (blob) setShot({ blob, url: URL.createObjectURL(blob) })
 }
 const pick = (file: File) => {
  if (!file.type.startsWith('image/')) { toast.error('That is not an image. Choose a picture instead.'); return }
  if (file.size > 10 * 1024 * 1024) { toast.error('That picture is over 10 MB. Choose a smaller one.'); return }
  setShot({ blob: file, url: URL.createObjectURL(file) })
 }
 const send = async () => {
  if (!shot || !state) return
  setBusy(true)
  try {
   const mediaId = makeId()
   await saveMedia(mediaId, shot.blob)
   const at = new Date().toISOString()
   update(s => ({ ...s, snaps: [...s.snaps, { id: makeId(), at, person: 'you', mediaId, caption: caption.trim() || undefined, prompted: !!promptDay, promptDay }] }))
   toast.success(promptDay ? 'Caught it. Theirs is in too.' : 'Sent. It fades unless somebody keeps it.')
   onClose()
  } catch { toast.error('Your browser would not save that picture. Try a smaller one.') }
  finally { setBusy(false) }
 }

 return <div className="camera" role="dialog" aria-modal="true" aria-label="Take an instant">
  <div className="camera-bar">
   <button type="button" className="story-icon" aria-label="Close the camera" onClick={onClose}><X/></button>
   <span className="camera-title">{promptDay ? 'Your window' : 'Instant'}</span>
   <button type="button" className="story-icon" aria-label="Camera settings"><Settings2/></button>
  </div>

  <div className="camera-stage">
   <div className="camera-frame">
    {shot
     ? <img src={shot.url} alt="The instant you just took" className="camera-feed"/>
     : failed
      ? <label className="camera-fallback">
       <Camera aria-hidden="true"/>
       <b>No camera here.</b>
       <span>Choose a picture instead, it works the same way.</span>
       <input type="file" accept="image/*" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) pick(f) }}/>
      </label>
      : <video ref={video} className="camera-feed" playsInline muted autoPlay aria-label="Camera preview"/>}
    <span className="camera-corners" aria-hidden="true"/>
   </div>
   {shot && <input className="camera-caption" maxLength={80} value={caption} onChange={e => setCaption(e.target.value)}
    placeholder="a little happier today…" aria-label="A line about this instant" autoComplete="off"/>}
  </div>

  <div className="camera-deck">
   {shot ? <>
    <button type="button" className="camera-side" aria-label="Take another" onClick={() => { URL.revokeObjectURL(shot.url); setShot(null) }}><RefreshCw/></button>
    <button type="button" className="btn camera-send" disabled={busy} onClick={send}>{busy ? 'Sending…' : 'Send it'}</button>
   </> : <>
    <button type="button" className="camera-side" aria-label="Flash is off"><Zap/></button>
    <button type="button" className="camera-shutter" aria-label="Take the instant" onClick={shoot}><span/></button>
    <button type="button" className="camera-side" aria-label="Flip the camera"><RefreshCw/></button>
   </>}
  </div>

  <button type="button" className="camera-audience" aria-label="Who sees this"
   onClick={() => setAudience(a => a === 'people' ? 'close' : 'people')}>
   {audience === 'people' ? 'Your people' : 'Close family'} <ChevronDown/>
  </button>
 </div>
}
