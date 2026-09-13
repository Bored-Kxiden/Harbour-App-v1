import type { Metadata, Viewport } from 'next'
import { Nunito, Quicksand } from 'next/font/google'
import './globals.css'

const body = Nunito({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-body', display: 'swap' })
const round = Quicksand({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-round', display: 'swap' })

export const metadata: Metadata = {
  title: 'Harbor · A little closer, every day',
  description: 'A gentle place for family connection. Share little moments, find time together, and watch your meadow grow. Interactive mobile demo.',
  appleWebApp: { capable: true, title: 'Harbor', statusBarStyle: 'black-translucent' },
  // Lets Android's own "Add to Home Screen" open Harbor with no browser bars at
  // all, the same chrome-free view iOS reaches through its own Home Screen icon.
  manifest: '/manifest.webmanifest',
}
export const viewport: Viewport = {
  /* The page itself does not zoom. A pinch here is almost always aimed at the meadow,
     and letting the browser take it instead scaled the whole app away from under the
     gesture. The field answers the pinch on its own, and the sheet's own zoom buttons
     cover anyone who would rather press than pinch. */
  width: 'device-width', initialScale: 1, maximumScale: 1, userScalable: false, viewportFit: 'cover',
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#9ECDE8' },
    { media: '(prefers-color-scheme: dark)', color: '#10150F' },
  ],
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={`${body.variable} ${round.variable}`}><body className="font-sans">{children}</body></html>
}
