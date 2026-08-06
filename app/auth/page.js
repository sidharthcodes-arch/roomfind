'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Home, Loader2, MapPin, CheckCircle, ArrowLeft, ShieldCheck, Heart, Sparkles } from 'lucide-react'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

export default function AuthPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'forgot'
  const [step, setStep] = useState('form')   // 'form' | 'role'

  useEffect(() => {
    if (!authLoading && user && step !== 'role') {
      router.replace('/')
    }
  }, [user, authLoading, step, router])
  
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)

  const [pendingUserId, setPendingUserId] = useState(null)
  const [pendingEmail, setPendingEmail] = useState(null)
  const [resetSent, setResetSent] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [toast, setToast] = useState(null)

  const showToast = (message, type = 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const validate = () => {
    const errs = {}
    if (!EMAIL_REGEX.test(email.trim())) errs.email = 'Enter a valid email address'
    if (mode !== 'forgot' && password.length < 6) errs.password = 'Password must be at least 6 characters'
    if (mode === 'signup' && !agreeTerms) errs.terms = 'You must agree to the Terms & Privacy Policy'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setIsLoading(true)

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
        router.push('/')
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim() } }
        })
        if (error) throw error
        if (data.user) {
          setPendingUserId(data.user.id)
          setPendingEmail(data.user.email ?? email.trim())
          setStep('role')
        }
      } else if (mode === 'forgot') {
        const redirectUrl = `${window.location.origin}/auth/reset-password`
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectUrl })
        if (error) throw error
        setResetSent(true)
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
        full_name: fullName.trim() || null,
        role
      }, { onConflict: 'id' })
      if (error) throw error
      router.push('/')
    } catch (err) {
      showToast(err?.message ?? 'Failed to save account setup')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOAuth = async (provider) => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/` }
      })
      if (error) throw error
    } catch (err) {
      showToast(err?.message ?? `Could not connect with ${provider}`)
    }
  }

  // ── Auth Loading / Already Logged-in Redirect Guard ──
  if (authLoading || (user && step !== 'role')) {
    return (
      <div className="min-h-screen bg-[#ececea] flex items-center justify-center">
        <Loader2 className="animate-spin w-8 h-8 text-brand" />
      </div>
    )
  }

  // ── Role Selection Screen (Post-signup) ──
  if (step === 'role') {
    return (
      <div className="min-h-screen bg-[#ececea] flex items-center justify-center p-4">
        {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
        <div className="w-full max-w-md bg-white rounded-3xl border border-black/[0.09] p-8 shadow-xl text-center">
          <div className="w-14 h-14 bg-brand-light text-brand rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Home className="w-7 h-7" />
          </div>
          <h1 className="text-[22px] font-bold text-slate-900 mb-2">How will you use RoomFind?</h1>
          <p className="text-slate-500 text-[14px] mb-6">Choose your primary account role to personalize your experience.</p>
          <div className="space-y-3">
            <button
              onClick={() => selectRole('tenant')}
              disabled={isLoading}
              className="w-full p-4 rounded-2xl border-2 border-slate-200 hover:border-brand hover:bg-brand-light/40 transition-all text-left group disabled:opacity-50"
            >
              <div className="font-semibold text-slate-900 text-[15px] group-hover:text-brand transition-colors">I am looking for a Room</div>
              <div className="text-[13px] text-slate-500 mt-0.5">Search verified listings near your location without broker fees</div>
            </button>
            <button
              onClick={() => selectRole('landlord')}
              disabled={isLoading}
              className="w-full p-4 rounded-2xl border-2 border-slate-200 hover:border-brand hover:bg-brand-light/40 transition-all text-left group disabled:opacity-50"
            >
              <div className="font-semibold text-slate-900 text-[15px] group-hover:text-brand transition-colors">I am a Room Owner / Landlord</div>
              <div className="text-[13px] text-slate-500 mt-0.5">Post room listings & get inquiries directly on WhatsApp</div>
            </button>
          </div>
          {isLoading && (
            <div className="flex justify-center mt-6">
              <Loader2 className="animate-spin w-6 h-6 text-brand" />
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F4F7F5] flex flex-col justify-between">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      <div className="w-full min-h-screen grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        
        {/* ── LEFT PANEL: Brand & RoomFind Hero ── */}
        <div className="lg:col-span-6 bg-gradient-to-br from-[#0F2922] via-[#143B31] to-[#0A1F19] text-white p-8 lg:p-14 flex flex-col justify-between relative overflow-hidden border-b lg:border-b-0 lg:border-r border-white/10">
          
          {/* Subtle background glow circle */}
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-brand/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Top Brand Logo */}
          <div className="relative z-10 flex items-center justify-between mb-10 lg:mb-0">
            <Link href="/" className="flex items-center gap-2.5 text-white font-bold text-[18px] tracking-tight">
              <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center shadow-lg shadow-brand/30">
                <Home className="w-5 h-5 text-white" />
              </div>
              <span>RoomFind</span>
            </Link>
            <Link href="/" className="text-xs text-white/70 hover:text-white flex items-center gap-1 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to listings
            </Link>
          </div>

          {/* Center Hero content */}
          <div className="relative z-10 my-auto max-w-lg space-y-6">
            <div className="inline-flex items-center gap-2 bg-brand/20 border border-brand/40 px-3.5 py-1.5 rounded-full text-xs font-semibold text-emerald-300 backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Location-Based Room Finder</span>
            </div>

            <h1 className="text-3xl lg:text-5xl font-bold tracking-tight leading-[1.15]">
              Find rooms near you.<br />
              <span className="text-emerald-400">Zero broker fees.</span>
            </h1>

            <p className="text-emerald-100/70 text-[15px] leading-relaxed">
              Connect directly with verified room owners in your area. Real-time GPS distance calculation, instant WhatsApp chat, and simple rental discovery.
            </p>

            {/* Room Card Live Preview Mockup */}
            <div className="bg-[#0B1E19]/80 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-mono font-medium text-emerald-200">LIVE NEARBY RADAR</span>
                </div>
                <span className="text-[11px] font-medium bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  📍 1.2 km away
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-900/60 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <MapPin className="w-6 h-6 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white text-[14px] truncate">Cozy Single Room</span>
                    <span className="font-bold text-emerald-400 text-[15px]">₹8,500<span className="text-xs text-emerald-200/60 font-normal">/mo</span></span>
                  </div>
                  <p className="text-xs text-white/60 truncate">Koramangala 4th Block · Furnished</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-emerald-200/60 pt-1">
                <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Verified Owner</span>
                <span className="flex items-center gap-1 text-emerald-300"><Heart className="w-3 h-3 fill-emerald-300" /> Direct WhatsApp</span>
              </div>
            </div>

            {/* Stat Row Proof Points (Filling bottom space smoothly) */}
            <div className="grid grid-cols-3 gap-3 pt-2 text-left border-t border-white/10">
              <div className="bg-white/5 rounded-xl p-3 border border-white/5 backdrop-blur-sm">
                <div className="text-lg font-bold text-white tracking-tight">500+</div>
                <div className="text-[11px] text-emerald-200/70 font-medium">Verified Rooms</div>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/5 backdrop-blur-sm">
                <div className="text-lg font-bold text-emerald-400 tracking-tight">12 min</div>
                <div className="text-[11px] text-emerald-200/70 font-medium">Avg. Response</div>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/5 backdrop-blur-sm">
                <div className="text-lg font-bold text-white tracking-tight">₹0</div>
                <div className="text-[11px] text-emerald-200/70 font-medium">Broker Fees</div>
              </div>
            </div>

          </div>

          {/* Footnote */}
          <div className="relative z-10 pt-6 text-xs text-emerald-100/50 font-mono flex items-center gap-2">
            <span>✓ Verified Listings</span>
            <span>·</span>
            <span>✓ Zero Brokerage</span>
            <span>·</span>
            <span>✓ GPS Search</span>
          </div>
        </div>

        {/* ── RIGHT PANEL: Form Card ── */}
        <div className="lg:col-span-6 bg-gradient-to-br from-[#F4F7F5] via-[#EBF2EE] to-[#F0F5F2] p-6 lg:p-14 flex items-center justify-center">
          <div className="w-full max-w-md bg-white rounded-3xl border border-emerald-900/10 p-8 lg:p-10 shadow-2xl shadow-emerald-950/5">
            
            {/* Mode Switcher Tabs */}
            {mode !== 'forgot' && (
              <div className="flex bg-slate-100/80 rounded-full p-1.5 mb-8">
                <button
                  type="button"
                  className={`flex-1 py-2.5 rounded-full text-[13px] font-semibold transition-all ${
                    mode === 'login' ? 'bg-brand text-white shadow-md shadow-brand/20' : 'text-slate-500 hover:text-slate-800'
                  }`}
                  onClick={() => { setMode('login'); setErrors({}); setResetSent(false) }}
                >
                  Log In
                </button>
                <button
                  type="button"
                  className={`flex-1 py-2.5 rounded-full text-[13px] font-semibold transition-all ${
                    mode === 'signup' ? 'bg-brand text-white shadow-md shadow-brand/20' : 'text-slate-500 hover:text-slate-800'
                  }`}
                  onClick={() => { setMode('signup'); setErrors({}); setResetSent(false) }}
                >
                  Create Account
                </button>
              </div>
            )}

            {/* Header Titles with improved breathing room */}
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                {mode === 'login' && 'Welcome back'}
                {mode === 'signup' && 'Create your account'}
                {mode === 'forgot' && 'Reset your password'}
              </h2>
              <p className="text-slate-500 text-[13.5px] mt-1.5 leading-normal">
                {mode === 'login' && 'Log in to manage your listings and search saved rooms.'}
                {mode === 'signup' && 'Join RoomFind to discover rooms near you.'}
                {mode === 'forgot' && 'Enter your email to receive a password reset link.'}
              </p>
            </div>

            {/* Forgot Password Reset Email Sent Screen */}
            {mode === 'forgot' && resetSent ? (
              <div className="text-center space-y-4 py-4">
                <div className="p-4 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-200 text-[13px] leading-relaxed text-left">
                  We've sent a password reset link to <strong>{email}</strong>. Please check your inbox and click the link to update your password.
                </div>
                <button
                  type="button"
                  onClick={() => { setMode('login'); setResetSent(false); setErrors({}) }}
                  className="w-full text-brand font-semibold text-[13px] hover:underline"
                >
                  ← Back to Log In
                </button>
              </div>
            ) : (
              /* Auth Form */
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>

                {/* Full name input (Signup mode only) */}
                {mode === 'signup' && (
                  <div>
                    <label className="block text-[12px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      placeholder="Ada Lovelace"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-black/[0.09] rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-brand bg-white text-slate-900"
                    />
                  </div>
                )}

                {/* Email input */}
                <div>
                  <label className="block text-[12px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full px-3.5 py-2.5 border rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-brand ${
                      errors.email ? 'border-red-400 bg-red-50' : 'border-black/[0.09] bg-white'
                    }`}
                  />
                  {errors.email && <p className="text-red-500 text-[12px] mt-1">{errors.email}</p>}
                </div>

                {/* Password input (Hidden in Forgot Mode) */}
                {mode !== 'forgot' && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[12px] font-semibold text-slate-600 uppercase tracking-wider">
                        Password
                      </label>
                      {mode === 'login' && (
                        <button
                          type="button"
                          onClick={() => { setMode('forgot'); setErrors({}); setResetSent(false) }}
                          className="text-[12px] text-brand font-medium hover:underline"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`w-full px-3.5 py-2.5 border rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-brand ${
                        errors.password ? 'border-red-400 bg-red-50' : 'border-black/[0.09] bg-white'
                      }`}
                    />
                    {errors.password && <p className="text-red-500 text-[12px] mt-1">{errors.password}</p>}
                  </div>
                )}

                {/* Options Row for Login Mode */}
                {mode === 'login' && (
                  <div className="flex items-center justify-between text-[13px] text-slate-600">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded accent-brand"
                      />
                      <span>Remember me</span>
                    </label>
                  </div>
                )}

                {/* Terms agreement checkbox for Signup Mode */}
                {mode === 'signup' && (
                  <div>
                    <label className="flex items-start gap-2 cursor-pointer select-none text-[13px] text-slate-600">
                      <input
                        type="checkbox"
                        checked={agreeTerms}
                        onChange={(e) => setAgreeTerms(e.target.checked)}
                        className="w-4 h-4 rounded accent-brand mt-0.5 shrink-0"
                      />
                      <span>
                        I agree to the <a href="#" className="text-brand hover:underline font-medium">Terms of Service</a> & <a href="#" className="text-brand hover:underline font-medium">Privacy Policy</a>
                      </span>
                    </label>
                    {errors.terms && <p className="text-red-500 text-[12px] mt-1">{errors.terms}</p>}
                  </div>
                )}

                {/* Main Action Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-brand hover:opacity-90 active:scale-[0.99] text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-[14.5px] shadow-lg shadow-brand/20 mt-2"
                >
                  {isLoading && <Loader2 className="animate-spin w-4 h-4" />}
                  {mode === 'login' && 'Log in'}
                  {mode === 'signup' && 'Create account'}
                  {mode === 'forgot' && 'Send Reset Link'}
                </button>

                {/* Back to Login Button for Forgot Mode */}
                {mode === 'forgot' && (
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setErrors({}) }}
                    className="w-full text-slate-500 text-[13px] font-medium hover:text-slate-800 transition-colors pt-2 block text-center"
                  >
                    ← Back to Log In
                  </button>
                )}
              </form>
            )}

            {/* Social Logins Divider (Login & Signup modes) */}
            {mode !== 'forgot' && (
              <>
                <div className="relative flex items-center my-6">
                  <div className="flex-grow border-t border-slate-200" />
                  <span className="flex-shrink mx-3 text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                    Or continue with
                  </span>
                  <div className="flex-grow border-t border-slate-200" />
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => handleOAuth('google')}
                    className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 border border-slate-200 hover:border-brand rounded-xl text-[13.5px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 16 16">
                      <path fill="#4285F4" d="M15.68 8.18c0-.58-.05-1.13-.15-1.66H8v3.14h4.3a3.68 3.68 0 0 1-1.6 2.42v2h2.58c1.51-1.39 2.4-3.44 2.4-5.9z"/>
                      <path fill="#34A853" d="M8 16c2.16 0 3.97-.72 5.29-1.93l-2.58-2c-.72.48-1.63.77-2.71.77-2.08 0-3.85-1.41-4.48-3.3H.86v2.07A8 8 0 0 0 8 16z"/>
                      <path fill="#FBBC05" d="M3.52 9.54A4.8 4.8 0 0 1 3.27 8c0-.53.09-1.05.25-1.54V4.39H.86A8 8 0 0 0 0 8c0 1.29.31 2.51.86 3.61l2.66-2.07z"/>
                      <path fill="#EA4335" d="M8 3.16c1.18 0 2.23.4 3.06 1.2l2.3-2.29A7.95 7.95 0 0 0 8 0 8 8 0 0 0 .86 4.39l2.66 2.07C4.15 4.57 5.92 3.16 8 3.16z"/>
                    </svg>
                    Continue with Google
                  </button>
                </div>

                {/* Footer mode toggle note */}
                <p className="text-center text-[13px] text-slate-500 mt-6">
                  {mode === 'login' ? (
                    <>Don't have an account? <button type="button" onClick={() => setMode('signup')} className="text-brand font-semibold hover:underline">Create one</button></>
                  ) : (
                    <>Already have an account? <button type="button" onClick={() => setMode('login')} className="text-brand font-semibold hover:underline">Log in</button></>
                  )}
                </p>
              </>
            )}

          </div>
        </div>

      </div>
    </div>
  )
}
