import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, ArrowLeft, KeyRound } from 'lucide-react'
import { useAuthStore } from '../../store'
import { supabase } from '../../lib/supabaseClient'
import { toast } from 'sonner'
import logoGold from '../../assets/logo-gold.png'

const COUNTRY_CODES = [
  { code: '+91', label: '🇮🇳 +91 (India)' },
  { code: '+1', label: '🇺🇸 +1 (USA/Canada)' },
  { code: '+65', label: '🇸🇬 +65 (Singapore)' },
  { code: '+60', label: '🇲🇾 +60 (Malaysia)' },
  { code: '+44', label: '🇬🇧 +44 (UK)' },
  { code: '+971', label: '🇦🇪 +971 (UAE)' },
  { code: '+61', label: '🇦🇺 +61 (Australia)' },
  { code: '+33', label: '🇫🇷 +33 (France)' },
]

export default function AuthModal() {
  const { authModalOpen, authModalMode, closeAuthModal } = useAuthStore()
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'otp' | 'forgot_password'
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [otp, setOtp] = useState('')
  
  // Form State
  const [countryCode, setCountryCode] = useState('+91')
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', password: '' })
  
  // Validation & Instant Checks State
  const [errors, setErrors] = useState({})
  const [emailCheckStatus, setEmailCheckStatus] = useState(null) // null | 'checking' | 'available' | 'exists' | 'invalid'
  const [emailCheckMsg, setEmailCheckMsg] = useState('')

  // Sync mode from store
  React.useEffect(() => { 
    if (authModalOpen) {
      setMode(authModalMode)
      setOtp('')
      setErrors({})
      setEmailCheckStatus(null)
      setEmailCheckMsg('')
    }
  }, [authModalOpen, authModalMode])

  // Instant Email Validation
  const handleInstantEmailCheck = async () => {
    const email = form.email.trim()
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    if (!email || !emailRegex.test(email)) {
      setEmailCheckStatus('invalid')
      setEmailCheckMsg('Please enter a valid email address first.')
      return
    }

    setEmailCheckStatus('checking')
    setEmailCheckMsg('Checking availability...')
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/users/check-email?email=${encodeURIComponent(email)}`)
      if (res.ok) {
        const data = await res.json()
        if (data.available) {
          setEmailCheckStatus('available')
          setEmailCheckMsg('Email is available!')
        } else {
          setEmailCheckStatus('exists')
          setEmailCheckMsg('Email already registered. Please log in.')
        }
      } else {
        setEmailCheckStatus(null)
      }
    } catch (e) {
      setEmailCheckStatus(null)
    }
  }

  // Strict Field Validation
  const validateForm = () => {
    const errs = {}

    // Full Name: Only letters, single spaces between words, DOT allowed
    // e.g. "R. Ramesh", "S.P. Kumar", "Karthik"
    const nameRegex = /^[A-Za-z]+([ .][A-Za-z]+)*\.?$/
    if (!form.fullName.trim()) {
      errs.fullName = 'Full Name is required'
    } else if (!nameRegex.test(form.fullName.trim())) {
      errs.fullName = 'Name can only contain alphabets, single spaces, and dot (.)'
    }

    // Phone: Exactly 10 digits, no spaces
    if (!form.phone.trim()) {
      errs.phone = 'Mobile number is required'
    } else if (!/^\d{10}$/.test(form.phone.trim())) {
      errs.phone = 'Mobile number must be exactly 10 digits without spaces'
    }

    // Email
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    if (!form.email.trim()) {
      errs.email = 'Email address is required'
    } else if (!emailRegex.test(form.email.trim())) {
      errs.email = 'Invalid email address format'
    }

    // Password: min 8, letters + numbers + special chars, NO SPACES
    if (form.password.includes(' ')) {
      errs.password = 'Password cannot contain any spaces'
    } else if (form.password.length < 8) {
      errs.password = 'Password must be at least 8 characters'
    } else {
      const hasLetter = /[a-zA-Z]/.test(form.password)
      const hasNumber = /[0-9]/.test(form.password)
      const hasSpecial = /[^a-zA-Z0-9]/.test(form.password)
      if (!hasLetter || !hasNumber || !hasSpecial) {
        errs.password = 'Password must include alphabets, numbers, and special characters'
      }
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSignUp = async (e) => {
    e.preventDefault()
    if (!validateForm()) {
      toast.error('Please fix the validation errors on screen')
      return
    }

    setLoading(true)
    const fullPhoneNumber = `${countryCode} ${form.phone.trim()}`
    try {
      // Pre-check for duplicate email/phone via RPC
      const { data: checkData, error: checkError } = await supabase.rpc('check_user_exists', {
        p_email: form.email.trim(),
        p_phone: fullPhoneNumber
      })
      
      if (!checkError && checkData) {
        if (checkData.phone_exists) {
          toast.error("Phone number already exists")
          setErrors(prev => ({ ...prev, phone: 'Phone number already registered' }))
          setLoading(false)
          return
        }
        if (checkData.email_exists) {
          toast.error("Email already exists. Please log in.")
          setErrors(prev => ({ ...prev, email: 'Email already registered. Please log in.' }))
          setMode('login')
          setLoading(false)
          return
        }
      }

      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: { 
          data: { 
            full_name: form.fullName.trim(), 
            phone: fullPhoneNumber,
            country_code: countryCode
          } 
        },
      })
      
      if (error) throw error
      
      toast.success('Verification code sent! Check your email.')
      setMode('otp')
    } catch (err) {
      toast.error(err.message || 'Sign up failed')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: form.email.trim(),
        token: otp.trim(),
        type: 'signup'
      })
      if (error) throw error
      toast.success('Email verified successfully! Welcome to the temple community.')
      closeAuthModal()
    } catch (err) {
      toast.error(err.message || 'Verification failed. Please re-check the OTP.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: form.email.trim(), 
        password: form.password,
      })
      
      if (error) {
        if (error.message.toLowerCase().includes('email not confirmed')) {
          await supabase.auth.resend({ type: 'signup', email: form.email.trim() })
          toast.info('Account unverified. We have sent a fresh OTP to your email!')
          setMode('otp')
          return
        }
        throw error
      }
      toast.success('Welcome back!')
      closeAuthModal()
    } catch (err) {
      toast.error(err.message || 'Login failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    if (!form.email.trim()) {
      toast.error("Please enter your registered email address")
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(form.email.trim(), {
        redirectTo: `${window.location.origin}/dashboard`
      })
      if (error) throw error
      toast.success('Password reset instructions sent! Please check your email inbox & spam.')
      setMode('login')
    } catch (err) {
      toast.error(err.message || 'Failed to send password reset email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {authModalOpen && (
        <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={(e) => { if (e.target === e.currentTarget) closeAuthModal() }}
        >
          <motion.div className="modal-panel"
            initial={{ opacity: 0, scale: 0.93, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 20 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Header */}
            <div className="relative bg-gradient-to-br from-[#FAF0E1] to-[#F4E3CB] p-6 pb-4">
              <button onClick={closeAuthModal}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center transition-colors"
              >
                <X size={14} />
              </button>
              <div className="w-12 h-12 rounded-xl bg-temple-cream border border-temple-gold/40 flex items-center justify-center mb-3 p-1">
                <img src={logoGold} alt="Temple Logo" className="w-full h-full object-contain" />
              </div>
              <h2 className="font-serif text-2xl font-bold text-temple-brown">
                {mode === 'otp' 
                  ? 'Verify Your Email' 
                  : mode === 'signup' 
                  ? 'Join the Devotee Community' 
                  : mode === 'forgot_password'
                  ? 'Reset Your Password'
                  : 'Welcome Back'}
              </h2>
              <p className="text-xs text-temple-tan mt-1">
                {mode === 'otp'
                  ? 'Enter the 6-digit code sent to your email'
                  : mode === 'signup'
                  ? 'Create your account to book services and donate'
                  : mode === 'forgot_password'
                  ? 'Enter your registered email address to receive a secure password reset link'
                  : 'Log in to book services and make offerings'}
              </p>
              
              {mode !== 'otp' && mode !== 'forgot_password' && (
                <div className="flex mt-4 bg-black/5 rounded-xl p-1">
                  {['login', 'signup'].map((m) => (
                    <button key={m} onClick={() => { setMode(m); setErrors({}); }}
                      className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                        mode === m ? 'bg-white shadow-sm text-temple-brown' : 'text-temple-tan hover:text-temple-brown'
                      }`}
                    >
                      {m === 'login' ? 'Log In' : 'Sign Up'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Body */}
            <div className="p-6">
              {mode === 'otp' ? (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="text-center py-2">
                    <p className="text-sm text-apple-muted mb-4">
                      Code sent to <strong className="text-apple-ink">{form.email}</strong>
                    </p>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-temple-brown text-left block">6-Digit Code</label>
                      <input 
                        type="text" 
                        maxLength={6} 
                        placeholder="000000" 
                        value={otp} 
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} 
                        required 
                        className="w-full px-3 py-3 rounded-xl border border-temple-gold/50 bg-white text-xl text-center tracking-[0.5em] font-mono focus:ring-2 focus:ring-temple-saffron/30 focus:border-temple-saffron transition" 
                      />
                    </div>
                  </div>
                  <SubmitBtn loading={loading} label="Verify & Continue" />
                  <div className="text-center mt-2 space-y-3">
                    <p className="text-[10px] text-temple-tan leading-tight">
                      Don't see the email? Please check your <strong>SPAM folder</strong>. <br/>
                      If you find it there, please mark it as "Not Spam" to help other devotees receive Lord Vinayagar's grace.
                    </p>
                    <button type="button" onClick={() => setMode('signup')} className="text-temple-saffron text-sm font-medium hover:underline">
                      Back to Sign Up
                    </button>
                  </div>
                </form>
              ) : mode === 'forgot_password' ? (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-temple-brown">Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="you@example.com"
                      value={form.email}
                      onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-temple-gold/50 bg-white text-sm focus:ring-2 focus:ring-temple-saffron/30 focus:border-temple-saffron transition"
                    />
                  </div>
                  <SubmitBtn loading={loading} label="Send Reset Link" />
                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => setMode('login')}
                      className="inline-flex items-center gap-1.5 text-xs text-temple-saffron font-semibold hover:underline"
                    >
                      <ArrowLeft size={13} /> Back to Log In
                    </button>
                  </div>
                </form>
              ) : mode === 'signup' ? (
                <form onSubmit={handleSignUp} className="space-y-3.5">
                  {/* Full Name */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-temple-brown">Full Name *</label>
                    <input 
                      type="text"
                      required
                      placeholder="e.g. Ramesh Kumar or R. Kumar"
                      value={form.fullName}
                      onChange={(e) => {
                        // Allow only letters, single spaces, dot
                        const val = e.target.value
                        if (/^[A-Za-z .]*$/.test(val)) {
                          setForm(f => ({ ...f, fullName: val }))
                          if (errors.fullName) setErrors(prev => ({ ...prev, fullName: null }))
                        }
                      }}
                      className={`w-full px-3 py-2.5 rounded-xl border bg-white text-sm focus:ring-2 transition ${
                        errors.fullName ? 'border-red-400 focus:ring-red-200' : 'border-temple-gold/50 focus:ring-temple-saffron/30'
                      }`}
                    />
                    {errors.fullName ? (
                      <p className="text-[11px] text-red-500 font-medium">{errors.fullName}</p>
                    ) : (
                      <p className="text-[10px] text-apple-muted">Only alphabets, single spaces, and dot (.) allowed.</p>
                    )}
                  </div>

                  {/* Phone with Country Code */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-temple-brown">Mobile Number *</label>
                    <div className="flex gap-2">
                      <select
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="px-2.5 py-2.5 rounded-xl border border-temple-gold/50 bg-white text-xs font-semibold focus:ring-2 focus:ring-temple-saffron/30 shrink-0 w-36"
                      >
                        {COUNTRY_CODES.map(c => (
                          <option key={c.code} value={c.code}>{c.label}</option>
                        ))}
                      </select>
                      <input 
                        type="tel"
                        required
                        maxLength={10}
                        placeholder="10-digit number"
                        value={form.phone}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 10)
                          setForm(f => ({ ...f, phone: val }))
                          if (errors.phone) setErrors(prev => ({ ...prev, phone: null }))
                        }}
                        className={`flex-1 px-3 py-2.5 rounded-xl border bg-white text-sm focus:ring-2 transition ${
                          errors.phone ? 'border-red-400 focus:ring-red-200' : 'border-temple-gold/50 focus:ring-temple-saffron/30'
                        }`}
                      />
                    </div>
                    {errors.phone ? (
                      <p className="text-[11px] text-red-500 font-medium">{errors.phone}</p>
                    ) : (
                      <p className="text-[10px] text-apple-muted">Accepts only 10 digits without any spaces.</p>
                    )}
                  </div>

                  {/* Email with Instant Validation Button */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-temple-brown">Email Address *</label>
                      <button
                        type="button"
                        onClick={handleInstantEmailCheck}
                        disabled={!form.email || emailCheckStatus === 'checking'}
                        className="text-[11px] font-semibold text-temple-saffron hover:text-temple-saffron-hover disabled:opacity-40 underline"
                      >
                        {emailCheckStatus === 'checking' ? 'Validating...' : 'Instant Check'}
                      </button>
                    </div>
                    <div className="relative">
                      <input 
                        type="email"
                        required
                        placeholder="you@example.com"
                        value={form.email}
                        onChange={(e) => {
                          setForm(f => ({ ...f, email: e.target.value.trim() }))
                          setEmailCheckStatus(null)
                          setEmailCheckMsg('')
                          if (errors.email) setErrors(prev => ({ ...prev, email: null }))
                        }}
                        className={`w-full px-3 py-2.5 pr-20 rounded-xl border bg-white text-sm focus:ring-2 transition ${
                          errors.email ? 'border-red-400 focus:ring-red-200' : 'border-temple-gold/50 focus:ring-temple-saffron/30'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={handleInstantEmailCheck}
                        disabled={!form.email || emailCheckStatus === 'checking'}
                        className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-temple-cream hover:bg-amber-100 text-temple-brown border border-temple-gold/40 transition disabled:opacity-40"
                      >
                        {emailCheckStatus === 'checking' ? <Loader2 size={12} className="animate-spin" /> : 'Check'}
                      </button>
                    </div>
                    {emailCheckMsg && (
                      <div className={`flex items-center gap-1 text-[11px] font-medium mt-1 ${
                        emailCheckStatus === 'available' ? 'text-temple-green' : 'text-red-500'
                      }`}>
                        {emailCheckStatus === 'available' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                        {emailCheckMsg}
                      </div>
                    )}
                    {errors.email && <p className="text-[11px] text-red-500 font-medium">{errors.email}</p>}
                  </div>

                  {/* Password Field */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-temple-brown">Password *</label>
                    <div className="relative">
                      <input 
                        type={showPass ? 'text' : 'password'} 
                        value={form.password} 
                        onChange={(e) => {
                          const val = e.target.value.replace(/\s/g, '') // strictly no spaces
                          setForm(f => ({ ...f, password: val }))
                          if (errors.password) setErrors(prev => ({ ...prev, password: null }))
                        }} 
                        required 
                        minLength={8}
                        placeholder="Letters, numbers, special characters (no space)"
                        className={`w-full pr-10 pl-3 py-2.5 rounded-xl border bg-white text-sm focus:ring-2 transition ${
                          errors.password ? 'border-red-400 focus:ring-red-200' : 'border-temple-gold/50 focus:ring-temple-saffron/30'
                        }`}
                      />
                      <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-temple-tan">
                        {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {errors.password ? (
                      <p className="text-[11px] text-red-500 font-medium">{errors.password}</p>
                    ) : (
                      <p className="text-[10px] text-apple-muted">Minimum 8 characters. Must contain letters, numbers & special characters without spaces.</p>
                    )}
                  </div>

                  <SubmitBtn loading={loading} label="Create Devotee Account" />
                  <p className="text-[10px] text-center text-temple-tan">By signing up, you agree to temple terms & privacy guidelines.</p>
                </form>
              ) : (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-temple-brown">Email Address</label>
                    <input 
                      type="email" 
                      placeholder="you@example.com" 
                      value={form.email} 
                      onChange={(e) => setForm(f => ({ ...f, email: e.target.value.trim() }))} 
                      required 
                      className="w-full px-3 py-2.5 rounded-xl border border-temple-gold/50 bg-white text-sm focus:ring-2 focus:ring-temple-saffron/30 focus:border-temple-saffron transition"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-temple-brown">Password</label>
                      <button 
                        type="button" 
                        onClick={() => setMode('forgot_password')} 
                        className="text-[11px] text-temple-saffron font-medium hover:underline"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div className="relative">
                      <input 
                        type={showPass ? 'text' : 'password'} 
                        value={form.password} 
                        onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))} 
                        required 
                        className="w-full pr-10 pl-3 py-2.5 rounded-xl border border-temple-gold/50 bg-white text-sm focus:ring-2 focus:ring-temple-saffron/30 focus:border-temple-saffron transition"
                      />
                      <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-temple-tan">
                        {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <SubmitBtn loading={loading} label="Log In" />
                  
                  <p className="text-center text-xs text-temple-tan">
                    Don't have an account?{' '}
                    <button type="button" onClick={() => setMode('signup')} className="text-temple-saffron font-semibold hover:underline">
                      Sign Up
                    </button>
                  </p>
                </form>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function SubmitBtn({ loading, label }) {
  return (
    <motion.button type="submit" disabled={loading}
      whileHover={!loading ? { scale: 1.02 } : {}} whileTap={!loading ? { scale: 0.97 } : {}}
      className="w-full py-3 rounded-xl bg-temple-saffron hover:bg-temple-saffron-hover text-white font-bold text-sm shadow-glowing-orange transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : label}
    </motion.button>
  )
}
