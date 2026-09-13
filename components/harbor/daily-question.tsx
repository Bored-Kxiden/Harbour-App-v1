'use client'
import { useState } from 'react'
import { Dices } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { gameForDay, localDay } from '@/lib/harbor/model'
import { makeId, useHarbor } from '@/lib/harbor/store'
import { Avatar } from './avatar'

/** One small shared question a day. It opens once when the app does, and skipping costs nothing. */
export function DailyQuestion({ open, onOpenChange }: { open: boolean; onOpenChange: (value: boolean) => void }) {
 const { state, update, log } = useHarbor()
 const [answer, setAnswer] = useState('')
 const day = localDay()
 if (!state) return null
 const prompt = gameForDay(day)
 const mine = state.games[day]
 const replies = [state.people[0] && { person: state.people[0], text: prompt.mom }, state.people[1] && { person: state.people[1], text: prompt.dad }].filter(Boolean) as { person: { id: string; name: string }; text: string }[]

 const submit = (event: React.FormEvent<HTMLFormElement>) => {
  event.preventDefault()
  const text = answer.trim(); if (!text) return
  update(s => ({ ...s, games: { ...s.games, [day]: text } }))
  log({ id: makeId(), at: new Date().toISOString(), person: state.people[0]?.id ?? 'family', kind: 'played', text: `Answered today’s little question: “${prompt.q}”`, source: 'game' })
  toast.success('Thanks for playing along.')
 }

 return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent>
  <DialogHeader>
   <DialogTitle style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}><Dices className="size-5" style={{ marginTop: 4, flexShrink: 0, color: 'var(--leaf)' }}/>{prompt.q}</DialogTitle>
   <DialogDescription>Today&apos;s little question. No streak to keep. Answer today, skip tomorrow, either is fine.</DialogDescription>
  </DialogHeader>

  {mine ? <>
   <div className="stack">
    {replies.map(r => <div key={r.person.id} className="row" style={{ boxShadow: 'none', background: 'var(--wash)' }}>
     <Avatar person={r.person.id} size="sm"/><span className="row-body"><b>{r.person.name}</b><span>{r.text}</span></span>
    </div>)}
    <div className="row" style={{ boxShadow: 'none', background: 'var(--soft)' }}>
     <Avatar person="you" size="sm"/><span className="row-body"><b>You</b><span>{mine}</span></span>
    </div>
   </div>
   <button type="button" className="btn btn-block" onClick={() => onOpenChange(false)}>Back to your garden</button>
  </> : <form className="flow" onSubmit={submit}>
   <div><label className="label" htmlFor="question-answer">Your answer</label>
    <textarea className="input" id="question-answer" rows={3} maxLength={200} required placeholder="Whatever comes to mind…" value={answer} onChange={e => setAnswer(e.target.value)}/></div>
   <button type="submit" className="btn btn-block">Share my answer</button>
   <button type="button" className="btn btn-quiet btn-block" onClick={() => onOpenChange(false)}>Not today</button>
  </form>}
 </DialogContent></Dialog>
}
