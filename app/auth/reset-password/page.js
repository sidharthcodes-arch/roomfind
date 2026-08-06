'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Home, Loader2, CheckCircle2 } from 'lucide-react'

function Toast({ message, type = 'error', onDismiss }) {
  if (!message) return null
  const bg = type === 'success' ? 'bg-emerald-600' : 'bg-red-500'
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 ${bg} text-white text-[13px] px-4 py-3 rounded-xl shadow-lg max-w-sm w-full mx-4 flex items-center justify-between gap-3`}>
      <span>{message}</span>
      <button onClick={onDismiss} className="text-white/80 hover:text-white shrink-0">✕</button>
    </div>
  )
}

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
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
    <div className="min-h-screen bg-[#ececea] flex items-center justify-center p-4">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      <div className="w-full max-w-sm bg-white rounded-2xl border border-black/[0.09] p-8">
        {/* Header / Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-brand rounded-xl flex items-center justify-center mx-auto mb-4">
            <Home className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-[24px] font-bold text-slate-900">RoomFind</h1>
          <p className="text-slate-500 text-[13px] mt-1">Set your new password</p>
        </div>

        {success ? (
          <div className="text-center space-y-3 py-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h2 className="text-[16px] font-bold text-slate-900">Password Updated!</h2>
            <p className="text-[13px] text-slate-500">Redirecting to login page...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label className="block text-[13px] font-medium text-slate-700 mb-1">New Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full px-3 py-2.5 border rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent ${
                  errors.password ? 'border-red-400 bg-red-50' : 'border-black/[0.09] bg-white'
                }`}
              />
              {errors.password && <p className="text-red-500 text-[12px] mt-1">{errors.password}</p>}
            </div>

            <div>
              <label className="block text-[13px] font-medium text-slate-700 mb-1">Confirm New Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full px-3 py-2.5 border rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent ${
                  errors.confirmPassword ? 'border-red-400 bg-red-50' : 'border-black/[0.09] bg-white'
                }`}
              />
              {errors.confirmPassword && <p className="text-red-500 text-[12px] mt-1">{errors.confirmPassword}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-brand hover:opacity-90 text-white font-semibold py-2.5 rounded-xl transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 text-[14px]"
            >
              {isLoading && <Loader2 className="animate-spin w-4 h-4" />}
              Update Password
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
