import type { Metadata } from 'next'
import { Instrument_Serif, Inter, Silkscreen } from 'next/font/google'
import { ConvexClientProvider } from '@/components/convex-provider'
import './globals.css'

const instrumentSerif = Instrument_Serif({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-instrument-serif',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const silkscreen = Silkscreen({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-silkscreen',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Sapling OS',
  description: 'Personal knowledge system with AI-powered task execution',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className={`${instrumentSerif.variable} ${inter.variable} ${silkscreen.variable} font-sans antialiased`}
      >
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  )
}
