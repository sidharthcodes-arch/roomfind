'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeft, MapPin, Phone, User, Home, Users, CheckCircle, ShieldCheck,
  ChevronLeft, ChevronRight, Heart, MessageCircle, Share, Bookmark, Pencil,
  Navigation, Copy, Send, ExternalLink
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
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-black/[0.09] px-4 py-2.5 flex items-center justify-between gap-2 shadow-xs">
        <Link href="/" className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 transition-colors shrink-0">
          <ArrowLeft className="w-4.5 h-4.5" />
        </Link>

        <div className="flex-1 min-w-0 px-1">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Listing Details</p>
          <h1 className="font-bold text-slate-900 text-sm truncate leading-snug">{listing.title}</h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {user?.id === listing.user_id && (
            <Link
              href={`/edit-listing/${listing.id}`}
              className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 rounded-full px-3 py-1 hover:bg-emerald-100 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit</span>
            </Link>
          )}

          <button onClick={handleShare} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 shrink-0" aria-label="Share listing">
            <Share className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Stack */}
      <div className="p-3 space-y-3.5">

        {/* MASTER UNIFIED CARD (Hero + Owner + Price/Title + Specs + Social + Comments) */}
        <div className="bg-white rounded-2xl border border-black/[0.09] shadow-sm overflow-hidden space-y-0">

          {/* 1. Hero Photo Carousel */}
          {photos.length > 0 ? (
            <div className="relative bg-slate-900 aspect-[4/3] overflow-hidden group cursor-pointer" onClick={() => setIsLightboxOpen(true)}>
              <img src={photos[currentPhoto]} alt="" className="w-full h-full object-cover transition-all duration-300" />
              
              {/* Top Left Badges */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
                <span className={`text-xs font-bold px-3 py-1 rounded-full shadow-md flex items-center gap-1 ${isTaken ? 'bg-slate-700 text-white' : 'bg-[#00a884] text-white'}`}>
                  <CheckCircle className="w-3.5 h-3.5 fill-white/20" />
                  <span>{isTaken ? 'Taken' : 'Available'}</span>
                </span>
                <span className="bg-black/60 backdrop-blur-md text-white text-xs font-medium px-3 py-1 rounded-full border border-white/20 capitalize">
                  {listing.room_type} Room
                </span>
              </div>

              {/* Top Right Distance Badge */}
              <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white text-xs font-medium px-3 py-1 rounded-full z-10 flex items-center gap-1 border border-white/20">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                <span>{userDistance ? `${userDistance} km away` : '0.0 km away'}</span>
              </div>

              {/* Carousel Navigation Arrows */}
              {photos.length > 1 && (
                <>
                  <button onClick={(e) => { e.stopPropagation(); prevPhoto(); }} className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 hover:bg-black/70 rounded-full flex items-center justify-center text-white backdrop-blur-sm transition-all z-10" aria-label="Previous photo">
                    <ChevronLeft className="w-4.5 h-4.5" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); nextPhoto(); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 hover:bg-black/70 rounded-full flex items-center justify-center text-white backdrop-blur-sm transition-all z-10" aria-label="Next photo">
                    <ChevronRight className="w-4.5 h-4.5" />
                  </button>
                </>
              )}

              {/* Photo Counter & Dot Indicators */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between z-10">
                <span className="bg-black/60 backdrop-blur-md text-white text-xs font-bold px-2.5 py-0.5 rounded-md">
                  {currentPhoto + 1} / {photos.length} Photos
                </span>

                {photos.length > 1 && (
                  <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-full">
                    {photos.map((_, i) => (
                      <div
                        key={i}
                        className={`transition-all ${i === currentPhoto ? 'w-4 h-1.5 rounded-full bg-white' : 'w-1.5 h-1.5 rounded-full bg-white/50'}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="aspect-[4/3] bg-slate-200 flex items-center justify-center">
              <MapPin className="w-10 h-10 text-slate-400" />
            </div>
          )}

          {/* 2. Interactive Thumbnail Strip */}
          {photos.length > 1 && (
            <div className="flex gap-2 px-3.5 py-2.5 overflow-x-auto scrollbar-hide bg-slate-50/60 border-b border-slate-100">
              {photos.map((photo, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPhoto(i)}
                  className={`shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                    i === currentPhoto ? 'border-[#00a884] ring-2 ring-[#00a884]/30' : 'border-transparent hover:border-slate-300'
                  }`}
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
                    <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 rounded-full flex items-center gap-0.5 shrink-0">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Owner
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
                  <MapPin className="w-4 h-4 text-[#00a884] shrink-0 mt-0.5" />
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
                    <Home className="w-4 h-4" />
                  </div>
                  <span className="text-xs text-slate-500 font-medium">Type</span>
                  <span className="text-sm font-bold text-slate-800 capitalize">{listing.room_type}</span>
                </div>

                <div className="bg-emerald-50/50 rounded-2xl p-3 border border-emerald-100/60 text-center flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-emerald-100/80 text-emerald-700 flex items-center justify-center mb-1">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <span className="text-xs text-slate-500 font-medium">Furnished</span>
                  <span className="text-sm font-bold text-slate-800">
                    {listing.furnished === true ? 'Yes' : listing.furnished === false ? 'No' : (listing.furnished || 'Yes')}
                  </span>
                </div>

                <div className="bg-emerald-50/50 rounded-2xl p-3 border border-emerald-100/60 text-center flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-emerald-100/80 text-emerald-700 flex items-center justify-center mb-1">
                    <Users className="w-4 h-4" />
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
                  <MessageCircle className="w-4.5 h-4.5 text-[#00a884]" />
                  <span>Comment</span>
                  <span className="text-[#00a884] font-bold">({comments.length})</span>
                </button>

                <button onClick={handleShare} className="flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors">
                  <Share className="w-4.5 h-4.5 text-slate-400" />
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
        <div className="bg-white rounded-2xl border border-black/[0.09] p-4 shadow-sm space-y-3">
          
          {/* Location Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#00a884] text-white flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4 fill-white" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Location & Navigation</h3>
            </div>

            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-3 py-1 rounded-full flex items-center gap-1">
              🚗 {userDistance ? `${userDistance} km away` : '0.0 km away'}
            </span>
          </div>

          {/* Address Row & Copy */}
          <div className="flex items-start justify-between gap-2.5 pt-1">
            <p className="text-sm font-semibold text-slate-800 leading-snug">
              {[listing.address, listing.area, listing.city].filter(Boolean).join(', ')}
            </p>
            <button
              onClick={handleCopyAddress}
              className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copyText}</span>
            </button>
          </div>

          {/* Google Maps View (Clean without pin overlay) */}
          {listing.latitude != null && listing.longitude != null && (
            <div className="relative bg-slate-100 aspect-[16/9] border border-slate-100 rounded-xl overflow-hidden group">
              <iframe
                src={`https://maps.google.com/maps?q=${listing.latitude},${listing.longitude}&z=15&output=embed`}
                className="w-full h-full border-0 filter contrast-[1.02]"
                title="Listing Location Map"
                loading="lazy"
              />
            </div>
          )}

          {/* Get Directions Button */}
          {googleMapsDirectionsUrl && (
            <a
              href={googleMapsDirectionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#00a884] hover:bg-[#008f6f] text-white font-bold text-sm transition-all shadow-xs active:scale-98"
            >
              <Navigation className="w-4 h-4 fill-white/20" />
              <span>Get Directions in Google Maps</span>
            </a>
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
            <Phone className="w-4.5 h-4.5 fill-white" />
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
