import React, { useState, useEffect } from 'react'
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, CalendarCheck, Settings2, Users, Bell,
  FileBarChart2, CalendarRange, LogOut, ShieldCheck,
  TrendingUp, IndianRupee, Clock, Home, Shield, HeartHandshake, FileClock, Settings
} from 'lucide-react'
import { useAuthStore } from '../store'
import logoGold from '../assets/logo-gold.png'
import { supabase } from '../lib/supabaseClient'
import { Loader2 } from 'lucide-react'
import BookingsManager from './admin/BookingsManager'
import ServicesManager from './admin/ServicesManager'
import UserManager from './admin/UserManager'
import RolesManager from './admin/RolesManager'
import CalendarManager from './admin/CalendarManager'
import NoticesManager from './admin/NoticesManager'
import DonationsManager from './admin/DonationsManager'
import AuditLogsManager from './admin/AuditLogsManager'
import ReportsManager from './admin/ReportsManager'
import TaxExemptionsManager from './admin/TaxExemptionsManager'
import SettingsManager from './admin/SettingsManager'

const ADMIN_NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '', perm: 'any' },
  { label: 'Bookings', icon: CalendarCheck, path: 'bookings', perm: 'manage_bookings' },
  { label: 'Services', icon: Settings2, path: 'services', perm: 'manage_services' },
  { label: 'Calendar', icon: CalendarRange, path: 'calendar', perm: 'manage_calendar' },
  { label: 'User Management', icon: Users, path: 'users', perm: 'manage_users' },
  { label: 'Roles & Perms', icon: Shield, path: 'roles', perm: 'manage_roles' },
  { label: 'Audit Logs', icon: FileClock, path: 'audit-logs', perm: 'manage_roles' },
  { label: 'Notices', icon: Bell, path: 'notices', perm: 'manage_notices' },
  { label: 'Donations', icon: HeartHandshake, path: 'donations', perm: 'view_reports' },
  { label: 'Reports', icon: FileBarChart2, path: 'reports', perm: 'view_reports' },
  { label: 'Tax Exemptions', icon: ShieldCheck, path: 'tax-exemptions', perm: 'manage_exemptions' },
  { label: 'Settings', icon: Settings, path: 'settings', perm: 'manage_roles' },
]

function AdminSidebar({ onSignOut, profile, perms }) {
  const visibleNav = ADMIN_NAV.filter(n => n.perm === 'any' || perms?.all || perms?.[n.perm])

  return (
    <aside className="apple-sidebar hidden md:flex">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <img src={logoGold} alt="Temple" className="w-8 h-8 object-contain" />
          <div>
            <p className="text-xs font-bold text-apple-ink leading-tight">Sri Manakula CMS</p>
            <p className="text-[10px] text-apple-muted capitalize">{profile?.role?.replace(/_/g, ' ') || 'Admin'} Portal</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 px-2 py-3 overflow-y-auto">
        {visibleNav.map(({ label, icon: Icon, path }) => (
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

function AdminOverview() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchDashboard = async () => {
    try {
      setLoading(true)
      const { data: session } = await supabase.auth.getSession()
      const url = new URL(`${import.meta.env.VITE_API_URL}/api/admin/dashboard`)
      if (startDate && endDate) {
        url.searchParams.append('start_date', startDate)
        url.searchParams.append('end_date', endDate)
      }
      const res = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${session?.session?.access_token}` }
      })
      if (!res.ok) throw new Error("Failed to fetch dashboard")
      const d = await res.json()
      setData(d)
    } catch(e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboard()
  }, [startDate, endDate])

  const kpis = [
    { label: 'Revenue', value: `₹${data?.revenue || 0}`, icon: IndianRupee, color: 'text-temple-green' },
    { label: 'Total Bookings', value: data?.bookings || 0, icon: CalendarCheck, color: 'text-temple-saffron' },
    { label: 'Donations (₹)', value: `₹${data?.total_donations || 0}`, icon: HeartHandshake, color: 'text-temple-gold' },
    { label: 'Total Donations', value: data?.donations_count || 0, icon: Users, color: 'text-apple-blue' },
    { label: 'Pending Approvals', value: data?.pending_approvals || 0, icon: Clock, color: 'text-apple-amber' },
  ]
  return (
    <motion.div variants={fadePage} initial="hidden" animate="visible" className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-apple-ink">Dashboard</h1>
        <div className="flex items-center gap-2 text-sm bg-white p-1 rounded-lg border border-gray-100 shadow-sm">
          <input 
            type="date" 
            className="apple-input py-1.5 border-none bg-transparent"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />
          <span className="text-apple-muted">to</span>
          <input 
            type="date" 
            className="apple-input py-1.5 border-none bg-transparent"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
          />
          {(startDate || endDate) && (
            <button 
              onClick={() => { setStartDate(''); setEndDate(''); }} 
              className="px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-md font-medium"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="apple-stat-card">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-apple-muted">{label}</p>
              <Icon size={15} className={color} />
            </div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="apple-card overflow-hidden p-0">
          <div className="p-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-apple-ink">Recent Bookings</h3>
          </div>
          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-temple-saffron" /></div>
            ) : !data?.recent_bookings?.length ? (
              <div className="p-10 text-center text-apple-muted text-sm">No recent bookings</div>
            ) : (
              data.recent_bookings.map(b => (
                <div key={b.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-medium text-apple-ink">{b.user_name}</p>
                    <p className="text-xs text-apple-muted">{b.service_name} • {new Date(b.date).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase ${b.status === 'confirmed' ? 'bg-temple-green/10 text-temple-green' : 'bg-apple-amber/10 text-apple-amber'}`}>
                    {b.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="apple-card overflow-hidden p-0">
          <div className="p-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-apple-ink">Recent Donations</h3>
          </div>
          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-temple-saffron" /></div>
            ) : !data?.recent_donations?.length ? (
              <div className="p-10 text-center text-apple-muted text-sm">No recent donations</div>
            ) : (
              data.recent_donations.map(d => (
                <div key={d.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-medium text-apple-ink">{d.user_name}</p>
                    <p className="text-xs text-apple-muted">{new Date(d.created_at).toLocaleDateString()} • {d.reference}</p>
                  </div>
                  <span className="text-sm font-bold text-temple-green">
                    ₹{d.amount_rupees}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}



function Placeholder({ title, desc }) {
  return (
    <motion.div variants={fadePage} initial="hidden" animate="visible" className="space-y-4">
      <h2 className="text-xl font-semibold text-apple-ink">{title}</h2>
      <div className="apple-card">
        <div className="text-center py-16 text-apple-muted text-sm">
          {desc || 'Coming in Phase 5 — in development'}
        </div>
      </div>
    </motion.div>
  )
}

export default function AdminDashboard() {
  const { signOut, profile } = useAuthStore()
  const navigate = useNavigate()
  const [perms, setPerms] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchPerms() {
      try {
        const { data: session } = await supabase.auth.getSession()
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/my_permissions`, {
          headers: { 'Authorization': `Bearer ${session?.session?.access_token}` }
        })
        if (res.ok) {
          const data = await res.json()
          setPerms(data)
        } else {
          setPerms({})
        }
      } catch (e) {
        setPerms({})
      } finally {
        setLoading(false)
      }
    }
    fetchPerms()
  }, [])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-apple-bg"><Loader2 className="animate-spin text-temple-saffron" /></div>
  }

  const hasPerm = (p) => perms?.all || perms?.[p]

  return (
    <div className="min-h-screen bg-apple-bg font-display">
      <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 sm:px-6 gap-3 sticky top-0 z-20">
        <img src={logoGold} alt="Temple" className="w-7 h-7 object-contain" />
        <span className="font-bold text-sm text-apple-ink">Sri Manakula Vinayagar — Admin CMS</span>
        <div className="flex-1" />
        <span className={`apple-badge ${perms?.all ? 'apple-badge-purple' : 'apple-badge-blue'}`}>
          {profile?.role?.replace(/_/g, ' ') || 'Admin'}
        </span>
      </header>

      <div className="flex h-[calc(100vh-56px)]">
        <AdminSidebar profile={profile} perms={perms} onSignOut={async () => { await signOut(); navigate('/admin/login') }} />
        <main className="flex-1 overflow-y-auto p-6">
          <Routes>
            <Route index element={<AdminOverview />} />
            {hasPerm('manage_bookings') && <Route path="bookings" element={<BookingsManager />} />}
            {hasPerm('manage_services') && <Route path="services" element={<ServicesManager />} />}
            {hasPerm('manage_users') && <Route path="users" element={<UserManager />} />}
            {hasPerm('manage_roles') && <Route path="roles" element={<RolesManager />} />}
            {hasPerm('manage_roles') && <Route path="audit-logs" element={<AuditLogsManager />} />}
            {hasPerm('manage_calendar') && <Route path="calendar" element={<CalendarManager />} />}
            {hasPerm('manage_notices') && <Route path="notices" element={<NoticesManager />} />}
            {hasPerm('view_reports') && <Route path="reports" element={<ReportsManager />} />}
            {hasPerm('view_reports') && <Route path="donations" element={<DonationsManager />} />}
            {hasPerm('manage_exemptions') && <Route path="tax-exemptions" element={<TaxExemptionsManager />} />}
            {hasPerm('manage_roles') && <Route path="settings" element={<SettingsManager />} />}
            <Route path="*" element={<div className="py-20 text-center text-apple-muted">Select an option from the sidebar.</div>} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
