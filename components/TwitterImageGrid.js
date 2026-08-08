'use client'

import { useState, useEffect } from 'react'
import { MapPin } from 'lucide-react'

export default function TwitterImageGrid({ photos = [], onImageClick }) {
  const [aspectMode, setAspectMode] = useState('landscape') // 'vertical' | 'square' | 'landscape'

  // Automatically detect primary photo aspect ratio
  useEffect(() => {
    if (!photos || photos.length === 0) return
    const primarySrc = photos[0]
    const img = new Image()
    img.src = primarySrc
    img.onload = () => {
      const { naturalWidth: w, naturalHeight: h } = img
      if (h > w * 1.1) {
        setAspectMode('vertical') // Portrait / Tall photo
      } else if (Math.abs(w - h) < 60) {
        setAspectMode('square')
      } else {
        setAspectMode('landscape')
      }
    }
  }, [photos])

  if (!photos || photos.length === 0) {
    return (
      <div className="w-full aspect-[16/9] bg-slate-100 rounded-2xl flex items-center justify-center">
        <MapPin className="w-10 h-10 text-slate-300" />
      </div>
    )
  }

  const count = photos.length

  const handleClick = (e, index) => {
    e.preventDefault()
    e.stopPropagation()
    onImageClick?.(index)
  }

  // Dynamic aspect ratio container class
  let aspectClass = 'aspect-[16/9]'
  if (count === 1) {
    if (aspectMode === 'vertical') aspectClass = 'aspect-[4/5] max-h-[520px]'
    else if (aspectMode === 'square') aspectClass = 'aspect-[1/1] max-h-[460px]'
    else aspectClass = 'aspect-[16/9] max-h-[400px]'
  } else {
    if (aspectMode === 'vertical') aspectClass = 'aspect-[4/5] max-h-[500px]'
    else if (aspectMode === 'square') aspectClass = 'aspect-[1/1] max-h-[460px]'
    else aspectClass = 'aspect-[16/9] max-h-[400px]'
  }

  // ─── 1 Photo ─────────────────────────────────────────────────────────────
  if (count === 1) {
    return (
      <div
        onClick={(e) => handleClick(e, 0)}
        className={`relative w-full ${aspectClass} bg-slate-900 rounded-2xl overflow-hidden cursor-pointer group transition-all duration-300`}
      >
        <img
          src={photos[0]}
          alt="Listing photo 1"
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          onError={(e) => { e.target.style.display = 'none' }}
        />
      </div>
    )
  }

  // ─── 2 Photos (50/50 Split) ────────────────────────────────────────────────
  if (count === 2) {
    return (
      <div className={`grid grid-cols-2 gap-0.5 w-full ${aspectClass} rounded-2xl overflow-hidden bg-slate-900 transition-all duration-300`}>
        {photos.slice(0, 2).map((src, i) => (
          <div
            key={i}
            onClick={(e) => handleClick(e, i)}
            className="relative w-full h-full overflow-hidden cursor-pointer group"
          >
            <img
              src={src}
              alt={`Listing photo ${i + 1}`}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          </div>
        ))}
      </div>
    )
  }

  // ─── 3 Photos (1 Large Left, 2 Stacked Right) ──────────────────────────────
  if (count === 3) {
    return (
      <div className={`grid grid-cols-2 gap-0.5 w-full ${aspectClass} rounded-2xl overflow-hidden bg-slate-900 transition-all duration-300`}>
        {/* Left main photo */}
        <div
          onClick={(e) => handleClick(e, 0)}
          className="relative w-full h-full overflow-hidden cursor-pointer group"
        >
          <img
            src={photos[0]}
            alt="Listing photo 1"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </div>

        {/* Right stacked photos */}
        <div className="grid grid-rows-2 gap-0.5 w-full h-full">
          {photos.slice(1, 3).map((src, i) => (
            <div
              key={i + 1}
              onClick={(e) => handleClick(e, i + 1)}
              className="relative w-full h-full overflow-hidden cursor-pointer group"
            >
              <img
                src={src}
                alt={`Listing photo ${i + 2}`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ─── 4+ Photos (2x2 Grid with optional +N overlay) ─────────────────────────
  const remaining = count - 4

  return (
    <div className={`grid grid-cols-2 grid-rows-2 gap-0.5 w-full ${aspectClass} rounded-2xl overflow-hidden bg-slate-900 transition-all duration-300`}>
      {photos.slice(0, 4).map((src, i) => (
        <div
          key={i}
          onClick={(e) => handleClick(e, i)}
          className="relative w-full h-full overflow-hidden cursor-pointer group"
        >
          <img
            src={src}
            alt={`Listing photo ${i + 1}`}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
          {/* Overlay on 4th image if there are more than 4 photos */}
          {i === 3 && remaining > 0 && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[2px] transition-opacity group-hover:bg-black/70">
              <span className="text-white font-bold text-lg sm:text-xl">+{remaining}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
