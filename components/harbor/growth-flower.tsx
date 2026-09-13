'use client'
import { growthStages, type GrowthStage } from '@/lib/harbor/model'

/** The one flower in the app that isn't decoration: it is how calling itself is
    doing. The same six stages a cut flower goes through in a vase: bud, blooming,
    fully bloomed, withering, shedding, dying back, driven by how recently and how
    often anyone has actually called, not by anything typed in. */
export function GrowthFlower({ stage, size, className }: { stage: GrowthStage; size?: number; className?: string }) {
 const info = growthStages.find(g => g.id === stage) ?? growthStages[0]
 /* No size given: it lives in a card that already sizes it by CSS (as Sprig does),
    so an explicit width/height here would just fight that box's own aspect ratio. */
 return <svg className={className} {...(size ? { width: size, height: size * 1.22 } : {})}
  viewBox="0 0 64 78" fill="none" role="img" aria-label={`${info.label}. ${info.caption}`}>
  <GrowthMark stage={stage}/>
 </svg>
}

/** Bare geometry, so the same drawing can also sit inside a widget-style ring. */
export function GrowthMark({ stage }: { stage: GrowthStage }) {
 switch (stage) {
  case 'bud': return <g className="growth growth-bud">
   <path d="M32 76V48" stroke="#7BA96B" strokeWidth="2.6" strokeLinecap="round"/>
   <path d="M31 60c-3-7-9-10-17-10 1 8 7 13 17 10z" fill="#9CCB8F"/>
   <path d="M32 30c5 0 8 5 8 11 0 5-3 9-8 9s-8-4-8-9c0-6 3-11 8-11z" fill="#C7DE7E"/>
   <path d="M32 30c-2.6 3-4 6.5-4 11s1.4 8 4 10c2.6-2 4-5.5 4-10s-1.4-8-4-11z" fill="#AECB63"/>
  </g>
  case 'blooming': return <g className="growth growth-blooming">
   <path d="M32 76V38" stroke="#6FA765" strokeWidth="2.8" strokeLinecap="round"/>
   <path d="M31 54c-3-9-10-13-20-14 1 11 8 17 20 14z" fill="#9CCB8F"/>
   <path d="M33 48c2-9 8-13 18-14-1 10-7 16-18 14z" fill="#7FB878"/>
   <path d="M32 12c6.5 0 11.5 5.4 11.5 12.4 0 3-1 5.7-2.7 7.8-2.2-1-4.7-1.5-8.8-1.5s-6.6.5-8.8 1.5c-1.7-2.1-2.7-4.8-2.7-7.8C20.5 17.4 25.5 12 32 12z" fill="#F7CE63"/>
   <path d="M32 12c-4.3 3.6-6.6 8-6.6 12.4 0 2.6.7 4.9 1.9 6.9 1.4-.5 2.9-.8 4.7-.9V12z" fill="#F2B441"/>
  </g>
  case 'full': return <g className="growth growth-full">
   <path d="M32 76V32" stroke="#6FA765" strokeWidth="3" strokeLinecap="round"/>
   <path d="M31 50c-4-11-12-16-24-17 1 13 10 20 24 17z" fill="#9CCB8F"/>
   <path d="M33 43c2-11 9-16 22-17-1 12-9 19-22 17z" fill="#7FB878"/>
   <path d="M32 8c7.4 0 13.5 6.3 13.5 14.4 0 3.5-1.1 6.6-3 9-2.6-1.1-5.8-1.7-10.5-1.7s-7.9.6-10.5 1.7c-1.9-2.4-3-5.5-3-9C18.5 14.3 24.6 8 32 8z" fill="#F7CE63"/>
   <path d="M32 8c-5 4.1-7.7 9.3-7.7 14.4 0 3 .8 5.7 2.2 8 1.7-.6 3.5-1 5.5-1.1V8z" fill="#F2B441"/>
  </g>
  case 'withering': return <g className="growth growth-withering">
   <path d="M32 76C33 60 30 50 24 44" stroke="#8C9E72" strokeWidth="2.6" strokeLinecap="round" fill="none"/>
   <path d="M30 56c-3-7-9-10-17-10 1 8 7 13 17 10z" fill="#A9B583"/>
   <ellipse cx="24" cy="44" rx="10" ry="9" fill="#D9C079" transform="rotate(-25 24 44)"/>
   <ellipse cx="21" cy="41" rx="6" ry="7" fill="#C6A85B" transform="rotate(-25 24 44)"/>
  </g>
  case 'shedding': return <g className="growth growth-shedding">
   <path d="M33 76C35 58 30 46 20 40" stroke="#9E9678" strokeWidth="2.4" strokeLinecap="round" fill="none"/>
   <path d="M27 52c-3-6-8-8-14-7 1 7 6 10 14 7z" fill="#C3BB94"/>
   <ellipse cx="20" cy="40" rx="7.4" ry="6.6" fill="#C7A96A" transform="rotate(-35 20 40)"/>
   <ellipse cx="18" cy="38" rx="4.4" ry="5" fill="#B99A5C" transform="rotate(-35 20 40)"/>
   {/* two petals, already down */}
   <ellipse className="growth-fallen growth-fallen-a" cx="9" cy="68" rx="5" ry="3.2" fill="#C7A96A" transform="rotate(-18 9 68)"/>
   <ellipse className="growth-fallen growth-fallen-b" cx="28" cy="73" rx="4.4" ry="2.8" fill="#B99A5C" transform="rotate(22 28 73)"/>
  </g>
  case 'dying': return <g className="growth growth-dying">
   <path d="M34 76C38 54 32 40 18 34" stroke="#8A8677" strokeWidth="2.2" strokeLinecap="round" fill="none"/>
   <path d="M25 46c-2-4-6-6-10-5 1 5 4 7 10 5z" fill="#ADA88F"/>
   <ellipse cx="18" cy="34" rx="6.4" ry="5.8" fill="#8B8776" transform="rotate(-55 18 34)"/>
   <ellipse cx="16" cy="32" rx="3.6" ry="4.4" fill="#77735F" transform="rotate(-55 18 34)"/>
   <ellipse cx="8" cy="70" rx="4.4" ry="2.6" fill="#8B8776" transform="rotate(-14 8 70)"/>
  </g>
 }
}
