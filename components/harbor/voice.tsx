'use client'
import { useEffect, useRef, useState } from 'react'
import { Check, Mic, Pause, Pencil, Play, RotateCcw, Square, Trash2 } from 'lucide-react'
import { makeId } from '@/lib/harbor/store'
import { saveMedia } from '@/lib/harbor/media'

type Phase = 'idle' | 'recording' | 'review'
type Recognition = {
 lang: string; continuous: boolean; interimResults: boolean
 start(): void; stop(): void
 onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
 onerror: (() => void) | null
 onend: (() => void) | null
}
type SpeechWindow = Window & {
 SpeechRecognition?: new () => Recognition
 webkitSpeechRecognition?: new () => Recognition
}

function speechEngine(): Recognition | null {
 if (typeof window === 'undefined') return null
 const w = window as SpeechWindow
 const Engine = w.SpeechRecognition ?? w.webkitSpeechRecognition
 if (!Engine) return null
 try { return new Engine() } catch { return null }
}
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export type VoiceTake = { mediaId?: string; seconds: number; text: string; edited: boolean }

/** Record, read back, correct, then send. The transcript is a draft the recorder owns:
    it arrives in a lighter face to say so, and nothing goes anywhere until it is kept.
    Where a browser cannot transcribe (and Safari on iOS often cannot) the recording
    still works and the line underneath is simply typed instead. */
export function VoiceNote({ onKeep, onCancel, sendLabel = 'Send voice note' }: {
 onKeep: (take: VoiceTake) => void
 onCancel?: () => void
 sendLabel?: string
}) {
 const [phase, setPhase] = useState<Phase>('idle')
 const [seconds, setSeconds] = useState(0)
 const [text, setText] = useState('')
 const [editing, setEditing] = useState(false)
 const [edited, setEdited] = useState(false)
 const [error, setError] = useState<string>()
 const [canHear, setCanHear] = useState(true)
 const [levels, setLevels] = useState<number[]>(() => Array(28).fill(0.08))
 const [playing, setPlaying] = useState(false)

 const recorder = useRef<MediaRecorder>(null)
 const chunks = useRef<Blob[]>([])
 const speech = useRef<Recognition | null>(null)
 const settled = useRef('')
 const audio = useRef<HTMLAudioElement>(null)
 const clipUrl = useRef<string>(null)
 const clipId = useRef<string>(null)
 const frame = useRef<number>(null)
 const started = useRef(0)

 /* One cleanup for every resource this component can be holding when it unmounts:
    a live microphone, an animation loop, an object URL and a recogniser. */
 const stopEverything = () => {
  if (frame.current !== null) cancelAnimationFrame(frame.current)
  frame.current = null
  try { speech.current?.stop() } catch { /* already stopped */ }
  speech.current = null
  const active = recorder.current
  if (active && active.state !== 'inactive') { try { active.stop() } catch { /* already stopped */ } }
  active?.stream.getTracks().forEach(t => t.stop())
 }
 useEffect(() => () => {
  stopEverything()
  if (clipUrl.current) URL.revokeObjectURL(clipUrl.current)
 }, [])

 const begin = async () => {
  setError(undefined); setText(''); setEdited(false); settled.current = ''
  let stream: MediaStream
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }) } catch {
   setError('Harbor could not reach the microphone. Check the permission for this site, or type your message instead.')
   return
  }

  /* The bars are the real signal, read off an analyser, so a silent room looks silent
     and someone can tell at a glance that it is actually hearing them. */
  const context = new AudioContext()
  const analyser = context.createAnalyser()
  analyser.fftSize = 64
  context.createMediaStreamSource(stream).connect(analyser)
  const bins = new Uint8Array(analyser.frequencyBinCount)
  const tick = () => {
   analyser.getByteFrequencyData(bins)
   let sum = 0
   for (const v of bins) sum += v
   const level = Math.min(1, (sum / bins.length) / 90)
   setLevels(prev => [...prev.slice(1), Math.max(0.08, level)])
   setSeconds((Date.now() - started.current) / 1000)
   frame.current = requestAnimationFrame(tick)
  }

  const mime = ['audio/webm', 'audio/mp4', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported?.(t))
  const media = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
  chunks.current = []
  media.ondataavailable = e => { if (e.data.size) chunks.current.push(e.data) }
  media.onstop = async () => {
   stream.getTracks().forEach(t => t.stop())
   void context.close()
   const blob = new Blob(chunks.current, { type: media.mimeType || 'audio/webm' })
   if (clipUrl.current) URL.revokeObjectURL(clipUrl.current)
   clipUrl.current = URL.createObjectURL(blob)
   const id = makeId()
   try { await saveMedia(id, blob); clipId.current = id } catch { clipId.current = null }
   setPhase('review')
  }
  recorder.current = media
  started.current = Date.now()
  media.start()
  frame.current = requestAnimationFrame(tick)

  const engine = speechEngine()
  setCanHear(!!engine)
  if (engine) {
   engine.lang = navigator.language || 'en-IN'
   engine.continuous = true
   engine.interimResults = true
   engine.onresult = e => {
    let live = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
     const chunk = e.results[i][0].transcript
     if (e.results[i].isFinal) settled.current = `${settled.current} ${chunk}`.trim()
     else live += chunk
    }
    setText(`${settled.current} ${live}`.trim())
   }
   engine.onerror = () => setCanHear(false)
   engine.onend = () => { speech.current = null }
   try { engine.start(); speech.current = engine } catch { setCanHear(false) }
  }
  setSeconds(0)
  setPhase('recording')
 }

 const finish = () => {
  if (frame.current !== null) cancelAnimationFrame(frame.current)
  frame.current = null
  try { speech.current?.stop() } catch { /* already stopped */ }
  speech.current = null
  const media = recorder.current
  if (media && media.state !== 'inactive') media.stop()
  else setPhase('review')
 }

 const scrap = () => {
  stopEverything()
  if (clipUrl.current) { URL.revokeObjectURL(clipUrl.current); clipUrl.current = null }
  clipId.current = null
  setPhase('idle'); setSeconds(0); setText(''); setEditing(false); setEdited(false); setPlaying(false)
 }

 const toggle = () => {
  const el = audio.current
  if (!el) return
  if (el.paused) { void el.play(); setPlaying(true) } else { el.pause(); setPlaying(false) }
 }

 if (phase === 'idle') return <div className="voice">
  <button type="button" className="voice-start" onClick={begin}>
   <span className="voice-start-disc"><Mic aria-hidden="true"/></span>
   <span className="voice-start-body">
    <b>Record a voice note</b>
    <span>Say it out loud. We write it down for you.</span>
   </span>
  </button>
  {error && <p className="field-error" role="alert">{error}</p>}
 </div>

 if (phase === 'recording') return <div className="voice voice-live">
  <div className="voice-head">
   <span className="voice-dot" aria-hidden="true"/>
   <b>Recording</b>
   <span className="voice-clock">{clock(seconds)}</span>
  </div>
  <div className="voice-wave" aria-hidden="true">
   {levels.map((v, i) => <span key={i}><i style={{ ['--v' as string]: v }}/></span>)}
  </div>
  <p className={text ? 'voice-draft' : 'voice-draft voice-draft-empty'} aria-live="polite">
   {text || (canHear ? 'Listening…' : 'This browser will not write it down, but the recording is fine. You can type a line after.')}
  </p>
  <button type="button" className="btn btn-block" onClick={finish}><Square aria-hidden="true"/>Stop</button>
 </div>

 return <div className="voice voice-review">
  <div className="voice-clip">
   <button type="button" className="voice-play" onClick={toggle} aria-label={playing ? 'Pause the recording' : 'Play the recording back'}>
    {playing ? <Pause aria-hidden="true"/> : <Play aria-hidden="true"/>}
   </button>
   <div className="voice-clip-body">
    <b>Your voice note</b>
    <span>{clock(seconds)} long</span>
   </div>
   <button type="button" className="voice-redo" onClick={scrap} aria-label="Record it again"><RotateCcw aria-hidden="true"/></button>
   {clipUrl.current && <audio ref={audio} src={clipUrl.current} onEnded={() => setPlaying(false)} preload="metadata"/>}
  </div>

  <div className="voice-text">
   <div className="voice-text-head">
    <span className="label" style={{ margin: 0 }}>{edited ? 'Your words, edited' : 'What we heard'}</span>
    {!editing && <button type="button" className="text-link" onClick={() => setEditing(true)}>
     <Pencil aria-hidden="true"/>Edit
    </button>}
   </div>
   {editing
    ? <textarea className="input" autoFocus maxLength={400} value={text} rows={3}
       aria-label="Correct the transcription"
       onChange={e => { setText(e.target.value); setEdited(true) }}/>
    : <p className={text ? 'voice-heard' : 'voice-heard voice-heard-empty'}>
       {text || (canHear ? 'Nothing was picked up. Tap Edit to write the line yourself.' : 'This browser cannot write speech down. Tap Edit to add a line.')}
      </p>}
   {editing && <button type="button" className="btn btn-soft" onClick={() => setEditing(false)}>
    <Check aria-hidden="true"/>Done editing
   </button>}
  </div>

  <div className="voice-acts">
   <button type="button" className="btn btn-quiet" onClick={() => { scrap(); onCancel?.() }}>
    <Trash2 aria-hidden="true"/>Discard
   </button>
   <button type="button" className="btn" onClick={() => onKeep({ mediaId: clipId.current ?? undefined, seconds: Math.round(seconds), text: text.trim(), edited })}>
    {sendLabel}
   </button>
  </div>
 </div>
}
