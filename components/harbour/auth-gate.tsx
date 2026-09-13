'use client'
import { useEffect, useState } from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'
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

function SignIn() {
  const [joining, setJoining] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [checkEmail, setCheckEmail] = useState(false)

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
      /* Supabase's own wording is short and plain enough to show as it is. */
      setError(e instanceof Error ? e.message : 'That did not work. Try again.')
    } finally {
      setBusy(false)
    }
  }

  if (checkEmail) {
    return (
      <div className="setup">
        <div className="setup-inner">
          <Brand/>
          <div className="setup-step">
            <h1>Check your email.</h1>
            <p className="setup-sub">
              Your account is made. Open the link we sent to {email.trim()}, then come
              back and sign in.
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

          <label className="label" htmlFor="auth-password">Password</label>
          <input className="input" id="auth-password" type="password"
            autoComplete={joining ? 'new-password' : 'current-password'} value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void go() }}/>

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
        </div>
      </div>
    </div>
  )
}
