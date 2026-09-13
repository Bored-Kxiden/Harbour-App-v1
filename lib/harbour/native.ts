'use client'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'

/** The handful of things a web page genuinely cannot do for itself.
 *
 *  Everything here is a no-op in a browser, so `npm run dev` behaves exactly
 *  as it always did and none of it has to be guarded at the call site.
 */
export const onDevice = () => Capacitor.isNativePlatform()

/** Android's back gesture, given the meaning it has in every other app.
 *
 *  Harbour has three layers to come back through, in order: whatever overlay is
 *  open, then the screen you are on, then the app itself. Every overlay in the
 *  app already closes on Escape, so the gesture is translated into the key they
 *  all answer rather than teaching each of them about Android.
 *
 *  The key is dispatched at the focused element rather than at the document,
 *  because an event fired on the document travels up to window but never down
 *  into the overlay. Focus is inside the overlay while it is open, so from
 *  there it passes through the overlay's own handler and the window handlers
 *  both.
 */
export function wireBackButton() {
  if (!onDevice()) return () => {}
  const handle = App.addListener('backButton', () => {
    if (document.querySelector('[role="dialog"][aria-modal="true"]')) {
      const at = document.activeElement instanceof Element ? document.activeElement : document.body
      at.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
      return
    }
    const page = (location.hash.slice(1) || 'home').split('/')[0]
    if (page !== 'home') { location.hash = 'home'; return }
    /* Home, with nothing open: leave the app where the user left it rather than
       closing it, which is what the system back button does elsewhere. */
    void App.minimizeApp()
  })
  return () => { void handle.then(h => h.remove()) }
}

/** The bar at the top of the screen carries the sky the meadow is painting, and
    its icons flip when that sky goes dark so they stay readable either way.
    Style.Light means dark icons for a light bar, which is why it reads backwards
    against `night`. */
export function followTheme(night: boolean, sky: string) {
  if (!onDevice()) return
  void StatusBar.setStyle({ style: night ? Style.Dark : Style.Light })
  void StatusBar.setBackgroundColor({ color: sky })
}

/** Held until the first screen has actually painted, rather than hidden on a
    timer that guesses how long that takes. */
export function done() {
  if (!onDevice()) return
  void SplashScreen.hide()
}

/** A small knock for the moments that deserve one: a seed going in, a call
    starting. Silent on a phone with haptics switched off, and on the web. */
export function tap(strength: 'light' | 'medium' = 'light') {
  if (!onDevice()) return
  void Haptics.impact({ style: strength === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light })
}

/** A longer knock, for a cue arriving. Only reached where the web view has no
    Vibration API of its own, since that one can hold a rhythm and this cannot. */
export function knock(ms: number) {
  if (!onDevice()) return
  void Haptics.vibrate({ duration: Math.min(2000, Math.max(1, Math.round(ms))) })
}

/** Hand the number to the phone's own dialer, with the call not yet placed.
 *
 *  Deliberately ACTION_DIAL and not ACTION_CALL: dialling for somebody needs no
 *  permission, and asking for the phone and call-log permission is the worst
 *  place to spend a new user's trust. The person still presses the green
 *  button themselves, which is also the only honest way to do this -- the app
 *  cannot know they actually got through, so it asks them afterwards.
 */
export function dial(phone: string | undefined) {
  if (!phone || !onDevice()) return false
  window.open(`tel:${phone.replace(/[^+\d]/g, '')}`, '_system')
  return true
}

/** Fires when the app comes back to the foreground. The call screen uses it to
    know the user is back from the dialer; the store uses it to catch up on
    anything that changed on the other person's phone while this one was away. */
export function onResume(fn: () => void) {
  if (!onDevice()) return () => {}
  const handle = App.addListener('resume', fn)
  return () => { void handle.then(h => h.remove()) }
}
