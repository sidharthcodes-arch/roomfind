'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { sanitizeFilename } from '@/lib/utils'
import { ArrowLeft, Upload, MapPin, X, Loader2, Save, Check } from 'lucide-react'

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

const inputBase = 'w-full px-3 py-2.5 border rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent'
const inputNormal = `${inputBase} border-black/[0.09] bg-white`
const inputError  = `${inputBase} border-red-400 bg-red-50`

export default function EditListingPage({ params }) {
  const { id } = params
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const fileInputRef = useRef(null)

  const [fetchingListing, setFetchingListing] = useState(true)
  const [fetchError, setFetchError] = useState(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [city, setCity] = useState('')
  const [area, setArea] = useState('')
  const [address, setAddress] = useState('')
  const [roomType, setRoomType] = useState('single')
  const [furnished, setFurnished] = useState(false)
  const [genderPreference, setGenderPreference] = useState('any')
  const [status, setStatus] = useState('available')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  
  // Photos handling: existing URLs + new File objects
  const [existingPhotos, setExistingPhotos] = useState([])
  const [newPhotoFiles, setNewPhotoFiles] = useState([])
  const [newPhotoPreviews, setNewPhotoPreviews] = useState([])

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

  // Fetch listing data for editing
  useEffect(() => {
    if (!id || !user) return
    const loadListing = async () => {
      setFetchingListing(true)
      try {
        const { data, error } = await supabase
          .from('listings')
          .select('*')
          .eq('id', id)
          .single()

        if (error) throw error
        if (!data) throw new Error('Listing not found')
        
        if (data.user_id !== user.id) {
          throw new Error('You do not have permission to edit this listing')
        }

        setTitle(data.title ?? '')
        setDescription(data.description ?? '')
        setPrice(data.price ? String(data.price) : '')
        setCity(data.city ?? '')
        setArea(data.area ?? '')
        setAddress(data.address ?? '')
        setRoomType(data.room_type ?? 'single')
        setFurnished(Boolean(data.furnished))
        setGenderPreference(data.gender_preference ?? 'any')
        setStatus(data.status ?? 'available')
        setLatitude(data.latitude != null ? String(data.latitude) : '')
        setLongitude(data.longitude != null ? String(data.longitude) : '')
        setExistingPhotos(data.photos ?? [])
      } catch (err) {
        console.error('Error fetching listing for edit:', err)
        setFetchError(err?.message ?? 'Failed to load listing details')
      } finally {
        setFetchingListing(false)
      }
    }

    loadListing()
  }, [id, user])

  const totalPhotoCount = existingPhotos.length + newPhotoFiles.length

  const handlePhotosSelect = (e) => {
    const files = Array.from(e.target.files ?? [])
    const availableSlots = 5 - totalPhotoCount
    if (availableSlots <= 0) return

    const selectFiles = files.slice(0, availableSlots)
    const combinedFiles = [...newPhotoFiles, ...selectFiles]
    const combinedPreviews = combinedFiles.map((f) => URL.createObjectURL(f))

    setNewPhotoFiles(combinedFiles)
    setNewPhotoPreviews(combinedPreviews)
    e.target.value = ''
  }

  const removeExistingPhoto = (index) => {
    setExistingPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  const removeNewPhoto = (index) => {
    setNewPhotoFiles((prev) => prev.filter((_, i) => i !== index))
    setNewPhotoPreviews((prev) => prev.filter((_, i) => i !== index))
  }

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser')
      return
    }
    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(String(pos.coords.latitude))
        setLongitude(String(pos.coords.longitude))
        setIsLocating(false)
        showToast('Location coordinates updated!', 'success')
      },
      () => {
        setIsLocating(false)
        showToast('Could not retrieve current location')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
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

  const uploadNewPhotos = async () => {
    const uploadedUrls = []
    for (const file of newPhotoFiles) {
      const path = `${user.id}/${Date.now()}-${sanitizeFilename(file.name)}`
      const { data, error } = await supabase.storage.from('listing-photos').upload(path, file)
      if (error) throw error
      const { data: urlData } = supabase.storage.from('listing-photos').getPublicUrl(data.path)
      uploadedUrls.push(urlData.publicUrl)
    }
    return uploadedUrls
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setIsSubmitting(true)
    try {
      const uploadedUrls = newPhotoFiles.length > 0 ? await uploadNewPhotos() : []
      const finalPhotos = [...existingPhotos, ...uploadedUrls]
      const isAvailable = status === 'available'

      const updates = {
        title: title.trim(),
        description: description.trim() || null,
        price: Number(price),
        city: city.trim(),
        area: area.trim(),
        address: address.trim() || null,
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null,
        room_type: roomType,
        furnished,
        gender_preference: genderPreference,
        status,
        is_available: isAvailable,
        photos: finalPhotos,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from('listings')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error

      showToast('Listing updated successfully!', 'success')
      setTimeout(() => router.push('/profile'), 1200)
    } catch (err) {
      console.error('Error updating listing:', err)
      showToast(err?.message ?? 'Failed to update listing')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (authLoading || fetchingListing) {
    return (
      <div className="min-h-screen bg-[#ececea] flex items-center justify-center">
        <Loader2 className="animate-spin w-8 h-8 text-brand" />
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="min-h-screen bg-[#ececea] flex items-center justify-center p-4">
        <div className="text-center max-w-xs bg-white rounded-2xl border border-black/[0.09] p-8">
          <p className="text-slate-700 font-medium mb-4">{fetchError}</p>
          <Link href="/profile" className="text-brand font-semibold underline underline-offset-2 text-[13px]">
            Back to My Profile
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#ececea] pb-24 max-w-lg mx-auto relative shadow-sm border-x border-black/[0.05]">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-black/[0.09] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/profile" className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </Link>
          <h1 className="font-semibold text-slate-900 text-[16px]">Edit Listing</h1>
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand text-white text-xs font-semibold hover:bg-brand/90 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save
        </button>
      </div>

      <div className="px-3 pt-3">
        <form onSubmit={handleSubmit} className="space-y-3" noValidate>

          {/* Status availability toggle */}
          <div className="bg-white rounded-2xl p-4 border border-black/[0.09] space-y-2">
            <label className="block text-[13px] font-semibold text-slate-900">Listing Status</label>
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setStatus('available')}
                className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                  status === 'available'
                    ? 'bg-brand text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                ✓ Available
              </button>
              <button
                type="button"
                onClick={() => setStatus('taken')}
                className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                  status === 'taken'
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                ✕ Marked Taken
              </button>
            </div>
          </div>

          {/* Basic info */}
          <div className="bg-white rounded-2xl p-4 border border-black/[0.09] space-y-4">
            <h2 className="font-semibold text-slate-900 text-[15px]">Basic info</h2>

            <div>
              <label className="block text-[13px] font-medium text-slate-700 mb-1">Title</label>
              <input
                type="text"
                placeholder="e.g. Cozy single room in Koramangala"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={errors.title ? inputError : inputNormal}
              />
              {errors.title && <p className="text-red-500 text-[12px] mt-1">{errors.title}</p>}
            </div>

            <div>
              <label className="block text-[13px] font-medium text-slate-700 mb-1">
                Description <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea
                placeholder="Describe the room, amenities, rules..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2.5 border border-black/[0.09] rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent resize-none bg-white"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-slate-700 mb-1">Monthly rent (₹)</label>
              <input
                type="number"
                placeholder="12000"
                value={price}
                min="1"
                onChange={(e) => setPrice(e.target.value)}
                className={errors.price ? inputError : inputNormal}
              />
              {errors.price && <p className="text-red-500 text-[12px] mt-1">{errors.price}</p>}
            </div>
          </div>

          {/* Room details */}
          <div className="bg-white rounded-2xl p-4 border border-black/[0.09] space-y-4">
            <h2 className="font-semibold text-slate-900 text-[15px]">Room details</h2>

            <div>
              <label className="block text-[13px] font-medium text-slate-700 mb-1">Room type</label>
              <select
                value={roomType}
                onChange={(e) => setRoomType(e.target.value)}
                className="w-full px-3 py-2.5 border border-black/[0.09] rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-brand bg-white"
              >
                <option value="single">Single</option>
                <option value="shared">Shared</option>
                <option value="full apartment">Full Apartment</option>
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-slate-700 mb-1">Gender preference</label>
              <select
                value={genderPreference}
                onChange={(e) => setGenderPreference(e.target.value)}
                className="w-full px-3 py-2.5 border border-black/[0.09] rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-brand bg-white"
              >
                <option value="any">Any</option>
                <option value="male">Male only</option>
                <option value="female">Female only</option>
              </select>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={furnished}
                onChange={(e) => setFurnished(e.target.checked)}
                className="w-4 h-4 rounded accent-brand"
              />
              <span className="text-[14px] text-slate-700 font-medium">Furnished</span>
            </label>
          </div>

          {/* Location */}
          <div className="bg-white rounded-2xl p-4 border border-black/[0.09] space-y-4">
            <h2 className="font-semibold text-slate-900 text-[15px]">Location</h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[13px] font-medium text-slate-700 mb-1">City</label>
                <input
                  type="text"
                  placeholder="Bangalore"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className={errors.city ? inputError : inputNormal}
                />
                {errors.city && <p className="text-red-500 text-[12px] mt-1">{errors.city}</p>}
              </div>
              <div>
                <label className="block text-[13px] font-medium text-slate-700 mb-1">Area</label>
                <input
                  type="text"
                  placeholder="Koramangala"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className={errors.area ? inputError : inputNormal}
                />
                {errors.area && <p className="text-red-500 text-[12px] mt-1">{errors.area}</p>}
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-slate-700 mb-1">
                Full address <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="123, 5th Cross, Block 3..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={inputNormal}
              />
            </div>

            <button
              type="button"
              onClick={useMyLocation}
              disabled={isLocating}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-black/[0.09] rounded-xl text-[13px] text-slate-600 hover:border-brand hover:text-brand transition-colors disabled:opacity-50"
            >
              {isLocating ? <Loader2 className="animate-spin w-4 h-4" /> : <MapPin className="w-4 h-4" />}
              Update to my current location
            </button>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[13px] font-medium text-slate-700 mb-1">
                  Latitude <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="12.9716"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  className={inputNormal}
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-slate-700 mb-1">
                  Longitude <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="77.5946"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  className={inputNormal}
                />
              </div>
            </div>
          </div>

          {/* Photos */}
          <div className="bg-white rounded-2xl p-4 border border-black/[0.09] space-y-3">
            <h2 className="font-semibold text-slate-900 text-[15px]">
              Photos <span className="text-slate-400 font-normal text-[13px]">({totalPhotoCount}/5 photos)</span>
            </h2>

            {/* Grid of existing + newly added photo previews */}
            {(existingPhotos.length > 0 || newPhotoPreviews.length > 0) && (
              <div className="grid grid-cols-3 gap-2">
                {/* Existing photos */}
                {existingPhotos.map((photoUrl, i) => (
                  <div key={`existing-${i}`} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 group border border-black/10">
                    <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeExistingPhoto(i)}
                      className="absolute top-1 right-1 w-6 h-6 bg-black/70 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors"
                      title="Remove photo"
                    >
                      <X className="w-3.5 h-3.5 text-white" />
                    </button>
                    <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded font-mono">Saved</span>
                  </div>
                ))}

                {/* New photos previews */}
                {newPhotoPreviews.map((preview, i) => (
                  <div key={`new-${i}`} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 group border border-brand/30">
                    <img src={preview} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeNewPhoto(i)}
                      className="absolute top-1 right-1 w-6 h-6 bg-black/70 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors"
                      title="Remove photo"
                    >
                      <X className="w-3.5 h-3.5 text-white" />
                    </button>
                    <span className="absolute bottom-1 left-1 text-[10px] bg-brand text-white px-1.5 py-0.5 rounded font-mono">New</span>
                  </div>
                ))}
              </div>
            )}

            {totalPhotoCount < 5 && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handlePhotosSelect}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-black/[0.09] rounded-xl py-6 flex flex-col items-center gap-2 text-slate-400 hover:border-brand hover:text-brand transition-colors"
                >
                  <Upload className="w-5 h-5" />
                  <span className="text-[13px]">Upload additional photos</span>
                </button>
              </>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-brand hover:opacity-90 active:scale-[0.99] text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-[15px] shadow-lg shadow-brand/20"
          >
            {isSubmitting ? <Loader2 className="animate-spin w-4 h-4" /> : <Check className="w-4 h-4" />}
            Save Changes
          </button>
        </form>
      </div>
    </div>
  )
}
