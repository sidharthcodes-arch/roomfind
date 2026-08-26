import { DM_Sans } from 'next/font/google'
import './globals.css'
import BottomNav from '@/components/BottomNav'

const dmSans = DM_Sans({ 
  subsets: ['latin'], 
  variable: '--font-dm-sans',
  display: 'swap',
})

export const metadata = {
  title: 'RoomFind - Find verified rooms & PGs near you',
  description: 'Find verified rooms and PGs near you with real-time stats',
  icons: {
    icon: '/logo-icon.png',
    shortcut: '/logo-icon.png',
    apple: '/logo-icon.png',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} font-sans bg-[#ececea] min-h-screen text-slate-900 antialiased`}>
        {children}
        <BottomNav />
      </body>
    </html>
  )
}
