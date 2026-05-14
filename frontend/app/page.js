'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { filterByDistance } from '@/lib/utils'
import { Bell, MapPin, Heart, MessageCircle, Share2, Bookmark, Plus, CheckCircle } from 'lucide-react'

const PAGE_SIZE = 10

// ─── helpers ────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

// ─── filter chips ────────────────────────────────────────────────────────────

const FILTERS = ['All', 'Single', 'Shared', 'Furnished', 'Under ₹5k', 'Near you']

// ─── skeleton card ───────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-black/[0.09] animate-pulse mb-3">
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 bg-slate-200 rounded w-32" />
          <div className="h-3 bg-slate-200 rounded w-24" />
        </div>
      </div>
      <div className="aspect-[4/3] bg-slate-200" />
      <div className="px-4 py-3 space-y-2">
        <div className="h-5 bg-slate-200 rounded w-24" />
        <div className="h-4 bg-slate-200 rounded w-3/4" />
        <div className="h-3 bg-slate-200 rounded w-1/2" />
      </div>
    </div>
  )
}

// ─── listing card ─────────────────────────────────────────────────────────────

function ListingCard({ listing, currentUserId, onLikeToggle }) {
  const isTaken = listing.status === 'taken'
  const photos = listing.photos ?? []
  const [photoIdx, setPhotoIdx] = useState(0)
  const [liked, setLiked] = useState(listing._liked ?? false)
  const [likeCount, setLikeCount] = useState(listing._likeCount ?? 0)
  const [saved, setSaved] = useState(false)

  const ownerName = listing.users?.full_name ?? 'Owner'
  const ownerInitials = initials(ownerName)

  const handleLike = async (e) => {
    e.preventDefault()
    if (!currentUserId) return
    
    // Optimistic update
    const next = !liked
    setLiked(next)
    setLikeCount((c) => c + (next ? 1 : -1))
    onLikeToggle?.(listing._id || listing.id, next)
    
    try {
      const res = await fetch(`http://localhost:5000/api/listings/${listing._id || listing.id}/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${listing._token}` }
      })
      if (!res.ok) throw new Error('Failed to like')
    } catch (err) {
      // Revert on error
      setLiked(!next)
      setLikeCount((c) => c + (!next ? 1 : -1))
      onLikeToggle?.(listing._id || listing.id, !next)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!currentUserId) return
    const next = !saved
    setSaved(next)
    try {
      await fetch(`http://localhost:5000/api/listings/${listing._id || listing.id}/save`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${listing._token}` }
      })
    } catch (err) {
      setSaved(!next)
    }
  }

  const whatsappHref = listing.users?.phone_number
    ? `https://wa.me/${listing.users.phone_number.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi, I saw your listing "${listing.title}" on RoomFind. Is it still available?`)}`
    : null

  return (
    <article className="bg-white rounded-2xl overflow-hidden border border-black/[0.09] mb-3">
      {/* Owner row */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center shrink-0 overflow-hidden">
          {listing.users?.profile_photo ? (
            <img src={listing.users.profile_photo} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-brand font-bold text-sm">{ownerInitials}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[14px] text-slate-900 truncate">{ownerName}</span>
            {/* Verified owner badge */}
            <span className="flex items-center gap-0.5 text-[11px] font-medium text-brand bg-brand-light px-1.5 py-0.5 rounded-full shrink-0">
              <CheckCircle className="w-3 h-3" />
              Owner
            </span>
          </div>
          <p className="text-[12px] text-slate-400 truncate">
            {listing.area} · {timeAgo(listing.created_at)}
          </p>
        </div>
        <button className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600">
          <span className="text-xl leading-none">···</span>
        </button>
      </div>

      {/* Photo */}
      <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
        {photos.length > 0 ? (
          <img
            src={photos[photoIdx]}
            alt={listing.title}
            className="w-full h-full object-cover"
            onError={(e) => { e.target.style.display = 'none' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <MapPin className="w-10 h-10 text-slate-300" />
          </div>
        )}

        {/* Status + room type badges */}
        <div className="absolute top-3 left-3 flex gap-1.5">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
            isTaken ? 'bg-slate-700 text-white' : 'bg-brand text-white'
          }`}>
            {isTaken ? 'Taken' : 'Available'}
          </span>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-black/40 text-white capitalize">
            {listing.room_type}
          </span>
        </div>

        {/* Photo count */}
        {photos.length > 1 && (
          <div className="absolute bottom-3 right-3 bg-black/50 text-white text-[11px] px-2 py-0.5 rounded-full">
            {photoIdx + 1} / {photos.length}
          </div>
        )}

        {/* Tap zones for photo nav */}
        {photos.length > 1 && (
          <>
            <button
              className="absolute left-0 top-0 w-1/2 h-full"
              onClick={() => setPhotoIdx((i) => (i - 1 + photos.length) % photos.length)}
            />
            <button
              className="absolute right-0 top-0 w-1/2 h-full"
              onClick={() => setPhotoIdx((i) => (i + 1) % photos.length)}
            />
          </>
        )}
      </div>

      {/* Price + details */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-baseline gap-1 mb-1">
          <span className="text-[22px] font-bold text-slate-900">
            ₹{Number(listing.price).toLocaleString('en-IN')}
          </span>
          <span className="text-[13px] text-slate-400">/month</span>
        </div>
        <p className="text-[14px] text-slate-700 font-medium line-clamp-1 mb-1">{listing.title}</p>
        <div className="flex items-center gap-1 mb-2">
          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-[12px] text-slate-500 truncate">{listing.area}, {listing.city}</span>
        </div>
        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {listing.furnished && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-brand-light text-brand font-medium">
              Furnished
            </span>
          )}
          {listing.gender_preference && listing.gender_preference !== 'any' && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium capitalize">
              {listing.gender_preference === 'male' ? 'Male only' : 'Female preferred'}
            </span>
          )}
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
            No broker
          </span>
        </div>
      </div>

      {/* Action row */}
      <div className="flex items-center px-3 py-1 border-t border-black/[0.05]">
        <button
          onClick={handleLike}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-colors hover:bg-slate-50"
        >
          <Heart
            className={`w-5 h-5 transition-colors ${liked ? 'fill-coral text-coral' : 'text-slate-400'}`}
          />
          <span className={`text-[13px] font-medium ${liked ? 'text-coral' : 'text-slate-500'}`}>
            {likeCount}
          </span>
        </button>

        <Link
          href={`/listings/${listing.id}#comments`}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors"
        >
          <MessageCircle className="w-5 h-5 text-slate-400" />
          <span className="text-[13px] font-medium text-slate-500">{listing._commentCount ?? 0}</span>
        </Link>

        <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors">
          <Share2 className="w-5 h-5 text-slate-400" />
          <span className="text-[13px] font-medium text-slate-500">Share</span>
        </button>

        <button
          onClick={handleSave}
          className="ml-auto flex items-center justify-center w-9 h-9 rounded-xl hover:bg-slate-50 transition-colors"
        >
          <Bookmark className={`w-5 h-5 ${saved ? 'fill-brand text-brand' : 'text-slate-400'}`} />
        </button>
      </div>

      {/* WhatsApp CTA */}
      <div className="px-4 pb-4 pt-1">
        {!isTaken && whatsappHref ? (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-brand text-white font-semibold text-[14px] active:opacity-90 transition-opacity"
          >
            {/* WhatsApp icon inline SVG */}
            <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Contact on WhatsApp
          </a>
        ) : (
          <div className="flex items-center justify-center w-full py-2.5 rounded-xl bg-slate-200 text-slate-400 font-semibold text-[14px] cursor-not-allowed select-none">
            Room no longer available
          </div>
        )}
      </div>
    </article>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { user } = useAuth()
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [activeFilter, setActiveFilter] = useState('All')
  const [userLat, setUserLat] = useState(null)
  const [userLng, setUserLng] = useState(null)
  const [hasNotif, setHasNotif] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const pageRef = useRef(0)
  const sentinelRef = useRef(null)

  // Geolocation
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude) },
        () => {}
      )
    }
  }, [])

  const fetchPage = useCallback(async (page, replace = false) => {
    try {
      const queryParams = new URLSearchParams()
      queryParams.append('page', page + 1)
      queryParams.append('limit', PAGE_SIZE)
      
      if (activeFilter === 'Single') queryParams.append('room_type', 'single')
      if (activeFilter === 'Shared') queryParams.append('room_type', 'shared')
      if (activeFilter === 'Furnished') queryParams.append('furnished', 'true')
      if (activeFilter === 'Under ₹5k') queryParams.append('max_price', '5000')

      const headers = {}
      if (user?.accessToken) {
        headers['Authorization'] = `Bearer ${user.accessToken}`
      }

      const res = await fetch(`http://localhost:5000/api/listings?${queryParams.toString()}`, { headers })
      if (!res.ok) throw new Error('Failed to fetch listings')
      const data = await res.json()

      if (!data || data.length === 0) {
        setHasMore(false)
        if (replace) setListings([])
        return
      }

      let enriched = data.map(l => ({
        ...l,
        id: l._id,
        _token: user?.accessToken
      }))

      if (activeFilter === 'Near you' && userLat !== null && userLng !== null) {
        enriched = filterByDistance(enriched, userLat, userLng)
      }

      setHasMore(data.length === PAGE_SIZE)
      setListings((prev) => replace ? enriched : [...prev, ...enriched])
    } catch (error) {
      console.error('listings fetch error:', error)
      setFetchError(error.message)
    }
  }, [user, userLat, userLng, activeFilter])

  // Initial load / filter change
  useEffect(() => {
    pageRef.current = 0
    setListings([])
    setHasMore(true)
    setFetchError(null)
    setLoading(true)
    fetchPage(0, true).finally(() => setLoading(false))
  }, [activeFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  // Infinite scroll sentinel
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      async ([entry]) => {
        if (entry.isIntersecting && hasMore && !loadingMore && !loading) {
          setLoadingMore(true)
          pageRef.current += 1
          await fetchPage(pageRef.current)
          setLoadingMore(false)
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loading, fetchPage])

  return (
    <div className="min-h-screen bg-[#ececea] pb-24">

      {/* ── Top bar ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-black/[0.09] px-4 py-3 flex items-center justify-between">
        <h1 className="text-[20px] font-bold text-slate-900 tracking-tight">RoomFind</h1>
        <button className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors">
          <Bell className="w-5 h-5 text-slate-600" />
          {hasNotif && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-coral border-2 border-white" />
          )}
        </button>
      </div>

      {/* ── Filter chips ── */}
      <div className="sticky top-[57px] z-10 bg-white border-b border-black/[0.09] px-4 py-2.5 flex gap-2 overflow-x-auto scrollbar-hide">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
              activeFilter === f
                ? 'bg-brand text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* ── Feed ── */}
      <div className="px-3 pt-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)
        ) : fetchError ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-slate-600 font-medium mb-1">Could not load listings</p>
            <p className="text-red-400 text-[12px] font-mono bg-red-50 px-3 py-2 rounded-lg mt-2 max-w-xs break-all">{fetchError}</p>
            <button
              onClick={() => { setFetchError(null); setLoading(true); fetchPage(0, true).finally(() => setLoading(false)) }}
              className="mt-4 text-[13px] text-brand font-medium underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        ) : listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <MapPin className="w-10 h-10 text-slate-300 mb-3" />
            <p className="text-slate-600 font-medium">No listings found</p>
            <p className="text-slate-400 text-sm mt-1">Try a different filter</p>
          </div>
        ) : (
          <>
            {listings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                currentUserId={user?.id ?? null}
              />
            ))}
            {/* Sentinel for infinite scroll */}
            <div ref={sentinelRef} className="h-4" />
            {loadingMore && (
              <div className="flex justify-center py-4">
                <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {!hasMore && listings.length > 0 && (
              <p className="text-center text-slate-400 text-[13px] py-4">You've seen all listings</p>
            )}
          </>
        )}
      </div>

      {/* ── FAB (owners only) ── */}
      <Link
        href="/create-listing"
        className="fixed bottom-20 right-4 z-30 w-14 h-14 rounded-full bg-brand shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        aria-label="Post a listing"
      >
        <Plus className="w-7 h-7 text-white stroke-[2.5]" />
      </Link>
    </div>
  )
}
