'use client'
import { useState } from 'react'
import { Keyboard, LockKeyhole, MessageCircle, Plus, Send, Users } from 'lucide-react'
import { toast } from 'sonner'
import { makeId, useHarbor } from '@/lib/harbor/store'
import { formatTime, localDay, minutes, sharedWindows, type VoiceClip } from '@/lib/harbor/model'
import { Avatar } from './avatar'
import { BackBar } from './back'
import { VoiceNote } from './voice'

/** Say the heavy thing once, pick who hears it, and be done with the asking. Saying
    it out loud is the faster way, so it is the one offered first. */
export function ShareLoad({ navigate }: { navigate: (page: string) => void }) {
 const { state, update, log } = useHarbor()
 const [text, setText] = useState('')
 const [who, setWho] = useState<string[]>([])
 const [how, setHow] = useState<'message' | 'group'>('message')
 const [typing, setTyping] = useState(false)
 if (!state) return null
 const windows = sharedWindows(state, localDay())

 const toggle = (id: string) => setWho(list => list.includes(id) ? list.filter(x => x !== id) : [...list, id])
 const send = (body: string, voice?: VoiceClip) => {
  if (!body || !who.length) return
  const at = new Date().toISOString()
  update(s => ({
   ...s,
   messages: Object.fromEntries(Object.entries(s.messages).map(([id, ms]) =>
    who.includes(id) ? [id, [...ms, { id: makeId(), at, text: body, mine: true, voice }]] : [id, ms])),
  }))
  log({ id: makeId(), at, person: who[0], kind: 'message', text: body, source: 'manual' })
  const names = state.people.filter(p => who.includes(p.id)).map(p => p.name)
  setText('')
  toast.success(`Sent to ${names.join(' and ')}.`)
 }

 const names = state.people.filter(p => who.includes(p.id)).map(p => p.name).join(' and ')
 return <div className="entrance">
  <BackBar onBack={() => navigate('home')}/>
  <div className="page-head">
   <h1>Share my load</h1>
   <p>Tell the people you pick what is going on, once, and be done with the asking.</p>
  </div>

  <div className="wrap flow stagger">
   <section className="flow" style={{ gap: 10, ['--i' as string]: 0 }} aria-labelledby="who-heading">
    <div className="row-head"><h2 id="who-heading">1. Who hears it</h2></div>
    <div className="who-row">
     {state.people.map(person => <button key={person.id} type="button" className="who"
      aria-pressed={who.includes(person.id)} onClick={() => toggle(person.id)}>
      <span className="who-face"><Avatar person={person.id}/></span>
      <b>{person.name}</b>
     </button>)}
     <button type="button" className="who" onClick={() => navigate('account')}>
      <span className="who-add"><Plus aria-hidden="true"/></span><b>Add</b>
     </button>
    </div>
    <p className="note-strip"><LockKeyhole aria-hidden="true"/>Private to whoever you pick. Nothing is posted anywhere.</p>
   </section>

   <section className="flow" style={{ gap: 10, ['--i' as string]: 1 }} aria-labelledby="say-heading">
    <div className="row-head">
     <h2 id="say-heading">2. What to say</h2>
     <button type="button" className="text-link" onClick={() => setTyping(t => !t)}>
      {typing ? <><Send aria-hidden="true"/>Record instead</> : <><Keyboard aria-hidden="true"/>Type instead</>}
     </button>
    </div>
    {!who.length && <p className="empty" style={{ marginBottom: 0 }}>Pick somebody above first.</p>}
    <div className="say-box">
     {typing ? <>
      <textarea id="load-text" className="input" maxLength={400} value={text} rows={4}
       aria-label="What is going on" disabled={!who.length}
       onChange={e => setText(e.target.value)} placeholder="Work, family, studies, just life…"/>
      <button type="button" className="btn btn-block" disabled={!text.trim() || !who.length} onClick={() => send(text.trim())}>
       <Send aria-hidden="true"/>{who.length ? `Send to ${names}` : 'Send'}
      </button>
     </> : who.length ? <VoiceNote key={who.join(',')} sendLabel={`Send to ${names}`}
      onKeep={take => send(take.text || 'Voice note', { mediaId: take.mediaId, seconds: take.seconds, edited: take.edited })}/> : null}
    </div>
   </section>

   <section className="flow" style={{ gap: 9, ['--i' as string]: 2 }} aria-labelledby="how-heading">
    <div className="row-head"><h2 id="how-heading">3. How it reaches them</h2></div>
    <div role="radiogroup" aria-labelledby="how-heading" className="flow" style={{ gap: 9 }}>
     <button type="button" role="radio" aria-checked={how === 'message'} className="pick" onClick={() => setHow('message')}>
      <span className="row-icon" style={{ background: 'var(--tint-mint)' }}><MessageCircle aria-hidden="true"/></span>
      <span className="row-body"><b>One at a time</b><span>Each person gets it privately.</span></span>
      <span className="pick-mark" aria-hidden="true"/>
     </button>
     <button type="button" role="radio" aria-checked={how === 'group'} className="pick" onClick={() => setHow('group')}>
      <span className="row-icon" style={{ background: 'var(--tint-blue)' }}><Users aria-hidden="true"/></span>
      <span className="row-body"><b>All together</b><span>Everyone you picked sees the same thread.</span></span>
      <span className="pick-mark" aria-hidden="true"/>
     </button>
    </div>
   </section>

   <section className="card card-pad flow" style={{ ['--i' as string]: 3 }} aria-labelledby="rhythm-heading">
    <div className="switch-row">
     <div><b id="rhythm-heading">Share when I am free</b><p className="small">Free and busy times only, never what a block is called.</p></div>
     <button type="button" className="toggle" aria-pressed={state.sharing} aria-labelledby="rhythm-heading"
      onClick={() => update(s => ({ ...s, sharing: !s.sharing, sharingSetupDone: true }))}/>
    </div>
    {state.sharing && <div className="switch-row">
     <div><b>They share back</b><p className="small">{state.people[0]?.name ?? 'They'} shows you their free time too.</p></div>
     <button type="button" className="toggle" aria-pressed={state.momConsent} aria-label={`Mutual sharing with ${state.people[0]?.name ?? 'them'}`}
      onClick={() => update(s => ({ ...s, momConsent: !s.momConsent }))}/>
    </div>}
    {state.sharing && state.momConsent && <p className="note-strip">
     <Users aria-hidden="true"/>
     {windows.length
      ? `You are both free ${formatTime(windows[0].start)} to ${formatTime(windows[0].end)} today, ${minutes(windows[0].end) - minutes(windows[0].start)} minutes.`
      : 'No overlap today. Try another day, or just leave a note.'}
    </p>}
   </section>

   <p className="fineprint" style={{ ['--i' as string]: 4 }}>Saved on this device. Nothing reaches a real person.</p>
  </div>
 </div>
}
