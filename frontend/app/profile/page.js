'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { User, Phone, Mail, Home, MapPin, Trash2, LogOut, Loader2, Plus } from 'lucide-react'

function Toast({ message, type = 'error', onDismiss }) {
  if (!message) return null
  const bg = type === 'success' ? 'bg-brand' : 'bg-red-500'
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 ${bg} text-white text-[13px] px-4 py-3 rounded-xl shadow-lg max-w-sm w-full mx-4 flex items-center justify-between gap-3`}>
      <span>{message}</span>
      <button onClick={onDismiss} className="text-white/80 hover:text-white shrink-0">✕</button>
    </div>
  )
}

function ListingItem({ listing, onDelete }) {
  const firstPhoto = listing.photos?.[0] ?? null
  return (
    <div className="flex gap-3 items-start p-3 bg-white rounded-xl border border-black/[0.09]">
      <div className="w-16 h-16 rounded-lg bg-slate-100 overflow-hidden shrink-0">
        {firstPhoto ? (
          <img src={firstPhoto} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <MapPin className="w-5 h-5 text-slate-300" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-900 text-[14px] line-clamp-1">{listing.title}</p>
        <p className="text-brand text-[14px] font-semibold">
          ₹{Number(listing.price).toLocaleString('en-IN')}/mo
        </p>
        <p className="text-slate-400 text-[12px] mt-0.5">{listing.area}, {listing.city}</p>
        <span className={`inline-block mt-1 text-[11px] px-1.5 py-0.5 rounded-full font-medium ${
          listing.status === 'available' ? 'bg-brand-light text-brand' : 'bg-slate-200 text-slate-500'
        }`}>
          {listing.status === 'available' ? 'Available' : 'Taken'}
        </span>
      </div>
      <button onClick={onDelete}
        className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors shrink-0">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}

export default function ProfilePage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [profile, setProfile] = useState(null)
  const [listings, setListings] = useState([])
  const [profileLoading, setProfileLoading] = useState(true)
  const [listingsLoading, setListingsLoading] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = (message, type = 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => {
    if (!authLoading && !user) router.push('/auth')
  }, [authLoading, user, router])

  const fetchProfile = useCallback(async () => {
    if (!user) return
    setProfileLoading(true)
    try {
      const res = await fetch('http://localhost:5000/api/users/profile', {
        headers: { 'Authorization': `Bearer ${user.accessToken}` }
      })
      if (res.ok) {
        const data = await res.json()
        setProfile(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setProfileLoading(false)
    }
  }, [user])

  const fetchListings = useCallback(async () => {
    if (!user) return
    setListingsLoading(true)
    try {
      const res = await fetch('http://localhost:5000/api/users/my-listings', {
        headers: { 'Authorization': `Bearer ${user.accessToken}` }
      })
      if (res.ok) {
        const data = await res.json()
        setListings(data.map(l => ({...l, id: l._id})))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setListingsLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      fetchProfile()
      fetchListings()
    }
  }, [user, fetchProfile, fetchListings])

  const deleteListing = async (id) => {
    if (!window.confirm('Delete this listing? This cannot be undone.')) return
    try {
      const res = await fetch(`http://localhost:5000/api/listings/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${user.accessToken}` }
      })
      if (!res.ok) throw new Error('Failed to delete')
      setListings((prev) => prev.filter((l) => l.id !== id))
      showToast('Listing deleted.', 'success')
    } catch (e) {
      showToast('Failed to delete listing')
    }
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    const { signOut } = await import('next-auth/react')
    await signOut({ callbackUrl: '/auth' })
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#ececea] flex items-center justify-center">
        <Loader2 className="animate-spin w-8 h-8 text-brand" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-[#ececea] pb-24">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-black/[0.09] px-4 py-3">
        <h1 className="font-semibold text-slate-900 text-[16px]">My Profile</h1>
      </div>

      <div className="px-3 pt-3 space-y-3">

        {/* Profile card */}
        <div className="bg-white rounded-2xl p-4 border border-black/[0.09]">
          {profileLoading ? (
            <div className="flex items-center gap-4 animate-pulse">
              <div className="w-16 h-16 rounded-full bg-slate-200 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-40 bg-slate-200 rounded" />
                <div className="h-4 w-32 bg-slate-200 rounded" />
                <div className="h-4 w-24 bg-slate-200 rounded" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-brand-light rounded-full flex items-center justify-center shrink-0 overflow-hidden">
                {profile?.profile_photo ? (
                  <img src={profile.profile_photo} alt="" className="w-full h-full object-cover rounded-full" />
                ) : (
                  <User className="w-8 h-8 text-brand" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 text-[17px]">
                  {profile?.full_name ?? 'No name set'}
                </p>
                <div className="flex items-center gap-1.5 text-slate-500 text-[13px] mt-0.5">
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{user.email}</span>
                </div>
                {profile?.phone_number && (
                  <div className="flex items-center gap-1.5 text-slate-500 text-[13px] mt-0.5">
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    <span>{profile.phone_number}</span>
                  </div>
                )}
                <div className="mt-2">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium capitalize ${
                    profile?.role === 'landlord' ? 'bg-brand-light text-brand' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {profile?.role ?? 'No role'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Landlord listings section */}
        {profile?.role === 'landlord' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 text-[15px]">My Listings</h2>
              <Link href="/create-listing" className="flex items-center gap-1 text-brand text-[13px] font-medium">
                <Plus className="w-4 h-4" />
                Add
              </Link>
            </div>

            {listingsLoading ? (
              <div className="space-y-2 animate-pulse">
                {[1, 2].map((i) => (
                  <div key={i} className="h-24 w-full bg-slate-200 rounded-xl" />
                ))}
              </div>
            ) : listings.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 border border-dashed border-black/[0.09] text-center">
                <Home className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 text-[13px]">No listings yet</p>
                <Link href="/create-listing" className="mt-2 inline-block text-brand text-[13px] font-medium underline underline-offset-2">
                  Post your first room
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {listings.map((listing) => (
                  <ListingItem key={listing.id} listing={listing} onDelete={() => deleteListing(listing.id)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sign out */}
        <button onClick={handleSignOut} disabled={signingOut}
          className="w-full flex items-center justify-center gap-2 py-2.5 border border-red-200 text-red-600 rounded-xl text-[14px] font-medium hover:bg-red-50 transition-colors disabled:opacity-50">
          {signingOut ? <Loader2 className="animate-spin w-4 h-4" /> : <LogOut className="w-4 h-4" />}
          Sign Out
        </button>
      </div>
    </div>
  )
}
