'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeft, MapPin, Phone, User, Home, Users, CheckCircle, ShieldCheck,
  ChevronLeft, ChevronRight, Heart, MessageCircle, Share, Bookmark, Pencil,
  Navigation, Copy, Send, ExternalLink, Map
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import ShareModal from '@/components/ShareModal'
import ImageLightboxModal from '@/components/ImageLightboxModal'

const genderLabel = {
  any: 'Any Gender',
  male: 'Male Only',
  female: 'Female Only',
}

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

function timeAgo(dateStr) {
  if (!dateStr) return 'recently'
  const diff = (Date.now() - new Date(dateStr)) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const d = R * c
  return d.toFixed(1)
}

function Toast({ message, type = 'success', onDismiss }) {
  if (!message) return null
  const bg = type === 'error' ? 'bg-red-500' : 'bg-[#00a884]'
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 ${bg} text-white text-[13px] font-medium px-4 py-3 rounded-xl shadow-lg max-w-sm w-full mx-4 flex items-center justify-between gap-3 animate-fade-in`}>
      <span>{message}</span>
      <button onClick={onDismiss} className="text-white/80 hover:text-white shrink-0">✕</button>
    </div>
  )
}

function SkeletonDetail() {
  return (
    <div className="min-h-screen bg-[#ececea] pb-24 animate-pulse max-w-md mx-auto">
      <div className="bg-white border-b border-black/[0.09] px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-slate-200" />
        <div className="h-5 w-40 bg-slate-200 rounded" />
      </div>
      <div className="p-3">
        <div className="bg-white rounded-2xl border border-black/[0.09] overflow-hidden">
          <div className="w-full aspect-[4/3] bg-slate-200" />
          <div className="p-4 space-y-3">
            <div className="h-6 w-3/4 bg-slate-200 rounded" />
            <div className="h-8 w-1/3 bg-slate-200 rounded" />
            <div className="h-4 w-2/3 bg-slate-200 rounded" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ListingDetailPage({ params }) {
  const { id } = params
  const { user } = useAuth()
  const [listing, setListing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentPhoto, setCurrentPhoto] = useState(0)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [saved, setSaved] = useState(false)
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const [userDistance, setUserDistance] = useState(null)
  const [copyText, setCopyText] = useState('Copy')

  // Comments state (Always open community discussion)
  const [showComments, setShowComments] = useState(true)
  const [newCommentText, setNewCommentText] = useState('')
  const [comments, setComments] = useState([
    { id: 1, name: 'Priya M.', text: 'Is this room still available for next month?', time: '1h ago' },
    { id: 2, name: 'Rahul S.', text: 'How far is it walking distance from the main market?', time: '30m ago' },
  ])

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleShare = (e) => {
    if (e) e.preventDefault()
    setIsShareOpen(true)
  }

  useEffect(() => {
    if (!id) return
    const fetchListing = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('listings')
          .select('*, users(full_name, phone_number, profile_photo)')
          .eq('id', id)
          .single()
        if (error) throw error
        setListing(data)

        // Calculate distance if cached user GPS exists
        try {
          const cachedGps = localStorage.getItem('roomfind_user_gps')
          if (cachedGps && data.latitude != null && data.longitude != null) {
            const { lat, lng } = JSON.parse(cachedGps)
            const dist = calculateDistanceKm(lat, lng, data.latitude, data.longitude)
            if (dist) setUserDistance(dist)
          }
        } catch (_) {}

        // Fetch like count + user like
        const [{ data: likesData }, { data: userLike }] = await Promise.all([
          supabase.from('listing_likes').select('id').eq('listing_id', id),
          user
            ? supabase.from('listing_likes').select('id').eq('listing_id', id).eq('user_id', user.id).maybeSingle()
            : Promise.resolve({ data: null }),
        ])
        setLikeCount(likesData?.length ?? 0)
        setLiked(!!userLike)
      } catch (err) {
        setError(err?.message ?? 'Failed to load listing')
      } finally {
        setLoading(false)
      }
    }
    fetchListing()
  }, [id, user])

  const handleLike = async () => {
    if (!user) {
      showToast('Please log in to like listings', 'error')
      return
    }
    const next = !liked
    setLiked(next)
    setLikeCount((c) => c + (next ? 1 : -1))
    if (next) {
      await supabase.from('listing_likes').insert({ listing_id: id, user_id: user.id })
      showToast('Added to liked listings')
    } else {
      await supabase.from('listing_likes').delete().eq('listing_id', id).eq('user_id', user.id)
    }
  }

  const handleAddComment = (e) => {
    e.preventDefault()
    const trimmed = newCommentText.trim()
    if (!trimmed) return
    const authorName = user?.user_metadata?.full_name || 'You'
    setComments((prev) => [
      ...prev,
      { id: Date.now(), name: authorName, text: trimmed, time: 'Just now' },
    ])
    setNewCommentText('')
    showToast('Comment posted!')
  }

  const handleCopyAddress = () => {
    const fullAddr = [listing.address, listing.area, listing.city].filter(Boolean).join(', ')
    if (!fullAddr) return
    navigator.clipboard.writeText(fullAddr)
    setCopyText('Copied!')
    showToast('Address copied to clipboard!')
    setTimeout(() => setCopyText('Copy'), 2500)
  }

  if (loading) return <SkeletonDetail />

  if (error || !listing) {
    return (
      <div className="min-h-screen bg-[#ececea] flex items-center justify-center">
        <div className="text-center px-4">
          <p className="text-slate-600 mb-4">{error ?? 'Listing not found'}</p>
          <Link href="/" className="text-[#00a884] font-medium underline underline-offset-2">
            Back to listings
          </Link>
        </div>
      </div>
    )
  }

  const photos = listing.photos ?? []
  const isTaken = listing.status === 'taken' || listing.status === 'booked' || listing.is_available === false
  const ownerName = listing.users?.full_name ?? 'Owner'
  const prevPhoto = () => setCurrentPhoto((p) => (p - 1 + photos.length) % photos.length)
  const nextPhoto = () => setCurrentPhoto((p) => (p + 1) % photos.length)

  const rawPhone = listing.users?.phone_number || listing.phone_number || ''
  const cleanPhone = rawPhone.replace(/\D/g, '')
  const whatsappHref = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hi, I saw your listing "${listing.title}" on RoomFind. Is it still available?`)}`
    : `https://wa.me/?text=${encodeURIComponent(`Hi, I am inquiring about the listing "${listing.title}" on RoomFind.`)}`

  const googleMapsDirectionsUrl = listing.latitude != null && listing.longitude != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${listing.latitude},${listing.longitude}`
    : null

  return (
    <div className="min-h-screen bg-[#ececea] pb-28 max-w-md mx-auto relative border-x border-black/[0.05]">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-3.5 py-2.5 flex items-center justify-between gap-2.5 shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <Link href="/" className="w-8.5 h-8.5 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 transition-colors shrink-0" aria-label="Back">
            <ChevronLeft className="w-5 h-5 text-slate-700" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="font-bold text-slate-900 text-sm truncate leading-snug">{listing.title}</h1>
            <p className="text-[11.5px] text-slate-400 font-normal truncate mt-0.5">
              {[listing.city, listing.state || 'West Bengal'].filter(Boolean).join(', ')}
            </p>
          </div>
        </div>

        <span className="text-xs font-bold text-emerald-800 bg-emerald-100/80 border border-emerald-200/50 px-3 py-1.5 rounded-full shrink-0">
          ₹{Number(listing.price).toLocaleString('en-IN')}
        </span>
      </header>

      {/* Main Content Stack */}
      <div className="p-3 space-y-3.5">

        {/* MASTER UNIFIED CARD (Hero + Owner + Price/Title + Specs + Social + Comments) */}
        <div className="bg-white rounded-2xl border border-black/[0.09] shadow-sm overflow-hidden space-y-0">
          
          {/* 1. Hero Photo Carousel */}
          {photos.length > 0 ? (
            <div className="relative bg-slate-900 aspect-[4/3] overflow-hidden group cursor-pointer" onClick={() => setIsLightboxOpen(true)}>
              <img src={photos[currentPhoto]} alt="" className="w-full h-full object-cover transition-all duration-300" />
                           {/* Top Left: Available Pill (Green) + Single Room Pill (Neutral Dark) */}
              <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10">
                <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full shadow-xs flex items-center gap-1.5 ${
                  isTaken ? 'bg-slate-700 text-white' : 'bg-[#00a884] text-white'
                }`}>
                  <svg className="w-3 h-3 fill-current text-white shrink-0" width="12" height="12" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>{isTaken ? 'Taken' : 'Available'}</span>
                </span>
                <span className="bg-slate-900/65 backdrop-blur-md text-white/90 text-[11px] font-medium px-2.5 py-0.5 rounded-full capitalize border border-white/10">
                  {listing.room_type} Room
                </span>
              </div>

              {/* Top Right: Small, Understated Photo Counter */}
              {photos.length > 1 && (
                <div className="absolute top-2.5 right-2.5 z-10">
                  <span className="bg-slate-900/65 backdrop-blur-md text-white/80 text-[10px] font-normal px-2.5 py-0.5 rounded-full border border-white/10">
                    {currentPhoto + 1} / {photos.length}
                  </span>
                </div>
              )}

              {/* Clear, Discoverable Photo Navigation Arrows */}
              {photos.length > 1 && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); prevPhoto(); }}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-7.5 h-7.5 bg-black/40 hover:bg-black/70 rounded-full flex items-center justify-center text-white/90 hover:text-white backdrop-blur-xs opacity-85 hover:opacity-100 transition-all z-10 shadow-xs"
                    aria-label="Previous photo"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); nextPhoto(); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7.5 h-7.5 bg-black/40 hover:bg-black/70 rounded-full flex items-center justify-center text-white/90 hover:text-white backdrop-blur-xs opacity-85 hover:opacity-100 transition-all z-10 shadow-xs"
                    aria-label="Next photo"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="aspect-[4/3] bg-slate-200 flex items-center justify-center">
              <span className="text-slate-400 text-xs font-medium">No photo available</span>
            </div>
          )}

          {/* Photo Thumbnails Row */}
          {photos.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1.5 scrollbar-none">
              {photos.map((photo, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentPhoto(index)}
                  className={`relative rounded-lg overflow-hidden shrink-0 transition-all ${
                    currentPhoto === index
                      ? 'ring-1.5 ring-[#00a884] opacity-100'
                      : 'opacity-65 hover:opacity-90'
                  }`}
                  style={{ width: '60px', height: '44px' }}
                >
                  <img src={photo} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* 3. Inner Body Content */}
          <div className="p-4 space-y-4">

            {/* Owner Profile Row */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-11 h-11 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-sm border border-emerald-300 overflow-hidden shrink-0">
                    {listing.users?.profile_photo ? (
                      <img src={listing.users.profile_photo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span>{initials(ownerName)}</span>
                    )}
                  </div>
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#00a884] border-2 border-white rounded-full"></span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 truncate">{ownerName}</span>
                    <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                      <svg className="w-3.5 h-3.5 fill-current text-emerald-600 shrink-0" width="14" height="14" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Owner</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Responds in ~1 hour
                  </p>
                </div>
              </div>
            </div>

            {/* Price & Title Overview */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <div className="flex items-baseline gap-1">
                  <span className="text-[28px] font-extrabold text-slate-900 tracking-tight">₹{Number(listing.price).toLocaleString('en-IN')}</span>
                  <span className="text-sm text-slate-500 font-medium">/month</span>
                </div>
                <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-3 py-1 rounded-full font-semibold">
                  No Brokerage
                </span>
              </div>

              <div>
                <h2 className="text-lg font-extrabold text-slate-900 leading-snug">{listing.title}</h2>
                <p className="text-[13.5px] text-slate-600 font-medium mt-1 flex items-start gap-1">
                  <svg className="w-4 h-4 fill-current text-[#00a884] shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                  </svg>
                  <span>{[listing.address, listing.area, listing.city].filter(Boolean).join(', ')}</span>
                </p>
              </div>

              {listing.description && (
                <p className="text-sm leading-relaxed text-slate-700 pt-1 whitespace-pre-wrap">
                  {listing.description}
                </p>
              )}
            </div>

            {/* Room Specifications Grid */}
            <div className="pt-1">
              <div className="grid grid-cols-3 gap-2.5">
                <div className="bg-emerald-50/50 rounded-2xl p-3 border border-emerald-100/60 text-center flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-emerald-100/80 text-emerald-700 flex items-center justify-center mb-1">
                    <svg className="w-4 h-4 fill-current text-emerald-700" width="16" height="16" viewBox="0 0 20 20">
                      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                    </svg>
                  </div>
                  <span className="text-xs text-slate-500 font-medium">Type</span>
                  <span className="text-sm font-bold text-slate-800 capitalize">{listing.room_type}</span>
                </div>

                <div className="bg-emerald-50/50 rounded-2xl p-3 border border-emerald-100/60 text-center flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-emerald-100/80 text-emerald-700 flex items-center justify-center mb-1">
                    <svg className="w-4 h-4 fill-current text-emerald-700" width="16" height="16" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-xs text-slate-500 font-medium">Furnished</span>
                  <span className="text-sm font-bold text-slate-800">
                    {listing.furnished === true ? 'Yes' : listing.furnished === false ? 'No' : (listing.furnished || 'Yes')}
                  </span>
                </div>

                <div className="bg-emerald-50/50 rounded-2xl p-3 border border-emerald-100/60 text-center flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-emerald-100/80 text-emerald-700 flex items-center justify-center mb-1">
                    <svg className="w-4 h-4 fill-current text-emerald-700" width="16" height="16" viewBox="0 0 20 20">
                      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                    </svg>
                  </div>
                  <span className="text-xs text-slate-500 font-medium">Gender</span>
                  <span className="text-sm font-bold text-slate-800 capitalize">
                    {genderLabel[listing.gender_preference] || listing.gender_preference || 'Any Gender'}
                  </span>
                </div>
              </div>
            </div>

            {/* Social Action Bar & Community Comments */}
            <div className="pt-2.5 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between text-slate-600 text-sm font-semibold">
                <button onClick={handleLike} className="flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors">
                  <Heart className={`w-4.5 h-4.5 ${liked ? 'fill-coral text-coral' : 'text-slate-400'}`} />
                  <span className={liked ? 'text-coral font-bold' : ''}>{likeCount}</span>
                </button>

                <button
                  onClick={() => {
                    setShowComments(true)
                    document.getElementById('comment-input')?.focus()
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-slate-50 text-slate-800 transition-colors"
                >
                  <MessageCircle className="w-4 h-4 text-slate-500" />
                  <span>Comment</span>
                  <span className="text-xs text-slate-500 font-normal">({comments.length})</span>
                </button>

                <button onClick={handleShare} className="flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-slate-50 text-slate-800 transition-colors">
                  <svg className="w-4.5 h-4.5 fill-current text-slate-500 shrink-0" width="18" height="18" viewBox="0 0 24 24">
                    <path d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z" />
                  </svg>
                  <span>Share</span>
                </button>

                <button
                  onClick={() => {
                    setSaved((s) => !s)
                    showToast(saved ? 'Removed from bookmarks' : 'Saved to bookmarks')
                  }}
                  className="p-2 rounded-xl hover:bg-slate-50 transition-colors ml-auto"
                  aria-label="Save listing"
                >
                  <Bookmark className={`w-4.5 h-4.5 ${saved ? 'fill-[#00a884] text-[#00a884]' : 'text-slate-400'}`} />
                </button>
              </div>

              {/* Always-Open Community Discussion */}
              {showComments && (
                <div className="pt-3.5 border-t border-slate-100 space-y-3.5 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">COMMUNITY DISCUSSION</h4>
                    <span className="text-xs text-slate-400">Ask the owner questions</span>
                  </div>

                  <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                    {comments.map((comment) => (
                      <div key={comment.id} className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center shrink-0 border border-emerald-200/60">
                          {initials(comment.name)}
                        </div>
                        <div className="bg-slate-50 border border-slate-100 rounded-2xl px-3.5 py-2.5 flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-bold text-slate-900">{comment.name}</p>
                            <span className="text-xs text-slate-400">{comment.time}</span>
                          </div>
                          <p className="text-[13.5px] text-slate-700 mt-0.5 leading-snug">{comment.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleAddComment} className="flex items-center gap-2 pt-1">
                    <input
                      id="comment-input"
                      type="text"
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      placeholder="Ask a question or comment..."
                      className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-full px-4 py-2.5 focus:outline-none focus:border-[#00a884] transition-colors"
                    />
                    <button type="submit" className="w-9 h-9 rounded-full bg-[#00a884] hover:bg-[#008f6f] text-white flex items-center justify-center shrink-0 shadow-xs transition-transform active:scale-95" aria-label="Post comment">
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* SEPARATE LOCATION & NAVIGATION CARD BELOW */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          
          {/* Header Row (Lighter grey background) */}
          <div className="p-4 pb-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white border border-emerald-200/50 text-emerald-600 flex items-center justify-center shrink-0 shadow-2xs">
                <svg className="w-5 h-5 fill-current text-emerald-600 shrink-0" width="20" height="20" viewBox="0 0 24 24">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-slate-900">Location & Navigation</h3>
            </div>

            <span className="text-xs font-semibold text-emerald-700 bg-white border border-emerald-200/80 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-2xs">
              🚗 <span>{userDistance ? `${userDistance} km away` : '0.0 km away'}</span>
            </span>
          </div>

          {/* Address & Content Body (White background) */}
          <div className="p-4 space-y-3 bg-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">FULL ADDRESS</span>
                <div className="space-y-0.5 text-sm">
                  <p className="font-normal text-slate-800 leading-snug">
                    {[listing.address, listing.area].filter(Boolean).join(', ')}
                  </p>
                  {listing.city && (
                    <p className="text-xs font-medium text-slate-500 pt-0.5 leading-snug">
                      {[listing.city, listing.state || 'West Bengal'].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={handleCopyAddress}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
              >
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>{copyText}</span>
              </button>
            </div>

            {/* Clean Micro-Landmark Chips */}
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <span className="text-[11.5px] font-medium text-slate-600 bg-slate-100/80 px-2.5 py-1 rounded-full flex items-center gap-1">
                🚌 Easy Transport Access
              </span>
              <span className="text-[11.5px] font-medium text-slate-600 bg-slate-100/80 px-2.5 py-1 rounded-full flex items-center gap-1">
                🛡️ Verified Location
              </span>
            </div>
          </div>

          {/* Google Maps View */}
          {listing.latitude != null && listing.longitude != null && (
            <div className="relative bg-slate-100 h-72 w-full border-t border-slate-200/60 overflow-hidden group">
              <iframe
                src={`https://maps.google.com/maps?q=${listing.latitude},${listing.longitude}&z=17&output=embed`}
                className="w-full h-full border-0 filter contrast-[1.02]"
                title="Listing Location Map"
                loading="lazy"
              />
            </div>
          )}

          {/* Get Directions Button Footer */}
          {googleMapsDirectionsUrl && (
            <div className="p-3 bg-slate-100/60 border-t border-slate-200/60">
              <a
                href={googleMapsDirectionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#00a884] hover:bg-[#008f6f] text-white font-bold text-sm transition-all shadow-xs active:scale-98"
              >
                <Map className="w-4 h-4 text-white shrink-0" />
                <span>Get Directions in Google Maps</span>
              </a>
            </div>
          )}
        </div>

      </div>

      {/* STICKY MOBILE BOTTOM CONTACT BAR */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/95 backdrop-blur-md border-t border-black/[0.09] p-3.5 px-4 flex items-center justify-between gap-3 z-50 shadow-2xl">
        <div>
          <span className="text-xs text-slate-400 font-medium block uppercase tracking-wider">Total Monthly Rent</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-2xl font-black text-slate-900">₹{Number(listing.price).toLocaleString('en-IN')}</span>
            <span className="text-xs text-slate-500 font-medium">/mo</span>
          </div>
        </div>

        {isTaken ? (
          <div className="flex-1 max-w-[210px] py-3 rounded-xl bg-slate-200 text-slate-500 font-bold text-xs text-center select-none">
            Taken
          </div>
        ) : (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 max-w-[210px] flex items-center justify-center gap-2 py-3 rounded-xl bg-[#00a884] hover:bg-[#008f6f] active:scale-98 text-white font-bold text-sm transition-all shadow-md"
          >
            <svg className="w-5 h-5 fill-current text-white shrink-0" width="20" height="20" viewBox="0 0 20 20">
              <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
            </svg>
            <span>Contact Owner</span>
          </a>
        )}
      </div>

      <ShareModal
        isOpen={isShareOpen}
        listing={listing}
        onClose={() => setIsShareOpen(false)}
      />

      <ImageLightboxModal
        isOpen={isLightboxOpen}
        photos={photos}
        initialIndex={currentPhoto}
        listing={{ ...listing, _liked: liked, _likeCount: likeCount }}
        onClose={() => setIsLightboxOpen(false)}
        onLikeToggle={handleLike}
        onShare={() => setIsShareOpen(true)}
      />
    </div>
  )
}
