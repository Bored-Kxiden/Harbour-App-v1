'use client'
import { useEffect, useState } from 'react'
import { Heart, Lock, PenLine, Phone, Send, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { addMoment, latestPersonalNote } from '@/lib/harbor/model'
import { makeId, useHarbor } from '@/lib/harbor/store'
import { Avatar } from './avatar'
import { BackBar } from './back'

export function Conversation({ person, navigate, onCall }: { person: string; navigate: (page: string) => void; onCall: (person: string) => void }) {
 const { state, update } = useHarbor()
 const [together, setTogether] = useState(false)
 const [noting, setNoting] = useState(false)
 const [note, setNote] = useState('')
 useEffect(() => { update(s => s.read.includes(person) ? s : { ...s, read: [...s.read, person] }) }, [person])
 if (!state) return null
 const p = state.people.find(x => x.id === person)
 if (!p) return <div className="entrance">
  <BackBar onBack={() => navigate('home')}/>
  <div className="wrap flow">
   <p className="small">This conversation isn&apos;t in your circle.</p>
   <button type="button" className="btn btn-soft" onClick={() => navigate('home')}>Back home</button>
  </div>
 </div>
 const draft = state.drafts[person] ?? ''
 const messages = state.messages[person] ?? []
 const mine = latestPersonalNote(state, person)

 function send(text = draft) {
  if (!text.trim()) return
  const at = new Date().toISOString(), id = makeId()
  update(s => addMoment({ ...s, messages: { ...s.messages, [person]: [...(s.messages[person] ?? []), { id, at, text: text.trim(), mine: true }] }, drafts: { ...s.drafts, [person]: '' } }, { id, at, person, kind: 'message', text: text.trim(), source: 'manual' }))
 }
 /* A personal note is not a message: it sits on their card, addressed to them alone,
    and never joins the rail everybody reads. */
 const leaveNote = () => {
  const value = note.trim()
  if (!value) return
  update(s => ({ ...s, notes: [...s.notes, { id: makeId(), at: new Date().toISOString(), person, scope: 'personal', text: value }] }))
  setNoting(false); setNote('')
  toast.success(`Left for ${p.name} alone. Nobody else can read it.`)
 }

 return <div className="entrance">
  <BackBar onBack={() => navigate('home')}/>
  <div className="chat-head">
   <Avatar person={person} size="lg"/>
   <div className="chat-who">
    <h1>{p.name}</h1>
    <p>A demo conversation · no read receipts</p>
   </div>
   <button type="button" className="round-button" aria-label={`Call ${p.name}`} onClick={() => onCall(person)}><Phone aria-hidden="true"/></button>
  </div>

  <div className="wrap flow">
   <p className="note-strip"><Lock aria-hidden="true"/>Everything here is between you and {p.name}. The rail on the home screen is the other thing, that one everybody reads.</p>

   <div className="chat-acts">
    <button type="button" className="row" onClick={() => setNoting(true)}>
     <span className="row-icon tint-gold"><PenLine aria-hidden="true"/></span>
     <span className="row-body"><b>Leave a note just for them</b><span>{mine ? `Yours now: "${mine.text}"` : 'It sits on their card, nowhere else'}</span></span>
    </button>
    <button type="button" className="row" onClick={() => setTogether(true)}>
     <span className="row-icon tint-sky"><Users aria-hidden="true"/></span>
     <span className="row-body"><b>Work together, from wherever</b><span>No agenda, just company</span></span>
    </button>
   </div>

   <div className="transcript">
    <span className="transcript-day">A little space for you two</span>
    {messages.map(m => <div key={m.id} className="bubble-row" data-mine={m.mine}>
     <span className="bubble">{m.text}</span>
     {!m.mine && <button type="button" className="react" aria-label={m.liked ? 'Love already sent' : 'Send love for this message'} disabled={m.liked}
      onClick={() => update(s => addMoment({ ...s, messages: { ...s.messages, [person]: s.messages[person].map(x => x.id === m.id ? { ...x, liked: true } : x) } }, { id: `reaction-${m.id}`, at: new Date().toISOString(), person, kind: 'reacted', text: 'Sent love for a little note from home.', source: 'manual' }))}>
      <Heart aria-hidden="true" style={{ fill: m.liked ? 'currentColor' : 'none' }}/>{m.liked ? 'A little love, sent' : 'Send a little love'}
     </button>}
    </div>)}
   </div>

   <form className="composer" onSubmit={e => { e.preventDefault(); send() }}>
    <label htmlFor="message" className="sr-only">Your message</label>
    <textarea id="message" className="input" rows={1} placeholder="A little note is enough…" value={draft} maxLength={2000}
     onChange={e => update(s => ({ ...s, drafts: { ...s.drafts, [person]: e.target.value } }))}
     onKeyDown={e => { if (e.nativeEvent.isComposing || e.keyCode === 229) return; if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}/>
    <button type="submit" className="btn composer-send" aria-label="Send message" disabled={!draft.trim()}><Send aria-hidden="true"/></button>
   </form>
   <p className="fineprint">Saved here, not delivered to a real person.</p>
  </div>

  <Dialog open={noting} onOpenChange={value => { setNoting(value); if (!value) setNote('') }}><DialogContent>
   <DialogHeader>
    <DialogTitle>A note just for {p.name}</DialogTitle>
    <DialogDescription>It shows on their card in Your people, and nowhere else. Not on the rail, not to anybody you have added.</DialogDescription>
   </DialogHeader>
   <p className="note-strip"><Lock aria-hidden="true"/>Only {p.name} can read this one.</p>
   <label className="label" htmlFor="personal-note">Your note</label>
   <input id="personal-note" className="input" maxLength={90} value={note} autoComplete="off"
    placeholder="thinking about that thing you said…"
    onChange={e => setNote(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); leaveNote() } }}/>
   <button type="button" className="btn btn-block" disabled={!note.trim()} onClick={leaveNote}><PenLine aria-hidden="true"/>Leave It For Them</button>
  </DialogContent></Dialog>

  <Dialog open={together} onOpenChange={setTogether}><DialogContent>
   <DialogHeader><DialogTitle>Just being there counts.</DialogTitle><DialogDescription>A shared-session invitation in your demo chat. No real audio or video session starts.</DialogDescription></DialogHeader>
   <div className="flow">{['Study with me for a little while?', 'Shall we cook dinner together?', 'No agenda. Just a little company?'].map(text =>
    <button key={text} type="button" className="btn btn-soft btn-block" style={{ minHeight: 52, whiteSpace: 'normal' }} onClick={() => { send(text); setTogether(false) }}>{text}</button>)}</div>
  </DialogContent></Dialog>
 </div>
}
