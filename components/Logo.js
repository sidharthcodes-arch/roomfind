'use client'

export function RoomFindLogo({
  className = "h-8 w-auto",
  showText = false,
  textClassName = "text-[22px] font-extrabold tracking-tight leading-none",
}) {
  return (
    <div className="flex items-center gap-2 select-none inline-flex">
      {/* Transparent Logo Icon */}
      <img
        src="/logo-icon.png"
        alt="RoomFind Logo"
        className={`object-contain shrink-0 ${className}`}
      />

      {/* Typography: Room (Black) + Find (Green) */}
      {showText && (
        <span className={textClassName}>
          <span className="text-slate-900">Room</span>
          <span className="text-brand">Find</span>
        </span>
      )}
    </div>
  )
}

export default RoomFindLogo
