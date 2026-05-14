import { DM_Sans } from 'next/font/google'
import './globals.css'
import BottomNav from '@/components/BottomNav'
import Providers from '@/components/Providers'

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans' })

export const metadata = {
  title: 'RoomFind',
  description: 'Find rooms near you',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} font-sans bg-[#ececea] min-h-screen`}>
        <Providers>
          <div className="max-w-lg mx-auto min-h-screen relative">
            {children}
          </div>
          <BottomNav />
        </Providers>
      </body>
    </html>
  )
}
