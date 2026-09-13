'use client'
import { useEffect, useRef, useState } from 'react'
import { Bell, Bookmark, CalendarDays, Cloud, CloudLightning, CloudRain, CloudSun, House, Images, Leaf, Minus, Moon, Plus, Sparkles, Sun, UserRound } from 'lucide-react'
import { Toaster } from '@/components/ui/sonner'
import { makeId, useHarbor } from '@/lib/harbor/store'
import { activePacts, fieldWeather, localDay, rollSnapWindow, snapWindowDue, unseenAlerts, weatherIndex, weathers, type Moment, type Weather } from '@/lib/harbor/model'
import { Home } from './home'
import { ParentHome } from './parent-home'
import { Setup } from './setup'
import { Schedule } from './schedule'
import { AccountScreen } from './account'
import { AlertsScreen } from './alerts'
import { NotesScreen } from './notes'
import { ShareLoad } from './share-load'
import { Conversation } from './conversation'
import { CueOverlay, CueScreen, type Cue } from './cue'
import { CallFlow } from './call'
import { DailyQuestion } from './daily-question'
import { GlassCase } from './glass-case'
import { Meadow, type MeadowHandle } from './meadow'
import { Sheet } from './sheet'
import { CameraScreen, StoryViewer } from './instants'
import { SnapPrompt } from './snap'
import { SectionsOverlay } from './sections'
import { Tour } from './tour'

const weatherIcon: Record<Weather, typeof Sun> = { clear: Sun, bright: CloudSun, cloudy: Cloud, rain: CloudRain, storm: CloudLightning }
/* Two bars, because the two people holding this phone are not doing the same job.
   A student is juggling a timetable and needs the whole set. A parent wants their
   people, their pictures, something to play, and their own settings: four stops,
   each wide enough to hit without looking. */
const studentTabs = {
 left: [{ id: 'home', label: 'Home', icon: House }, { id: 'schedule', label: 'Week', icon: CalendarDays }],
 right: [{ id: 'saved', label: 'Saved', icon: Bookmark }, { id: 'account', label: 'You', icon: UserRound }],
}
/* Photos rather than Saved, and it opens on the pictures: a parent looking for a
   photo of their kid should not land on a list of notes first. */
const parentTabs = [
 { id: 'home', label: 'Home', icon: House },
 { id: 'saved/photos', label: 'Photos', icon: Images },
 { id: 'activity', label: 'Activity', icon: Sparkles },
 { id: 'account', label: 'You', icon: UserRound },
]
/** Everything the nav bar does not reach. Each of these opens with a way back out. */
const PAGES = ['home', 'schedule', 'share', 'saved', 'account', 'chat', 'cue', 'activity']


/* The verge, a painted strip of grass and flowers pinned to the bottom of the screen,
   used to sit on top of every page at z-index 22. It made the app look like a
   gardening campaign and, worse, it covered the foot of every scrolling list for
   good: content behind it could never be read. The meadow canvas already grows
   grass and flowers, so this was a second decoration doing damage. Removed.
   --foot survives as the scroller's bottom clearance for the nav bar. */

export function HarborApp() {
 const [route, setRoute] = useState('home')
 const { state, update } = useHarbor()
 const [lift, setLift] = useState(0)
 const [dragging, setDragging] = useState(false)
 const [cue, setCue] = useState<Cue | null>(null)
 const [call, setCall] = useState<{ person: string; topic?: string } | null>(null)
 const [fresh, setFresh] = useState<string>()
 const [question, setQuestion] = useState(false)
 const [story, setStory] = useState<number | null>(null)
 const [camera, setCamera] = useState<{ promptDay?: string } | null>(null)
 const [moment, setMoment] = useState<Moment | null>(null)
 const [windowDue, setWindowDue] = useState(false)
 const [chipWeather, setChipWeather] = useState(false)
 const [sections, setSections] = useState(false)
 const meadowRef = useRef<MeadowHandle>(null)
 const [night, setNight] = useState(false)
 const chipTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
 const day = localDay()
 const needsWindow = !!state && activePacts(state).length > 0 && !state.snapWindows[day]

 useEffect(() => { if (needsWindow) update(s => ({ ...s, snapWindows: { ...s.snapWindows, [day]: rollSnapWindow() } })) }, [needsWindow, day])

 useEffect(() => {
  if (!state) return
  let skipped = false
  try { skipped = sessionStorage.getItem('harbor-window') === day } catch { /* storage can be blocked; the window simply asks again */ }
  const check = () => setWindowDue(!skipped && snapWindowDue(state))
  check()
  const timer = setInterval(check, 20000)
  return () => clearInterval(timer)
 }, [state, day])

 /* Where the card sits when you land on home. It used to rest at the floor, which
    gave the meadow the top half of the screen and pushed the first thing you could
    actually do below the fold. A third of the way up for a student; nearly to the top
    for a parent, where the field is a horizon rather than a subject. Everywhere else
    the card is the screen and opens raised. Pulling it down still shows the field. */
 const homeRest = state?.mode === 'parent' ? 0.74 : 0.34
 useEffect(() => {
  const sync = () => {
   const next = location.hash.slice(1) || 'home'
   setRoute(next)
   setLift(next.split('/')[0] === 'home' ? homeRest : 1)
  }
  sync(); window.addEventListener('hashchange', sync); return () => window.removeEventListener('hashchange', sync)
 }, [homeRest])

 /* The daily question used to open itself a second after launch, which meant the
    first thing anybody saw was a modal in front of a screen they had not read yet.
    It is a nice thing to be offered and a bad thing to be interrupted by, so it
    waits on the home screen now and opens when somebody asks for it. */

 useEffect(() => () => clearTimeout(chipTimer.current), [])

 /* Safari before 17 ignores touch-action for its own pinch and answers with these
    three events instead. They are bound to the meadow rather than the document, so a
    two-finger pinch on the field still moves the camera while a pinch anywhere else
    zooms the page the way the reader expects. */
 useEffect(() => {
  const field = document.querySelector('.meadow')
  if (!field) return
  const stop = (e: Event) => e.preventDefault()
  for (const name of ['gesturestart', 'gesturechange', 'gestureend']) field.addEventListener(name, stop)
  return () => { for (const name of ['gesturestart', 'gesturechange', 'gestureend']) field.removeEventListener(name, stop) }
 }, [state?.setupDone])

 /* One choice, three answers: follow the system, or override it either way. The
    meadow needs the resolved answer too, so it can put the sun down. */
 const theme = state?.settings.theme ?? 'system'
 useEffect(() => {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
  const dark = window.matchMedia('(prefers-color-scheme: dark)')
  const resolve = () => setNight(theme === 'dark' || (theme === 'system' && dark.matches))
  resolve()
  dark.addEventListener('change', resolve)
  return () => dark.removeEventListener('change', resolve)
 }, [theme])

 const navigate = (next: string) => { location.hash = next }
 const page = route.split('/')[0]
 const parentMode = state?.mode === 'parent'
 /* Activity opens on whichever of its three sections the link asked for. */
 const sub = route.split('/')[1]
 const activityTab = sub === 'play' || sub === 'starred' ? sub : undefined
 /* A parent has no weather of their own here. The sky over their field is the one
    their child set, which is what they opened the app to find out. */
 const weather = state ? fieldWeather(state) : 'clear'
 const Icon = weatherIcon[weather]
 const waiting = state ? unseenAlerts(state) : 0

 /* One tap for the thing people actually reach for. Auto is still in Account for
    anyone who wants the phone to decide; this just flips between the two looks. */
 const flipTheme = () => update(s => ({ ...s, settings: { ...s.settings, theme: night ? 'light' : 'dark' } }))

 /* Tapping the chip turns the weather over: the sky crossfades behind, the glyph
    rotates in front. The chip belongs to the student side; parent mode keeps the
    field as a horizon and says how everybody is in words, on their card. */
 const turnWeather = () => {
  const next = weathers[(weatherIndex(weather) + 1) % weathers.length].id
  update(s => ({ ...s, weather: next }))
  setChipWeather(true)
  clearTimeout(chipTimer.current)
  chipTimer.current = setTimeout(() => setChipWeather(false), 2600)
 }
 const showWeather = () => {
  setChipWeather(true)
  clearTimeout(chipTimer.current)
  chipTimer.current = setTimeout(() => setChipWeather(false), 2600)
 }

 const fireCue = (personId: string) => {
  const id = makeId()
  update(s => ({ ...s, cues: [...s.cues, { id, at: new Date().toISOString() }] }))
  setCue({ id, person: personId })
 }

 const total = state ? state.moments.filter(m => m.kind === 'called' && m.flower).length : 0
 const chipLabel = chipWeather ? weathers[weatherIndex(weather)].label : total ? 'Your garden is blooming' : 'Plant your first flower'

 /* Collapsed past rest the card leaves the grab handle sitting right where the
    fixed nav bar floats, unreachable underneath it. Once it is collapsed that far,
    the nav has nothing to navigate to anyway, so it steps aside until the card
    comes back up. */
 /* Nothing else is rendered until somebody says who they are: the answer decides the
    navigation, the home screen and the sample household, so there is no sensible
    version of the app to show behind it. */
 if (state && !state.setupDone) return <><Setup/><Toaster theme={night ? 'dark' : 'light'} position="top-center"/></>

 return <div className="stage" data-reduced-motion={state?.settings.reducedMotion} data-dragging={dragging} data-camera={!!camera}
  data-collapsed={lift < -0.5} data-mode={state?.mode ?? 'student'}
  style={{ ['--lift' as string]: lift }}>
  <Meadow ref={meadowRef} weather={weather} sheetLift={lift} freshBloomId={fresh} bare={!!camera} night={night} onOpenBloom={setMoment}/>

  {/* Zoom, made into buttons: a pinch is not something everyone reaches for first. */}
  <div className="meadow-zoom" data-away={lift > 0.72}>
   <button type="button" onClick={() => meadowRef.current?.zoomBy(1.5)} aria-label="Zoom into the meadow"><Plus aria-hidden="true"/></button>
   <button type="button" onClick={() => meadowRef.current?.zoomBy(1 / 1.5)} aria-label="Zoom out of the meadow"><Minus aria-hidden="true"/></button>
  </div>

  <header className="topbar">
   <a href="#home" className="brand" aria-label="Harbor, home">
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 29V14" stroke="#1F6B43" strokeWidth="3" strokeLinecap="round"/><path d="M15 15.5c-1.2-5-5-7.6-11-8 .4 6.6 3.8 10 11 8z" fill="#59A468"/><path d="M17 13c1-5.6 4.8-8.8 11.6-9.4C28.2 11 24.4 15 17 13z" fill="#79BC7F"/></svg>
    <span className="brand-word">harbor</span>
   </a>
   <div className="top-acts">
    <button type="button" className="disc" onClick={() => navigate('activity')}
     aria-label={waiting ? `Activity, ${waiting} new` : 'Activity'}>
     <Bell aria-hidden="true"/>{!!waiting && <i/>}
    </button>
    <button type="button" className="disc" data-tint="leaf" onClick={flipTheme}
     aria-label={night ? 'Switch to the day look' : 'Switch to the dusk look'}>
     <span className="weather-turn" aria-hidden="true">{night ? <Sun key="sun"/> : <Moon key="moon"/>}</span>
    </button>
   </div>
  </header>


  {/* Two taps living in one pill: the glyph turns the weather over, the label opens
      the garden's own map, since a pinch alone is not how everyone finds a person. */}
  <div className="meadow-chip" data-away={lift > 0.72}>
   <button type="button" className="meadow-chip-icon" onClick={turnWeather}
    aria-label={`Weather in your meadow: ${weathers[weatherIndex(weather)].label}. Turn it over.`}>
    <span className="weather-turn" aria-hidden="true"><Icon key={weather}/></span>
   </button>
   <button type="button" className="meadow-chip-label" onClick={() => setSections(true)} aria-label="Find people in your garden">
    <span className="chip-text" key={chipLabel}>{chipLabel}</span>
    <svg className="caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>
   </button>
  </div>
  {sections && <SectionsOverlay onClose={() => setSections(false)}
   onGo={id => meadowRef.current?.flyTo(id)} onOverview={() => meadowRef.current?.recenter()}/>}

  <Sheet lift={lift} onLift={setLift} onDragging={setDragging} label="Harbor" at={route}>
   {!state
    ? <div className="wrap flow" role="status" aria-live="polite" aria-busy="true">
     <span className="sr-only">Making a little room for you…</span>
     <div className="skeleton" style={{ height: 178 }} aria-hidden="true"/>
     <div className="skeleton" style={{ height: 22, width: '45%', borderRadius: 11 }} aria-hidden="true"/>
     <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }} aria-hidden="true">
      <div className="skeleton" style={{ height: 168 }}/><div className="skeleton" style={{ height: 168 }}/>
     </div>
    </div>
    : <>
     {page === 'home' && (parentMode
      ? <ParentHome navigate={navigate} onCall={person => setCall({ person })} onOpenStory={() => setStory(0)} onQuestion={() => setQuestion(true)}/>
      : <Home navigate={navigate} onCall={person => setCall({ person })}
       onOpenCamera={() => setCamera({})} onOpenStory={() => setStory(0)} onWeatherShown={showWeather} onExpand={() => setLift(1)} onQuestion={() => setQuestion(true)}/>)}
     {page === 'schedule' && <Schedule navigate={navigate}/>}
     {page === 'share' && <ShareLoad navigate={navigate}/>}
     {page === 'saved' && <NotesScreen key={route} navigate={navigate} initial={route.split('/')[1] === 'photos' ? 'instants' : 'notes'}
      onOpenCamera={() => setCamera({})} onOpenStory={() => setStory(0)}/>}
     {page === 'activity' && <AlertsScreen key={route} navigate={navigate} initial={activityTab}/>}
     {page === 'account' && <AccountScreen navigate={navigate}/>}
     {page === 'chat' && <Conversation key={route} person={route.split('/')[1] || state.people[0]?.id} navigate={navigate} onCall={person => setCall({ person })}/>}
     {page === 'cue' && <CueScreen navigate={navigate} onFire={fireCue}/>}
     {!PAGES.includes(page) && <div className="wrap flow">
      <p className="small">This path is still growing.</p>
      <button type="button" className="btn btn-soft" onClick={() => navigate('home')}>Back home</button>
     </div>}
    </>}
  </Sheet>

  <nav className="nav" aria-label="Main" data-wide={parentMode}>
   {parentMode
    ? parentTabs.map(({ id, label, icon: Icon }) => <a key={id} href={`#${id}`} className="nav-item"
      aria-current={page === id.split('/')[0] ? 'page' : undefined}>
     <Icon aria-hidden="true"/><b>{label}</b><i aria-hidden="true"/>
    </a>)
    : <>
     {studentTabs.left.map(({ id, label, icon: Icon }) => <a key={id} href={`#${id}`} className="nav-item" aria-current={page === id ? 'page' : undefined}>
      <Icon aria-hidden="true"/><b>{label}</b><i aria-hidden="true"/>
     </a>)}
     {/* A place to go, not a switch. It lights up when sharing is on, but tapping it
         opens the screen rather than turning anything on or off. */}
     <a href="#share" className="nav-share" data-on={!!state?.sharing} aria-current={page === 'share' ? 'page' : undefined}
      aria-label={`Share my load${state?.sharing ? ', sharing is on' : ''}`}>
      <span className="nav-share-disc"><Leaf aria-hidden="true"/></span>
      <b>Share load</b>
     </a>
     {studentTabs.right.map(({ id, label, icon: Icon }) => <a key={id} href={`#${id}`} className="nav-item" aria-current={page === id ? 'page' : undefined}>
      <Icon aria-hidden="true"/><b>{label}</b><i aria-hidden="true"/>
     </a>)}
    </>}
  </nav>

  {moment && <GlassCase moment={moment} onClose={() => setMoment(null)}/>}
  {story !== null && <StoryViewer start={story} onClose={() => setStory(null)}/>}
  {camera && <CameraScreen promptDay={camera.promptDay} onClose={() => setCamera(null)}/>}
  {cue && <CueOverlay cue={cue} onDismiss={() => setCue(null)} onCall={topic => { setCue(null); setCall({ person: cue.person, topic }) }}/>}
  {call && <CallFlow person={call.person} topic={call.topic} onCancel={() => setCall(null)}
   onDone={id => { setCall(null); setFresh(id); navigate('home'); setLift(0); setTimeout(() => setFresh(undefined), 6000) }}/>}
  {windowDue && !camera && !cue && !call && !question && story === null && <SnapPrompt
   onTake={() => { setWindowDue(false); setCamera({ promptDay: day }) }}
   onSkip={() => { setWindowDue(false); try { sessionStorage.setItem('harbor-window', day) } catch { /* nothing to remember if storage is blocked */ } }}/>}
  {/* The first run, once for each side of the phone. It waits for the home screen
      rather than opening over the setup flow, and it never returns on its own. */}
  {state?.setupDone && page === 'home' && !state.toursSeen.includes(state.mode) && !camera && !cue && !call && !question
   && <Tour mode={state.mode} onDone={() => update(s => ({ ...s, toursSeen: [...s.toursSeen, s.mode] }))}/>}
  <DailyQuestion open={question} onOpenChange={setQuestion}/>
  <Toaster theme={night ? 'dark' : 'light'} position="top-center"/>
 </div>
}
