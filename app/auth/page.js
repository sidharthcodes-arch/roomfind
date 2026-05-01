'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Home, Loader2 } from 'lucide-react'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function Toast({ message, onDismiss }) {
  if (!message) return null
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white text-sm px-4 py-3 rounded-xl shadow-lg max-w-sm w-full mx-4 flex items-center justify-between gap-3">
      <span>{message}</span>
      <button onClick={onDismiss} className="text-white/80 hover:text-white shrink-0">✕</button>
    </div>
  )
}

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [step, setStep] = useState('form')  // 'form' | 'role'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pendingUserId, setPendingUserId] = useState(null)
  const [pendingEmail, setPendingEmail] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [toast, setToast] = useState(null)

  const showToast = (message) => {
    setToast(message)
    setTimeout(() => setToast(null), 4000)
  }

  const validate = () => {
    const newErrors = {}
    if (!EMAIL_REGEX.test(email)) {
      newErrors.email = 'Enter a valid email address'
    }
    if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    setIsLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push('/')
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (data.user) {
          setPendingUserId(data.user.id)
          setPendingEmail(data.user.email ?? email)
          setStep('role')
        }
      }
    } catch (err) {
      showToast(err?.message ?? 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  const selectRole = async (role) => {
    if (!pendingUserId) return
    setIsLoading(true)
    try {
      const { error } = await supabase.from('users').upsert({
        id: pendingUserId,
        email: pendingEmail,
        role,
      })
      if (error) throw error
      router.push('/')
    } catch (err) {
      showToast(err?.message ?? 'Failed to save role')
    } finally {
      setIsLoading(false)
    }
  }

  if (step === 'role') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Toast message={toast} onDismiss={() => setToast(null)} />
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
          <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center mx-auto mb-6">
            <Home className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">How will you use RoomFind?</h1>
          <p className="text-slate-500 text-sm mb-8">Choose your account type to get started.</p>
          <div className="space-y-3">
            <button
              onClick={() => selectRole('tenant')}
              disabled={isLoading}
              className="w-full p-4 rounded-xl border-2 border-slate-200 hover:border-amber-500 hover:bg-amber-50 transition-all text-left disabled:opacity-50"
            >
              <div className="font-semibold text-slate-900">I am a Tenant</div>
              <div className="text-sm text-slate-500">Looking for a room to rent</div>
            </button>
            <button
              onClick={() => selectRole('landlord')}
              disabled={isLoading}
              className="w-full p-4 rounded-xl border-2 border-slate-200 hover:border-amber-500 hover:bg-amber-50 transition-all text-left disabled:opacity-50"
            >
              <div className="font-semibold text-slate-900">I am a Landlord</div>
              <div className="text-sm text-slate-500">Want to post rooms for rent</div>
            </button>
          </div>
          {isLoading && (
            <div className="flex justify-center mt-4">
              <Loader2 className="animate-spin w-5 h-5 text-amber-500" />
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Toast message={toast} onDismiss={() => setToast(null)} />
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Home className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">RoomFind</h1>
          <p className="text-slate-500 text-sm mt-1">Find rooms near you</p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-slate-100 rounded-xl p-1 mb-6">
          <button
            type="button"
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
            onClick={() => { setMode('login'); setErrors({}) }}
          >
            Log In
          </button>
          <button
            type="button"
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === 'signup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
            onClick={() => { setMode('signup'); setErrors({}) }}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent ${
                errors.email ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white'
              }`}
            />
            {errors.email && (
              <p className="text-red-500 text-xs mt-1">{errors.email}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent ${
                errors.password ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white'
              }`}
            />
            {errors.password && (
              <p className="text-red-500 text-xs mt-1">{errors.password}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 className="animate-spin w-4 h-4" />}
            {mode === 'login' ? 'Log In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  )
}
