import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Floyd-Steinberg Video Dithering Tool',
  description: 'Apply true Floyd-Steinberg dithering to MP4 videos for After Effects',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      {/*
        antialiased: Tailwind utility for -webkit-font-smoothing: antialiased.
        This is redundant with the globals.css body rule, but harmless —
        both set the same CSS properties.

        bg-gray-50 is REMOVED: the dark dot-pattern background is now set
        entirely in globals.css body { background-color / background-image }.
        A single Tailwind class can't express both the color AND the gradient.
      */}
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
