import type { CapacitorConfig } from '@capacitor/cli'

/** What the native shell does with the web build.
 *
 *  `webDir` is the folder `next build` produced. Capacitor copies it into the
 *  APK and serves it over a local origin inside the app, which is why nobody
 *  ever sees a browser: there is no browser, only a full-screen window with
 *  the app's own files in it.
 */
const config: CapacitorConfig = {
  appId: 'app.harbour',
  appName: 'Harbour',
  webDir: 'out',
  android: {
    /* The paper the app is printed on. Painted behind the web layer so the
       system bars and the overscroll never flash white. */
    backgroundColor: '#FEFCF5',
  },
  plugins: {
    SplashScreen: {
      /* The app hides this itself once the first screen has actually painted,
         rather than on a timer that guesses. */
      launchAutoHide: false,
      backgroundColor: '#FEFCF5',
      showSpinner: false,
    },
    Keyboard: {
      /* Shrink the web view rather than sliding it up. The app is one fixed
         full-height stage with a card pinned to the bottom of it, so sliding
         would push the card off the top of the screen; resizing lets the dvh
         units the layout is built on answer for the keyboard themselves. */
      resize: 'native',
      resizeOnFullScreen: true,
    },
    StatusBar: {
      /* The meadow runs under the status bar; the app tints the bar to match
         and flips the icons when it goes to dusk. */
      overlaysWebView: false,
      style: 'LIGHT',
      backgroundColor: '#9ECDE8',
    },
  },
}

export default config
