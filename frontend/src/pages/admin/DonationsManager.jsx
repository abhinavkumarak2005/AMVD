import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'

export default function DonationsManager() {
  const [donations, setDonations] = useState([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [phone, setPhone] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [actionLoading, setActionLoading] = useState(null)

  const fetchDonations = async () => {
    try {
      setLoading(true)
      const { data: session } = await supabase.auth.getSession()
      const url = new URL(`${import.meta.env.VITE_API_URL}/api/admin/donations`)
      if (startDate && endDate) {
        url.searchParams.append('start_date', startDate)
        url.searchParams.append('end_date', endDate)
      }
      if (phone.trim()) {
        url.searchParams.append('phone', phone.trim())
      }
      if (statusFilter !== 'all') {
        url.searchParams.append('status', statusFilter)
      }
      
      const res = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${session?.session?.access_token}` }
      })
      if (!res.ok) throw new Error("Failed to fetch donations")
      const data = await res.json()
      setDonations(data)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async (id, status) => {
    setActionLoading(id)
    try {
      const { data: session } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/donations/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.session?.access_token}`
        },
        body: JSON.stringify({ status })
      })
      if (!res.ok) throw new Error("Failed to update status")
      toast.success(`Donation ${status}`)
      fetchDonations()
    } catch(e) {
      toast.error(e.message)
    } finally {
      setActionLoading(null)
    }
  }

  // Fetch when filters change, but debounce phone typing slightly by using a form submit or just leaving it to useEffect
  useEffect(() => {
    // Basic debounce for typing
    const delayDebounceFn = setTimeout(() => {
      fetchDonations()
    }, 500)
    return () => clearTimeout(delayDebounceFn)
  }, [startDate, endDate, phone, statusFilter])

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-apple-ink">Donations (E-Undiyal)</h2>
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
            {(startDate || endDate) && (
              <button 
                onClick={() => { setStartDate(''); setEndDate(''); }} 
                className="px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-md font-medium"
              >
                Clear
              </button>
            )}
          </div>
          <select 
            className="apple-input text-sm py-1.5"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="success">Success</option>
            <option value="initiated">Initiated</option>
            <option value="failed">Failed</option>
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
                <th className="px-4 py-3 font-medium">Donor Details</th>
                <th className="px-4 py-3 font-medium">Amount (₹)</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Notes</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="5" className="text-center py-10"><Loader2 className="animate-spin mx-auto text-temple-saffron" /></td></tr>
              ) : donations.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-10 text-apple-muted">No donations found.</td></tr>
              ) : (
                donations.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50/50 align-top">
                    <td className="px-4 py-3">
                      <div className="font-semibold">{d.reference}</div>
                      <div className="text-[10px] text-apple-muted mt-1">{new Date(d.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{d.user_name}</div>
                      <div className="text-xs text-apple-muted mt-0.5">{d.user_email}</div>
                      <div className="text-xs text-apple-muted">{d.user_phone}</div>
                    </td>
                    <td className="px-4 py-3 font-medium text-temple-green">
                      <div>₹{d.amount_rupees}</div>
                      {d.razorpay_payment_id && <div className="text-[10px] text-apple-muted mt-1 font-mono font-normal leading-tight">Txn ID: {d.razorpay_payment_id}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                        d.status === 'success' ? 'bg-temple-green/10 text-temple-green' :
                        d.status === 'failed' ? 'bg-red-100 text-red-700' :
                        'bg-apple-amber/10 text-apple-amber'
                      }`}>
                        {d.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-apple-muted">
                      {d.notes || '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {d.status === 'initiated' && (
                        <button
                          onClick={() => handleStatusUpdate(d.id, 'cancelled')}
                          disabled={actionLoading === d.id}
                          className="apple-button-secondary text-xs px-2 py-1 text-red-600 hover:bg-red-50"
                        >
                          {actionLoading === d.id ? <Loader2 size={12} className="animate-spin" /> : 'Cancel'}
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
    </div>
  )
}
