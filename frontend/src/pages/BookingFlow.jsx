import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CalendarDays, Users, CreditCard, Clock, ChevronRight, ChevronLeft, Loader2, AlertCircle } from 'lucide-react'
import Header from '../components/layout/Header'
import { useAuthStore, useBookingStore } from '../store'
import api from '../lib/api'
import { toast } from 'sonner'
import { format, addDays } from 'date-fns'
import ExemptionModal from '../components/layout/ExemptionModal'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

const STEPS = [
  { id: 1, label: 'Select Date', icon: CalendarDays },
  { id: 2, label: 'Your Details', icon: Users },
  { id: 3, label: 'Review & Pay', icon: CreditCard },
]

function CountdownTimer() {
  const { secondsLeft, hold } = useBookingStore()
  if (!hold) return null
  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60
  const urgent = secondsLeft < 120
  return (
    <div className={`slot-timer ${urgent ? 'urgent' : ''}`}>
      <Clock size={12} />
      Slot held for: {mins}:{secs.toString().padStart(2, '0')}
    </div>
  )
}

export default function BookingFlow() {
  const { serviceId } = useParams()
  const navigate = useNavigate()
  const { session } = useAuthStore()
  const { hold, setHold, clearHold } = useBookingStore()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    date: '',
    session: 'morning',
    numPersons: 1,
    persons: [{ fullName: '', email: '', age: '', relation: '', phone: '' }],
  })
  const [isBooked, setIsBooked] = useState(false)
  const [serviceDetails, setServiceDetails] = useState(null)
  const [availability, setAvailability] = useState(null)
  const [fetchingAvailability, setFetchingAvailability] = useState(false)
  
  const [exemptionLimit, setExemptionLimit] = useState(10000)
  const [showModal, setShowModal] = useState(false)
  const [txDetails, setTxDetails] = useState(null)
  
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/settings`)
      .then(res => res.json())
      .then(data => {
        if(data['80g_minimum_amount']) setExemptionLimit(Number(data['80g_minimum_amount']))
      })
      .catch(console.error)
  }, [])

  useEffect(() => {
    async function fetchService() {
      try {
        const { data } = await api.get('/api/bookings/services')
        const svc = data.find(s => s.id === serviceId)
        if (svc) setServiceDetails(svc)
      } catch(e) {}
    }
    fetchService()
  }, [serviceId])

  // Fetch availability when date changes
  useEffect(() => {
    async function fetchAvailability() {
      if (!formData.date || !serviceId) return
      setFetchingAvailability(true)
      try {
        const { data } = await api.get(`/api/bookings/availability?service_id=${serviceId}&date=${formData.date}`)
        setAvailability(data)
        
        // Auto-select first available session if current is invalid
        const sessions = Object.keys(data)
        if (sessions.length > 0 && !sessions.includes(formData.session)) {
          setFormData(f => ({ ...f, session: sessions[0] }))
        }
      } catch (e) {
        toast.error('Failed to fetch availability')
      } finally {
        setFetchingAvailability(false)
      }
    }
    fetchAvailability()
  }, [formData.date, serviceId])

  // Clear stale hold on initial mount
  useEffect(() => {
    clearHold()
  }, [])

  // Keep ref to avoid dependencies triggering cleanup
  const holdRef = useRef(hold)
  const isBookedRef = useRef(isBooked)
  useEffect(() => {
    holdRef.current = hold
    isBookedRef.current = isBooked
  }, [hold, isBooked])

  // Release hold on page close or component unmount
  useEffect(() => {
    const release = () => {
      const h = holdRef.current
      if (h?.holdId && !isBookedRef.current) {
        const blob = new Blob([JSON.stringify({ hold_id: h.holdId })], { type: 'application/json' })
        navigator.sendBeacon(`${import.meta.env.VITE_API_URL}/api/bookings/release_hold`, blob)
      }
    }
    const handleBeforeUnload = () => release()
    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      release()
      useBookingStore.getState().clearHold() // Reset UI timer
    }
  }, [])

  if (!session) {
    return (
      <div className="min-h-screen bg-temple-ivory flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-5xl">🛕</div>
          <p className="font-serif text-xl text-temple-brown">Please sign in to book a service</p>
          <button onClick={() => navigate('/')} className="text-temple-saffron font-medium underline">Back to Homepage</button>
        </div>
      </div>
    )
  }

  const handlePlaceHold = async () => {
    if (!formData.date) { toast.error('Please select a date'); return }
    setLoading(true)
    try {
      const { data } = await api.post('/api/bookings/hold', {
        service_id: serviceId,
        user_id: session.user.id,
        date: formData.date,
        session: formData.session,
      })
      setHold({ holdId: data.hold_id, serviceId, date: formData.date, session: formData.session, expiresAt: data.expires_at })
      setStep(2)
    } catch (err) {
      const detail = err.response?.data?.detail
      const msg = Array.isArray(detail) ? detail[0].msg : detail || 'This slot is not available'
      toast.error(typeof msg === 'string' ? msg : 'This slot is not available')
    } finally {
      setLoading(false)
    }
  }

  const handlePay = async () => {
    setLoading(true)
    try {
      const { data } = await api.post('/api/bookings/create', {
        service_id: serviceId,
        user_id: session.user.id,
        hold_id: hold?.holdId,
        date: formData.date,
        session: formData.session,
        num_persons: formData.numPersons,
        persons: formData.persons,
      })
      
      // Extend hold timer dynamically by 5 mins when initiating payment
      try {
        await api.post('/api/bookings/extend_hold', { hold_id: hold?.holdId })
        const newExpiresAt = new Date(new Date(hold.expiresAt).getTime() + 5 * 60000).toISOString()
        setHold({ ...hold, expiresAt: newExpiresAt })
      } catch (e) {}

      const rzp = new window.Razorpay({
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        order_id: data.razorpay_order_id,
        amount: data.amount_rupees * 100,
        currency: 'INR',
        name: 'Arulmigu Manakula Vinayagar Devasthanam',
        description: 'Pooja Service Booking',
        handler: async (response) => {
          try {
            const res = await api.post('/api/bookings/verify', {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature
            })
            setIsBooked(true)
            toast.success('Payment successful! 🙏')
            
            if (data.amount_rupees >= exemptionLimit && res.data.id) {
              setTxDetails({ id: res.data.id, reference: res.data.reference, amount_rupees: data.amount_rupees })
              setShowModal(true)
            } else {
              navigate('/booking/success', { state: { bookingId: res.data.reference } })
            }
          } catch (e) {
            console.error("Verify failed", e)
            toast.error('Payment verification failed')
            navigate('/booking/success', { state: { bookingId: data.booking_id } }) // Fallback
          }
        },
        modal: { 
          ondismiss: () => {
            toast.info('Payment cancelled')
            api.put(`/api/bookings/${data.booking_id}/cancel`).catch(console.error)
          } 
        },
      })
      rzp.open()
    } catch (err) {
      const detail = err.response?.data?.detail
      const msg = Array.isArray(detail) ? detail[0].msg : detail || 'Payment initiation failed'
      toast.error(typeof msg === 'string' ? msg : 'Payment initiation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-b from-[#FBF3E7] to-[#F5E8D6] py-10 px-4">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Step indicator */}
          <div className="flex items-center justify-between relative">
            <div className="absolute top-5 left-8 right-8 h-0.5 bg-temple-gold/20" />
            {STEPS.map((s) => {
              const Icon = s.icon
              return (
                <div key={s.id} className="flex flex-col items-center gap-1 z-10">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                    step >= s.id ? 'bg-temple-saffron border-temple-saffron text-white' : 'bg-white border-temple-gold/40 text-temple-tan'
                  }`}>
                    <Icon size={16} />
                  </div>
                  <span className={`text-xs font-medium ${step >= s.id ? 'text-temple-saffron' : 'text-temple-tan'}`}>{s.label}</span>
                </div>
              )
            })}
          </div>

          {/* Timer */}
          <div className="flex justify-center"><CountdownTimer /></div>

          {/* Service Context Banner */}
          {serviceDetails && (
            <div className="bg-white/80 border border-temple-gold/40 rounded-2xl p-4 text-center shadow-sm">
              <span className="text-xs font-bold text-temple-tan uppercase tracking-widest">Booking Service</span>
              <h2 className="text-xl font-serif font-bold text-temple-brown mt-1">{serviceDetails.name}</h2>
              {serviceDetails.post_booking_info && <p className="text-xs text-temple-olive mt-1 max-w-md mx-auto">{serviceDetails.post_booking_info}</p>}
            </div>
          )}

          {/* Step content */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-temple-gold/30 shadow-card-lift">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                  <h2 className="font-serif text-2xl font-bold text-temple-brown">Select Date & Session</h2>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-temple-brown">Booking Date</label>
                    <DatePicker
                      selected={formData.date ? new Date(formData.date) : null}
                      onChange={(date) => setFormData((f) => ({ ...f, date: date ? format(date, 'yyyy-MM-dd') : '' }))}
                      minDate={addDays(new Date(), serviceDetails?.advance_days || 3)}
                      dateFormat="MMMM d, yyyy"
                      placeholderText="Select a date"
                      className="w-full px-3 py-2.5 rounded-xl border border-temple-gold/50 bg-white text-sm focus:ring-2 focus:ring-temple-saffron/30"
                      wrapperClassName="w-full"
                    />
                    {formData.date && serviceDetails?.available_days && !serviceDetails.available_days.includes(new Date(formData.date).getDay()) && (
                      <p className="text-xs text-red-500 font-bold">This service is not available on this day of the week.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-temple-brown">Session</label>
                    <select value={formData.session} onChange={(e) => setFormData((f) => ({ ...f, session: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-temple-gold/50 bg-white text-sm focus:ring-2 focus:ring-temple-saffron/30 disabled:opacity-50"
                      disabled={fetchingAvailability || !formData.date || !availability}
                    >
                      {fetchingAvailability ? (
                        <option>Loading...</option>
                      ) : (serviceDetails?.sessions || ['morning', 'evening']).map(sess => {
                        const available = availability?.[sess]
                        const isBlocked = available === -1
                        const isFull = available === 0
                        return (
                          <option key={sess} value={sess} disabled={isFull || isBlocked}>
                            {sess} {availability ? (isBlocked ? '(Booking Blocked)' : isFull ? '(Full)' : '') : ''}
                          </option>
                        )
                      })}
                    </select>
                  </div>
                  <button
                    onClick={handlePlaceHold} 
                    disabled={loading || fetchingAvailability || !formData.date || !availability || availability[formData.session] <= 0 || (serviceDetails?.available_days && !serviceDetails.available_days.includes(new Date(formData.date).getDay()))}
                    className="w-full btn-bounce py-3 rounded-xl bg-temple-saffron hover:bg-temple-saffron-hover text-white font-bold shadow-glowing-orange disabled:opacity-50 disabled:shadow-none flex justify-center items-center gap-2"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <><span>Proceed to Details</span><ChevronRight size={16} /></>}
                  </button>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                  <h2 className="font-serif text-2xl font-bold text-temple-brown">Devotee Details</h2>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-temple-brown">Number of Persons (max 5)</label>
                    <select value={formData.numPersons}
                      onChange={(e) => {
                        const n = parseInt(e.target.value)
                        setFormData((f) => ({
                          ...f, numPersons: n,
                          persons: Array.from({ length: n }, (_, i) => f.persons[i] || { fullName: '', email: '', age: '', relation: '', phone: '' })
                        }))
                      }}
                      className="w-full px-3 py-2.5 rounded-xl border border-temple-gold/50 bg-white text-sm focus:ring-2 focus:ring-temple-saffron/30"
                    >
                      {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  {formData.persons.map((p, i) => (
                    <div key={i} className="p-4 bg-temple-cream/40 rounded-xl border border-temple-gold/30 space-y-3">
                      <h4 className="text-sm font-semibold text-temple-brown">Person {i + 1}</h4>
                      {[['fullName', 'Full Name *', 'Enter name'], ['email', 'Email', 'Email address'], ['age', 'Age *', 'Age'], ['relation', 'Relation (e.g. Father, Friend) *', 'Relation to booking person'], ['phone', 'Phone Number', 'Phone']].map(([key, label, placeholder]) => (
                        <div key={key}>
                          <label className="text-xs text-temple-tan">{label}</label>
                          <input placeholder={placeholder} value={p[key] || ''} type={key === 'age' || key === 'phone' ? 'number' : 'text'}
                            onChange={(e) => {
                              const np = [...formData.persons]
                              np[i] = { ...np[i], [key]: e.target.value }
                              setFormData((f) => ({ ...f, persons: np }))
                            }}
                            className="w-full mt-1 px-3 py-2 rounded-lg border border-temple-gold/40 bg-white text-sm focus:ring-2 focus:ring-temple-saffron/30"
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                  <div className="flex gap-3">
                    <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl border border-temple-gold/40 text-temple-brown font-medium flex items-center justify-center gap-1">
                      <ChevronLeft size={16} /> Back
                    </button>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        for (let i = 0; i < formData.persons.length; i++) {
                          const p = formData.persons[i];
                          if (!p.fullName || !p.age || !p.relation) {
                            return toast.error(`Please fill all compulsory fields (*) for Person ${i + 1}`);
                          }
                          if (p.phone && !/^\d{10}$/.test(p.phone)) {
                            return toast.error(`Phone number for Person ${i + 1} must be exactly 10 digits`);
                          }
                          if (p.fullName && /\d/.test(p.fullName)) {
                            return toast.error(`Full Name for Person ${i + 1} cannot contain numbers`);
                          }
                          if (p.relation && /\d/.test(p.relation)) {
                            return toast.error(`Relation for Person ${i + 1} cannot contain numbers`);
                          }
                          if (p.email) {
                            if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(p.email)) {
                              return toast.error(`Invalid email format for Person ${i + 1}`);
                            }
                          }
                        }
                        setStep(3);
                      }}
                      className="flex-1 py-3 rounded-xl bg-temple-saffron text-white font-bold flex items-center justify-center gap-1 shadow-glowing-orange"
                    >
                      Review <ChevronRight size={16} />
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                  <h2 className="font-serif text-2xl font-bold text-temple-brown">Review & Pay</h2>
                  <div className="bg-temple-cream/40 rounded-xl p-4 border border-temple-gold/30 space-y-2 text-sm">
                    {[
                      ['Service', `Service #${serviceId.substring(0, 6).toUpperCase()}`],
                      ['Date', formData.date],
                      ['Session', formData.session],
                      ['Persons', formData.numPersons],
                    ].map(([l, v]) => (
                      <div key={l} className="flex justify-between">
                        <span className="text-temple-tan">{l}</span>
                        <span className="font-medium text-temple-brown capitalize">{v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex gap-2">
                    <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs text-amber-700">Your slot is held for 10 minutes. Complete payment to confirm your booking.</p>
                      <p className="text-xs text-amber-700 font-bold">* Refund will not be applicable once the payment is completed.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setStep(2)} className="flex-1 py-3 rounded-xl border border-temple-gold/40 text-temple-brown font-medium flex items-center justify-center gap-1">
                      <ChevronLeft size={16} /> Back
                    </button>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      onClick={handlePay} disabled={loading}
                      className="flex-1 py-3 rounded-xl bg-temple-green text-white font-bold flex items-center justify-center gap-2 shadow-glowing-green disabled:opacity-60"
                    >
                      {loading ? <Loader2 size={16} className="animate-spin" /> : '🔒 Pay & Confirm'}
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <ExemptionModal 
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          navigate('/booking/success', { state: { bookingId: txDetails?.reference } })
        }}
        type="booking"
        entity={txDetails}
        onSuccess={() => {
          setShowModal(false)
          navigate('/booking/success', { state: { bookingId: txDetails?.reference } })
        }}
      />
    </>
  )
}
