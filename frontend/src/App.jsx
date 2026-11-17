import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useAuthStore } from './store'

import Landing from './pages/Landing'
import Services from './pages/Services'
import BookingFlow from './pages/BookingFlow'
import BookingSuccess from './pages/BookingSuccess'
import Dashboard from './pages/Dashboard'
import AdminDashboard from './pages/AdminDashboard'
import AdminLogin from './pages/AdminLogin'
import AuthModal from './components/layout/AuthModal'
import NoticeBanner from './components/layout/NoticeBanner'
import Donations from './pages/Donations'

function ActivityTracker() {
  const location = useLocation()
  const { session, profile } = useAuthStore()

  useEffect(() => {
    // Only track public/devotee routes or logins
    if (location.pathname.startsWith('/admin')) return

    try {
      fetch(`${import.meta.env.VITE_API_URL}/api/admin/audit-logs/activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_type: 'PAGE_VISIT',
          page_url: location.pathname,
          user_id: session?.user?.id || null,
          user_name: profile?.full_name || session?.user?.email || 'Visitor',
          user_role: profile?.role || 'devotee'
        })
      }).catch(() => {})
    } catch (e) {}
  }, [location.pathname, session?.user?.id])

  return null
}

function PrivateRoute({ children }) {
  const { session, isLoading } = useAuthStore()
  if (isLoading) return null
  return session ? children : <Navigate to="/" replace />
}

function AdminRoute({ children }) {
  const { profile, session, isLoading } = useAuthStore()
  if (isLoading) return null
  if (!session) return <Navigate to="/admin/login" replace />
  const role = profile?.role
  if (!role || !['admin', 'super_admin'].includes(role)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const init = useAuthStore((s) => s.init)
  useEffect(() => { init() }, [init])

  return (
    <BrowserRouter>
      <ActivityTracker />
      <NoticeBanner />
      <AuthModal />
      <Toaster position="top-right" richColors expand />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/services" element={<Services />} />
        <Route path="/book/:serviceId" element={<BookingFlow />} />
        <Route path="/booking/success" element={<BookingSuccess />} />
        <Route path="/donations" element={<Donations />} />
        <Route path="/dashboard/*" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/*" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
