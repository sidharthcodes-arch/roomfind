'use client'

import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, X, Heart, Share2, MessageCircle, Phone } from 'lucide-react'

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

export default function ImageLightboxModal({
  isOpen,
  photos = [],
  initialIndex = 0,
  listing = null,
  onClose,
  onLikeToggle,
  onShare
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [touchStart, setTouchStart] = useState(null)
  const [touchEnd, setTouchEnd] = useState(null)

  // Sync index when opened with a specific initial photo
  useEffect(() => {
    setCurrentIndex(initialIndex)
  }, [initialIndex, isOpen])

  const nextPhoto = useCallback(() => {
    if (photos.length <= 1) return
    setCurrentIndex((i) => (i + 1) % photos.length)
  }, [photos.length])

  const prevPhoto = useCallback(() => {
    if (photos.length <= 1) return
    setCurrentIndex((i) => (i - 1 + photos.length) % photos.length)
  }, [photos.length])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
      if (e.key === 'ArrowRight') nextPhoto()
      if (e.key === 'ArrowLeft') prevPhoto()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, nextPhoto, prevPhoto, onClose])

  // Disable background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Swipe gesture handling for mobile screens
  const handleTouchStart = (e) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    const minSwipeDistance = 40
    if (distance > minSwipeDistance) {
      nextPhoto()
    } else if (distance < -minSwipeDistance) {
      prevPhoto()
    }
  }

  if (!isOpen || !photos || photos.length === 0) return null

  const ownerName = listing?.users?.full_name ?? 'Owner'
  const ownerInitials = initials(ownerName)
  const whatsappHref = listing?.users?.phone_number
    ? `https://wa.me/${listing.users.phone_number.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi, I saw your listing "${listing.title}" on RoomFind.`)}`
    : null

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between select-none animate-fade-in">
      
      {/* ── Top Bar (Twitter / X style header) ── */}
      <div className="z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent text-white">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors shrink-0"
            aria-label="Close"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          
          {listing && (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-full bg-brand-light flex items-center justify-center shrink-0 overflow-hidden border border-white/20">
                {listing.users?.profile_photo ? (
                  <img src={listing.users.profile_photo} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-brand font-bold text-xs">{ownerInitials}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate leading-tight">{ownerName}</p>
                <p className="text-xs text-white/70 truncate">{listing.title || 'RoomFind Listing'}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {photos.length > 1 && (
            <span className="text-xs font-mono font-medium px-2.5 py-1 rounded-full bg-white/10 text-white/90">
              {currentIndex + 1} / {photos.length}
            </span>
          )}
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors shrink-0 hidden sm:flex"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* ── Main Viewport (Full 100% Uncut Image View) ── */}
      <div
        className="relative flex-1 flex items-center justify-center w-full h-full overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <img
          key={currentIndex}
          src={photos[currentIndex]}
          alt={`Photo ${currentIndex + 1}`}
          className="max-w-full max-h-full w-auto h-auto object-contain transition-opacity duration-200"
        />

        {/* Desktop Navigation Chevrons */}
        {photos.length > 1 && (
          <>
            <button
              onClick={prevPhoto}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-all border border-white/15 shadow-lg hidden sm:flex"
              aria-label="Previous photo"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <button
              onClick={nextPhoto}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-all border border-white/15 shadow-lg hidden sm:flex"
              aria-label="Next photo"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}

        {/* Bottom Pagination Dots (Twitter/X style • • • •) */}
        {photos.length > 1 && (
          <div className="absolute bottom-4 left-0 right-0 z-20 flex justify-center gap-1.5 pointer-events-none">
            {photos.map((_, i) => (
              <span
                key={i}
                className={`rounded-full transition-all duration-300 ${
                  i === currentIndex
                    ? 'bg-white w-4 h-1.5 opacity-100 shadow-sm'
                    : 'bg-white/40 w-1.5 h-1.5 opacity-60'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Bottom Action Bar (Twitter / X style footer) ── */}
      <div className="z-20 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 pt-3 pb-6 text-white border-t border-white/10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onLikeToggle && (
              <button
                onClick={onLikeToggle}
                className="flex items-center gap-1.5 text-white/80 hover:text-coral transition-colors"
              >
                <Heart className={`w-6 h-6 ${listing?._liked ? 'fill-coral text-coral' : ''}`} />
                <span className="text-sm font-medium">{listing?._likeCount ?? 0}</span>
              </button>
            )}

            {listing && (
              <div className="flex items-center gap-1.5 text-white/80">
                <MessageCircle className="w-6 h-6" />
                <span className="text-sm font-medium">{listing?._commentCount ?? 0}</span>
              </div>
            )}

            {onShare && (
              <button
                onClick={onShare}
                className="flex items-center gap-1.5 text-white/80 hover:text-white transition-colors"
              >
                <Share2 className="w-6 h-6" />
              </button>
            )}
          </div>

          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-brand text-white font-semibold text-xs active:scale-95 transition-transform"
            >
              <Phone className="w-3.5 h-3.5" />
              Contact
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
