'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { RoomFindLogo } from '@/components/Logo'
import { Loader2, CheckCircle2, ChevronLeft, Eye, EyeOff, Lock } from 'lucide-react'

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

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errors, setErrors] = useState({})
  const [toast, setToast] = useState(null)

  const showToast = (message, type = 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const validate = () => {
    const errs = {}
    if (password.length < 6) errs.password = 'Password must be at least 6 characters'
    if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setIsLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setSuccess(true)
      setTimeout(() => {
        router.push('/auth')
      }, 2500)
    } catch (err) {
      showToast(err?.message ?? 'Failed to update password')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col justify-between font-sans">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* ── TOP NAVBAR HEADER ── */}
      <header className="w-full max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
        <Link href="/" className="inline-flex items-center">
          <RoomFindLogo className="h-7 w-auto" showText={true} textClassName="text-[20px] font-extrabold tracking-tight" />
        </Link>
        <div className="text-[13px] text-slate-500">
          Remember password?{' '}
          <Link href="/auth" className="font-semibold text-brand hover:underline underline-offset-2 transition-colors">
            Sign In
          </Link>
        </div>
      </header>

      {/* ── MAIN CONTENT (Mobile First Centered Container) ── */}
      <main className="w-full max-w-md mx-auto px-6 py-8 my-auto flex flex-col items-center">
        
        {/* Vector Line Art Illustration Header */}
        <div className="mb-6 relative flex items-center justify-center">
          <div className="w-24 h-24 rounded-full bg-brand/5 flex items-center justify-center">
            <svg
              className="w-16 h-16 text-slate-700"
              viewBox="0 0 100 100"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Signpost & Key Illustration */}
              <path d="M 50,75 L 50,35" strokeDasharray="none" />
              <path d="M 32,35 L 68,35 L 75,25 L 68,15 L 32,15 Z" fill="white" />
              <line x1="38" y1="23" x2="58" y2="23" strokeWidth="2" />
              <line x1="38" y1="28" x2="52" y2="28" strokeWidth="1.8" strokeOpacity="0.5" />
              {/* Shadow Base */}
              <ellipse cx="50" cy="78" rx="20" ry="4" fill="currentColor" fillOpacity="0.15" stroke="none" />
              {/* Grass tufts */}
              <path d="M 28,78 C 30,73 31,73 33,78" />
              <path d="M 67,78 C 69,73 70,73 72,78" />
            </svg>
          </div>
        </div>

        {/* Heading & Subtitle */}
        <div className="text-center mb-8 max-w-sm">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
            Reset your password?
          </h1>
          <p className="text-slate-500 text-[13px] leading-relaxed">
            Enter your new password below so that we can update and secure your account.
          </p>
        </div>

        {/* Success State */}
        {success ? (
          <div className="w-full text-center space-y-4 py-6 bg-emerald-50/60 rounded-3xl border border-emerald-100 p-6 animate-fade-in">
            <div className="w-12 h-12 bg-emerald-100 text-brand rounded-full flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-[17px] font-bold text-slate-900">Password Updated!</h2>
              <p className="text-[13px] text-slate-500 mt-1">Your password has been changed successfully.</p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-2 text-[13px] font-semibold text-brand">
              <Loader2 className="w-4 h-4 animate-spin" />
              Redirecting to sign in...
            </div>
          </div>
        ) : (
          /* Form Container */
          <form onSubmit={handleSubmit} className="w-full space-y-5" noValidate>
            
            {/* New Password Field */}
            <div className="space-y-1.5">
              <label className="block text-[13px] font-semibold text-slate-800 ml-1">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="e.g. •••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full px-5 py-3 rounded-full border text-[14px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all ${
                    errors.password ? 'border-red-400 bg-red-50/50' : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-[12px] ml-3 mt-1">{errors.password}</p>}
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-1.5">
              <label className="block text-[13px] font-semibold text-slate-800 ml-1">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="e.g. •••••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full px-5 py-3 rounded-full border text-[14px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all ${
                    errors.confirmPassword ? 'border-red-400 bg-red-50/50' : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmPassword && <p className="text-red-500 text-[12px] ml-3 mt-1">{errors.confirmPassword}</p>}
            </div>

            {/* Primary Pill Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-brand hover:opacity-90 text-white font-bold py-3.5 px-6 rounded-full transition-all shadow-md hover:shadow-lg active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 text-[15px] mt-2"
            >
              {isLoading && <Loader2 className="animate-spin w-4 h-4" />}
              Update Password
            </button>

            {/* Back to Login Link */}
            <div className="pt-3 text-center">
              <Link
                href="/auth"
                className="inline-flex items-center gap-1 text-[13px] font-medium text-slate-500 hover:text-slate-900 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-slate-400" />
                <span>Back to Login</span>
              </Link>
            </div>
          </form>
        )}
      </main>

      {/* ── FOOTER ── */}
      <footer className="w-full max-w-5xl mx-auto px-6 py-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-[12px] text-slate-400 gap-2">
        <div>Copyright © 2026 RoomFind</div>
        <div className="flex items-center gap-4">
          <Link href="/" className="hover:text-slate-600 transition-colors">Privacy Policy</Link>
          <span>•</span>
          <Link href="/" className="hover:text-slate-600 transition-colors">Terms of Service</Link>
        </div>
      </footer>
    </div>
  )
}
