'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { filterByDistance, filterBySearch, formatPrice } from '@/lib/utils'
import { Search, MapPin, Navigation, AlertCircle } from 'lucide-react'

const roomTypeColor = {
  single: 'bg-blue-50 text-blue-700 border border-blue-200',
  shared: 'bg-purple-50 text-purple-700 border border-purple-200',
  'full apartment': 'bg-green-50 text-green-700 border border-green-200',
}

function ListingCard({ listing }) {
  const firstPhoto = listing.photos?.[0] ?? null

  return (
    <Link href={`/listings/${listing.id}`}>
      <div className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
        <div className="aspect-[4/3] bg-slate-100 relative overflow-hidden">
          {firstPhoto ? (
            <img
              src={firstPhoto}
              alt={listing.title}
              className="w-full h-full object-cover"
              onError={(e) => { e.target.style.display = 'none' }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <MapPin className="w-8 h-8 text-slate-300" />
            </div>
          )}
          <div className="absolute top-2 left-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roomTypeColor[listing.room_type] ?? 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
              {listing.room_type}
            </span>
          </div>
        </div>
        <div className="p-3">
          <p className="font-semibold text-slate-900 text-sm line-clamp-1">{listing.title}</p>
          <p className="text-amber-600 font-bold text-base mt-0.5">
            ₹{Number(listing.price).toLocaleString('en-IN')}
            <span className="text-xs text-slate-400 font-normal">/mo</span>
          </p>
          <div className="flex items-center gap-1 mt-1">
            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
            <p className="text-xs text-slate-500 line-clamp-1">{listing.area}, {listing.city}</p>
          </div>
          {listing.furnished && (
            <span className="inline-block mt-2 text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
              Furnished
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

function ListingCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-slate-100 animate-pulse">
      <div className="aspect-[4/3] bg-slate-200" />
      <div className="p-3 space-y-2">
        <div className="h-4 bg-slate-200 rounded w-3/4" />
        <div className="h-5 bg-slate-200 rounded w-1/3" />
        <div className="h-3 bg-slate-200 rounded w-1/2" />
      </div>
    </div>
  )
}

export default function HomePage() {
  const [listings, setListings] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [userLat, setUserLat] = useState(null)
  const [userLng, setUserLng] = useState(null)

  const fetchListings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('is_available', true)
        .order('created_at', { ascending: false })
      if (error) throw error
      setListings(data ?? [])
    } catch (err) {
      setError(err?.message ?? 'Failed to load listings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Request geolocation silently
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLat(pos.coords.latitude)
          setUserLng(pos.coords.longitude)
        },
        () => {} // silent failure
      )
    }
    fetchListings()
  }, [fetchListings])

  const filtered = useMemo(() => {
    let result = listings
    if (userLat !== null && userLng !== null) {
      result = filterByDistance(result, userLat, userLng)
    }
    if (search.trim()) {
      result = filterBySearch(result, search.trim())
    }
    return result
  }, [listings, search, userLat, userLng])

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-slate-900">RoomFind</h1>
          {userLat !== null && (
            <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
              <Navigation className="w-3 h-3" />
              <span>Near me</span>
            </div>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            placeholder="Search by city or area..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <ListingCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
            <p className="text-slate-600 text-sm">{error}</p>
            <button
              onClick={fetchListings}
              className="mt-4 text-sm text-amber-600 font-medium underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MapPin className="w-10 h-10 text-slate-300 mb-3" />
            <p className="text-slate-600 font-medium">No listings found</p>
            <p className="text-slate-400 text-sm mt-1">
              {search ? 'Try a different search term' : 'No rooms available in your area yet'}
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-400 mb-3">
              {filtered.length} {filtered.length === 1 ? 'listing' : 'listings'} found
            </p>
            <div className="grid grid-cols-2 gap-3">
              {filtered.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
