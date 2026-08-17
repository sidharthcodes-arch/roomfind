'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Search, Bookmark, User } from 'lucide-react'

const tabs = [
  { href: '/',        icon: Home,     label: 'Home'    },
  { href: '/search',  icon: Search,   label: 'Search'  },
  { href: '/saved',   icon: Bookmark, label: 'Saved'   },
  { href: '/profile', icon: User,     label: 'Profile' },
]

export default function BottomNav() {
  const pathname = usePathname()

  if (pathname === '/auth' || pathname.startsWith('/listings/') || pathname.startsWith('/edit-listing/')) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-black/[0.09]">
      <div className="max-w-lg mx-auto flex">
        {tabs.map(({ href, icon: Icon, label }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center gap-0.5 py-3 transition-colors ${
                isActive ? 'text-brand' : 'text-slate-400'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.5]'}`} />
              <span className={`text-[11px] ${isActive ? 'font-semibold' : 'font-normal'}`}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
