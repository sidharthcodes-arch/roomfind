'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { sanitizeFilename } from '@/lib/utils'
import { ArrowLeft, Upload, MapPin, X, Loader2 } from 'lucide-react'

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

// Shared input classes
const inputBase = 'w-full px-3 py-2.5 border rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent'
const inputNormal = `${inputBase} border-black/[0.09] bg-white`
const inputError  = `${inputBase} border-red-400 bg-red-50`

export default function CreateListingPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const fileInputRef = useRef(null)

  const [userRole, setUserRole] = useState(null)
  const [roleLoading, setRoleLoading] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [city, setCity] = useState('')
  const [area, setArea] = useState('')
  const [address, setAddress] = useState('')
  const [roomType, setRoomType] = useState('single')
  const [furnished, setFurnished] = useState(false)
  const [genderPreference, setGenderPreference] = useState('any')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [photoFiles, setPhotoFiles] = useState([])
  const [photoPreviews, setPhotoPreviews] = useState([])

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [errors, setErrors] = useState({})
  const [toast, setToast] = useState(null)

  const showToast = (message, type = 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => {
    if (!authLoading && !user) router.push('/auth')
  }, [authLoading, user, router])

  useEffect(() => {
    if (!user) return
    setRoleLoading(true)
    supabase.from('users').select('role').eq('id', user.id).single()
      .then(({ data }) => { setUserRole(data?.role ?? null); setRoleLoading(false) })
  }, [user])

  const handlePhotos = (e) => {
    const files = Array.from(e.target.files ?? [])
    const combined = [...photoFiles, ...files].slice(0, 5)
    setPhotoFiles(combined)
    setPhotoPreviews(combined.map((f) => URL.createObjectURL(f)))
    e.target.value = ''
  }

  const removePhoto = (index) => {
    setPhotoFiles(photoFiles.filter((_, i) => i !== index))
    setPhotoPreviews(photoPreviews.filter((_, i) => i !== index))
  }

  const useMyLocation = () => {
    if (!navigator.geolocation) { showToast('Geolocation not supported.'); return }
    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLatitude(String(pos.coords.latitude)); setLongitude(String(pos.coords.longitude)); setIsLocating(false) },
      () => { setIsLocating(false); showToast('Could not get location.') }
    )
  }

  const validate = () => {
    const e = {}
    if (!title.trim() || title.trim().length < 5) e.title = 'Title must be at least 5 characters'
    if (!price || isNaN(Number(price)) || Number(price) <= 0) e.price = 'Enter a valid price greater than 0'
    if (!city.trim()) e.city = 'City is required'
    if (!area.trim()) e.area = 'Area is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const uploadPhotos = async () => {
    const urls = []
    for (const file of photoFiles) {
      const path = `${user.id}/${Date.now()}-${sanitizeFilename(file.name)}`
      const { data, error } = await supabase.storage.from('listing-photos').upload(path, file)
      if (error) throw error
      const { data: urlData } = supabase.storage.from('listing-photos').getPublicUrl(data.path)
      urls.push(urlData.publicUrl)
    }
    return urls
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setIsSubmitting(true)
    try {
      await supabase.from('users').upsert({ id: user.id, email: user.email }, { onConflict: 'id', ignoreDuplicates: true })
      const photoUrls = photoFiles.length > 0 ? await uploadPhotos() : []
      const { error } = await supabase.from('listings').insert({
        title: title.trim(), description: description.trim() || null,
        price: Number(price), city: city.trim(), area: area.trim(),
        address: address.trim() || null,
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null,
        room_type: roomType, furnished, gender_preference: genderPreference,
        user_id: user.id, photos: photoUrls, is_available: true, status: 'available',
      })
      if (error) throw error
      showToast('Listing posted! Your room is now live.', 'success')
      setTimeout(() => router.push('/profile'), 1500)
    } catch (err) {
      showToast(err?.message ?? 'Failed to post listing')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-[#ececea] flex items-center justify-center">
        <Loader2 className="animate-spin w-8 h-8 text-brand" />
      </div>
    )
  }

  if (!user) return null

  if (userRole === 'tenant') {
    return (
      <div className="min-h-screen bg-[#ececea] flex items-center justify-center p-4">
        <div className="text-center max-w-xs bg-white rounded-2xl border border-black/[0.09] p-8">
          <div className="w-12 h-12 bg-brand-light rounded-full flex items-center justify-center mx-auto mb-4">
            <MapPin className="w-6 h-6 text-brand" />
          </div>
          <h2 className="font-bold text-slate-900 mb-2">Landlords only</h2>
          <p className="text-slate-500 text-[13px] mb-4">Only landlord accounts can post listings.</p>
          <Link href="/" className="text-brand font-medium underline underline-offset-2 text-[13px]">
            Back to listings
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#ececea] pb-24">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-black/[0.09] px-4 py-3 flex items-center gap-3">
        <Link href="/" className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-slate-600" />
        </Link>
        <h1 className="font-semibold text-slate-900 text-[16px]">Post a Room</h1>
      </div>

      <div className="px-3 pt-3">
        <form onSubmit={handleSubmit} className="space-y-3" noValidate>

          {/* Basic info */}
          <div className="bg-white rounded-2xl p-4 border border-black/[0.09] space-y-4">
            <h2 className="font-semibold text-slate-900 text-[15px]">Basic info</h2>

            <div>
              <label className="block text-[13px] font-medium text-slate-700 mb-1">Title</label>
              <input type="text" placeholder="e.g. Cozy single room in Koramangala"
                value={title} onChange={(e) => setTitle(e.target.value)}
                className={errors.title ? inputError : inputNormal} />
              {errors.title && <p className="text-red-500 text-[12px] mt-1">{errors.title}</p>}
            </div>

            <div>
              <label className="block text-[13px] font-medium text-slate-700 mb-1">
                Description <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea placeholder="Describe the room, amenities, rules..."
                value={description} onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2.5 border border-black/[0.09] rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent resize-none bg-white" />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-slate-700 mb-1">Monthly rent (₹)</label>
              <input type="number" placeholder="12000" value={price} min="1"
                onChange={(e) => setPrice(e.target.value)}
                className={errors.price ? inputError : inputNormal} />
              {errors.price && <p className="text-red-500 text-[12px] mt-1">{errors.price}</p>}
            </div>
          </div>

          {/* Room details */}
          <div className="bg-white rounded-2xl p-4 border border-black/[0.09] space-y-4">
            <h2 className="font-semibold text-slate-900 text-[15px]">Room details</h2>

            <div>
              <label className="block text-[13px] font-medium text-slate-700 mb-1">Room type</label>
              <select value={roomType} onChange={(e) => setRoomType(e.target.value)}
                className="w-full px-3 py-2.5 border border-black/[0.09] rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-brand bg-white">
                <option value="single">Single</option>
                <option value="shared">Shared</option>
                <option value="full apartment">Full Apartment</option>
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-slate-700 mb-1">Gender preference</label>
              <select value={genderPreference} onChange={(e) => setGenderPreference(e.target.value)}
                className="w-full px-3 py-2.5 border border-black/[0.09] rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-brand bg-white">
                <option value="any">Any</option>
                <option value="male">Male only</option>
                <option value="female">Female only</option>
              </select>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={furnished} onChange={(e) => setFurnished(e.target.checked)}
                className="w-4 h-4 rounded accent-brand" />
              <span className="text-[14px] text-slate-700">Furnished</span>
            </label>
          </div>

          {/* Location */}
          <div className="bg-white rounded-2xl p-4 border border-black/[0.09] space-y-4">
            <h2 className="font-semibold text-slate-900 text-[15px]">Location</h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[13px] font-medium text-slate-700 mb-1">City</label>
                <input type="text" placeholder="Bangalore" value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className={errors.city ? inputError : inputNormal} />
                {errors.city && <p className="text-red-500 text-[12px] mt-1">{errors.city}</p>}
              </div>
              <div>
                <label className="block text-[13px] font-medium text-slate-700 mb-1">Area</label>
                <input type="text" placeholder="Koramangala" value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className={errors.area ? inputError : inputNormal} />
                {errors.area && <p className="text-red-500 text-[12px] mt-1">{errors.area}</p>}
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-slate-700 mb-1">
                Full address <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input type="text" placeholder="123, 5th Cross, Block 3..." value={address}
                onChange={(e) => setAddress(e.target.value)} className={inputNormal} />
            </div>

            <button type="button" onClick={useMyLocation} disabled={isLocating}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-black/[0.09] rounded-xl text-[13px] text-slate-600 hover:border-brand hover:text-brand transition-colors disabled:opacity-50">
              {isLocating ? <Loader2 className="animate-spin w-4 h-4" /> : <MapPin className="w-4 h-4" />}
              Use my current location
            </button>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[13px] font-medium text-slate-700 mb-1">
                  Latitude <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input type="number" step="any" placeholder="12.9716" value={latitude}
                  onChange={(e) => setLatitude(e.target.value)} className={inputNormal} />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-slate-700 mb-1">
                  Longitude <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input type="number" step="any" placeholder="77.5946" value={longitude}
                  onChange={(e) => setLongitude(e.target.value)} className={inputNormal} />
              </div>
            </div>
          </div>

          {/* Photos */}
          <div className="bg-white rounded-2xl p-4 border border-black/[0.09] space-y-3">
            <h2 className="font-semibold text-slate-900 text-[15px]">
              Photos <span className="text-slate-400 font-normal text-[13px]">(up to 5)</span>
            </h2>

            {photoPreviews.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {photoPreviews.map((preview, i) => (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100">
                    <img src={preview} alt="" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center">
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {photoFiles.length < 5 && (
              <>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotos} />
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-black/[0.09] rounded-xl py-6 flex flex-col items-center gap-2 text-slate-400 hover:border-brand hover:text-brand transition-colors">
                  <Upload className="w-5 h-5" />
                  <span className="text-[13px]">Upload photos</span>
                </button>
              </>
            )}
          </div>

          {/* Submit */}
          <button type="submit" disabled={isSubmitting}
            className="w-full bg-brand hover:opacity-90 text-white font-semibold py-3 rounded-xl transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 text-[15px]">
            {isSubmitting && <Loader2 className="animate-spin w-4 h-4" />}
            Post Listing
          </button>
        </form>
      </div>
    </div>
  )
}
