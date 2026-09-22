import React, { useState, useEffect } from 'react'
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LayoutDashboard, CalendarDays, Download, HeartHandshake, Receipt, Settings, LogOut, User, Loader2, Home } from 'lucide-react'
import { useAuthStore } from '../store'
import { supabase } from '../lib/supabaseClient'
import { toast } from 'sonner'
import logoGold from '../assets/logo-gold.png'
import ExemptionModal from '../components/layout/ExemptionModal'

const NAV = [
  { label: 'Overview', icon: LayoutDashboard, path: '' },
  { label: 'My Bookings', icon: CalendarDays, path: 'bookings' },
  { label: 'Donations', icon: HeartHandshake, path: 'donations' },
  { label: 'Receipts', icon: Receipt, path: 'receipts' },
  { label: 'Settings', icon: Settings, path: 'settings' },
]

function Sidebar({ onSignOut }) {
  const { profile, user } = useAuthStore()
  
  const fullName = profile?.full_name || user?.user_metadata?.full_name || 'Devotee'
  const phone = profile?.phone || user?.user_metadata?.phone || ''

  return (
    <aside className="apple-sidebar hidden md:flex">
      <div className="p-5 border-b border-gray-100 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 shrink-0 overflow-hidden">
          <User size={24} className="mt-1" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-apple-ink truncate">{fullName}</p>
          <p className="text-xs text-apple-muted truncate">{phone}</p>
        </div>
      </div>
      <div className="px-4 pt-4 pb-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-apple-muted">My Account</p>
      </div>
      <nav className="flex-1 space-y-0.5 px-2 pb-2">
        {NAV.map(({ label, icon: Icon, path }) => (
          <NavLink key={label} to={path} end={path === ''}
            className={({ isActive }) => `apple-sidebar-item ${isActive ? 'active' : ''}`}
          >
            <Icon size={17} /><span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-gray-100 space-y-1">
        <a href="/" className="w-full apple-sidebar-item hover:bg-gray-50 flex items-center gap-3 justify-start text-apple-ink">
          <Home size={17} /> Back to Home
        </a>
        <button onClick={onSignOut} className="w-full apple-sidebar-item text-red-500 hover:bg-red-50">
          <LogOut size={17} /> Sign Out
        </button>
      </div>
    </aside>
  )
}

const fadePage = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22,1,0.36,1] } } }

function Overview() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState({ bookings: 0, donated: 0, upcoming: 0 })
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const fetchStats = async () => {
      try {
        const { data: bData } = await supabase.from('bookings').select('*, services(name)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5)
        const { data: dData } = await supabase.from('e_undiyal_transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5)
        
        let totalDonated = 0
        const { data: allD } = await supabase.from('e_undiyal_transactions').select('amount_rupees').eq('user_id', user.id).eq('status', 'success')
        if (allD) {
          totalDonated = allD.reduce((sum, item) => sum + item.amount_rupees, 0)
        }
        
        let upcoming = 0
        const today = new Date().toISOString().split('T')[0]
        const { data: allB } = await supabase.from('bookings').select('date').eq('user_id', user.id).eq('status', 'confirmed')
        if (allB) {
          upcoming = allB.filter(b => b.date >= today).length
        }

        setStats({ bookings: allB?.length || 0, donated: totalDonated, upcoming })
        
        const recent = []
        if (bData) recent.push(...bData.map(b => ({ ...b, _type: 'booking' })))
        if (dData) recent.push(...dData.map(d => ({ ...d, _type: 'donation' })))
        
        recent.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        setActivities(recent.slice(0, 5))

      } catch (e) {} finally { setLoading(false) }
    }
    fetchStats()
  }, [user])

  return (
    <motion.div variants={fadePage} initial="hidden" animate="visible" className="space-y-6">
      <h2 className="text-xl font-semibold text-apple-ink">Welcome back</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Bookings', value: loading ? '...' : stats.bookings.toString(), color: 'text-temple-saffron', icon: CalendarDays },
          { label: 'Total Donated', value: loading ? '...' : `₹${stats.donated.toLocaleString('en-IN')}`, color: 'text-temple-green', icon: HeartHandshake },
          { label: 'Upcoming Bookings', value: loading ? '...' : stats.upcoming.toString(), color: 'text-apple-blue', icon: CalendarDays },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="apple-stat-card">
            <div className="flex items-center justify-between">
              <p className="text-xs text-apple-muted">{label}</p>
              <Icon size={16} className={color} />
            </div>
            <p className={`text-3xl font-bold ${color} mt-1`}>{value}</p>
          </div>
        ))}
      </div>
      <div className="apple-card">
        <h3 className="text-sm font-semibold text-apple-ink mb-3">Recent Activity</h3>
        {loading ? (
           <div className="text-center py-10"><Loader2 className="animate-spin text-temple-saffron mx-auto" /></div>
        ) : activities.length === 0 ? (
          <div className="text-center py-10 text-apple-muted">
            <CalendarDays size={28} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No activity yet.</p>
            <a href="/services" className="text-temple-saffron font-medium text-sm mt-1 inline-block">Book a Service →</a>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {activities.map(act => (
              <div key={act.id} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${act._type === 'booking' ? 'bg-temple-cream text-temple-saffron' : 'bg-temple-cream text-temple-green'}`}>
                    {act._type === 'booking' ? <CalendarDays size={14} /> : <HeartHandshake size={14} />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-apple-ink">{act._type === 'booking' ? act.services?.name : act.notes || 'General Donation'}</p>
                    <p className="text-xs text-apple-muted">{act._type === 'booking' ? `${act.date} • ${act.session}` : new Date(act.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end">
                  <p className="text-sm font-semibold text-apple-ink">₹{act.amount_rupees}</p>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium mt-0.5 ${
                    act.status === 'confirmed' || act.status === 'success' ? 'bg-temple-green/10 text-temple-green' : 
                    act.status === 'cancelled' || act.status === 'failed' ? 'bg-red-50 text-red-600' :
                    'bg-amber-50 text-amber-600'
                  }`}>
                    {act.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

function DonationsPage() {
  const { user } = useAuthStore()
  const [donations, setDonations] = useState([])
  const [loading, setLoading] = useState(true)
  const [exemptionModal, setExemptionModal] = useState({ isOpen: false, entity: null })

  useEffect(() => {
    if (!user) return
    const fetchDonations = async () => {
      try {
        const { data } = await supabase.from('e_undiyal_transactions').select(`
          *,
          tax_exemptions (status)
        `).eq('user_id', user.id).order('created_at', { ascending: false })
        setDonations(data || [])
      } catch(e) {} finally { setLoading(false) }
    }
    fetchDonations()
  }, [user])

  const handle80gSuccess = (donationId) => {
    setDonations(prev => prev.map(d => 
      d.id === donationId ? { ...d, tax_exemptions: [{ status: 'pending' }] } : d
    ))
  }

  const handleCancelDonation = async (donationId) => {
    try {
      const { data: session } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/donations/${donationId}/cancel`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session?.session?.access_token}`
        }
      })
      if (!res.ok) throw new Error("Failed to cancel donation")
      
      setDonations(prev => prev.map(d => 
        d.id === donationId ? { ...d, status: 'cancelled' } : d
      ))
      toast.success("Donation cancelled successfully.")
    } catch(e) {
      toast.error(e.message)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-temple-saffron" /></div>
  
  if (donations.length === 0) return <EmptySection title="My Donations" icon={HeartHandshake} label="No donations yet." href="/donations" linkLabel="Make a Donation →" />

  return (
    <motion.div variants={fadePage} initial="hidden" animate="visible" className="space-y-4">
      <h2 className="text-xl font-semibold text-apple-ink">My Donations</h2>
      <div className="apple-card space-y-4">
        {donations.map((item) => (
          <div key={item.id} className="flex flex-col p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-temple-cream flex items-center justify-center text-temple-green">
                  <HeartHandshake size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-apple-ink">{item.reference}</p>
                    <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${
                      item.status === 'success' ? 'bg-temple-green/10 text-temple-green' :
                      item.status === 'cancelled' || item.status === 'failed' ? 'bg-red-100 text-red-700' :
                      'bg-apple-amber/10 text-apple-amber'
                    }`}>
                      {item.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-apple-muted mt-0.5">Transaction ID: {item.razorpay_payment_id || item.razorpay_order_id || 'N/A'}</p>
                  <p className="text-xs text-apple-muted mt-0.5">{item.notes} • Paid on: {new Date(item.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-temple-green">₹{item.amount_rupees.toLocaleString('en-IN')}</p>
                {item.status === 'initiated' && (
                  <button 
                    onClick={() => handleCancelDonation(item.id)}
                    className="text-[10px] font-medium text-red-500 hover:text-red-600 mt-1"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
            
            {item.amount_rupees >= 10000 && (
              <div className="pl-14">
                {item.tax_exemptions?.length > 0 ? (
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-amber-50 text-amber-600 border border-amber-200">
                    80G Request: {item.tax_exemptions[0].status.toUpperCase()}
                  </span>
                ) : (
                  <button 
                    onClick={() => setExemptionModal({ isOpen: true, entity: item })}
                    className="text-xs font-medium text-temple-saffron hover:text-temple-green transition-colors flex items-center gap-1"
                  >
                    Request 80G Certificate
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <ExemptionModal 
        isOpen={exemptionModal.isOpen} 
        onClose={() => setExemptionModal({ isOpen: false, entity: null })} 
        entity={exemptionModal.entity} 
        type="donation" 
        onSuccess={handle80gSuccess} 
      />
    </motion.div>
  )
}
function BookingsPage() {
  const { user } = useAuthStore()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [exemptionModal, setExemptionModal] = useState({ isOpen: false, entity: null })

  useEffect(() => {
    if (!user) return
    const fetchBookings = async () => {
      try {
        const { data } = await supabase.from('bookings').select(`
          *,
          services (name),
          tax_exemptions (status)
        `).eq('user_id', user.id).order('created_at', { ascending: false })
        setBookings(data || [])
      } catch(e) {} finally { setLoading(false) }
    }
    fetchBookings()
  }, [user])

  const handle80gSuccess = (bookingId) => {
    setBookings(prev => prev.map(b => 
      b.id === bookingId ? { ...b, tax_exemptions: [{ status: 'pending' }] } : b
    ))
  }

  const handleCancelBooking = async (bookingId) => {
    try {
      const { data: session } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/bookings/${bookingId}/cancel`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session?.session?.access_token}`
        }
      })
      if (!res.ok) throw new Error("Failed to cancel booking")
      
      setBookings(prev => prev.map(b => 
        b.id === bookingId ? { ...b, status: 'cancelled' } : b
      ))
      toast.success("Booking cancelled successfully.")
    } catch(e) {
      toast.error(e.message)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-temple-saffron" /></div>
  
  if (bookings.length === 0) return <EmptySection title="My Bookings" icon={CalendarDays} label="No bookings yet." href="/services" linkLabel="Book a Service →" />

  return (
    <motion.div variants={fadePage} initial="hidden" animate="visible" className="space-y-4">
      <h2 className="text-xl font-semibold text-apple-ink">My Bookings</h2>
      <div className="apple-card space-y-4">
        {bookings.map((item) => (
          <div key={item.id} className="flex flex-col p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-temple-cream flex items-center justify-center text-temple-saffron">
                  <CalendarDays size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-apple-ink">{item.reference}</p>
                    <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${
                      item.status === 'confirmed' ? 'bg-temple-green/10 text-temple-green' :
                      item.status === 'cancelled' || item.status === 'failed' ? 'bg-red-100 text-red-700' :
                      'bg-apple-amber/10 text-apple-amber'
                    }`}>
                      {item.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-apple-muted mt-0.5">Transaction ID: {item.razorpay_payment_id || item.razorpay_order_id || 'N/A'}</p>
                  <p className="text-xs text-apple-muted mt-0.5">{item.services?.name} • Service Date: {item.date} ({item.session}) • {item.num_persons} Persons</p>
                  <p className="text-xs text-apple-muted mt-0.5">Booked on: {new Date(item.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-temple-green">₹{item.amount_rupees}</p>
                {item.status === 'pending_payment' && (
                  <button 
                    onClick={() => handleCancelBooking(item.id)}
                    className="text-[10px] font-medium text-red-500 hover:text-red-600 mt-1"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
            
            {item.amount_rupees >= 10000 && (
              <div className="pl-14">
                {item.tax_exemptions?.length > 0 ? (
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-amber-50 text-amber-600 border border-amber-200">
                    80G Request: {item.tax_exemptions[0].status.toUpperCase()}
                  </span>
                ) : (
                  <button 
                    onClick={() => setExemptionModal({ isOpen: true, entity: item })}
                    className="text-xs font-medium text-temple-saffron hover:text-temple-green transition-colors flex items-center gap-1"
                  >
                    Request 80G Certificate
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <ExemptionModal 
        isOpen={exemptionModal.isOpen} 
        onClose={() => setExemptionModal({ isOpen: false, entity: null })} 
        entity={exemptionModal.entity} 
        type="booking" 
        onSuccess={handle80gSuccess} 
      />
    </motion.div>
  )
}

function EmptySection({ title, icon: Icon, label, href, linkLabel }) {
  return (
    <motion.div variants={fadePage} initial="hidden" animate="visible" className="space-y-4">
      <h2 className="text-xl font-semibold text-apple-ink">{title}</h2>
      <div className="apple-card">
        <div className="text-center py-14 text-apple-muted">
          <Icon size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">{label}</p>
          {href && <a href={href} className="text-temple-saffron text-sm font-medium mt-1 inline-block">{linkLabel}</a>}
        </div>
      </div>
    </motion.div>
  )
}

function ReceiptsPage() {
  const { user } = useAuthStore()
  const [receipts, setReceipts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchReceipts = async () => {
      if (!user) return
      
      try {
        const { data: bData } = await supabase
          .from('bookings')
          .select('id, reference, amount_rupees, created_at, status')
          .eq('user_id', user.id)
          .eq('status', 'confirmed')
          
        const { data: dData } = await supabase
          .from('e_undiyal_transactions')
          .select('id, reference, amount_rupees, created_at, status')
          .eq('user_id', user.id)
          .eq('status', 'success')

        const combined = [
          ...(bData || []).map(b => ({ ...b, type: 'Booking' })),
          ...(dData || []).map(d => ({ ...d, type: 'Donation' }))
        ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        
        setReceipts(combined)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchReceipts()
  }, [user])

  const handleDownload = async (item) => {
    try {
      const endpoint = item.type === 'Booking' 
        ? `/api/bookings/${item.id}/receipt` 
        : `/api/donations/${item.id}/receipt`
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}${endpoint}`, {
        method: 'GET',
      })
      
      if (!response.ok) throw new Error("Failed to generate receipt")
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${item.reference}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (e) {
      toast.error('Failed to download receipt')
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-temple-saffron" /></div>
  }

  if (receipts.length === 0) {
    return <EmptySection title="Receipts" icon={Receipt} label="No receipts yet." />
  }

  return (
    <motion.div variants={fadePage} initial="hidden" animate="visible" className="space-y-4">
      <h2 className="text-xl font-semibold text-apple-ink">My Receipts</h2>
      <div className="apple-card space-y-4">
        {receipts.map((item) => (
          <div key={item.id} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-temple-cream flex items-center justify-center text-temple-saffron">
                <Receipt size={20} />
              </div>
              <div>
                <p className="font-semibold text-sm text-apple-ink">{item.reference}</p>
                <p className="text-xs text-apple-muted">{item.type} • ₹{item.amount_rupees} • {new Date(item.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            <button 
              onClick={() => handleDownload(item)}
              className="p-2 bg-white border border-gray-200 rounded-lg text-temple-saffron hover:bg-temple-saffron hover:text-white hover:border-temple-saffron transition-all shadow-sm"
              title="Download PDF"
            >
              <Download size={18} />
            </button>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

function SettingsPage() {
  const { profile, user, fetchProfile } = useAuthStore()
  const [loading, setLoading] = useState(false)
  
  const [form, setForm] = useState({
    fullName: profile?.full_name || user?.user_metadata?.full_name || '',
    phone: profile?.phone || user?.user_metadata?.phone || ''
  })

  // Sync if profile loads after mount
  useEffect(() => {
    if (profile || user) {
      setForm({
        fullName: profile?.full_name || user?.user_metadata?.full_name || '',
        phone: profile?.phone || user?.user_metadata?.phone || ''
      })
    }
  }, [profile, user])

  const handleSave = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      // 1. Update Auth metadata
      const { error: authErr } = await supabase.auth.updateUser({
        data: { full_name: form.fullName, phone: form.phone }
      })
      if (authErr) throw authErr

      // 2. Update public users table
      const { error: dbErr } = await supabase
        .from('users')
        .update({ full_name: form.fullName, phone: form.phone, updated_at: new Date().toISOString() })
        .eq('id', user.id)
      
      if (dbErr) throw dbErr

      await fetchProfile(user.id)
      toast.success('Profile updated successfully!')
    } catch (err) {
      toast.error(err.message || 'Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div variants={fadePage} initial="hidden" animate="visible" className="space-y-4">
      <h2 className="text-xl font-semibold text-apple-ink">Account Settings</h2>
      <form onSubmit={handleSave} className="apple-card space-y-4">
        <h3 className="text-sm font-semibold text-apple-ink">Profile Information</h3>
        
        <div>
          <label className="text-xs text-apple-muted">Full Name</label>
          <input className="w-full mt-1 px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-apple-ink focus:ring-2 focus:ring-temple-saffron/30" 
            value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} required />
        </div>
        
        <div>
          <label className="text-xs text-apple-muted">Phone Number</label>
          <input className="w-full mt-1 px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-apple-ink focus:ring-2 focus:ring-temple-saffron/30" 
            value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} required />
        </div>
        
        <div>
          <label className="text-xs text-apple-muted">Email Address (Cannot be changed)</label>
          <input className="w-full mt-1 px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-500 cursor-not-allowed" 
            defaultValue={profile?.email || user?.email || ''} readOnly />
        </div>
        
        <button type="submit" disabled={loading} className="px-5 py-2.5 rounded-xl bg-temple-saffron text-white text-sm font-semibold shadow-glowing-orange hover:bg-temple-saffron-hover transition flex items-center gap-2 disabled:opacity-50">
          {loading && <Loader2 size={16} className="animate-spin" />} Save Changes
        </button>
      </form>
    </motion.div>
  )
}

export default function Dashboard() {
  const { signOut } = useAuthStore()
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-apple-bg font-display">
      <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 sm:px-6 gap-4 sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <img src={logoGold} alt="Temple" className="w-7 h-7 object-contain" />
          <a href="/" className="font-serif text-sm font-bold text-temple-brown hover:text-temple-saffron transition-colors">
            Arulmigu Manakula Vinayagar
          </a>
        </div>
        <div className="flex-1" />
        <span className="apple-badge apple-badge-green">Devotee</span>
      </header>
      <div className="flex h-[calc(100vh-56px)]">
        <Sidebar onSignOut={async () => { await signOut(); navigate('/') }} />
        <main className="flex-1 overflow-y-auto p-6">
          <Routes>
            <Route index element={<Overview />} />
            <Route path="bookings" element={<BookingsPage />} />
            <Route path="donations" element={<DonationsPage />} />
            <Route path="receipts" element={<ReceiptsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
