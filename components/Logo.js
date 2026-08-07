'use client'

export function RoomFindLogo({ className = "w-9 h-9", showText = false, textClassName = "text-slate-900 font-bold text-[18px] tracking-tight" }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`relative flex items-center justify-center bg-[#0F5B46] rounded-xl text-white shadow-md shadow-[#0F5B46]/20 select-none shrink-0 overflow-hidden ${className}`}>
        <svg className="w-full h-full p-1.5" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* House roof arch */}
          <path d="M14 44 L50 18 L86 44" stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
          {/* Chimney */}
          <path d="M68 28 V20 H75 V33" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          {/* Dominant capital R */}
          <text x="22" y="82" fill="currentColor" fontSize="48" fontWeight="900" fontFamily="system-ui, -apple-system, sans-serif">R</text>
          {/* Smaller lowercase f */}
          <text x="56" y="82" fill="currentColor" fontSize="32" fontWeight="600" fontFamily="system-ui, -apple-system, sans-serif">f</text>
        </svg>
      </div>
      {showText && <span className={textClassName}>RoomFind</span>}
    </div>
  )
}
