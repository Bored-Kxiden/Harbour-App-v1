'use client'
import { Camera } from 'lucide-react'
import { useHarbor } from '@/lib/harbor/store'
import { activePacts } from '@/lib/harbor/model'
import { FlowerGlyph } from './flowers'
import { useEscape } from './use-escape'

/** The daily window, once two people have agreed to it: a random moment, a short fuse,
    and no expectation that the picture is any good. It opens like a flower does. */
export function SnapPrompt({ onTake, onSkip }: { onTake: () => void; onSkip: () => void }) {
 const { state } = useHarbor()
 useEscape(onSkip)
 if (!state) return null
 const names = activePacts(state).map(p => state.people.find(x => x.id === p.personId)?.name).filter(Boolean)
 const withWhom = names.length ? names.join(' and ') : 'Your people'
 return <div className="scrim" role="dialog" aria-modal="true" aria-label="Time for an instant">
  <div className="window-card">
   <span className="window-bloom">
    <span className="window-ring" aria-hidden="true"/>
    <span className="window-ring" aria-hidden="true"/>
    <FlowerGlyph kind="cosmos" size={58} blooming/>
   </span>
   <span className="eyebrow" style={{ display: 'block', marginTop: 10 }}>Your window is open</span>
   <h2 style={{ fontSize: 27, color: 'var(--ink-deep)', letterSpacing: '-.6px', margin: '6px 0 6px' }}>It&rsquo;s time.</h2>
   <p className="small" style={{ marginBottom: 16 }}>
    Whatever you&rsquo;re doing right now. That&rsquo;s the one. {withWhom} got the same nudge at the same moment.
   </p>
   <button type="button" className="btn btn-block" onClick={onTake}><Camera aria-hidden="true"/>Take It</button>
   <button type="button" className="btn btn-quiet btn-block" style={{ marginTop: 6 }} onClick={onSkip}>skip today</button>
  </div>
 </div>
}
