import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Eye, EyeOff, Loader2, Mail } from 'lucide-react'
import { useAuthStore } from '../../store'
import { supabase } from '../../lib/supabaseClient'
import { toast } from 'sonner'
import logoGold from '../../assets/logo-gold.png'

export default function AuthModal() {
  const { authModalOpen, authModalMode, closeAuthModal } = useAuthStore()
  const [mode, setMode] = useState('login')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [otp, setOtp] = useState('')
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', password: '' })
  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  // Sync mode from store
  React.useEffect(() => { 
    if (authModalOpen) {
      setMode(authModalMode)
      setOtp('')
    }
  }, [authModalOpen, authModalMode])

  const handleSignUp = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      // Pre-check for duplicate email/phone
      const { data: checkData, error: checkError } = await supabase.rpc('check_user_exists', {
        p_email: form.email,
        p_phone: form.phone
      })
      
      if (!checkError && checkData) {
        if (checkData.phone_exists) {
          toast.error("Phone number already exists")
          setLoading(false)
          return
        }
        if (checkData.email_exists) {
          toast.error("Email already exists. Please log in.")
          setMode('login')
          setLoading(false)
          return
        }
      }

      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { full_name: form.fullName, phone: form.phone } },
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
        email: form.email,
        token: otp,
        type: 'signup'
      })
      if (error) throw error
      toast.success('Email verified! Welcome 🙏')
      closeAuthModal()
    } catch (err) {
      toast.error(err.message || 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: form.email, password: form.password,
      })
      
      if (error) {
        if (error.message.toLowerCase().includes('email not confirmed')) {
          await supabase.auth.resend({ type: 'signup', email: form.email })
          toast.success('Account unverified. New OTP sent!')
          setMode('otp')
          return
        }
        throw error
      }
      toast.success('Welcome back! 🙏')
      closeAuthModal()
    } catch (err) {
      toast.error(err.message || 'Login failed')
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
                {mode === 'otp' ? 'Verify Your Email' : mode === 'signup' ? 'Join the Devotee Community' : 'Welcome Back'}
              </h2>
              <p className="text-xs text-temple-tan mt-1">
                {mode === 'otp'
                  ? 'Enter the 6-digit code sent to your email'
                  : mode === 'signup'
                  ? 'Create your account to book services and donate'
                  : 'Log in to book services and make offerings'}
              </p>
              {mode !== 'otp' && (
                <div className="flex mt-4 bg-black/5 rounded-xl p-1">
                  {['login', 'signup'].map((m) => (
                    <button key={m} onClick={() => setMode(m)}
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
                        onChange={(e) => setOtp(e.target.value)} 
                        required 
                        className="w-full px-3 py-3 rounded-xl border border-temple-gold/50 bg-white text-xl text-center tracking-[0.5em] font-mono focus:ring-2 focus:ring-temple-saffron/30 focus:border-temple-saffron transition" 
                      />
                    </div>
                  </div>
                  <SubmitBtn loading={loading} label="Verify & Continue" />
                  <div className="text-center mt-2 space-y-3">
                    <p className="text-[10px] text-temple-tan leading-tight">
                      Don't see the email? Please check your <strong>SPAM folder</strong>. <br/>
                      If you find it there, please mark it as "Not Spam" to help other devotees receive Lord Vinayagar's grace. 🙏
                    </p>
                    <button type="button" onClick={() => setMode('signup')} className="text-temple-saffron text-sm font-medium hover:underline">
                      Back to Sign Up
                    </button>
                  </div>
                </form>
              ) : mode === 'signup' ? (
                <form onSubmit={handleSignUp} className="space-y-4">
                  <Field label="Full Name" placeholder="Your full name" value={form.fullName} onChange={setField('fullName')} required />
                  <Field label="Phone Number" type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={setField('phone')} required />
                  <Field label="Email Address" type="email" placeholder="you@example.com" value={form.email} onChange={setField('email')} required />
                  <PassField value={form.password} onChange={setField('password')} show={showPass} toggle={() => setShowPass(s => !s)} />
                  <SubmitBtn loading={loading} label="Create Account 🙏" />
                  <p className="text-[10px] text-center text-temple-tan">By signing up, you agree to our Terms & Privacy Policy.</p>
                </form>
              ) : (
                <form onSubmit={handleLogin} className="space-y-4">
                  <Field label="Email Address" type="email" placeholder="you@example.com" value={form.email} onChange={setField('email')} required />
                  <PassField value={form.password} onChange={setField('password')} show={showPass} toggle={() => setShowPass(s => !s)} />
                  <SubmitBtn loading={loading} label="Log In 🙏" />
                  <p className="text-center text-xs text-temple-tan">
                    Don't have an account?{' '}
                    <button type="button" onClick={() => setMode('signup')} className="text-temple-saffron font-semibold hover:underline">Sign Up</button>
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

function Field({ label, ...props }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-temple-brown">{label}</label>
      <input {...props} className="w-full px-3 py-2.5 rounded-xl border border-temple-gold/50 bg-white text-sm focus:ring-2 focus:ring-temple-saffron/30 focus:border-temple-saffron transition" />
    </div>
  )
}

function PassField({ value, onChange, show, toggle }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-temple-brown">Password</label>
      <div className="relative">
        <input type={show ? 'text' : 'password'} value={value} onChange={onChange} required minLength={8}
          placeholder="Minimum 8 characters"
          className="w-full pr-10 pl-3 py-2.5 rounded-xl border border-temple-gold/50 bg-white text-sm focus:ring-2 focus:ring-temple-saffron/30 focus:border-temple-saffron transition"
        />
        <button type="button" onClick={toggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-temple-tan">
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
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
