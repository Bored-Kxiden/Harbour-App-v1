'use client'
import { flowerLibrary, flowerSpec, type FlowerKind } from '@/lib/harbor/model'
import { cn } from '@/lib/utils'

/** One flower, drawn upright with its base at the origin so it can stand anywhere on the ground. */
export function FlowerMark({ kind, size = 1, blooming = false, faded = false }: { kind: FlowerKind; size?: number; blooming?: boolean; faded?: boolean }) {
 const f = flowerSpec(kind)
 const cup = f.shape === 'cup'
 const spread = cup ? 168 : 360
 const step = cup ? spread / Math.max(f.petals - 1, 1) : spread / f.petals
 const start = cup ? -spread / 2 : 0
 const rx = f.shape === 'point' ? 2.6 : cup ? 5 : 4
 const ry = f.shape === 'point' ? 8.4 : cup ? 8.6 : 7.1
 return <g className={cn('flower', blooming && 'flower-bloom', faded && 'flower-faded')} transform={`scale(${size})`}>
  <path className="flower-stem" d="M0 0 C -2.2 -8, 2 -15, 0 -22.5" fill="none" stroke="#4E7A50" strokeWidth={1.7} strokeLinecap="round"/>
  <path className="flower-leaf" d="M0 -10 C -7 -13.5, -9.5 -8.5, -2.5 -6.5 Z" fill="#5C8A55"/>
  <path className="flower-leaf flower-leaf-right" d="M0 -15 C 6.5 -18.5, 8.5 -13.5, 2 -12 Z" fill="#6B9A61"/>
  <g transform="translate(0,-23.5)">
   {Array.from({ length: f.petals }, (_, i) => <g key={i} transform={`rotate(${start + i * step})`}>
    <ellipse className="flower-petal" style={{ ['--i' as string]: i }} cx={0} cy={-ry * 0.82} rx={rx} ry={ry} fill={i % 2 ? f.petal : f.petalDeep}/>
   </g>)}
   <circle className="flower-heart" r={cup ? 2.4 : 3.1} fill={f.heart}/>
  </g>
 </g>
}

/** The same flower on its own canvas, for pickers, lists and legends. */
export function FlowerGlyph({ kind, size = 46, blooming = false, className }: { kind: FlowerKind; size?: number; blooming?: boolean; className?: string }) {
 return <svg className={className} width={size} height={size * 1.28} viewBox="-15 -40 30 44" role="img" aria-label={`${flowerSpec(kind).name} flower`}>
  <FlowerMark kind={kind} blooming={blooming}/>
 </svg>
}

export function FlowerPicker({ value, onChange, suggested }: { value: FlowerKind; onChange: (kind: FlowerKind) => void; suggested?: FlowerKind[] }) {
 const list = suggested?.length ? flowerLibrary.filter(f => suggested.includes(f.id)) : flowerLibrary
 return <div className="flower-grid" role="radiogroup" aria-label="Choose a flower for this call">
  {list.map(f => <button key={f.id} type="button" role="radio" aria-checked={value === f.id} className="flower-option" onClick={() => onChange(f.id)}>
   <FlowerGlyph kind={f.id} size={44}/>
   <span className="flower-option-name">{f.name}</span>
   <span className="flower-option-note">{f.note}</span>
  </button>)}
 </div>
}
