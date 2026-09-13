'use client'
import { useState } from 'react'
import { BookHeart, Camera, ChevronRight, Images, Lock, MessageCircle, NotebookPen, Plus, Users } from 'lucide-react'
import { toast } from 'sonner'
import { useHarbor } from '@/lib/harbor/store'
import { personalNotes, sharedNotes, type Note, type Snap } from '@/lib/harbor/model'
import { Avatar } from './avatar'
import { LocalPhoto } from './media-view'
import { Sprig } from './sprigs'

/** Saved: everything worth keeping, in the two shapes it comes in.
    Lines people left, split by who was allowed to read them, and the pictures somebody
    chose to hold on to before they faded. */
export function NotesScreen({ navigate, onOpenCamera, onOpenStory, initial = 'notes' }: {
 navigate: (page: string) => void; onOpenCamera: () => void; onOpenStory: () => void
 initial?: 'notes' | 'instants'
}) {
 const { state, update } = useHarbor()
 const [view, setView] = useState<'notes' | 'instants'>(initial)
 if (!state) return null

 const personal = personalNotes(state)
 const shared = sharedNotes(state)
 const kept = state.snaps.filter(s => s.saved).sort((a, b) => b.at.localeCompare(a.at))
 const loose = state.snaps.filter(s => !s.saved).sort((a, b) => b.at.localeCompare(a.at))

 const keep = (snap: Snap) => {
  update(s => ({ ...s, snaps: s.snaps.map(x => x.id === snap.id ? { ...x, saved: !x.saved } : x) }))
  toast.success(snap.saved ? 'Let it fade.' : 'Kept in your saved instants.')
 }

 return <div className="entrance">
  <div className="page-head">
   <h1>{view === 'notes' ? 'Notes' : 'Photos'}</h1>
   <p>{view === 'notes'
    ? 'Small things your people said out loud. Nobody owes a reply.'
    : 'Pictures you kept before they faded. Tap one to let it go again.'}</p>
  </div>

  <div className="wrap flow stagger">
   <div className="segment" role="tablist" aria-label="What to look at" style={{ ['--i' as string]: 0 }}>
    <span className="segment-slide" style={{ ['--i' as string]: view === 'notes' ? 0 : 1 }} aria-hidden="true"/>
    {(['notes', 'instants'] as const).map(id => <button key={id} type="button" role="tab" className="segment-tab"
     aria-selected={view === id} onClick={() => setView(id)}>
     {id === 'notes' ? <><NotebookPen aria-hidden="true"/>Notes</> : <><Images aria-hidden="true"/>Saved instants</>}
    </button>)}
   </div>

   {view === 'notes' ? <>
    <NoteGroup title="Just for you" hint="Written to you alone. Nobody else can read these." icon={<Lock aria-hidden="true"/>}
     notes={personal} navigate={navigate} order={1}/>
    <NoteGroup title="For everyone" hint="Left on the rail for everybody you have added." icon={<Users aria-hidden="true"/>}
     notes={shared} navigate={navigate} order={2}/>
    <button type="button" className="row" style={{ ['--i' as string]: 3 }} onClick={onOpenStory}>
     <span className="row-icon" style={{ background: 'var(--tint-blue)' }}><BookHeart aria-hidden="true"/></span>
     <span className="row-body"><b>Today&rsquo;s instants</b><span>{state.snaps.length} picture{state.snaps.length === 1 ? '' : 's'} from your people</span></span>
     <ChevronRight className="caret" aria-hidden="true"/>
    </button>
   </> : <>
    {kept.length || loose.length ? <div className="scrap" style={{ ['--i' as string]: 1 }}>
     {[...kept, ...loose].map(snap => {
      const who = state.people.find(p => p.id === snap.person)
      return <button key={snap.id} type="button" className="polaroid" onClick={() => keep(snap)}
       aria-label={`${snap.caption ?? 'An instant'} from ${who?.name ?? 'you'}. ${snap.saved ? 'Saved. Tap to let it fade.' : 'Tap to save it.'}`}>
       <span className="polaroid-tape" aria-hidden="true"/>
       <span className={`polaroid-shot tint-${who?.tone ?? 'green'}`}>
        {snap.mediaId ? <LocalPhoto id={snap.mediaId}/> : <Sprig kind="cosmos" style={{ width: 54 }}/>}
       </span>
       <span className="polaroid-date">{new Date(snap.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
       <span className="polaroid-note">{snap.caption ?? 'no reason'}</span>
      </button>
     })}
     <p className="scrap-note">Collect moments,<br/>not things.</p>
    </div> : <p className="empty">Nothing saved yet. The camera is one tap away.</p>}
   </>}

   <p className="fineprint" style={{ ['--i' as string]: 9 }}>Instants fade on their own. Tap one to save it.</p>
  </div>

  <button type="button" className="fab" aria-label="Take an instant" onClick={onOpenCamera}>
   {view === 'instants' ? <Plus aria-hidden="true"/> : <Camera aria-hidden="true"/>}
  </button>
 </div>
}

/** One heading and the notes under it. The heading is the whole point: it says who
    else could read this, which is the only difference between the two kinds. */
function NoteGroup({ title, hint, icon, notes, navigate, order }: {
 title: string; hint: string; icon: React.ReactNode; notes: Note[]
 navigate: (page: string) => void; order: number
}) {
 const { state } = useHarbor()
 return <section className="flow" style={{ gap: 10, ['--i' as string]: order }} aria-label={title}>
  <div className="group-head">
   <b>{icon}{title}</b>
   <span>{hint}</span>
  </div>
  {notes.length ? notes.map(note => {
   const who = note.person === 'you' ? null : state?.people.find(p => p.id === note.person)
   return <article key={note.id} className="card card-pad">
    <Sprig kind={note.scope === 'personal' ? 'cosmos' : 'leaf'} className="person-sprig" style={{ width: 54, bottom: 2 }}/>
    <div className="row" style={{ boxShadow: 'none', background: 'transparent', padding: 0 }}>
     <Avatar person={note.person} size="sm"/>
     <span className="row-body">
      <b>{who?.name ?? 'You'}</b>
      <span>{new Date(note.at).toLocaleString(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit' })}</span>
     </span>
    </div>
    <p className="note-line">{note.text}</p>
    {who && <button type="button" className="text-link" onClick={() => navigate(`chat/${who.id}`)}>
     <MessageCircle aria-hidden="true"/>Say something back
    </button>}
   </article>
  }) : <p className="empty">Nothing here. The quiet is allowed.</p>}
 </section>
}
