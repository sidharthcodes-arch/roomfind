'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeft, MapPin, Phone, User, Home, Users, CheckCircle,
  ChevronLeft, ChevronRight, Heart, MessageCircle, Share2, Bookmark
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import ShareModal from '@/components/ShareModal'
import ImageLightboxModal from '@/components/ImageLightboxModal'

const genderLabel = {
  any: 'Any gender',
  male: 'Male only',
  female: 'Female only',
}

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function Toast({ message, type = 'success', onDismiss }) {
  if (!message) return null
  const bg = type === 'error' ? 'bg-red-500' : 'bg-brand'
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 ${bg} text-white text-[13px] px-4 py-3 rounded-xl shadow-lg max-w-sm w-full mx-4 flex items-center justify-between gap-3 animate-fade-in`}>
      <span>{message}</span>
      <button onClick={onDismiss} className="text-white/80 hover:text-white shrink-0">✕</button>
    </div>
  )
}

function SkeletonDetail() {
  return (
    <div className="min-h-screen bg-[#ececea] pb-24 animate-pulse">
      <div className="bg-white border-b border-black/[0.09] px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-slate-200" />
        <div className="h-5 w-40 bg-slate-200 rounded" />
      </div>
      <div className="w-full aspect-[4/3] bg-slate-200" />
      <div className="px-3 pt-3 space-y-3">
        <div className="bg-white rounded-2xl p-4 space-y-3">
          <div className="h-6 w-3/4 bg-slate-200 rounded" />
          <div className="h-8 w-1/3 bg-slate-200 rounded" />
          <div className="h-4 w-2/3 bg-slate-200 rounded" />
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
    if (!user) return
    const next = !liked
    setLiked(next)
    setLikeCount((c) => c + (next ? 1 : -1))
    if (next) {
      await supabase.from('listing_likes').insert({ listing_id: id, user_id: user.id })
    } else {
      await supabase.from('listing_likes').delete().eq('listing_id', id).eq('user_id', user.id)
    }
  }

  if (loading) return <SkeletonDetail />

  if (error || !listing) {
    return (
      <div className="min-h-screen bg-[#ececea] flex items-center justify-center">
        <div className="text-center px-4">
          <p className="text-slate-600 mb-4">{error ?? 'Listing not found'}</p>
          <Link href="/" className="text-brand font-medium underline underline-offset-2">
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

  const whatsappHref = listing.users?.phone_number
    ? `https://wa.me/${listing.users.phone_number.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi, I saw your listing "${listing.title}" on RoomFind. Is it still available?`)}`
    : null

  return (
    <div className="min-h-screen bg-[#ececea] pb-24 max-w-lg mx-auto relative border-x border-black/[0.05]">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-black/[0.09] px-4 py-3 flex items-center gap-3">
        <Link href="/" className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-slate-600" />
        </Link>
        <h1 className="font-semibold text-slate-900 text-[16px] line-clamp-1 flex-1">{listing.title}</h1>
      </div>

      {/* Photo carousel */}
      {photos.length > 0 ? (
        <div className="relative bg-slate-900 aspect-[4/3] overflow-hidden cursor-pointer" onClick={() => setIsLightboxOpen(true)}>
          <img src={photos[currentPhoto]} alt={`Photo ${currentPhoto + 1}`} className="w-full h-full object-cover" />

          {/* Status badge */}
          <div className="absolute top-3 left-3 flex gap-1.5">
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${isTaken ? 'bg-slate-700 text-white' : 'bg-brand text-white'}`}>
              {isTaken ? 'Taken' : 'Available'}
            </span>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-black/40 text-white capitalize">
              {listing.room_type}
            </span>
          </div>

          {photos.length > 1 && (
            <div className="absolute top-3 right-3 bg-black/50 text-white text-[11px] px-2 py-0.5 rounded-full">
              {currentPhoto + 1}/{photos.length}
            </div>
          )}
          {photos.length > 1 && (
            <>
              <button onClick={prevPhoto}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 rounded-full flex items-center justify-center text-white hover:bg-black/60">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={nextPhoto}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 rounded-full flex items-center justify-center text-white hover:bg-black/60">
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}
          {photos.length > 1 && (
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
              {photos.map((_, i) => (
                <button key={i} onClick={() => setCurrentPhoto(i)}
                  className={`rounded-full transition-all ${i === currentPhoto ? 'bg-white w-3 h-1.5' : 'bg-white/50 w-1.5 h-1.5'}`} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="aspect-[4/3] bg-slate-200 flex items-center justify-center">
          <MapPin className="w-12 h-12 text-slate-400" />
        </div>
      )}

      {/* Thumbnail strip */}
      {photos.length > 1 && (
        <div className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-hide bg-white border-b border-black/[0.09]">
          {photos.map((photo, i) => (
            <button key={i} onClick={() => setCurrentPhoto(i)}
              className={`shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all ${i === currentPhoto ? 'border-brand' : 'border-transparent'}`}>
              <img src={photo} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="px-3 pt-3 space-y-3">

        {/* Owner row */}
        <div className="bg-white rounded-2xl p-4 border border-black/[0.09] flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-brand-light flex items-center justify-center shrink-0 overflow-hidden">
            {listing.users?.profile_photo ? (
              <img src={listing.users.profile_photo} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-brand font-bold text-sm">{initials(ownerName)}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-[14px] text-slate-900">{ownerName}</span>
              <span className="flex items-center gap-0.5 text-[11px] font-medium text-brand bg-brand-light px-1.5 py-0.5 rounded-full shrink-0">
                <CheckCircle className="w-3 h-3" />
                Owner
              </span>
            </div>
            <p className="text-[12px] text-slate-400">{listing.area} · {timeAgo(listing.created_at)}</p>
          </div>
        </div>

        {/* Price + details */}
        <div className="bg-white rounded-2xl p-4 border border-black/[0.09]">
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-[24px] font-bold text-slate-900">₹{Number(listing.price).toLocaleString('en-IN')}</span>
            <span className="text-[13px] text-slate-400">/month</span>
          </div>
          <p className="text-[15px] font-semibold text-slate-800 mb-2">{listing.title}</p>
          <div className="flex items-center gap-1.5 mb-3">
            <MapPin className="w-3.5 h-3.5 text-brand shrink-0" />
            <span className="text-[13px] text-slate-500">{listing.area}, {listing.city}</span>
          </div>
          {listing.address && (
            <div className="flex items-start gap-1.5 mb-3">
              <Home className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span className="text-[12px] text-slate-400">{listing.address}</span>
            </div>
          )}
          {/* Tags */}
          <div className="flex flex-wrap gap-1.5">
            {listing.furnished && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-brand-light text-brand font-medium">Furnished</span>
            )}
            {listing.gender_preference && listing.gender_preference !== 'any' && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                {genderLabel[listing.gender_preference]}
              </span>
            )}
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">No broker</span>
          </div>
        </div>

        {/* About */}
        {listing.description && (
          <div className="bg-white rounded-2xl p-4 border border-black/[0.09]">
            <h3 className="font-semibold text-slate-900 text-[15px] mb-2">About this room</h3>
            <p className="text-slate-600 text-[14px] leading-relaxed whitespace-pre-wrap">{listing.description}</p>
          </div>
        )}

        {/* Room details grid */}
        <div className="bg-white rounded-2xl p-4 border border-black/[0.09]">
          <h3 className="font-semibold text-slate-900 text-[15px] mb-3">Room details</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col items-center gap-1 p-3 bg-slate-50 rounded-xl">
              <Home className="w-4 h-4 text-brand" />
              <p className="text-[11px] text-slate-400">Type</p>
              <p className="text-[12px] font-semibold text-slate-900 capitalize text-center">{listing.room_type}</p>
            </div>
            <div className="flex flex-col items-center gap-1 p-3 bg-slate-50 rounded-xl">
              <CheckCircle className="w-4 h-4 text-brand" />
              <p className="text-[11px] text-slate-400">Furnished</p>
              <p className="text-[12px] font-semibold text-slate-900">{listing.furnished ? 'Yes' : 'No'}</p>
            </div>
            <div className="flex flex-col items-center gap-1 p-3 bg-slate-50 rounded-xl">
              <Users className="w-4 h-4 text-brand" />
              <p className="text-[11px] text-slate-400">Gender</p>
              <p className="text-[12px] font-semibold text-slate-900 text-center capitalize">
                {listing.gender_preference === 'any' ? 'Any' : listing.gender_preference === 'male' ? 'Male' : 'Female'}
              </p>
            </div>
          </div>
        </div>

        {/* Action row */}
        <div className="bg-white rounded-2xl border border-black/[0.09] flex items-center px-3 py-1">
          <button onClick={handleLike}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
            <Heart className={`w-5 h-5 transition-colors ${liked ? 'fill-coral text-coral' : 'text-slate-400'}`} />
            <span className={`text-[13px] font-medium ${liked ? 'text-coral' : 'text-slate-500'}`}>{likeCount}</span>
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
            <MessageCircle className="w-5 h-5 text-slate-400" />
            <span className="text-[13px] font-medium text-slate-500">Comment</span>
          </button>
          <button onClick={handleShare} className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
            <Share2 className="w-5 h-5 text-slate-400" />
            <span className="text-[13px] font-medium text-slate-500">Share</span>
          </button>
          <button onClick={() => setSaved((s) => !s)}
            className="ml-auto flex items-center justify-center w-9 h-9 rounded-xl hover:bg-slate-50 transition-colors">
            <Bookmark className={`w-5 h-5 ${saved ? 'fill-brand text-brand' : 'text-slate-400'}`} />
          </button>
        </div>

        {/* Contact / WhatsApp */}
        {listing.users && (
          <div className="bg-white rounded-2xl p-4 border border-black/[0.09]">
            <h3 className="font-semibold text-slate-900 text-[15px] mb-3">Contact landlord</h3>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-brand-light rounded-full flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-brand" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900 text-[14px]">{ownerName}</p>
                {listing.users.phone_number && (
                  <a href={`tel:${listing.users.phone_number}`}
                    className="flex items-center gap-1 text-brand text-[13px] font-medium mt-0.5">
                    <Phone className="w-3.5 h-3.5" />
                    {listing.users.phone_number}
                  </a>
                )}
              </div>
            </div>

            {isTaken ? (
              <div className="flex items-center justify-center w-full py-2.5 rounded-xl bg-slate-200 text-slate-500 font-semibold text-[14px] cursor-not-allowed select-none">
                Room no longer available
              </div>
            ) : whatsappHref ? (
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-brand text-white font-semibold text-[14px] active:opacity-90 transition-opacity">
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
        )}

        {/* Map */}
        {listing.latitude != null && listing.longitude != null && (
          <div className="bg-white rounded-2xl overflow-hidden border border-black/[0.09]">
            <div className="px-4 py-3 border-b border-black/[0.09]">
              <h3 className="font-semibold text-slate-900 text-[15px]">Location</h3>
            </div>
            <iframe
              src={`https://maps.google.com/maps?q=${listing.latitude},${listing.longitude}&z=15&output=embed`}
              className="w-full h-48 border-0" title="Listing location" loading="lazy" />
          </div>
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
