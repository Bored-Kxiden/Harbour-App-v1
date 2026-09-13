'use client'
import { useEffect } from 'react'

/** Escape closes whatever is on top. Every aria-modal overlay owes the keyboard this. */
export function useEscape(onClose: () => void) {
 useEffect(() => {
  const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
  window.addEventListener('keydown', key)
  return () => window.removeEventListener('keydown', key)
 }, [onClose])
}
