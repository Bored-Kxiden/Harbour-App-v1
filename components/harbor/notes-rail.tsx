'use client'
import { useState } from 'react'
import { Camera, MessageCircle, PenLine, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { makeId, useHarbor } from '@/lib/harbor/store'
import { sharedNotes, type Note } from '@/lib/harbor/model'
import { LocalPhoto } from './media-view'

const DAY = 86400000

/** A little something: the notes everyone can read. One bubble per person, each over
    its own face. Personal notes never appear here, they belong to the one person they
    were written to and live on their card. The two things you can add, a line and a
    picture, sit together at the end of the rail rather than at opposite ends of it. */
export function NotesRail({ navigate, onOpenCamera }: { navigate: (page: string) => void; onOpenCamera: () => void }) {
 const { state, update } = useHarbor()
 const [composing, setComposing] = useState(false)
 const [open, setOpen] = useState<Note | null>(null)
 const [text, setText] = useState('')
 if (!state) return null

 const fresh = sharedNotes(state).filter(n => Date.now() - new Date(n.at).getTime() < 2 * DAY)
 const mine = fresh.find(n => n.person === 'you')

 const add = () => {
  const value = text.trim()
  if (!value) return
  update(s => ({ ...s, notes: [...s.notes, { id: makeId(), at: new Date().toISOString(), person: 'you', scope: 'shared', text: value }] }))
  setComposing(false); setText('')
  toast.success('Left for everyone you have added. No reply needed.')
 }

 return <div className="something">
  <div className="notes-rail">
   {mine && <button type="button" className="note-item" onClick={() => setOpen(mine)}>
    <span className="note-bubble">{mine.text}</span>
    <span className="note-face tint-gold"><PenLine aria-hidden="true"/></span>
    <span className="note-name">You</span>
   </button>}
   {state.people.map(person => {
    const note = fresh.find(n => n.person === person.id)
    return <button key={person.id} type="button" className="note-item"
     onClick={() => note ? setOpen(note) : navigate(`chat/${person.id}`)}
     aria-label={note ? `${person.name} left a little something for everyone` : `Open your conversation with ${person.name}`}>
     {note && <span className="note-bubble">{note.text}</span>}
     <span className={`note-face tint-${person.tone}`}>
      {person.photoId ? <LocalPhoto id={person.photoId} className="avatar-photo"/> : <span className="note-initial">{person.initials}</span>}
      {note && <span className="note-dot"/>}
     </span>
     <span className="note-name">{person.name}</span>
    </button>
   })}
  </div>

  {/* Both ways of adding something, side by side, so neither has to be hunted for. */}
  <div className="rail-acts">
   <button type="button" className="rail-act" aria-label="Write a little something for everyone" onClick={() => setComposing(true)}>
    <PenLine aria-hidden="true"/>
   </button>
   <button type="button" className="rail-act rail-act-dark" aria-label="Take an instant" onClick={onOpenCamera}>
    <Camera aria-hidden="true"/>
   </button>
  </div>

  <Dialog open={composing} onOpenChange={value => { setComposing(value); if (!value) setText('') }}>
   <DialogContent>
    <DialogHeader>
     <DialogTitle>A little something</DialogTitle>
     <DialogDescription>One line, for everyone you have added. It fades on its own after a couple of days, and nobody owes you an answer.</DialogDescription>
    </DialogHeader>
    <p className="note-strip"><Users aria-hidden="true"/>Everyone in Your people can read this. For one person only, leave a note in their conversation instead.</p>
    <label className="label" htmlFor="note-text">Your note</label>
    <input id="note-text" className="input" maxLength={90} placeholder="ate cereal for dinner again…" value={text}
     autoComplete="off" onChange={e => setText(e.target.value)}
     onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}/>
    <button type="button" className="btn btn-block" disabled={!text.trim()} onClick={add}><PenLine aria-hidden="true"/>Leave This Note</button>
   </DialogContent>
  </Dialog>

  <Dialog open={!!open} onOpenChange={value => !value && setOpen(null)}>
   <DialogContent>
    {open && <>
     <DialogHeader>
      <DialogTitle>{open.person === 'you' ? 'Your little something' : state.people.find(p => p.id === open.person)?.name ?? 'Family'}</DialogTitle>
      <DialogDescription>{new Date(open.at).toLocaleString(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit' })} · everyone can read this</DialogDescription>
     </DialogHeader>
     <p style={{ fontFamily: 'var(--font-round), sans-serif', fontSize: 24, lineHeight: 1.25, color: 'var(--ink-deep)' }}>{open.text}</p>
     {open.person !== 'you' && <button type="button" className="btn btn-block" onClick={() => { const person = open.person; setOpen(null); navigate(`chat/${person}`) }}>
      <MessageCircle aria-hidden="true"/>Say Something Back
     </button>}
     <button type="button" className="btn btn-quiet btn-block" onClick={() => setOpen(null)}>Just noticing, thanks</button>
    </>}
   </DialogContent>
  </Dialog>
 </div>
}
