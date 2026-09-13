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
  },
}

export default config
