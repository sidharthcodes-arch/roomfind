'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { User, Phone, Mail, Home, MapPin, Trash2, LogOut, Loader2, Plus, Pencil, Camera, X, Check } from 'lucide-react'
import CountryPhoneInput from '@/components/CountryPhoneInput'

function Toast({ message, type = 'error', onDismiss }) {
  if (!message) return null
  const bg = type === 'success' ? 'bg-brand' : 'bg-red-500'
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 ${bg} text-white text-[13px] px-4 py-3 rounded-xl shadow-lg max-w-sm w-full mx-4 flex items-center justify-between gap-3 animate-fade-in`}>
      <span>{message}</span>
      <button onClick={onDismiss} className="text-white/80 hover:text-white shrink-0">✕</button>
    </div>
  )
}

function ListingItem({ listing, onDelete, onToggleStatus }) {
  const firstPhoto = listing.photos?.[0] ?? null
  const isAvailable = listing.status !== 'taken'

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
        <div className="flex items-center gap-2 mt-2">
          <button
            type="button"
            onClick={onToggleStatus}
            className={`text-[11px] px-2.5 py-1 rounded-full font-semibold transition-all ${
              isAvailable
                ? 'bg-brand-light text-brand border border-brand/20 hover:bg-brand/20'
                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
            }`}
          >
            {isAvailable ? '✓ Available (Tap to Mark Taken)' : '✕ Taken (Tap to Mark Available)'}
          </button>
        </div>
      </div>
      <button
        onClick={onDelete}
        className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors shrink-0"
      >
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

  // Edit Profile modal state
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editRole, setEditRole] = useState('seeker')
  const [editPhoto, setEditPhoto] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const fileInputRef = useRef(null)

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
    const { data } = await supabase.from('users').select('*').eq('id', user.id).single()
    setProfile(data ?? null)
    setProfileLoading(false)
  }, [user])

  const fetchListings = useCallback(async () => {
    if (!user) return
    setListingsLoading(true)
    const { data } = await supabase.from('listings').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setListings(data ?? [])
    setListingsLoading(false)
  }, [user])

  useEffect(() => {
    if (user) {
      fetchProfile()
      fetchListings()
    }
  }, [user, fetchProfile, fetchListings])

  const openEditModal = () => {
    setEditName(profile?.full_name ?? '')
    setEditPhone(profile?.phone_number ?? '')
    setEditRole(profile?.role ?? 'seeker')
    setEditPhoto(profile?.profile_photo ?? '')
    setIsEditing(true)
  }

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image size must be under 5MB')
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => {
      setEditPhoto(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    if (!editName.trim()) {
      showToast('Full name is required')
      return
    }
    setSavingProfile(true)
    try {
      const updates = {
        id: user.id,
        full_name: editName.trim(),
        phone_number: editPhone.trim(),
        role: editRole,
        profile_photo: editPhoto,
        updated_at: new Date().toISOString(),
      }
      const { error } = await supabase.from('users').upsert(updates)
      if (error) throw error

      setProfile((prev) => ({ ...prev, ...updates }))
      setIsEditing(false)
      showToast('Profile updated successfully!', 'success')
    } catch (err) {
      console.error('Profile update error:', err)
      showToast(err?.message ?? 'Failed to update profile')
    } finally {
      setSavingProfile(false)
    }
  }

  const toggleListingStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === 'taken' ? 'available' : 'taken'
    const { error } = await supabase.from('listings').update({ status: nextStatus }).eq('id', id)
    if (error) {
      showToast('Failed to update room status')
    } else {
      setListings((prev) => prev.map((l) => l.id === id ? { ...l, status: nextStatus } : l))
      showToast(`Listing marked as ${nextStatus === 'taken' ? 'Taken' : 'Available'}.`, 'success')
    }
  }

  const deleteListing = async (id) => {
    if (!window.confirm('Delete this listing? This cannot be undone.')) return
    const { error } = await supabase.from('listings').delete().eq('id', id)
    if (error) {
      showToast('Failed to delete listing')
    } else {
      setListings((prev) => prev.filter((l) => l.id !== id))
      showToast('Listing deleted.', 'success')
    }
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/auth')
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
    <div className="min-h-screen bg-[#ececea] pb-24 max-w-lg mx-auto relative shadow-sm border-x border-black/[0.05]">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-black/[0.09] px-4 py-3 flex items-center justify-between">
        <h1 className="font-semibold text-slate-900 text-[16px]">My Profile</h1>
        <button
          onClick={openEditModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-light text-brand text-xs font-semibold hover:bg-brand/20 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit Profile
        </button>
      </div>

      <div className="px-3 pt-3 space-y-3">

        {/* Profile card */}
        <div className="bg-white rounded-2xl p-4 border border-black/[0.09] relative group">
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
              <div className="w-16 h-16 bg-brand-light rounded-full flex items-center justify-center shrink-0 overflow-hidden border border-black/10">
                {profile?.profile_photo ? (
                  <img src={profile.profile_photo} alt="" className="w-full h-full object-cover rounded-full" />
                ) : (
                  <User className="w-8 h-8 text-brand" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-slate-900 text-[17px] truncate">
                    {profile?.full_name ?? 'No name set'}
                  </p>
                </div>
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
                    {profile?.role === 'landlord' ? 'Property Owner / Landlord' : 'Room Seeker'}
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
                  <ListingItem
                    key={listing.id}
                    listing={listing}
                    onDelete={() => deleteListing(listing.id)}
                    onToggleStatus={() => toggleListingStatus(listing.id, listing.status)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full flex items-center justify-center gap-2 py-2.5 border border-red-200 text-red-600 rounded-xl text-[14px] font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          {signingOut ? <Loader2 className="animate-spin w-4 h-4" /> : <LogOut className="w-4 h-4" />}
          Sign Out
        </button>
      </div>

      {/* ── Edit Profile Modal ── */}
      {isEditing && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-xl border border-black/10 relative">
            <div className="flex items-center justify-between border-b border-black/[0.08] pb-3">
              <h2 className="font-bold text-slate-900 text-[16px]">Edit Profile</h2>
              <button
                onClick={() => setIsEditing(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Photo upload */}
              <div className="flex flex-col items-center gap-2">
                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <div className="w-20 h-20 rounded-full bg-brand-light flex items-center justify-center overflow-hidden border-2 border-brand/30 shadow-sm">
                    {editPhoto ? (
                      <img src={editPhoto} alt="Profile preview" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-10 h-10 text-brand" />
                    )}
                  </div>
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div className="absolute bottom-0 right-0 w-6 h-6 bg-brand text-white rounded-full flex items-center justify-center shadow-md border border-white">
                    <Camera className="w-3.5 h-3.5" />
                  </div>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handlePhotoSelect}
                  accept="image/*"
                  className="hidden"
                />
                <span className="text-[12px] text-slate-400 font-medium">Tap photo to change</span>
              </div>

              {/* Name */}
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-[14px] text-slate-900 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                  required
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1">Phone Number (WhatsApp)</label>
                <CountryPhoneInput
                  value={editPhone}
                  onChange={(val) => setEditPhone(val)}
                  placeholder="9876543210"
                />
                <p className="text-[11px] text-slate-400 mt-1">Select your country code and enter your WhatsApp contact number.</p>
              </div>

              {/* Role Toggle */}
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1">Account Type</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setEditRole('seeker')}
                    className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                      editRole === 'seeker'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Room Seeker
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditRole('landlord')}
                    className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                      editRole === 'landlord'
                        ? 'bg-brand text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Landlord / Owner
                  </button>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-[13px] hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="flex-1 py-2.5 rounded-xl bg-brand text-white font-semibold text-[13px] hover:bg-brand/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {savingProfile ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
