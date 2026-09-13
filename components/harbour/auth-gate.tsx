'use client'
import { useEffect, useState } from 'react'
import { ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/harbour/supabase'
import { done } from '@/lib/harbour/native'

/** Nothing in Harbour works without knowing whose phone this is, so this sits
 *  in front of the app and nothing else renders until it passes.
 *
 *  It is deliberately two fields and one button. The people this is built for
 *  include parents setting up a phone their child asked them to install, and
 *  every extra field is somewhere for that to go wrong.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)

  useEffect(() => {
    const db = supabase()
    db.auth.getSession().then(({ data }) => {
      setSignedIn(!!data.session)
      setReady(true)
    })
    const { data: sub } = db.auth.onAuthStateChange((_e, session) => setSignedIn(!!session))
    return () => sub.subscription.unsubscribe()
  }, [])

  /* The native splash is held open rather than hidden on a timer, so the first
     thing anybody sees is a finished screen and never a white flash. This is
     the earliest honest moment to drop it: we now know whether to ask who they
     are or to open their meadow, and either one is a real screen. */
  useEffect(() => { if (ready) done() }, [ready])

  if (!ready) return <Waiting/>
  if (!signedIn) return <SignIn/>
  return <>{children}</>
}

function Waiting() {
  return (
    <div className="setup">
      <div className="setup-inner" role="status" aria-live="polite">
        <Brand/>
        <p className="setup-sub" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Loader2 className="spin" aria-hidden="true" style={{ width: 16, height: 16 }}/>
          Opening your meadow…
        </p>
      </div>
    </div>
  )
}

function Brand() {
  return (
    <div className="setup-brand">
      <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" width="26" height="26">
        <path d="M16 29V14" stroke="#1F6B43" strokeWidth="3" strokeLinecap="round"/>
        <path d="M15 15.5c-1.2-5-5-7.6-11-8 .4 6.6 3.8 10 11 8z" fill="#59A468"/>
        <path d="M17 13c1-5.6 4.8-8.8 11.6-9.4C28.2 11 24.4 15 17 13z" fill="#79BC7F"/>
      </svg>
      <span>harbour</span>
    </div>
  )
}

/** Supabase's wording is accurate and unhelpful in equal measure.
 *
 *  "Invalid login credentials" is one message for two very different
 *  situations -- an email with no account behind it, and a password with a
 *  typo in it -- and it reads, on a phone, as though the app has decided you
 *  are not who you say you are. The account is usually fine; the password was
 *  typed blind. Say the useful half of that, and point at the eye.
 */
function explain(e: unknown) {
  const said = e instanceof Error ? e.message : ''
  if (/invalid login credentials/i.test(said))
    return 'That email and password do not go together. Tap the eye to check what you typed.'
  if (/email not confirmed/i.test(said))
    return 'This account still needs the link in the email we sent you.'
  if (/already registered|already been registered/i.test(said))
    return 'There is already an account with that email. Sign in instead.'
  if (/failed to fetch|network/i.test(said))
    return 'Harbour could not reach the internet just now. Try again in a moment.'
  if (/token has expired|otp_expired|expired/i.test(said))
    return 'That code has run out. Send yourself a new one.'
  if (/invalid.*(token|otp)|otp_disabled/i.test(said))
    return 'That code is not right. Check the email again -- it is the six digits, not the link.'
  if (/same.*password|should be different/i.test(said))
    return 'That is the password you already had. Choose a different one.'
  if (/rate limit|too many|for security purposes/i.test(said))
    return 'That was a lot of tries at once. Wait a minute, then go again.'
  return said || 'That did not work. Try again.'
}

/** A password field with a way to see what is in it, which is the difference
    between getting back into your account and giving up on a phone keyboard. */
function Secret({ id, label, value, onChange, onEnter, autoComplete }: {
  id: string; label: string; value: string; onChange: (v: string) => void
  onEnter?: () => void; autoComplete: string
}) {
  const [shown, setShown] = useState(false)
  return (
    <>
      <label className="label" htmlFor={id}>{label}</label>
      <div className="reveal">
        <input className="input" id={id} type={shown ? 'text' : 'password'}
          autoComplete={autoComplete} autoCapitalize="none" autoCorrect="off"
          spellCheck={false} value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onEnter?.() }}/>
        <button type="button" className="reveal-eye" onClick={() => setShown(!shown)}
          aria-pressed={shown} aria-controls={id}
          aria-label={shown ? 'Hide the password' : 'Show the password'}>
          {shown ? <EyeOff aria-hidden="true"/> : <Eye aria-hidden="true"/>}
        </button>
      </div>
    </>
  )
}

/** Getting back in, when the password is gone.
 *
 *  Deliberately a six-digit code rather than a link. A link has to land on a
 *  page, that page has to be somewhere Supabase has been told to allow, and --
 *  the part that actually decides it -- it opens on whichever device read the
 *  email. People read email on their phone and might be holding a different
 *  one, or a laptop, or an emulator. A code crosses that gap; a link cannot.
 *
 *  It needs one thing from the project: the Reset Password email template has
 *  to include {{ .Token }}. Supabase's default template only offers the link.
 */
function Forgot({ email: initial, onDone, onCancel }: { email: string; onDone: () => void; onCancel: () => void }) {
  const [stage, setStage] = useState<'ask' | 'code'>('ask')
  const [email, setEmail] = useState(initial)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [sentAt, setSentAt] = useState(0)

  const send = async () => {
    setError(undefined)
    if (!email.trim()) { setError('Which email is the account under?'); return }
    setBusy(true)
    try {
      /* No redirectTo: nothing here is ever going to follow a link, and
         pointing one at a page that does not exist is how somebody ends up
         staring at a browser error thinking they broke something. */
      const { error: failed } = await supabase().auth.resetPasswordForEmail(email.trim())
      if (failed) throw failed
      /* Whether or not that address has an account behind it, the answer is
         the same. Saying "no such account" here would turn this screen into a
         way of finding out who has one. */
      setStage('code'); setSentAt(Date.now())
    } catch (e) { setError(explain(e)) } finally { setBusy(false) }
  }

  const finish = async () => {
    setError(undefined)
    const digits = code.replace(/\D/g, '')
    if (digits.length !== 6) { setError('The code is the six digits in the email.'); return }
    if (password.length < 6) { setError('A new password of at least six characters.'); return }
    setBusy(true)
    try {
      const db = supabase()
      /* The code proves it is you and hands back a session; the session is what
         lets the password be changed. Two steps, and the first can fail on its
         own, so they are reported separately. */
      const { error: wrong } = await db.auth.verifyOtp({ email: email.trim(), token: digits, type: 'recovery' })
      if (wrong) throw wrong
      const { error: refused } = await db.auth.updateUser({ password })
      if (refused) throw refused
      onDone()
    } catch (e) { setError(explain(e)) } finally { setBusy(false) }
  }

  const again = Date.now() - sentAt > 30000

  return (
    <div className="setup">
      <div className="setup-inner">
        <Brand/>
        <div className="setup-step">
          <h1>{stage === 'ask' ? 'Let us get you back in.' : 'Check your email.'}</h1>
          <p className="setup-sub">
            {stage === 'ask'
              ? 'We will email you a six-digit code. Nothing in your meadow changes until you use it.'
              : <>We sent six digits to <b>{email.trim()}</b>. Type them here with the new password you want.</>}
          </p>

          {stage === 'ask' ? (
            <>
              <label className="label" htmlFor="forgot-email">Email</label>
              <input className="input" id="forgot-email" type="email" inputMode="email"
                autoComplete="email" spellCheck={false} autoFocus value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void send() }}/>
            </>
          ) : (
            <>
              <label className="label" htmlFor="forgot-code">The six digits</label>
              {/* No maxLength. The browser applies one to the raw string before
                  this ever sees it, so a code pasted with anything around it --
                  a space, a word, the line it sat on in the email -- gets cut
                  to length first and the digits thrown away with the rest.
                  Keeping the digits and taking six is the whole rule. */}
              <input className="input code-in" id="forgot-code" inputMode="numeric"
                autoComplete="one-time-code" autoFocus placeholder="000000"
                value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}/>
              <Secret id="forgot-password" label="Your new password" value={password}
                onChange={setPassword} onEnter={() => void finish()} autoComplete="new-password"/>
            </>
          )}

          {error && <p className="field-error" role="alert">{error}</p>}

          <button type="button" className="btn btn-block setup-go" disabled={busy}
            onClick={() => void (stage === 'ask' ? send() : finish())}>
            {busy ? <Loader2 className="spin" aria-hidden="true"/> : null}
            {stage === 'ask' ? 'Send me a code' : 'Set it and sign in'}
            {!busy && <ArrowRight aria-hidden="true"/>}
          </button>

          {stage === 'code' && (
            <button type="button" className="btn btn-quiet btn-block" disabled={busy || !again}
              onClick={() => void send()}>
              {again ? 'Send another code' : 'You can ask for another in a moment'}
            </button>
          )}
          <button type="button" className="btn btn-quiet btn-block" onClick={onCancel}>
            Back to signing in
          </button>

          {stage === 'code' && (
            <p className="note-strip">
              The email also has a link in it. Ignore the link -- it is meant for a web
              browser and will not bring you back here. The six digits are what works.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function SignIn() {
  const [joining, setJoining] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [checkEmail, setCheckEmail] = useState(false)
  const [forgot, setForgot] = useState(false)

  const go = async () => {
    setError(undefined)
    if (!email.trim() || password.length < 6) {
      setError('An email, and a password of at least six characters.')
      return
    }
    setBusy(true)
    try {
      const db = supabase()
      if (joining) {
        const { data, error: failed } = await db.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: name.trim() } },
        })
        if (failed) throw failed
        /* With email confirmation switched on, signing up succeeds but hands
           back no session, and the app would otherwise sit here looking broken.
           Say what happened instead. */
        if (!data.session) { setCheckEmail(true); return }
      } else {
        const { error: failed } = await db.auth.signInWithPassword({ email: email.trim(), password })
        if (failed) throw failed
      }
    } catch (e) {
      setError(explain(e))
    } finally {
      setBusy(false)
    }
  }

  if (forgot) return <Forgot email={email} onCancel={() => setForgot(false)}
    onDone={() => { setForgot(false); setPassword('') }}/>

  if (checkEmail) {
    return (
      <div className="setup">
        <div className="setup-inner">
          <Brand/>
          <div className="setup-step">
            <h1>Check your email.</h1>
            <p className="setup-sub">
              Your account is made. Open the link we sent to {email.trim()}, then come
              back here and sign in.
            </p>
            {/* The link confirms the account on Supabase's own server and only
                then tries to send the browser somewhere. Where it sends it is
                whatever Site URL the project has, which for a project nobody
                has deployed is http://localhost:3000 -- a page that does not
                exist on a phone. So the browser shows a failure at the exact
                moment the thing succeeded, which is a horrible thing to do to
                somebody signing up. Say so before it happens. */}
            <p className="note-strip">
              The browser may then say it cannot open the page. That is expected and it
              does not mean anything went wrong: your account was confirmed before it
              got that far. Just come back here.
            </p>
            <button type="button" className="btn btn-block setup-go"
              onClick={() => { setCheckEmail(false); setJoining(false) }}>
              Back to signing in <ArrowRight aria-hidden="true"/>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="setup">
      <div className="setup-inner">
        <Brand/>
        <div className="setup-step">
          <h1>{joining ? 'Make your Harbour.' : 'Welcome back.'}</h1>
          <p className="setup-sub">
            {joining
              ? 'One account per person. You will link to your people in a moment.'
              : 'Sign in and your meadow comes back exactly as you left it.'}
          </p>

          {joining && (
            <>
              <label className="label" htmlFor="auth-name">Your name</label>
              <input className="input" id="auth-name" autoComplete="given-name" spellCheck={false}
                placeholder="What they call you" value={name}
                onChange={e => setName(e.target.value)}/>
            </>
          )}

          <label className="label" htmlFor="auth-email">Email</label>
          <input className="input" id="auth-email" type="email" inputMode="email"
            autoComplete="email" spellCheck={false} value={email}
            onChange={e => setEmail(e.target.value)}/>

          <Secret id="auth-password" label="Password" value={password} onChange={setPassword}
            onEnter={() => void go()} autoComplete={joining ? 'new-password' : 'current-password'}/>

          {error && <p className="field-error" role="alert">{error}</p>}

          <button type="button" className="btn btn-block setup-go" onClick={() => void go()} disabled={busy}>
            {busy ? <Loader2 className="spin" aria-hidden="true"/> : null}
            {joining ? 'Create my account' : 'Sign in'}
            {!busy && <ArrowRight aria-hidden="true"/>}
          </button>
          <button type="button" className="btn btn-quiet btn-block"
            onClick={() => { setJoining(!joining); setError(undefined) }}>
            {joining ? 'I already have an account' : 'I am new here'}
          </button>
          {/* Only on the signing-in side: offering to recover a password to
              somebody in the middle of choosing one is just noise. */}
          {!joining && (
            <button type="button" className="btn btn-quiet btn-block"
              onClick={() => { setForgot(true); setError(undefined) }}>
              I have forgotten my password
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
