import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Loader2, CalendarX2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export default function CalendarManager() {
  const [blocks, setBlocks] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [dateStr, setDateStr] = useState('')
  const [reason, setReason] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [services, setServices] = useState([])
  const [submitting, setSubmitting] = useState(false)

  const fetchBlocks = async () => {
    try {
      const { data: session } = await supabase.auth.getSession()
      
      const [blocksRes, servicesRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/api/admin/calendar/blocks`, {
          headers: { 'Authorization': `Bearer ${session?.session?.access_token}` }
        }),
        fetch(`${import.meta.env.VITE_API_URL}/api/admin/services`, {
          headers: { 'Authorization': `Bearer ${session?.session?.access_token}` }
        })
      ])
      
      if (!blocksRes.ok) throw new Error("Failed to fetch blocks")
      const data = await blocksRes.json()
      setBlocks(data)
      
      if (servicesRes.ok) {
        const sData = await servicesRes.json()
        setServices(sData)
      }
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBlocks()
  }, [])

  const handleBlock = async (e) => {
    e.preventDefault()
    if (!dateStr || !reason) return toast.error("Please provide date and reason")
    
    setSubmitting(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/calendar/block`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ date: dateStr, reason, service_id: serviceId || null })
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Failed to block date")
      
      if (data.affected_bookings?.length > 0) {
        toast.error(`Date blocked, but there are ${data.affected_bookings.length} existing bookings. Please go to Bookings to cancel them.`, { duration: 6000 })
      } else {
        toast.success(data.message)
      }
      
      setDateStr('')
      setReason('')
      fetchBlocks()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleUnblock = async (date) => {
    try {
      const { data: session } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/calendar/block/${date}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session?.session?.access_token}` }
      })
      if (!res.ok) throw new Error("Failed to unblock date")
      toast.success("Date unblocked")
      fetchBlocks()
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-apple-ink">Calendar & Closures</h2>
      
      <div className="apple-card max-w-lg">
        <h3 className="text-sm font-bold text-apple-ink mb-4 flex items-center gap-2">
          <CalendarX2 size={18} className="text-red-500" />
          Block a Date
        </h3>
        <form onSubmit={handleBlock} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-apple-muted mb-1">Date to Block</label>
            <input 
              type="date" 
              className="apple-input w-full"
              value={dateStr}
              onChange={e => setDateStr(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-apple-muted mb-1">Service (Optional)</label>
            <select 
              className="apple-input w-full"
              value={serviceId}
              onChange={e => setServiceId(e.target.value)}
            >
              <option value="">All Services (Full Block)</option>
              {services.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-apple-muted mb-1">Reason (Internal)</label>
            <input 
              type="text" 
              className="apple-input w-full"
              placeholder="e.g., Kumbabishegam"
              value={reason}
              onChange={e => setReason(e.target.value)}
              required
            />
          </div>
          <button 
            type="submit" 
            disabled={submitting}
            className="apple-button w-full flex justify-center py-2"
          >
            {submitting ? <Loader2 className="animate-spin" /> : "Block Date"}
          </button>
        </form>
      </div>

      <div className="apple-card p-0 overflow-hidden">
        <table className="w-full text-left text-sm text-apple-ink">
          <thead className="bg-gray-50 border-b border-gray-100 text-apple-muted text-xs uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Blocked Date</th>
              <th className="px-4 py-3 font-medium">Target</th>
              <th className="px-4 py-3 font-medium">Reason</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan="3" className="text-center py-10"><Loader2 className="animate-spin mx-auto text-temple-saffron" /></td></tr>
            ) : blocks.length === 0 ? (
              <tr><td colSpan="3" className="text-center py-10 text-apple-muted">No dates currently blocked.</td></tr>
            ) : (
              blocks.map(b => (
                <tr key={b.date} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium">{new Date(b.date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-xs">
                    {b.status === 'blocked' ? (
                      <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full font-medium">All Services</span>
                    ) : (
                      <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full font-medium">
                        {b.service_ids?.map(id => services.find(s => s.id === id)?.name || id).join(', ')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-apple-muted">{b.reason}</td>
                  <td className="px-4 py-3 text-right">
                    <button 
                      onClick={() => handleUnblock(b.date)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Unblock Date"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
