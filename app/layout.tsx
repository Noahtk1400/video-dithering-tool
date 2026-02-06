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
      <body className="antialiased bg-gray-50">
        {children}
      </body>
    </html>
  )
}
