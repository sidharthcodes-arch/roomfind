import { Inter } from 'next/font/google'
import './globals.css'
import BottomNav from '@/components/BottomNav'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'RoomFind',
  description: 'Find rooms near you',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-50 min-h-screen`}>
        <div className="max-w-lg mx-auto min-h-screen relative">
          {children}
        </div>
        <BottomNav />
      </body>
    </html>
  )
}
