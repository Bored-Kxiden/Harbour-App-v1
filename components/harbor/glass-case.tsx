'use client'
import { feelings, flowerSpec, formatDuration, type Moment } from '@/lib/harbor/model'
import { useHarbor } from '@/lib/harbor/store'
import { FlowerGlyph } from './flowers'
import { useEscape } from './use-escape'

/** One call, under glass: the flower it grew, and the four things worth remembering about it. */
export function GlassCase({ moment, onClose }: { moment: Moment; onClose: () => void }) {
 const { state } = useHarbor()
 useEscape(onClose)
 const flower = flowerSpec(moment.flower)
 const who = state?.people.find(p => p.id === moment.person)
 const feeling = feelings.find(f => f.id === moment.feeling)
 const rows: [string, string][] = [
  ['Date', new Date(moment.at).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })],
  ['Duration', formatDuration(moment.minutes)],
 ]
 if (moment.topic) rows.push(['What it was about', moment.topic])
 if (feeling) rows.push(['How you felt', `${feeling.label}, ${feeling.caption.toLowerCase().replace(/\.$/, '')}`])

 return <div className="scrim" role="dialog" aria-modal="true" aria-label={`${flower.name}, a call with ${who?.name ?? 'your people'}`}
  onPointerDown={e => { if (e.target === e.currentTarget) onClose() }}>
  <div className="panel">
   <div className="vitrine">
    <span className="vitrine-shadow"/>
    <span className="vitrine-stage"><FlowerGlyph kind={moment.flower ?? 'daisy'} size={120} blooming/></span>
   </div>
   <div className="panel-head"><h3>{flower.name}</h3><span className="panel-who">with {who?.name ?? 'your people'}</span></div>
   <p className="small">{flower.note}</p>
   <div className="panel-rows">{rows.map(([label, value]) => <div className="panel-row" key={label}><b>{label}</b><span>{value}</span></div>)}</div>
   <button type="button" className="btn btn-soft btn-block" onClick={onClose}>Leave it growing</button>
  </div>
 </div>
}
