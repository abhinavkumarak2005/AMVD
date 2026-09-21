import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { toast } from 'sonner'
import logoGold from '../assets/logo-gold.png'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      // Fetch profile to check role
      const { data: profile, error: profileErr } = await supabase
        .from('users').select('role').eq('id', data.user.id).single()
        
      if (profileErr) {
        await supabase.auth.signOut()
        throw new Error(`Profile error: ${profileErr.message}`)
      }
      
      const role = profile?.role
      if (!role || !['admin', 'super_admin'].includes(role)) {
        await supabase.auth.signOut()
        throw new Error('Access denied. You do not have admin privileges.')
      }
      toast.success('Welcome to CMS 🙏')
      navigate('/admin')
    } catch (err) {
      toast.error(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-apple-bg flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm bg-white rounded-3xl shadow-apple-modal border border-gray-100 overflow-hidden"
      >
        <div className="p-8 text-center border-b border-gray-100 space-y-3">
          <div className="w-14 h-14 mx-auto bg-temple-cream border border-temple-gold/40 rounded-2xl flex items-center justify-center p-2">
            <img src={logoGold} alt="Temple Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-apple-ink">Admin Portal</h1>
            <p className="text-xs text-apple-muted mt-1">Arulmigu Manakula Vinayagar Devasthanam — CMS</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-apple-ink">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@temple.org"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-apple-bg text-sm focus:ring-2 focus:ring-temple-saffron/30 focus:border-temple-saffron"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-apple-ink">Password</label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} required value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                className="w-full pr-10 pl-3 py-2.5 rounded-xl border border-gray-200 bg-apple-bg text-sm focus:ring-2 focus:ring-temple-saffron/30 focus:border-temple-saffron"
              />
              <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-apple-muted">
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <motion.button type="submit" disabled={loading}
            whileHover={!loading ? { scale: 1.02 } : {}} whileTap={!loading ? { scale: 0.97 } : {}}
            className="w-full py-3 rounded-xl bg-temple-saffron text-white font-bold text-sm shadow-glowing-orange disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <><ShieldCheck size={16} /> Sign In to CMS</>}
          </motion.button>
          <p className="text-center text-xs text-apple-muted">
            <a href="/" className="text-temple-saffron hover:underline">← Back to public site</a>
          </p>
        </form>
      </motion.div>
    </div>
  )
}
