'use client'
import { useHarbor } from '@/lib/harbor/store'
import { initialsOf } from '@/lib/harbor/model'
import { cn } from '@/lib/utils'
import { LocalPhoto } from './media-view'

/** One circle for everyone: a saved photo when there is one, initials when there isn't. */
export function Avatar({ person, size = 'md', className }: { person: string; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
 const { state } = useHarbor()
 const you = person === 'you'
 const found = state?.people.find(p => p.id === person)
 const tone = you ? 'sky' : found?.tone ?? 'green'
 const initials = you ? initialsOf(state?.name ?? 'You') : found?.initials ?? '·'
 const photoId = you ? undefined : found?.photoId
 return <span className={cn('avatar', `avatar-${tone}`, `avatar-${size}`, className)} aria-hidden="true">
  {photoId ? <LocalPhoto id={photoId} className="avatar-photo"/> : initials}
 </span>
}
