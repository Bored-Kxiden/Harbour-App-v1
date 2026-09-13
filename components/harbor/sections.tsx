'use client'
import { ChevronRight, Maximize2 } from 'lucide-react'
import { useHarbor } from '@/lib/harbor/store'
import { callsFor, dominantFlower } from '@/lib/harbor/model'
import { Avatar } from './avatar'
import { FlowerGlyph } from './flowers'
import { useEscape } from './use-escape'

/** The garden, listed rather than walked. Tapping the label under the weather chip
    opens this instead of guessing where a pinch will land: every person's plot, by
    name, and one tap carries the camera there. "See the whole garden" is the same
    pulling-back the field already does on its own, just reachable without a gesture. */
export function SectionsOverlay({ onClose, onGo, onOverview }: {
 onClose: () => void
 onGo: (personId: string) => void
 onOverview: () => void
}) {
 const { state } = useHarbor()
 useEscape(onClose)
 if (!state) return null

 return <div className="scrim" role="dialog" aria-modal="true" aria-label="Find your way around the garden"
  onPointerDown={e => { if (e.target === e.currentTarget) onClose() }}>
  <div className="panel sections-panel">
   <div className="panel-head"><h3>Your garden</h3><span className="panel-who">tap a name to walk there</span></div>
   <button type="button" className="row" onClick={() => { onOverview(); onClose() }}>
    <span className="row-icon" style={{ background: 'var(--tint-blue)' }}><Maximize2 aria-hidden="true"/></span>
    <span className="row-body"><b>See the whole garden</b><span>Pull all the way back to the plan</span></span>
    <ChevronRight className="caret" aria-hidden="true"/>
   </button>
   <div className="sections-list">
    {state.people.map(person => {
     const flower = dominantFlower(state, person.id)
     const count = callsFor(state, person.id).length
     return <button key={person.id} type="button" className="row" onClick={() => { onGo(person.id); onClose() }}>
      <Avatar person={person.id}/>
      <span className="row-body"><b>{person.name}</b>
       <span>{count ? `${count} ${count === 1 ? 'flower' : 'flowers'} growing` : 'Nothing planted yet'}</span>
      </span>
      {flower && <FlowerGlyph kind={flower} size={22}/>}
      <ChevronRight className="caret" aria-hidden="true"/>
     </button>
    })}
   </div>
   <button type="button" className="btn btn-quiet btn-block" onClick={onClose}>Close</button>
  </div>
 </div>
}
