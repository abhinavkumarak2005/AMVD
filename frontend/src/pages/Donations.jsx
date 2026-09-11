import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Lock } from 'lucide-react'
import Header from '../components/layout/Header'
import { useAuthStore } from '../store'
import api from '../lib/api'
import { toast } from 'sonner'
import ExemptionModal from '../components/layout/ExemptionModal'

export default function Donations() {
  const { session, openAuthModal } = useAuthStore()
  const navigate = useNavigate()
  
  // Preset amounts based on the reference image
  const PRESETS = [100, 500, 1000, 2500, 5000]
  
  const [amount, setAmount] = useState(1000)
  const [isCustom, setIsCustom] = useState(false)
  const [customAmount, setCustomAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [exemptionLimit, setExemptionLimit] = useState(10000)

  // Modal State
  const [showModal, setShowModal] = useState(false)
  const [txDetails, setTxDetails] = useState(null)

  React.useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/settings`)
      .then(res => res.json())
      .then(data => {
        if(data['80g_minimum_amount']) setExemptionLimit(Number(data['80g_minimum_amount']))
      })
      .catch(console.error)
  }, [])

  const handleDonate = async () => {
    if (!session) {
      openAuthModal('login')
      return
    }

    const finalAmount = isCustom ? parseInt(customAmount) : amount
    
    if (isNaN(finalAmount) || finalAmount < 10) {
      toast.error('Please enter a valid amount (minimum ₹10)')
      return
    }

    setLoading(true)
    try {
      // 1. Create order
      const { data } = await api.post('/api/donations/create', {
        amount_rupees: finalAmount,
        user_id: session.user.id,
        notes: 'General E-Undiyal' // Hardcoded since we removed the dropdown
      })

      // 2. Open Razorpay
      const rzp = new window.Razorpay({
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        order_id: data.order_id,
        amount: data.amount_rupees * 100,
        currency: 'INR',
        name: 'Sri Manakula Vinayagar',
        description: 'Make Your Offering',
        handler: async (response) => {
          // 3. Fallback manual verify for localhost since webhooks can't reach laptop
          try {
            const res = await api.post('/api/donations/verify', {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature
            })
            
            toast.success('Thank you for your generous offering! 🙏')
            
            if (finalAmount >= exemptionLimit && res.data.id) {
              setTxDetails({ id: res.data.id, reference: res.data.reference, amount_rupees: finalAmount })
              setShowModal(true)
            } else {
              navigate('/dashboard/receipts')
            }
          } catch(e) {
            console.error("Verify failed", e)
            toast.success('Thank you for your generous offering! 🙏')
            navigate('/dashboard/receipts')
          }
        },
        modal: { ondismiss: () => toast.info('Offering cancelled') },
      })
      rzp.open()
    } catch (err) {
      toast.error('Failed to initiate offering. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Helper to format currency safely
  const formatCurrency = (val) => {
    if (isNaN(val)) return '0'
    return new Intl.NumberFormat('en-IN').format(val)
  }

  return (
    <>
      <Header />
      <div className="h-[calc(100vh-56px)] bg-gradient-to-b from-[#EEDDC4] to-[#E5CDAC] flex items-center justify-center p-4 overflow-hidden">
        
        <div className="w-full max-w-sm bg-[#FDFBF7] rounded-[32px] p-6 sm:p-8 shadow-2xl shadow-black/10 border border-white/50 relative overflow-hidden">
          
          <div className="text-center space-y-2 mb-8">
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#3E342B]">Make Your Offering</h1>
            <p className="text-[#967C5E] text-sm sm:text-base">Choose an amount or enter your own contribution</p>
          </div>

          <div className="space-y-6">
            {/* Amount Grid */}
            <div className="grid grid-cols-3 gap-3">
              {PRESETS.map(amt => (
                <button 
                  key={amt}
                  onClick={() => {
                    setAmount(amt)
                    setIsCustom(false)
                  }}
                  className={`
                    py-3.5 rounded-2xl font-bold text-[17px] transition-all duration-200 border-2
                    ${!isCustom && amount === amt 
                      ? 'bg-[#4A5822] text-white border-[#4A5822] shadow-lg shadow-[#4A5822]/30 scale-[1.02]' 
                      : 'bg-transparent text-[#3E342B] border-[#D6C1A4] hover:border-[#4A5822]/50 hover:bg-[#F5F0E6]'
                    }
                  `}
                >
                  ₹{formatCurrency(amt)}
                </button>
              ))}
              
              <button
                onClick={() => setIsCustom(true)}
                className={`
                  py-3.5 rounded-2xl font-bold text-[17px] transition-all duration-200 border-2
                  ${isCustom 
                    ? 'bg-[#4A5822] text-white border-[#4A5822] shadow-lg shadow-[#4A5822]/30 scale-[1.02]' 
                    : 'bg-transparent text-[#3E342B] border-[#D6C1A4] border-dashed hover:bg-[#F5F0E6]'
                  }
                `}
              >
                Custom
              </button>
            </div>

            {/* Custom Amount Input - Only show if Custom is selected */}
            {isCustom && (
              <div className="relative animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-[#967C5E] font-bold text-xl">₹</span>
                </div>
                <input
                  type="number"
                  min="10"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="Enter custom amount"
                  className="w-full pl-10 pr-4 py-4 rounded-2xl border-2 border-[#D6C1A4] text-[#3E342B] text-lg font-medium bg-transparent focus:ring-0 focus:border-[#4A5822] transition-colors outline-none"
                  autoFocus
                />
              </div>
            )}

            {/* Submit Button */}
            <button 
              onClick={handleDonate}
              disabled={loading || (isCustom && (!customAmount || parseInt(customAmount) < 10))}
              className="w-full py-4 rounded-2xl bg-[#4A5822] hover:bg-[#3d491c] text-white font-bold text-xl flex items-center justify-center gap-2 shadow-xl shadow-[#4A5822]/30 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed mt-4"
            >
              {loading ? (
                <Loader2 size={24} className="animate-spin" />
              ) : (
                <>
                  Donate ₹{formatCurrency(isCustom ? (parseInt(customAmount) || 0) : amount)} 
                  <Lock size={18} className="ml-1 text-white/80" fill="currentColor" />
                </>
              )}
            </button>
            
            {/* Divider */}
            <div className="pt-6 pb-2 border-b border-[#E8DCC8]"></div>

            {/* Footer Trust Icons */}
            <div className="text-center space-y-3">
              <p className="text-[#967C5E] text-xs font-medium tracking-wide">
                UPI · Cards · Net Banking · Wallets
              </p>
              <div className="flex items-center justify-center gap-4 text-xs font-bold">
                <span className="text-[#1A1F71]">VISA</span>
                <span className="text-[#EB001B]">Mastercard</span>
                <span className="text-[#FF7A00]">UPI</span>
                <span className="text-[#4A5822]">NetBanking</span>
              </div>
            </div>

          </div>
        </div>
      </div>
      
      <ExemptionModal 
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          navigate('/dashboard/receipts')
        }}
        type="donation"
        entity={txDetails}
        onSuccess={() => {
          setShowModal(false)
          navigate('/dashboard/receipts')
        }}
      />
    </>
  )
}
