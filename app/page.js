'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { filterByDistance } from '@/lib/utils'
import ShareModal from '@/components/ShareModal'
import TwitterImageGrid from '@/components/TwitterImageGrid'
import ImageLightboxModal from '@/components/ImageLightboxModal'
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

async function copyTextToClipboard(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (_) {}
  }
  try {
    const textArea = document.createElement("textarea")
    textArea.value = text
    textArea.style.position = "fixed"
    textArea.style.left = "-999999px"
    textArea.style.top = "-999999px"
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    const successful = document.execCommand("copy")
    textArea.remove()
    return successful
  } catch (_) {
    return false
  }
}

// ─── listing card ─────────────────────────────────────────────────────────────

function ListingCard({ listing, currentUserId, onLikeToggle, onShare }) {
  const router = useRouter()
  const isTaken = listing.status === 'taken' || listing.status === 'booked' || listing.is_available === false
  const photos = listing.photos ?? []
  const [liked, setLiked] = useState(listing._liked ?? false)
  const [likeCount, setLikeCount] = useState(listing._likeCount ?? 0)
  const [saved, setSaved] = useState(false)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  const ownerName = listing.users?.full_name ?? 'Owner'
  const ownerInitials = initials(ownerName)

  useEffect(() => {
    setLiked(listing._liked ?? false)
    setLikeCount(listing._likeCount ?? 0)
  }, [listing._liked, listing._likeCount])

  const handleCardClick = () => {
    router.push(`/listings/${listing.id}`)
  }

  const handleOpenLightbox = (index) => {
    setLightboxIndex(index)
    setIsLightboxOpen(true)
  }

  const handleLike = async (e) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    if (!currentUserId) return
    const next = !liked
    setLiked(next)
    setLikeCount((c) => c + (next ? 1 : -1))
    onLikeToggle?.(listing.id, next)
    if (next) {
      await supabase.from('listing_likes').insert({ listing_id: listing.id, user_id: currentUserId })
    } else {
      await supabase.from('listing_likes').delete()
        .eq('listing_id', listing.id).eq('user_id', currentUserId)
    }
  }

  const handleShare = (e) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    onShare?.(listing)
  }

  const whatsappHref = listing.users?.phone_number
    ? `https://wa.me/${listing.users.phone_number.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi, I saw your listing "${listing.title}" on RoomFind. Is it still available?`)}`
    : null

  return (
    <article
      onClick={handleCardClick}
      className="bg-white rounded-2xl overflow-hidden border border-black/[0.09] mb-3 cursor-pointer group hover:border-black/20 transition-colors"
    >
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
        <button
          onClick={(e) => e.stopPropagation()}
          className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600"
        >
          <span className="text-xl leading-none">···</span>
        </button>
      </div>

      {/* Twitter-Style Multi Image Grid */}
      <div className="relative px-3">
        <TwitterImageGrid
          photos={photos}
          onImageClick={handleOpenLightbox}
        />

        {/* Status + room type badges overlay */}
        <div className="absolute top-2.5 left-5 z-[1] flex gap-1.5 pointer-events-none">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shadow-sm ${
            isTaken ? 'bg-slate-700 text-white' : 'bg-brand text-white'
          }`}>
            {isTaken ? 'Taken' : 'Available'}
          </span>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-black/50 text-white backdrop-blur-sm capitalize">
            {listing.room_type}
          </span>
        </div>
      </div>

      {/* Twitter-Style Full Screen Lightbox Modal */}
      <ImageLightboxModal
        isOpen={isLightboxOpen}
        photos={photos}
        initialIndex={lightboxIndex}
        listing={{ ...listing, _liked: liked, _likeCount: likeCount }}
        onClose={() => setIsLightboxOpen(false)}
        onLikeToggle={handleLike}
        onShare={() => handleShare()}
      />

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
          {listing._distanceKm != null && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold flex items-center gap-1">
              <span>📍</span>
              {listing._distanceKm < 1
                ? `${Math.round(listing._distanceKm * 1000)}m away`
                : `${listing._distanceKm.toFixed(1)} km away`}
            </span>
          )}
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

      {/* Action row (Avoided: Clicks here do NOT open detail page) */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex items-center px-3 py-1 border-t border-black/[0.05]"
      >
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

        <button onClick={handleShare} className="flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors">
          <Share2 className="w-5 h-5 text-slate-400" />
          <span className="text-[13px] font-medium text-slate-500">Share</span>
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation()
            setSaved((s) => !s)
          }}
          className="ml-auto flex items-center justify-center w-9 h-9 rounded-xl hover:bg-slate-50 transition-colors"
        >
          <Bookmark className={`w-5 h-5 ${saved ? 'fill-brand text-brand' : 'text-slate-400'}`} />
        </button>
      </div>

      {/* CTA Section (Avoided: Clicks here do NOT open detail page) */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="px-4 pb-4 pt-1"
      >
        {isTaken ? (
          <div className="flex items-center justify-center w-full py-2.5 rounded-xl bg-slate-200 text-slate-500 font-semibold text-[14px] cursor-not-allowed select-none">
            Room no longer available
          </div>
        ) : whatsappHref ? (
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
          <div className="flex items-center justify-center w-full py-2.5 rounded-xl bg-slate-100 text-slate-500 font-semibold text-[14px] border border-black/[0.05] select-none">
            Available (No Contact Phone Listed)
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
  const [radiusKm, setRadiusKm] = useState(10)
  const [hasNotif, setHasNotif] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [shareListing, setShareListing] = useState(null)
  const pageRef = useRef(0)
  const sentinelRef = useRef(null)

  // Geolocation
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude) },
        () => {},
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
    }
  }, [])

  const buildQuery = useCallback((from, to) => {
    let q = supabase
      .from('listings')
      .select('*, users(full_name, phone_number, profile_photo)')
      .order('created_at', { ascending: false })
      .range(from, to)

    if (activeFilter === 'Single')    q = q.eq('room_type', 'single')
    if (activeFilter === 'Shared')    q = q.eq('room_type', 'shared')
    if (activeFilter === 'Furnished') q = q.eq('furnished', true)
    if (activeFilter === 'Under ₹5k') q = q.lte('price', 5000)

    // Server-side geographic bounding box query for "Near you"
    if (activeFilter === 'Near you' && userLat != null && userLng != null) {
      const deltaLat = radiusKm / 111.045
      const deltaLng = radiusKm / (111.045 * Math.cos((userLat * Math.PI) / 180))

      q = q
        .gte('latitude', userLat - deltaLat)
        .lte('latitude', userLat + deltaLat)
        .gte('longitude', userLng - deltaLng)
        .lte('longitude', userLng + deltaLng)
    }

    return q
  }, [activeFilter, userLat, userLng, radiusKm])

  const fetchPage = useCallback(async (page, replace = false) => {
    const from = page * PAGE_SIZE
    const to   = from + PAGE_SIZE - 1
    const { data, error } = await buildQuery(from, to)

    if (error) {
      console.error('listings fetch error:', error)
      setFetchError(error.message)
      return
    }
    if (!data || data.length === 0) {
      setHasMore(false)
      if (replace) setListings([])
      return
    }

    // Fetch like counts + user like status — failures here must NOT block listings
    const ids = data.map((l) => l.id)
    let likesData = [], userLikes = [], commentsData = []
    try {
      const [likesRes, userLikesRes, commentsRes] = await Promise.all([
        supabase.from('listing_likes').select('listing_id').in('listing_id', ids),
        user
          ? supabase.from('listing_likes').select('listing_id').in('listing_id', ids).eq('user_id', user.id)
          : Promise.resolve({ data: [] }),
        supabase.from('listing_comments').select('listing_id').in('listing_id', ids),
      ])
      likesData    = likesRes.data    ?? []
      userLikes    = userLikesRes.data ?? []
      commentsData = commentsRes.data  ?? []
    } catch (_) {
      // likes/comments tables may not exist yet — show listings anyway
    }

    const likeCountMap = {}
    const userLikeSet = new Set(userLikes.map((l) => l.listing_id))
    const commentCountMap = {}
    likesData.forEach((l)    => { likeCountMap[l.listing_id]    = (likeCountMap[l.listing_id]    ?? 0) + 1 })
    commentsData.forEach((l) => { commentCountMap[l.listing_id] = (commentCountMap[l.listing_id] ?? 0) + 1 })

    let enriched = data.map((l) => ({
      ...l,
      _liked: userLikeSet.has(l.id),
      _likeCount: likeCountMap[l.id] ?? 0,
      _commentCount: commentCountMap[l.id] ?? 0,
    }))

    // Near you filter — Haversine distance calculation and sorting
    if (activeFilter === 'Near you' && userLat != null && userLng != null) {
      enriched = filterByDistance(enriched, userLat, userLng, radiusKm)
    }

    setHasMore(data.length === PAGE_SIZE)
    setListings((prev) => replace ? enriched : [...prev, ...enriched])
  }, [buildQuery, user, userLat, userLng, activeFilter, radiusKm])

  const handleLikeToggle = (listingId, isLiked) => {
    setListings((prev) =>
      prev.map((item) =>
        item.id === listingId
          ? {
              ...item,
              _liked: isLiked,
              _likeCount: isLiked ? (item._likeCount ?? 0) + 1 : Math.max(0, (item._likeCount ?? 1) - 1),
            }
          : item
      )
    )
  }

  // Initial load / filter change / user auth resolution
  useEffect(() => {
    pageRef.current = 0
    setListings([])
    setHasMore(true)
    setFetchError(null)
    setLoading(true)
    fetchPage(0, true).finally(() => setLoading(false))
  }, [activeFilter, radiusKm, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

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
    <div className="min-h-screen bg-[#ececea] pb-24 max-w-lg mx-auto relative shadow-sm border-x border-black/[0.05]">

      {/* ── Top bar ── */}
      <div className="sticky top-0 z-30 bg-white border-b border-black/[0.09] px-4 py-3 flex items-center justify-between">
        <h1 className="text-[20px] font-bold text-slate-900 tracking-tight">RoomFind</h1>
        <button className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors">
          <Bell className="w-5 h-5 text-slate-600" />
          {hasNotif && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-coral border-2 border-white" />
          )}
        </button>
      </div>

      {/* ── Filter chips ── */}
      <div className="sticky top-[57px] z-30 bg-white border-b border-black/[0.09] px-4 py-2.5 flex gap-2 overflow-x-auto scrollbar-hide">
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

      {/* ── Radius selector sub-bar for Near You filter ── */}
      {activeFilter === 'Near you' && (
        <div className="bg-slate-50 border-b border-black/[0.07] px-4 py-2 flex items-center justify-between text-[12px] text-slate-600">
          <span className="font-medium">Search Radius:</span>
          <div className="flex gap-1.5">
            {[2, 5, 10, 20, 50].map((r) => (
              <button
                key={r}
                onClick={() => setRadiusKm(r)}
                className={`px-2.5 py-1 rounded-lg font-semibold text-[12px] transition-all ${
                  radiusKm === r
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {r} km
              </button>
            ))}
          </div>
        </div>
      )}

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
                onLikeToggle={handleLikeToggle}
                onShare={(l) => setShareListing(l)}
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

      {/* ── Share Modal ── */}
      <ShareModal
        isOpen={!!shareListing}
        listing={shareListing}
        onClose={() => setShareListing(null)}
      />
    </div>
  )
}
