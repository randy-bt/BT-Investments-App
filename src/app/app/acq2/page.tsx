import type { Metadata, Viewport } from 'next'
import { Acq2Client } from './client'

// Acquisitions 2 (Randy 7/25): the read-only mobile companion. Preloads
// every dashboard-flagged lead so browsing is instant, then gets out of
// the way. Launched from a home-screen bookmark, it opens fullscreen
// like a native app (appleWebApp metadata below).

export const metadata: Metadata = {
  title: 'Acquisitions 2',
  appleWebApp: {
    capable: true,
    title: 'ACQ 2',
    statusBarStyle: 'black-translucent',
  },
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f2f2f7' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
}

export default function Acq2Page() {
  return <Acq2Client />
}
