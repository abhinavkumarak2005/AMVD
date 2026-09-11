import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { toast } from 'sonner'

export default function ExemptionModal({ isOpen, onClose, entity, type, onSuccess }) {
  const [pan, setPan] = useState('')
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)

  if (!isOpen || !entity) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!pan || !address) return toast.error("Please provide both PAN and Address.")
    
    setLoading(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/exemptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.session?.access_token}`
        },
        body: JSON.stringify({
          booking_id: type === 'booking' ? entity.id : undefined,
          ehundi_id: type === 'donation' ? entity.id : undefined,
          pan_number: pan,
          address: address
        })
      })
      
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || "Failed to request 80G")
      }
      
      toast.success("80G certificate requested successfully!")
      onSuccess(entity.id)
      onClose()
    } catch(e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-0">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
          className="absolute inset-0 bg-apple-ink/20 backdrop-blur-sm" onClick={onClose} 
        />
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
          className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
        >
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <h3 className="font-display font-semibold text-apple-ink text-lg">Request 80G Exemption</h3>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 text-apple-muted transition-colors"><X size={20} /></button>
          </div>
          
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <p className="text-sm text-apple-muted">
              You are requesting an 80G Tax Exemption Certificate for {type === 'donation' ? 'Donation' : 'Booking'} <span className="font-semibold text-apple-ink">{entity.reference}</span> (₹{entity.amount_rupees}).
            </p>
            
            <div className="space-y-1">
              <label className="text-xs font-semibold text-apple-ink uppercase tracking-wider">PAN Number</label>
              <input 
                type="text" 
                required
                value={pan}
                onChange={e => setPan(e.target.value.toUpperCase())}
                placeholder="ABCDE1234F"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-temple-green focus:ring-1 focus:ring-temple-green outline-none transition-all uppercase"
                pattern="[A-Z]{5}[0-9]{4}[A-Z]{1}"
                title="Please enter a valid 10-character PAN number"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-apple-ink uppercase tracking-wider">Full Address</label>
              <textarea 
                required
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Required for the certificate..."
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-temple-green focus:ring-1 focus:ring-temple-green outline-none transition-all min-h-[100px] resize-none"
              />
            </div>

            <button type="submit" disabled={loading} className="w-full bg-temple-green hover:bg-[#1f5a3c] text-white py-3 rounded-xl font-semibold flex items-center justify-center transition-colors">
              {loading ? <Loader2 size={20} className="animate-spin" /> : "Submit Request"}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
