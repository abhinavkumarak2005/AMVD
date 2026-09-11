import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Search, Check, X, Eye } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { toast } from 'sonner'

export default function TaxExemptionsManager() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedReq, setSelectedReq] = useState(null)
  
  useEffect(() => {
    fetchRequests()
  }, [])

  const fetchRequests = async () => {
    try {
      const { data: session } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/tax-exemptions`, {
        headers: { 'Authorization': `Bearer ${session?.session?.access_token}` }
      })
      if (res.ok) {
        setRequests(await res.json())
      }
    } catch(e) {
      toast.error("Failed to load requests")
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStatus = async (id, status) => {
    try {
      const { data: session } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/tax-exemptions/${id}/status`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.session?.access_token}` 
        },
        body: JSON.stringify({ status })
      })
      if (!res.ok) throw new Error("Update failed")
      
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r))
      toast.success(`Request marked as ${status}`)
      setSelectedReq(null)
    } catch(e) {
      toast.error(e.message)
    }
  }

  const filtered = requests.filter(r => 
    r.pan_number.toLowerCase().includes(search.toLowerCase()) || 
    r.user_name.toLowerCase().includes(search.toLowerCase()) ||
    (r.booking_reference || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.donation_reference || '').toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-temple-saffron" /></div>

  return (
    <div className="space-y-6 relative h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-apple-ink">80G Tax Exemptions</h2>
          <p className="text-sm text-apple-muted mt-1">Review and approve tax exemption requests.</p>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm flex flex-col min-h-0 flex-1">
        <div className="p-4 border-b border-gray-100 flex items-center gap-4 bg-gray-50/50 rounded-t-2xl">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="Search by PAN, Name, or Reference..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-temple-green/20 focus:border-temple-green transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-semibold text-apple-muted uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-semibold text-apple-muted uppercase tracking-wider">Donor / PAN</th>
                <th className="px-6 py-4 text-xs font-semibold text-apple-muted uppercase tracking-wider">Reference</th>
                <th className="px-6 py-4 text-xs font-semibold text-apple-muted uppercase tracking-wider text-right">Amount</th>
                <th className="px-6 py-4 text-xs font-semibold text-apple-muted uppercase tracking-wider text-center">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-apple-muted uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(req => (
                <tr key={req.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm text-apple-muted whitespace-nowrap">
                    {new Date(req.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-semibold text-apple-ink">{req.user_name}</p>
                    <p className="text-xs text-apple-muted uppercase tracking-widest mt-0.5">{req.pan_number}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                      {req.booking_reference || req.donation_reference}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-temple-green text-right whitespace-nowrap">
                    ₹{req.amount_rupees.toLocaleString('en-IN')}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      req.status === 'approved' ? 'bg-green-100 text-green-700' :
                      req.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {req.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => setSelectedReq(req)}
                      className="text-apple-ink hover:text-temple-green p-1 transition-colors"
                    >
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan="6" className="px-6 py-10 text-center text-apple-muted text-sm">No requests found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {selectedReq && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-apple-ink/20 backdrop-blur-sm" onClick={() => setSelectedReq(null)} 
            />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <h3 className="font-display font-semibold text-apple-ink text-lg">Review Request</h3>
                <button onClick={() => setSelectedReq(null)} className="p-1 rounded-full hover:bg-gray-100"><X size={20} /></button>
              </div>
              
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-apple-muted uppercase">Name</p>
                    <p className="text-sm font-medium text-apple-ink">{selectedReq.user_name}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-apple-muted uppercase">PAN</p>
                    <p className="text-sm font-medium text-apple-ink uppercase tracking-widest">{selectedReq.pan_number}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-apple-muted uppercase">Phone</p>
                    <p className="text-sm font-medium text-apple-ink">{selectedReq.user_phone}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-apple-muted uppercase">Email</p>
                    <p className="text-sm font-medium text-apple-ink truncate">{selectedReq.user_email}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-apple-muted uppercase">Amount</p>
                    <p className="text-sm font-bold text-temple-green">₹{selectedReq.amount_rupees.toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-apple-muted uppercase">Reference</p>
                    <p className="text-sm font-medium text-apple-ink">{selectedReq.booking_reference || selectedReq.donation_reference}</p>
                  </div>
                </div>
                
                <div>
                  <p className="text-xs font-semibold text-apple-muted uppercase">Address</p>
                  <p className="text-sm text-apple-ink mt-1 bg-gray-50 p-3 rounded-lg whitespace-pre-wrap">{selectedReq.address}</p>
                </div>

                {selectedReq.status === 'pending' && (
                  <div className="flex gap-3 pt-2">
                    <button 
                      onClick={() => handleUpdateStatus(selectedReq.id, 'rejected')}
                      className="flex-1 bg-white border border-red-200 text-red-600 hover:bg-red-50 py-2.5 rounded-xl font-semibold transition-colors"
                    >
                      Reject
                    </button>
                    <button 
                      onClick={() => handleUpdateStatus(selectedReq.id, 'approved')}
                      className="flex-1 bg-temple-green hover:bg-[#1f5a3c] text-white py-2.5 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      <Check size={18} /> Approve
                    </button>
                  </div>
                )}
                {selectedReq.status !== 'pending' && (
                  <div className="pt-2 text-center text-sm font-medium text-apple-muted">
                    This request was {selectedReq.status}.
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
