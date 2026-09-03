import type { Metadata } from 'next'
import { IBM_Plex_Sans_Thai, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const sans = IBM_Plex_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-thai',
  display: 'swap',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono-code',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ระบบจัดการบอท',
  description: 'ตั้งค่า ticket ข้อความต้อนรับ และประกาศของบอท Discord',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
