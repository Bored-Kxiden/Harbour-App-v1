'use client'
import { ChevronLeft } from 'lucide-react'

/** The way out of anywhere that is not a tab.
    Four screens sit underneath the five in the nav bar, and until now the only way
    back out of them was the browser's own button, which a phone does not always show.
    Every one of them opens with this, naming where it goes rather than just pointing. */
export function BackBar({ onBack, label = 'Home' }: { onBack: () => void; label?: string }) {
 return <div className="backbar">
  <button type="button" className="back-btn" onClick={onBack}>
   <ChevronLeft aria-hidden="true"/>{label}
  </button>
 </div>
}
