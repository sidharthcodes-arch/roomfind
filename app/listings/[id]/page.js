'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatPrice } from '@/lib/utils'
import {
  ArrowLeft, MapPin, Phone, User, Home, Users, CheckCircle,
  ChevronLeft, ChevronRight
} from 'lucide-react'

const genderLabel = {
  any: 'Any gender',
  male: 'Male only',
  female: 'Female only',
}

const roomTypeColor = {
  single: 'bg-blue-50 text-blue-700',
  shared: 'bg-purple-50 text-purple-700',
  'full apartment': 'bg-green-50 text-green-700',
}

function SkeletonDetail() {
  return (
    <div className="min-h-screen bg-slate-50 pb-24 animate-pulse">
      <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-slate-200" />
        <div className="h-5 w-40 bg-slate-200 rounded" />
      </div>
      <div className="w-full aspect-[16/9] bg-slate-200" />
      <div className="px-4 pt-4 space-y-3">
        <div className="h-6 w-3/4 bg-slate-200 rounded" />
        <div className="h-8 w-1/3 bg-slate-200 rounded" />
        <div className="h-4 w-2/3 bg-slate-200 rounded" />
        <div className="h-20 w-full bg-slate-200 rounded" />
      </div>
    </div>
  )
}

export default function ListingDetailPage({ params }) {
  const { id } = params
  const [listing, setListing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentPhoto, setCurrentPhoto] = useState(0)

  useEffect(() => {
    if (!id) return
    const fetchListing = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('listings')
          .select('*, users(full_name, phone_number)')
          .eq('id', id)
          .single()
        if (error) throw error
        setListing(data)
      } catch (err) {
        setError(err?.message ?? 'Failed to load listing')
      } finally {
        setLoading(false)
      }
    }
    fetchListing()
  }, [id])

  if (loading) return <SkeletonDetail />

  if (error || !listing) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center px-4">
          <p className="text-slate-600 mb-4">{error ?? 'Listing not found'}</p>
          <Link href="/" className="text-amber-600 font-medium underline underline-offset-2">
            Back to listings
          </Link>
        </div>
      </div>
    )
  }

  const photos = listing.photos ?? []

  const prevPhoto = () => setCurrentPhoto((p) => (p - 1 + photos.length) % photos.length)
  const nextPhoto = () => setCurrentPhoto((p) => (p + 1) % photos.length)

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <Link
          href="/"
          className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4 text-slate-600" />
        </Link>
        <h1 className="font-semibold text-slate-900 line-clamp-1 flex-1">{listing.title}</h1>
      </div>

      {/* Photo carousel */}
      {photos.length > 0 ? (
        <div className="relative bg-slate-900 aspect-[16/9] overflow-hidden">
          <img
            src={photos[currentPhoto]}
            alt={`Photo ${currentPhoto + 1}`}
            className="w-full h-full object-cover"
          />
          {/* Counter badge */}
          {photos.length > 1 && (
            <div className="absolute top-3 right-3 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
              {currentPhoto + 1}/{photos.length}
            </div>
          )}
          {/* Arrow buttons */}
          {photos.length > 1 && (
            <>
              <button
                onClick={prevPhoto}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 rounded-full flex items-center justify-center text-white hover:bg-black/60"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={nextPhoto}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 rounded-full flex items-center justify-center text-white hover:bg-black/60"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}
          {/* Dot indicators */}
          {photos.length > 1 && (
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
              {photos.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPhoto(i)}
                  className={`rounded-full transition-all ${
                    i === currentPhoto ? 'bg-white w-3 h-1.5' : 'bg-white/50 w-1.5 h-1.5'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="aspect-[16/9] bg-slate-200 flex items-center justify-center">
          <MapPin className="w-12 h-12 text-slate-400" />
        </div>
      )}

      {/* Thumbnail strip */}
      {photos.length > 1 && (
        <div className="flex gap-2 px-4 py-2 overflow-x-auto bg-white border-b border-slate-100">
          {photos.map((photo, i) => (
            <button
              key={i}
              onClick={() => setCurrentPhoto(i)}
              className={`shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                i === currentPhoto ? 'border-amber-500' : 'border-transparent'
              }`}
            >
              <img src={photo} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="px-4 pt-4 space-y-4">
        {/* Main info card */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100">
          <h2 className="text-lg font-bold text-slate-900 mb-2">{listing.title}</h2>
          <p className="text-2xl font-bold text-amber-600 mb-3">
            ₹{Number(listing.price).toLocaleString('en-IN')}
            <span className="text-sm text-slate-400 font-normal">/month</span>
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${roomTypeColor[listing.room_type] ?? 'bg-slate-100 text-slate-600'}`}>
              {listing.room_type}
            </span>
            {listing.furnished && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-50 text-green-700">
                Furnished
              </span>
            )}
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 capitalize">
              {genderLabel[listing.gender_preference] ?? listing.gender_preference}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500 text-sm">
            <MapPin className="w-4 h-4 text-amber-500 shrink-0" />
            <span>{listing.area}, {listing.city}</span>
          </div>
          {listing.address && (
            <div className="flex items-start gap-1.5 text-slate-400 text-xs mt-1">
              <Home className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{listing.address}</span>
            </div>
          )}
        </div>

        {/* About this room */}
        {listing.description && (
          <div className="bg-white rounded-2xl p-4 border border-slate-100">
            <h3 className="font-semibold text-slate-900 mb-2">About this room</h3>
            <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
              {listing.description}
            </p>
          </div>
        )}

        {/* Room details grid */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100">
          <h3 className="font-semibold text-slate-900 mb-3">Room details</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Home className="w-4 h-4 text-amber-500" />
              <div>
                <p className="text-xs text-slate-400">Type</p>
                <p className="text-sm font-medium text-slate-900 capitalize">{listing.room_type}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-amber-500" />
              <div>
                <p className="text-xs text-slate-400">Furnished</p>
                <p className="text-sm font-medium text-slate-900">{listing.furnished ? 'Yes' : 'No'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-500" />
              <div>
                <p className="text-xs text-slate-400">Gender</p>
                <p className="text-sm font-medium text-slate-900">
                  {genderLabel[listing.gender_preference] ?? listing.gender_preference}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Contact landlord */}
        {listing.users && (
          <div className="bg-white rounded-2xl p-4 border border-slate-100">
            <h3 className="font-semibold text-slate-900 mb-3">Contact landlord</h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-slate-900">
                  {listing.users.full_name ?? 'Landlord'}
                </p>
                {listing.users.phone_number && (
                  <a
                    href={`tel:${listing.users.phone_number}`}
                    className="flex items-center gap-1 text-amber-600 text-sm font-medium mt-0.5"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    {listing.users.phone_number}
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Map */}
        {listing.latitude != null && listing.longitude != null && (
          <div className="bg-white rounded-2xl overflow-hidden border border-slate-100">
            <div className="px-4 py-3 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Location</h3>
            </div>
            <iframe
              src={`https://maps.google.com/maps?q=${listing.latitude},${listing.longitude}&z=15&output=embed`}
              className="w-full h-48 border-0"
              title="Listing location"
              loading="lazy"
            />
          </div>
        )}
      </div>
    </div>
  )
}
