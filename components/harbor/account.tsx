'use client'
import { useEffect, useState } from 'react'
import { Camera, ChevronRight, GraduationCap, House, ImageUp, LockKeyhole, Maximize, Minimize, Moon, Play, ShieldCheck, Sprout, Sun, SunMoon, Trash2, UserRoundPlus, Waves } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { chime, makeId, useHarbor } from '@/lib/harbor/store'
import { clearMedia, saveMedia } from '@/lib/harbor/media'
import { activePacts, callsFor, initialsOf, localDay, rollSnapWindow, themes, type Mode, type Person, type Tone } from '@/lib/harbor/model'
import { Avatar } from './avatar'
import { Sprig } from './sprigs'

const tones: Tone[] = ['green', 'gold', 'orange', 'sky']

/** Whether the whole document element is any browser's idea of fullscreen right now.
    Safari on the desktop still answers only to its own -webkit- prefixed reading. */
function fullscreenElement(): Element | null {
 return document.fullscreenElement ?? (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement ?? null
}
/** Already running with no browser chrome at all, launched from a home screen icon
    rather than a tab. Reached a different way on iPhone (Safari never gained the
    Fullscreen API for anything but a video), so a page that got here already did
    the thing this whole control is for. */
function isStandalone(): boolean {
 return window.matchMedia('(display-mode: standalone)').matches
  || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function AccountScreen({ navigate }: { navigate: (page: string) => void }) {
 const { state, update, reset, swap } = useHarbor()
 const [privacy, setPrivacy] = useState(false)
 const [fullscreen, setFullscreen] = useState(false)
 const [fullscreenSupported, setFullscreenSupported] = useState(false)
 const [standalone, setStandalone] = useState(false)
 const [resetOpen, setResetOpen] = useState(false)
 const [switchTo, setSwitchTo] = useState<Mode | null>(null)
 const [adding, setAdding] = useState(false)
 const [newName, setNewName] = useState('')
 const [removing, setRemoving] = useState<Person | null>(null)
 const [pactFor, setPactFor] = useState<Person | null>(null)
 if (!state) return null
 const settings = state.settings
 const pactOf = (id: string) => state.pacts.find(p => p.personId === id)
 /* The demo otherwise runs like any other web page, browser bars and all. Where the
    Fullscreen API genuinely works this is a live toggle; where it does not (every
    browser on an iPhone, since that is a WebKit limitation and not a Safari one),
    the row stays put and says the one thing that does work there instead, rather
    than just disappearing as if the feature never existed. */
 useEffect(() => {
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void }
  setFullscreenSupported(!!(document.fullscreenEnabled || (document as unknown as { webkitFullscreenEnabled?: boolean }).webkitFullscreenEnabled || el.webkitRequestFullscreen))
  setStandalone(isStandalone())
  const sync = () => setFullscreen(!!fullscreenElement())
  sync()
  document.addEventListener('fullscreenchange', sync)
  document.addEventListener('webkitfullscreenchange', sync)
  return () => { document.removeEventListener('fullscreenchange', sync); document.removeEventListener('webkitfullscreenchange', sync) }
 }, [])
 const toggleFullscreen = async () => {
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void }
  const exit = document as Document & { webkitExitFullscreen?: () => Promise<void> | void }
  try {
   if (fullscreenElement()) await (document.exitFullscreen ? document.exitFullscreen() : exit.webkitExitFullscreen?.())
   else await (el.requestFullscreen ? el.requestFullscreen() : el.webkitRequestFullscreen?.())
  } catch { toast.error('Full screen was not allowed just now. Try again with a direct tap.') }
 }

 const setPact = (id: string, status: 'invited' | 'active' | null) => update(s => ({
  ...s,
  pacts: status ? [...s.pacts.filter(p => p.personId !== id), { personId: id, status, since: new Date().toISOString() }] : s.pacts.filter(p => p.personId !== id),
 }))

 const addPerson = () => {
  const name = newName.trim()
  if (!name) return
  const id = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'friend'}-${makeId().slice(0, 4)}`
  update(s => ({ ...s, people: [...s.people, { id, name, initials: initialsOf(name), tone: tones[s.people.length % tones.length] }], messages: { ...s.messages, [id]: [] } }))
  setNewName(''); setAdding(false)
  toast.success(`${name} is in your list now.`)
 }
 const removePerson = (person: Person) => {
  update(s => ({
   ...s,
   people: s.people.filter(p => p.id !== person.id),
   moments: s.moments.filter(m => m.person !== person.id),
   notes: s.notes.filter(n => n.person !== person.id),
   messages: Object.fromEntries(Object.entries(s.messages).filter(([id]) => id !== person.id)),
  }))
  setRemoving(null)
  toast.success(`${person.name} has been removed.`)
 }
 const setPhoto = async (person: Person, file: File) => {
  if (!file.type.startsWith('image/')) { toast.error('That is not an image. Choose a picture instead.'); return }
  if (file.size > 10 * 1024 * 1024) { toast.error('That picture is over 10 MB. Choose a smaller one.'); return }
  try {
   const id = makeId(); await saveMedia(id, file)
   update(s => ({ ...s, people: s.people.map(p => p.id === person.id ? { ...p, photoId: id } : p) }))
   toast.success('Saved on this device only.')
  } catch { toast.error('Your browser would not save that picture. Try a smaller one.') }
 }
 const savePace = (event: React.FormEvent<HTMLFormElement>) => {
  event.preventDefault()
  const f = new FormData(event.currentTarget)
  const walkingMinutes = Number(f.get('walking')), dailyCap = Number(f.get('cap')), cooldownMinutes = Number(f.get('cooldown'))
  if (![walkingMinutes, dailyCap, cooldownMinutes].every(Number.isInteger)
   || walkingMinutes < 1 || walkingMinutes > 120
   || dailyCap < 1 || dailyCap > 10 || cooldownMinutes < 1 || cooldownMinutes > 1440) {
   toast.error('Those values are outside the limits shown. Try numbers inside them.')
   return
  }
  update(s => ({ ...s, settings: { ...s.settings, walkingMinutes, dailyCap, cooldownMinutes } }))
  toast.success('Your pace, saved.')
 }

 return <div className="entrance">
  <div className="page-head">
   <h1>You</h1>
   <p>Your name, your people, and how Harbor behaves.</p>
  </div>

  <div className="wrap flow stagger">
   <section className="card card-pad flow" style={{ ['--i' as string]: 0 }}>
    <Sprig kind="leaf" className="person-sprig" style={{ width: 62, top: 6, bottom: 'auto' }}/>
    <div>
     <label className="label" htmlFor="profile-name">What should we call you?</label>
     <input className="input" id="profile-name" maxLength={40} value={state.name} name="nickname" autoComplete="nickname"
      onChange={e => update(s => ({ ...s, name: e.target.value }))}
      onBlur={() => { if (!state.name.trim()) update(s => ({ ...s, name: 'Maya' })) }}/>
    </div>
    <p className="note-strip"><LockKeyhole aria-hidden="true"/>No account, no tracking. This sample family lives only in your browser.</p>
   </section>

   <section className="card card-pad flow" style={{ ['--i' as string]: 1 }}>
    <div className="row-head" style={{ marginBottom: 0 }}>
     <h2 style={{ fontSize: 19 }}><Sprout style={{ width: 18, height: 18, color: 'var(--leaf)' }} aria-hidden="true"/>Your people</h2>
     <span className="small">one patch each</span>
    </div>
    {state.people.map(person => <div key={person.id} className="row" style={{ boxShadow: 'none', background: 'transparent', padding: '5px 0' }}>
     <Avatar person={person.id}/>
     <span className="row-body"><b>{person.name}</b><span>{callsFor(state, person.id).length} flowers growing</span></span>
     <label className="disc tap" style={{ width: 38, height: 38, boxShadow: 'none', background: 'var(--secondary)' }}>
      <ImageUp aria-hidden="true"/>
      <span className="sr-only">Add a photo for {person.name}</span>
      <input type="file" accept="image/*" className="sr-only" onChange={e => { const file = e.target.files?.[0]; if (file) void setPhoto(person, file) }}/>
     </label>
     {state.people.length > 1 && <button type="button" className="disc" style={{ width: 38, height: 38, boxShadow: 'none', background: 'var(--secondary)' }}
      aria-label={`Remove ${person.name}`} onClick={() => setRemoving(person)}><Trash2 aria-hidden="true"/></button>}
    </div>)}
    <button type="button" className="btn btn-soft btn-block" onClick={() => setAdding(true)}><UserRoundPlus aria-hidden="true"/>Add Someone</button>
   </section>

   <section className="card card-pad flow" style={{ ['--i' as string]: 2 }}>
    <div className="switch-row">
     <h2 style={{ fontSize: 19 }}><Camera style={{ width: 18, height: 18, color: 'var(--gold)' }} aria-hidden="true"/>Snap windows</h2>
    </div>
    <p className="small">Once a day, at a moment nobody picks, you both get the same nudge to take one picture of whatever you&rsquo;re doing. It only exists between two people who each said yes, and either of you can end it.</p>
    {state.people.map(person => {
     const pact = pactOf(person.id)
     return <div key={person.id} className="row" style={{ boxShadow: 'none', background: 'transparent', padding: '5px 0' }}>
      <Avatar person={person.id} size="sm"/>
      <span className="row-body"><b>{person.name}</b><span>{pact?.status === 'active' ? 'On, you both agreed' : pact?.status === 'invited' ? 'Waiting on them' : 'Not set up'}</span></span>
      {pact?.status === 'active'
       ? <button type="button" className="btn btn-quiet" style={{ minHeight: 38, padding: '0 12px' }} onClick={() => setPact(person.id, null)}>End</button>
       : pact?.status === 'invited'
        ? <button type="button" className="btn btn-soft" style={{ minHeight: 38, padding: '0 12px', fontSize: 13 }} onClick={() => setPact(person.id, 'active')}>Simulate Yes</button>
        : <button type="button" className="btn btn-soft" style={{ minHeight: 38, padding: '0 14px', fontSize: 13 }} onClick={() => setPactFor(person)}>Invite</button>}
     </div>
    })}
    {!!activePacts(state).length && <>
     <p className="note-strip"><ShieldCheck aria-hidden="true"/>{state.snapWindows[localDay()]
      ? `Today's moment is set for ${new Date(state.snapWindows[localDay()]).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}. You are not told in advance in the real thing.`
      : 'Rolling today’s moment…'}</p>
     <button type="button" className="btn btn-soft btn-block" onClick={() => { update(s => ({ ...s, snapWindows: { ...s.snapWindows, [localDay()]: new Date(Date.now() - 1000).toISOString() } })); toast.success('Today’s window is open now.') }}>Open Today&rsquo;s Window (Demo)</button>
     <button type="button" className="btn btn-quiet btn-block" onClick={() => update(s => ({ ...s, snapWindows: { ...s.snapWindows, [localDay()]: rollSnapWindow() } }))}>Roll a new moment</button>
    </>}
   </section>

   <section className="card card-pad flow" style={{ ['--i' as string]: 3 }}>
    <div className="switch-row">
     <h2 style={{ fontSize: 19 }}><Waves style={{ width: 18, height: 18, color: '#6C9FD6' }} aria-hidden="true"/>Slack Tide</h2>
     <button type="button" className="toggle" aria-pressed={settings.cuesEnabled} aria-label="Turn Slack Tide on or off"
      onClick={() => settings.cuesEnabled ? update(s => ({ ...s, settings: { ...s.settings, cuesEnabled: false } })) : setPrivacy(true)}/>
    </div>
    <p className="small">A nudge to call somebody, timed for right after you have been walking, the moment you are naturally free rather than mid-errand. Off until you turn it on; in this web demo you stand in for the motion sensor yourself, with the button near the bottom of this card.</p>
    <form className="flow pace-form" key={`${settings.walkingMinutes}-${settings.dailyCap}-${settings.cooldownMinutes}`} onSubmit={savePace}>
     <p className="pace-line">
      Nudge me after
      <input className="input" id="walking" name="walking" type="number" inputMode="numeric" min={1} max={120} required
       defaultValue={settings.walkingMinutes} autoComplete="off" aria-label="Minutes of walking before a cue can fire"/>
      minutes of walking, so a trip to the mailbox does not count.
     </p>
     <p className="pace-line">
      No more than
      <input className="input" id="cap" name="cap" type="number" inputMode="numeric" min={1} max={10} required
       defaultValue={settings.dailyCap} autoComplete="off" aria-label="The most cues allowed in one day"/>
      cues in one day, however many walks that takes.
     </p>
     <p className="pace-line">
      And at least
      <input className="input" id="cooldown" name="cooldown" type="number" inputMode="numeric" min={1} max={1440} required
       defaultValue={settings.cooldownMinutes} autoComplete="off" aria-label="The fewest minutes between two cues"/>
      minutes between two of them, so they never stack up.
     </p>
     <button type="submit" className="btn btn-soft btn-block">Save My Pace</button>
    </form>
    <div>
     <label className="label" htmlFor="sound">Your ringtone</label>
     <p className="small" style={{ margin: '0 0 8px' }}>What plays when a cue arrives, two or three rings before it stops on its own.</p>
     <div style={{ display: 'flex', gap: 8 }}>
      <select id="sound" className="input" value={settings.sound} onChange={e => update(s => ({ ...s, settings: { ...s.settings, sound: e.target.value as typeof settings.sound } }))}>
       <option value="chime">Little chime</option><option value="soft">Soft note</option><option value="silent">Silence</option>
      </select>
      <button type="button" className="btn btn-soft" style={{ minWidth: 52, padding: 0 }} aria-label="Preview the ringtone"
       disabled={settings.sound === 'silent'} onClick={() => chime(settings.sound)}><Play aria-hidden="true"/></button>
     </div>
    </div>
    <p className="small">See exactly what a cue looks like, without waiting for a real walk:</p>
    <button type="button" className="btn btn-soft btn-block" onClick={() => navigate('cue')}>Try a Demo Moment <ChevronRight aria-hidden="true"/></button>
   </section>

   <section className="card card-pad flow" style={{ ['--i' as string]: 4 }}>
    <div>
     <b>How it looks</b>
     <p className="small">Dusk puts the same meadow after sunset. Auto follows your phone.</p>
    </div>
    <div className="segment" role="radiogroup" aria-label="How it looks" style={{ marginBottom: 0 }}>
     <span className="segment-slide" style={{ ['--i' as string]: themes.findIndex(x => x.id === settings.theme) }} aria-hidden="true"/>
     {themes.map(({ id, label }) => <button key={id} type="button" role="radio" className="segment-tab"
      aria-checked={settings.theme === id}
      onClick={() => update(s => ({ ...s, settings: { ...s.settings, theme: id } }))}>
      {id === 'system' ? <SunMoon aria-hidden="true"/> : id === 'light' ? <Sun aria-hidden="true"/> : <Moon aria-hidden="true"/>}
      {label}
     </button>)}
    </div>
    <div className="switch-row">
     <div><b>A little less movement</b><p className="small">Reduce interface animations.</p></div>
     <button type="button" className="toggle" aria-pressed={settings.reducedMotion} aria-label="Reduce motion"
      onClick={() => update(s => ({ ...s, settings: { ...s.settings, reducedMotion: !s.settings.reducedMotion } }))}/>
    </div>
    {/* Always here, never just missing: what it says and does adapts to the one
        real question, whether this browser can actually be asked to drop its own
        chrome, rather than the row itself vanishing where it can't. */}
    <div className="switch-row" style={{ alignItems: 'flex-start' }}>
     <div><b>{fullscreen ? <Minimize aria-hidden="true" style={{ width: 15, height: 15, verticalAlign: -2, marginRight: 5 }}/> : <Maximize aria-hidden="true" style={{ width: 15, height: 15, verticalAlign: -2, marginRight: 5 }}/>}Full screen</b>
      <p className="small">
       {standalone
        ? 'You are already using Harbor full screen, opened from your home screen with none of the browser\u2019s own bars.'
        : fullscreenSupported
         ? 'Hide your browser\u2019s own bars, the way an installed app would.'
         : 'This browser keeps its own bars on the web, an iPhone always does. Look for Add to Home Screen (or Install app) in its menu, then open Harbor from the icon it adds: that copy fills the whole screen with none.'}
      </p></div>
     {!standalone && fullscreenSupported &&
      <button type="button" className="toggle" aria-pressed={fullscreen} aria-label="Full screen" onClick={toggleFullscreen}/>}
    </div>
   </section>

   {/* Switching sides re-lays the sample household, because a parent's Harbor and a
       student's Harbor are not the same app with a different skin. */}
   <section className="card card-pad flow" style={{ ['--i' as string]: 5 }} aria-labelledby="mode-heading">
    <div>
     <h2 id="mode-heading" style={{ fontSize: 17 }}>Who is using Harbor</h2>
     <p className="small">Parent mode keeps four buttons and puts calling first. Student mode adds your timetable and the meadow.</p>
    </div>
    <div className="segment" role="radiogroup" aria-labelledby="mode-heading" style={{ marginBottom: 0 }}>
     <span className="segment-slide" style={{ ['--i' as string]: state.mode === 'parent' ? 0 : 1 }} aria-hidden="true"/>
     <button type="button" role="radio" className="segment-tab" aria-checked={state.mode === 'parent'}
      onClick={() => state.mode !== 'parent' && setSwitchTo('parent')}>
      <House aria-hidden="true"/>Parent
     </button>
     <button type="button" role="radio" className="segment-tab" aria-checked={state.mode === 'student'}
      onClick={() => state.mode !== 'student' && setSwitchTo('student')}>
      <GraduationCap aria-hidden="true"/>Away from home
     </button>
    </div>
    <button type="button" className="text-link" style={{ alignSelf: 'start' }}
     onClick={() => { update(s => ({ ...s, toursSeen: s.toursSeen.filter(m => m !== s.mode) })); navigate('home') }}>
     Walk me through it again <ChevronRight aria-hidden="true"/>
    </button>
   </section>

   <button type="button" className="row" style={{ ['--i' as string]: 6 }} onClick={() => navigate('share')}>
    <span className="row-icon"><ShieldCheck aria-hidden="true"/></span>
    <span className="row-body"><b>Share my load &amp; privacy</b><span>Who sees your free and busy time</span></span>
    <ChevronRight className="caret" aria-hidden="true"/>
   </button>
   <button type="button" className="btn btn-soft btn-block" style={{ ['--i' as string]: 7 }} onClick={() => setResetOpen(true)}>Start the Demo Fresh</button>
   <p className="fineprint" style={{ ['--i' as string]: 8 }}>Harbor · a little closer, every day.<br/>Local demo. No real calls, messages, or calendar access.</p>
  </div>

  <Dialog open={adding} onOpenChange={value => { setAdding(value); if (!value) setNewName('') }}><DialogContent>
   <DialogHeader><DialogTitle>Who else belongs here?</DialogTitle><DialogDescription>They get their own patch of the meadow. Every call you have with them grows a flower in it.</DialogDescription></DialogHeader>
   <div><label className="label" htmlFor="new-person">Their name</label>
    <input className="input" id="new-person" maxLength={40} value={newName} placeholder="Nani…" autoComplete="off" spellCheck={false}
     onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPerson() } }}/></div>
   <button type="button" className="btn btn-block" disabled={!newName.trim()} onClick={addPerson}><UserRoundPlus aria-hidden="true"/>Give Them a Patch</button>
  </DialogContent></Dialog>

  <Dialog open={!!pactFor} onOpenChange={value => !value && setPactFor(null)}><DialogContent>
   <DialogHeader><DialogTitle>A snap window with {pactFor?.name}?</DialogTitle><DialogDescription>Once a day, at a random moment, you both get the same nudge to take one picture of whatever you happen to be doing. Nothing is scheduled and nothing is scored.</DialogDescription></DialogHeader>
   <p className="note-strip"><ShieldCheck aria-hidden="true"/>It takes both of you. {pactFor?.name} has to accept on their side, and either of you can end it at any time without explaining.</p>
   <button type="button" className="btn btn-block" onClick={() => { if (pactFor) { setPact(pactFor.id, 'invited'); toast.success(`Asked ${pactFor.name}.`) } setPactFor(null) }}>Ask {pactFor?.name}</button>
   <button type="button" className="btn btn-quiet btn-block" onClick={() => setPactFor(null)}>Not now</button>
  </DialogContent></Dialog>

  <Dialog open={!!removing} onOpenChange={value => !value && setRemoving(null)}><DialogContent>
   <DialogHeader><DialogTitle>Remove {removing?.name}?</DialogTitle><DialogDescription>Their patch and every flower in it goes too. This cannot be undone.</DialogDescription></DialogHeader>
   <button type="button" className="btn btn-block" onClick={() => removing && removePerson(removing)}>Remove Them</button>
   <button type="button" className="btn btn-quiet btn-block" onClick={() => setRemoving(null)}>Keep their patch</button>
  </DialogContent></Dialog>

  <Dialog open={privacy} onOpenChange={setPrivacy}><DialogContent>
   <DialogHeader><DialogTitle>A cue, never a demand.</DialogTitle><DialogDescription>Slack Tide waits for a quiet moment. Your activity stays private, is never shared with your family, and every cue can be dismissed at no cost.</DialogDescription></DialogHeader>
   <p className="note-strip"><ShieldCheck aria-hidden="true"/>This web version does not request motion permissions, monitor other apps, or reach you while the page is closed.</p>
   <button type="button" className="btn btn-block" onClick={() => { update(s => ({ ...s, settings: { ...s.settings, cuesEnabled: true } })); setPrivacy(false) }}>Turn Cues On</button>
   <button type="button" className="btn btn-quiet btn-block" onClick={() => setPrivacy(false)}>Not now</button>
  </DialogContent></Dialog>

  <Dialog open={!!switchTo} onOpenChange={value => !value && setSwitchTo(null)}><DialogContent>
   <DialogHeader><DialogTitle>Switch to {switchTo === 'parent' ? 'parent mode' : 'student mode'}?</DialogTitle>
    <DialogDescription>The household is laid out again from the other side of the phone, so the names and the week make sense. The time you marked as busy and any seed you planted cross over with you: you see them from the other end, on your own card. Messages and photos start fresh.</DialogDescription></DialogHeader>
   <button type="button" className="btn btn-block" onClick={() => { if (switchTo) { swap(switchTo); setSwitchTo(null); navigate('home') } }}>Switch sides</button>
   <button type="button" className="btn btn-quiet btn-block" onClick={() => setSwitchTo(null)}>Stay here</button>
  </DialogContent></Dialog>

  <Dialog open={resetOpen} onOpenChange={setResetOpen}><DialogContent>
   <DialogHeader><DialogTitle>A fresh patch of ground?</DialogTitle><DialogDescription>This clears your local people, messages, media, schedules, preferences and every flower in your meadow, then restores the sample family. It cannot be undone.</DialogDescription></DialogHeader>
   <button type="button" className="btn btn-block" onClick={async () => { try { await clearMedia(); reset(); setResetOpen(false); navigate('home'); toast.success('A fresh little Harbor.') } catch { toast.error('Local media would not clear. Close other tabs of this demo and try again.') } }}>Reset All Demo Data</button>
   <button type="button" className="btn btn-quiet btn-block" onClick={() => setResetOpen(false)}>Keep my meadow</button>
  </DialogContent></Dialog>
 </div>
}
