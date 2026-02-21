import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MatesBet',
  description: 'Bet on anything with your mates. Real parimutuel odds from the pool.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
