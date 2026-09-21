import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabaseClient'
import { Search, Filter, Check, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function BookingsManager() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all, pending_payment, confirmed, cancelled
  const [actionLoading, setActionLoading] = useState(null)
  
  const [cancelModal, setCancelModal] = useState({ open: false, id: null, reason: '' })

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [phone, setPhone] = useState('')

  const fetchBookings = async () => {
    try {
      setLoading(true)
      const { data: session } = await supabase.auth.getSession()
      const url = new URL(`${import.meta.env.VITE_API_URL}/api/admin/bookings`)
      if (filter !== 'all') url.searchParams.append('status', filter)
      if (startDate && endDate) {
        url.searchParams.append('start_date', startDate)
        url.searchParams.append('end_date', endDate)
      }
      if (phone.trim()) {
        url.searchParams.append('phone', phone.trim())
      }
      
      const res = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${session?.session?.access_token}` }
      })
      if (!res.ok) throw new Error("Failed to fetch bookings")
      const data = await res.json()
      setBookings(data)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchBookings()
    }, 500)
    return () => clearTimeout(delayDebounceFn)
  }, [filter, startDate, endDate, phone])

  const handleStatusUpdate = async (id, status, reason = null) => {
    setActionLoading(id)
    try {
      const { data: session } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/bookings/${id}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session?.session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status, reason })
      })
      if (!res.ok) throw new Error("Failed to update status")
      toast.success(`Booking ${status}`)
      setCancelModal({ open: false, id: null, reason: '' })
      fetchBookings()
    } catch(e) {
      toast.error(e.message)
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-apple-ink">Bookings</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-apple-muted" size={16} />
            <input 
              type="text" 
              placeholder="Search mobile number..."
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="apple-input pl-9 py-1.5 text-sm w-48"
            />
          </div>
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
          </div>
          <select 
            className="apple-input text-sm py-1.5"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending_payment">Pending Payment</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="apple-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-apple-ink">
            <thead className="bg-gray-50 border-b border-gray-100 text-apple-muted text-xs uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Ref / Date</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Service</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="5" className="text-center py-10"><Loader2 className="animate-spin mx-auto text-temple-saffron" /></td></tr>
              ) : bookings.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-10 text-apple-muted">No bookings found.</td></tr>
              ) : (
                bookings.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="font-semibold">{b.reference}</div>
                      <div className="text-xs text-apple-muted">{b.date} • {b.session}</div>
                      <div className="text-[10px] text-apple-muted mt-1">Paid: {new Date(b.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{b.user_name}</div>
                      <div className="text-xs text-apple-muted">{b.user_phone}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{b.service_name}</div>
                      <div className="font-medium text-temple-green">₹{b.amount_rupees}</div>
                      {b.razorpay_payment_id && <div className="text-[10px] text-apple-muted mt-1 font-mono">Txn ID: {b.razorpay_payment_id}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        b.status === 'confirmed' ? 'bg-temple-cream text-temple-green border-temple-green/20 border' :
                        b.status === 'pending_payment' ? 'bg-amber-50 text-amber-600 border-amber-200 border' :
                        'bg-red-50 text-red-600 border-red-200 border'
                      }`}>
                        {b.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(b.status === 'confirmed' || b.status === 'pending_payment') && (
                        <button
                          onClick={() => setCancelModal({ open: true, id: b.id, reason: '' })}
                          disabled={actionLoading === b.id}
                          className="apple-button-secondary text-xs px-2 py-1 text-red-600 hover:bg-red-50"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {cancelModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold text-apple-ink mb-2">Cancel Booking</h3>
            <p className="text-sm text-apple-muted mb-4">Provide a reason for cancellation. This will be emailed to the user.</p>
            <textarea 
              className="apple-input w-full mb-4 text-sm"
              rows={3}
              placeholder="e.g. Temple is closed due to unforeseen circumstances."
              value={cancelModal.reason}
              onChange={(e) => setCancelModal({ ...cancelModal, reason: e.target.value })}
            />
            <div className="flex gap-2 justify-end">
              <button 
                onClick={() => setCancelModal({ open: false, id: null, reason: '' })}
                className="apple-button-secondary py-1.5 text-sm"
              >
                Close
              </button>
              <button 
                onClick={() => handleStatusUpdate(cancelModal.id, 'cancelled', cancelModal.reason)}
                className="apple-button bg-red-600 hover:bg-red-700 text-white py-1.5 text-sm"
              >
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
