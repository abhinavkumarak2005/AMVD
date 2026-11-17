import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CalendarDays, Users, CreditCard, Clock, ChevronRight, ChevronLeft, Loader2, AlertCircle, X, FileText, CheckCircle2, Info, Layers, Tag } from 'lucide-react'
import Header from '../components/layout/Header'
import Footer from '../components/layout/Footer'
import { useAuthStore, useBookingStore } from '../store'
import api from '../lib/api'
import { toast } from 'sonner'
import { format, addDays } from 'date-fns'
import ExemptionModal from '../components/layout/ExemptionModal'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

const STEPS = [
  { id: 1, label: 'Select Date', icon: CalendarDays },
  { id: 2, label: 'Devotee Details', icon: Users },
  { id: 3, label: 'Review & Pay', icon: CreditCard },
]

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

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
  const [screenError, setScreenError] = useState(null)

  // Service & Category Navigation State
  const [serviceDetails, setServiceDetails] = useState(null)
  const [allServices, setAllServices] = useState([])
  const [categories, setCategories] = useState([])

  // Booking Form State
  const [formData, setFormData] = useState({
    date: '',
    session: '',
    numPersons: 1,
    persons: [{ fullName: '', email: '', age: '', relation: 'Self', phone: '' }],
  })
  
  // Availability & Monthly Calendar Status State
  const [availability, setAvailability] = useState(null)
  const [fetchingAvailability, setFetchingAvailability] = useState(false)
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState(new Date())
  const [monthAvailability, setMonthAvailability] = useState({})

  const [isBooked, setIsBooked] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  
  // Tax Exemption State
  const [exemptionLimit, setExemptionLimit] = useState(10000)
  const [showModal, setShowModal] = useState(false)
  const [txDetails, setTxDetails] = useState(null)

  // Fetch Settings
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/settings`)
      .then(res => res.json())
      .then(data => {
        if (data['80g_minimum_amount']) setExemptionLimit(Number(data['80g_minimum_amount']))
      })
      .catch(console.error)
  }, [])

  // Fetch all services and categories for the persistent sub-menu
  useEffect(() => {
    async function fetchCatalogue() {
      try {
        const { data } = await api.get('/api/bookings/services')
        setAllServices(data)
        const svc = data.find(s => s.id === serviceId)
        if (svc) {
          setServiceDetails(svc)
          // Default session
          const initialSession = (svc.sessions && svc.sessions.length > 0) ? svc.sessions[0] : 'Morning'
          setFormData(f => ({ ...f, session: initialSession }))
        }

        // Fetch categories
        const catRes = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/service-categories`)
        if (catRes.ok) {
          const catData = await catRes.json()
          setCategories(catData)
        }
      } catch (e) {
        console.error(e)
      }
    }
    fetchCatalogue()
  }, [serviceId])

  // Fetch Month Availability whenever calendar month or service changes
  useEffect(() => {
    async function fetchMonthData() {
      if (!serviceId) return
      const year = currentCalendarMonth.getFullYear()
      const month = currentCalendarMonth.getMonth() + 1
      try {
        const res = await api.get(`/api/bookings/month-availability?service_id=${serviceId}&year=${year}&month=${month}`)
        if (res.data) {
          setMonthAvailability(res.data)
        }
      } catch (e) {
        console.error("Failed to load month availability", e)
      }
    }
    fetchMonthData()
  }, [serviceId, currentCalendarMonth])

  // Fetch slot availability when date changes
  useEffect(() => {
    async function fetchAvailability() {
      if (!formData.date || !serviceId) return
      setFetchingAvailability(true)
      setScreenError(null)
      try {
        const { data } = await api.get(`/api/bookings/availability?service_id=${serviceId}&date=${formData.date}`)
        setAvailability(data)
        
        const sessions = Object.keys(data)
        if (sessions.length > 0 && (!formData.session || !sessions.includes(formData.session))) {
          // pick first available session
          const firstAvail = sessions.find(s => data[s] > 0) || sessions[0]
          setFormData(f => ({ ...f, session: firstAvail }))
        }
      } catch (e) {
        setScreenError('Failed to fetch real-time session availability for this date.')
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

  const holdRef = useRef(hold)
  const isBookedRef = useRef(isBooked)
  useEffect(() => {
    holdRef.current = hold
    isBookedRef.current = isBooked
  }, [hold, isBooked])

  // Release hold on page close
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
      useBookingStore.getState().clearHold()
    }
  }, [])

  if (!session) {
    return (
      <div className="min-h-screen bg-temple-ivory flex items-center justify-center">
        <div className="text-center space-y-4 p-8 bg-white rounded-3xl shadow-apple-card border border-temple-gold/40 max-w-sm">
          <div className="text-5xl">🛕</div>
          <h2 className="font-serif text-2xl font-bold text-temple-brown">Devotee Login Required</h2>
          <p className="text-xs text-temple-tan">Please sign in to proceed with your sacred seva booking.</p>
          <div className="pt-2 flex flex-col gap-2">
            <button 
              onClick={() => useAuthStore.getState().openAuthModal('login')} 
              className="w-full py-2.5 rounded-xl bg-temple-saffron hover:bg-temple-saffron-hover text-white font-bold text-sm shadow-sm"
            >
              Sign In / Register
            </button>
            <button onClick={() => navigate('/services')} className="text-xs text-temple-tan hover:text-temple-brown underline">
              Back to Services
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Check if service is a single sponsor / donation service (e.g. Annadhanam Meals)
  const isSponsorshipService = serviceDetails?.name?.toLowerCase().includes('annadhanam') || 
                               serviceDetails?.name?.toLowerCase().includes('meals') ||
                               serviceDetails?.category?.toLowerCase() === 'annadhanam'

  const handlePlaceHold = async () => {
    setScreenError(null)
    if (!formData.date) {
      setScreenError('Please select a booking date from the calendar.')
      return
    }

    if (!formData.session) {
      setScreenError('Please select a session timing.')
      return
    }

    setLoading(true)
    try {
      const { data } = await api.post('/api/bookings/hold', {
        service_id: serviceId,
        user_id: session.user.id,
        date: formData.date,
        session: formData.session,
        slot_capacity: 1
      })
      setHold({ holdId: data.hold_id, serviceId, date: formData.date, session: formData.session, expiresAt: data.expires_at })
      setStep(2)
    } catch (err) {
      const detail = err.response?.data?.detail
      const msg = Array.isArray(detail) ? detail.map(d => d.msg).join(', ') : detail || 'This slot is no longer available. Please select another date or session.'
      setScreenError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const handlePay = async () => {
    setScreenError(null)
    if (!hold?.holdId) {
      setScreenError('Your 10-minute slot hold has expired or is invalid. Please return to Step 1 and select your slot again.')
      return
    }

    setLoading(true)
    try {
      const { data } = await api.post('/api/bookings/create', {
        service_id: serviceId,
        user_id: session.user.id,
        hold_id: hold.holdId,
        date: formData.date,
        session: formData.session,
        num_persons: isSponsorshipService ? 1 : formData.numPersons,
        persons: isSponsorshipService ? [formData.persons[0]] : formData.persons,
      })
      
      try {
        await api.post('/api/bookings/extend_hold', { hold_id: hold.holdId })
        const newExpiresAt = new Date(new Date(hold.expiresAt).getTime() + 5 * 60000).toISOString()
        setHold({ ...hold, expiresAt: newExpiresAt })
      } catch (e) {}

      const rzp = new window.Razorpay({
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        order_id: data.razorpay_order_id,
        amount: data.amount_rupees * 100,
        currency: 'INR',
        name: 'Arulmigu Manakula Vinayagar Devasthanam',
        description: `${serviceDetails?.name || 'Seva'} Booking`,
        handler: async (response) => {
          try {
            const res = await api.post('/api/bookings/verify', {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature
            })
            setIsBooked(true)
            toast.success('Seva booking payment successful!')
            
            if (data.amount_rupees >= exemptionLimit && res.data.id) {
              setTxDetails({ id: res.data.id, reference: res.data.reference, amount_rupees: data.amount_rupees })
              setShowModal(true)
            } else {
              navigate('/booking/success', { state: { bookingId: res.data.reference } })
            }
          } catch (e) {
            console.error("Verify failed", e)
            setScreenError('Payment was recorded but verification is taking longer. Redirecting to receipt.')
            navigate('/booking/success', { state: { bookingId: data.booking_id } })
          }
        },
        modal: { 
          ondismiss: () => {
            setScreenError('Payment checkout was closed. You can complete the payment before the slot timer expires.')
            api.put(`/api/bookings/${data.booking_id}/cancel`).catch(console.error)
          } 
        },
      })
      rzp.open()
    } catch (err) {
      const detail = err.response?.data?.detail
      const msg = Array.isArray(detail) ? detail.map(d => `${d.loc?.join('.')}: ${d.msg}`).join(', ') : detail || 'Payment initiation failed. Please check the fields and try again.'
      setScreenError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  // Format criteria days string (e.g. Thursday to Sunday)
  const operatingDaysText = serviceDetails?.available_days && serviceDetails.available_days.length < 7
    ? serviceDetails.available_days.map(d => DAY_NAMES[d]).join(', ')
    : 'All Days (Monday - Sunday)'

  return (
    <>
      <Header />
      
      {/* Retained Services Sub-Menu Bar */}
      <div className="bg-[#FAF3E8] border-b border-temple-gold/30 py-2.5 px-4 sticky top-20 z-20 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 shrink-0 text-xs font-bold text-temple-brown uppercase tracking-wider">
            <Layers size={14} className="text-temple-saffron" />
            <span>Service Categories:</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/services"
              className="text-xs px-3 py-1 rounded-full bg-white border border-temple-gold/40 text-temple-brown hover:bg-temple-cream transition font-medium"
            >
              All Services
            </Link>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => {
                  const targetService = allServices.find(s => s.category?.toLowerCase() === cat.name.toLowerCase())
                  if (targetService) {
                    navigate(`/book/${targetService.id}`)
                  } else {
                    navigate('/services')
                  }
                }}
                className={`text-xs px-3 py-1 rounded-full transition font-medium border ${
                  serviceDetails?.category?.toLowerCase() === cat.name.toLowerCase()
                    ? 'bg-temple-saffron text-white border-temple-saffron shadow-xs'
                    : 'bg-white/80 border-temple-gold/40 text-temple-brown hover:bg-temple-cream'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="min-h-screen bg-gradient-to-b from-[#FBF3E7] to-[#F5E8D6] py-8 px-4">
        <div className="max-w-2xl mx-auto space-y-6">

          {/* Stepper Header */}
          <div className="flex items-center justify-between relative px-4">
            <div className="absolute top-5 left-12 right-12 h-0.5 bg-temple-gold/30 z-0" />
            {STEPS.map((s) => {
              const Icon = s.icon
              const isDone = step > s.id
              const isCurrent = step === s.id
              return (
                <div key={s.id} className="flex flex-col items-center gap-1.5 z-10">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all font-bold text-sm ${
                    isDone || isCurrent
                      ? 'bg-temple-saffron border-temple-saffron text-white shadow-sm'
                      : 'bg-white border-temple-gold/40 text-temple-tan'
                  }`}>
                    {isDone ? <CheckCircle2 size={18} /> : <Icon size={16} />}
                  </div>
                  <span className={`text-xs font-semibold ${isCurrent ? 'text-temple-brown font-bold' : 'text-temple-tan'}`}>
                    {s.label}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Countdown Slot Hold Timer */}
          <div className="flex justify-center"><CountdownTimer /></div>

          {/* Dynamic Service Summary & Real-time Amount / Date / Session Banner */}
          {serviceDetails && (
            <div className="bg-white rounded-2xl p-5 border border-temple-gold/40 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-temple-gold/20 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-temple-olive uppercase tracking-wider bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200/50">
                      {serviceDetails.category} Seva
                    </span>
                    {isSponsorshipService && (
                      <span className="text-[11px] font-bold text-temple-green bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                        Annadhanam Sponsorship
                      </span>
                    )}
                  </div>
                  <h1 className="text-xl font-serif font-bold text-temple-brown mt-1">
                    {serviceDetails.name}
                  </h1>
                </div>
                <div className="sm:text-right">
                  <span className="text-xs text-temple-tan block">Seva Offering</span>
                  <span className="text-2xl font-serif font-bold text-temple-green">
                    ₹{serviceDetails.price_rupees?.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Real-time Chosen Parameters */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div className="bg-amber-50/50 p-2 rounded-xl">
                  <span className="text-temple-tan block text-[10px] uppercase font-bold">Booking Date</span>
                  <span className="font-semibold text-temple-brown">
                    {formData.date ? format(new Date(formData.date), 'dd MMM yyyy (EEE)') : 'Not selected yet'}
                  </span>
                </div>
                <div className="bg-amber-50/50 p-2 rounded-xl">
                  <span className="text-temple-tan block text-[10px] uppercase font-bold">Session Timing</span>
                  <span className="font-semibold text-temple-brown capitalize">
                    {formData.session || 'Select timing'}
                  </span>
                </div>
                <div className="bg-amber-50/50 p-2 rounded-xl col-span-2 sm:col-span-1">
                  <span className="text-temple-tan block text-[10px] uppercase font-bold">Devotees / Sponsors</span>
                  <span className="font-semibold text-temple-brown">
                    {isSponsorshipService ? '1 Sponsor' : `${formData.numPersons} Person(s)`}
                  </span>
                </div>
              </div>

              {/* Service Criteria Display */}
              <div className="text-xs text-apple-muted flex items-center gap-1.5 pt-1">
                <Info size={14} className="text-temple-saffron shrink-0" />
                <span>
                  <strong>Operating Days:</strong> {operatingDaysText}. (Book at least {serviceDetails.advance_days || 1} day(s) ahead).
                </span>
              </div>
            </div>
          )}

          {/* In-Screen Persistent Alert / Error Banner */}
          {screenError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start justify-between gap-3 text-xs text-red-800 shadow-xs animate-shake">
              <div className="flex items-start gap-2.5">
                <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-red-900 text-sm">Action Required</h4>
                  <p className="mt-0.5 leading-relaxed">{screenError}</p>
                </div>
              </div>
              <button onClick={() => setScreenError(null)} className="text-red-400 hover:text-red-700 p-1">
                <X size={16} />
              </button>
            </div>
          )}

          {/* Stepper Card Content */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-temple-gold/30 shadow-card-lift">
            <AnimatePresence mode="wait">

              {/* STEP 1: DATE & SESSION SELECTOR */}
              {step === 1 && (
                <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                  <div>
                    <h2 className="font-serif text-2xl font-bold text-temple-brown">Select Date & Session</h2>
                    <p className="text-xs text-temple-tan mt-0.5">
                      Dates marked in <strong className="text-temple-green">Green</strong> are free & available for booking.
                    </p>
                  </div>

                  {/* Calendar with Free / Booked Indicators */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-temple-brown block">Seva Date *</label>
                    <div className="border border-temple-gold/40 rounded-2xl p-2 bg-[#FAF7F2] flex justify-center">
                      <DatePicker
                        selected={formData.date ? new Date(formData.date) : null}
                        onChange={(date) => {
                          setScreenError(null)
                          setFormData(f => ({ ...f, date: date ? format(date, 'yyyy-MM-dd') : '' }))
                        }}
                        onMonthChange={(d) => setCurrentCalendarMonth(d)}
                        minDate={addDays(new Date(), serviceDetails?.advance_days || 1)}
                        inline
                        filterDate={(date) => {
                          const dateStr = format(date, 'yyyy-MM-dd')
                          const status = monthAvailability[dateStr]
                          // Enable if free, disable if booked or blocked
                          return status === 'free'
                        }}
                        renderDayContents={(day, date) => {
                          const dateStr = format(date, 'yyyy-MM-dd')
                          const status = monthAvailability[dateStr]
                          let indicatorClass = ''
                          if (status === 'free') indicatorClass = 'bg-temple-green'
                          else if (status === 'booked') indicatorClass = 'bg-red-500'
                          else if (status === 'blocked') indicatorClass = 'bg-gray-300'

                          return (
                            <div className="flex flex-col items-center justify-center relative py-0.5">
                              <span className="text-xs font-medium">{day}</span>
                              {status && (
                                <span className={`w-1.5 h-1.5 rounded-full ${indicatorClass} mt-0.5`} />
                              )}
                            </div>
                          )
                        }}
                      />
                    </div>

                    {/* Calendar Legend */}
                    <div className="flex items-center justify-center gap-4 text-xs pt-1 text-apple-muted">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-temple-green"></span>
                        <strong className="text-temple-green">Free / Available</strong>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                        <strong className="text-red-500">Booked (Full)</strong>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-gray-400"></span>
                        <span className="text-gray-500">Blocked / Closed</span>
                      </span>
                    </div>
                  </div>

                  {/* Session Dropdown */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-temple-brown block">Session Timing *</label>
                    <select
                      value={formData.session}
                      onChange={(e) => setFormData(f => ({ ...f, session: e.target.value }))}
                      disabled={fetchingAvailability || !formData.date}
                      className="w-full px-3 py-2.5 rounded-xl border border-temple-gold/50 bg-white text-sm focus:ring-2 focus:ring-temple-saffron/30 disabled:opacity-50"
                    >
                      {fetchingAvailability ? (
                        <option>Checking availability...</option>
                      ) : !formData.date ? (
                        <option>Please select a date first</option>
                      ) : (serviceDetails?.sessions || ['Morning', 'Evening']).map(sess => {
                        const available = availability?.[sess]
                        const isBlocked = available === -1
                        const isFull = available === 0
                        return (
                          <option key={sess} value={sess} disabled={isFull || isBlocked}>
                            {sess} {availability ? (isBlocked ? '(Blocked)' : isFull ? '(Full)' : `(${available} available)`) : ''}
                          </option>
                        )
                      })}
                    </select>
                  </div>

                  <button
                    onClick={handlePlaceHold}
                    disabled={loading || fetchingAvailability || !formData.date || !formData.session}
                    className="w-full btn-bounce py-3 rounded-xl bg-temple-saffron hover:bg-temple-saffron-hover text-white font-bold shadow-glowing-orange disabled:opacity-50 flex justify-center items-center gap-2 transition"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <><span>Proceed to Details</span><ChevronRight size={16} /></>}
                  </button>
                </motion.div>
              )}

              {/* STEP 2: DEVOTEE DETAILS */}
              {step === 2 && (
                <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                  <div>
                    <h2 className="font-serif text-2xl font-bold text-temple-brown">
                      {isSponsorshipService ? 'Devotee / Sponsor Details' : 'Devotee Information'}
                    </h2>
                    <p className="text-xs text-temple-tan mt-0.5">
                      {isSponsorshipService
                        ? 'Please provide the devotee or family name for the Annadhanam seva dedication.'
                        : 'Please enter details for all persons attending the seva.'}
                    </p>
                  </div>

                  {/* Multi-person selection (Only for standard sevas, NOT Annadhanam meals) */}
                  {!isSponsorshipService && (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-temple-brown">Number of Devotees (max {serviceDetails?.max_persons || 5})</label>
                      <select 
                        value={formData.numPersons}
                        onChange={(e) => {
                          const n = parseInt(e.target.value)
                          setFormData((f) => ({
                            ...f, numPersons: n,
                            persons: Array.from({ length: n }, (_, i) => f.persons[i] || { fullName: '', email: '', age: '', relation: i === 0 ? 'Self' : '', phone: '' })
                          }))
                        }}
                        className="w-full px-3 py-2.5 rounded-xl border border-temple-gold/50 bg-white text-sm focus:ring-2 focus:ring-temple-saffron/30"
                      >
                        {Array.from({ length: serviceDetails?.max_persons || 5 }, (_, i) => i + 1).map(n => (
                          <option key={n} value={n}>{n} Devotee{n > 1 ? 's' : ''}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Devotee Form Rows */}
                  {(isSponsorshipService ? [formData.persons[0] || {}] : formData.persons).map((p, i) => (
                    <div key={i} className="p-5 bg-temple-cream/30 rounded-2xl border border-temple-gold/40 space-y-3">
                      <div className="flex justify-between items-center border-b border-temple-gold/20 pb-2">
                        <h4 className="text-sm font-bold text-temple-brown">
                          {isSponsorshipService ? 'Sponsor / Devotee Details' : `Devotee ${i + 1} ${i === 0 ? '(Primary Contact)' : ''}`}
                        </h4>
                        <span className="text-[11px] text-temple-olive font-semibold bg-white px-2 py-0.5 rounded-full border border-temple-gold/30">
                          {i === 0 ? 'Primary' : `Person ${i + 1}`}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-temple-brown block">Full Name *</label>
                          <input 
                            placeholder="Full Name (no numbers)"
                            value={p.fullName || ''}
                            onChange={(e) => {
                              const val = e.target.value
                              if (/^[A-Za-z .]*$/.test(val)) {
                                const np = [...formData.persons]
                                np[i] = { ...np[i], fullName: val }
                                setFormData(f => ({ ...f, persons: np }))
                              }
                            }}
                            className="w-full mt-1 px-3 py-2 rounded-xl border border-temple-gold/40 bg-white text-sm focus:ring-2 focus:ring-temple-saffron/30"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-temple-brown block">Age *</label>
                          <input 
                            type="number"
                            min={1}
                            max={110}
                            placeholder="Age"
                            value={p.age || ''}
                            onChange={(e) => {
                              const np = [...formData.persons]
                              np[i] = { ...np[i], age: e.target.value }
                              setFormData(f => ({ ...f, persons: np }))
                            }}
                            className="w-full mt-1 px-3 py-2 rounded-xl border border-temple-gold/40 bg-white text-sm focus:ring-2 focus:ring-temple-saffron/30"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-temple-brown block">Phone Number</label>
                          <input 
                            type="tel"
                            maxLength={10}
                            placeholder="10-digit mobile"
                            value={p.phone || ''}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '').slice(0, 10)
                              const np = [...formData.persons]
                              np[i] = { ...np[i], phone: val }
                              setFormData(f => ({ ...f, persons: np }))
                            }}
                            className="w-full mt-1 px-3 py-2 rounded-xl border border-temple-gold/40 bg-white text-sm focus:ring-2 focus:ring-temple-saffron/30"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-temple-brown block">Email Address</label>
                          <input 
                            type="email"
                            placeholder="Email address for receipt"
                            value={p.email || ''}
                            onChange={(e) => {
                              const np = [...formData.persons]
                              np[i] = { ...np[i], email: e.target.value.trim() }
                              setFormData(f => ({ ...f, persons: np }))
                            }}
                            className="w-full mt-1 px-3 py-2 rounded-xl border border-temple-gold/40 bg-white text-sm focus:ring-2 focus:ring-temple-saffron/30"
                          />
                        </div>

                        {!isSponsorshipService && i > 0 && (
                          <div className="sm:col-span-2">
                            <label className="text-xs font-semibold text-temple-brown block">Relation to Primary Devotee *</label>
                            <input 
                              placeholder="e.g. Spouse, Son, Mother, Friend"
                              value={p.relation || ''}
                              onChange={(e) => {
                                const np = [...formData.persons]
                                np[i] = { ...np[i], relation: e.target.value }
                                setFormData(f => ({ ...f, persons: np }))
                              }}
                              className="w-full mt-1 px-3 py-2 rounded-xl border border-temple-gold/40 bg-white text-sm focus:ring-2 focus:ring-temple-saffron/30"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setStep(1)}
                      className="flex-1 py-3 rounded-xl border border-temple-gold/40 text-temple-brown font-semibold flex items-center justify-center gap-1 hover:bg-gray-50"
                    >
                      <ChevronLeft size={16} /> Back
                    </button>
                    <button
                      onClick={() => {
                        setScreenError(null)
                        const count = isSponsorshipService ? 1 : formData.persons.length
                        for (let i = 0; i < count; i++) {
                          const p = formData.persons[i] || {}
                          if (!p.fullName?.trim() || !p.age) {
                            const err = `Please provide Full Name and Age for ${isSponsorshipService ? 'the Sponsor' : `Devotee ${i + 1}`}.`
                            setScreenError(err)
                            return toast.error(err)
                          }
                          if (!isSponsorshipService && i > 0 && !p.relation?.trim()) {
                            const err = `Please specify the relation for Devotee ${i + 1}.`
                            setScreenError(err)
                            return toast.error(err)
                          }
                          if (p.phone && !/^\d{10}$/.test(p.phone)) {
                            const err = `Phone number for ${isSponsorshipService ? 'Sponsor' : `Devotee ${i + 1}`} must be exactly 10 digits.`
                            setScreenError(err)
                            return toast.error(err)
                          }
                          if (p.email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(p.email)) {
                            const err = `Invalid email address format for ${isSponsorshipService ? 'Sponsor' : `Devotee ${i + 1}`}.`
                            setScreenError(err)
                            return toast.error(err)
                          }
                        }
                        setStep(3)
                      }}
                      className="flex-1 py-3 rounded-xl bg-temple-saffron hover:bg-temple-saffron-hover text-white font-bold flex items-center justify-center gap-1 shadow-glowing-orange"
                    >
                      Review Booking <ChevronRight size={16} />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* STEP 3: REVIEW & PAY */}
              {step === 3 && (
                <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                  <div>
                    <h2 className="font-serif text-2xl font-bold text-temple-brown">Review Seva Booking</h2>
                    <p className="text-xs text-temple-tan mt-0.5">Please confirm your seva details before proceeding to payment.</p>
                  </div>

                  {/* Summary Breakdown */}
                  <div className="bg-temple-cream/40 rounded-2xl p-5 border border-temple-gold/40 space-y-2.5 text-sm">
                    <div className="flex justify-between items-center border-b border-temple-gold/20 pb-2">
                      <span className="text-temple-tan text-xs uppercase font-bold">Selected Seva</span>
                      <span className="font-bold text-temple-brown">{serviceDetails?.name}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-temple-gold/20 pb-2">
                      <span className="text-temple-tan text-xs uppercase font-bold">Scheduled Date</span>
                      <span className="font-semibold text-temple-brown">
                        {formData.date ? format(new Date(formData.date), 'EEEE, dd MMMM yyyy') : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-b border-temple-gold/20 pb-2">
                      <span className="text-temple-tan text-xs uppercase font-bold">Session Timing</span>
                      <span className="font-semibold text-temple-brown capitalize">{formData.session}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-temple-gold/20 pb-2">
                      <span className="text-temple-tan text-xs uppercase font-bold">Primary Devotee</span>
                      <span className="font-semibold text-temple-brown">{formData.persons[0]?.fullName}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-temple-brown font-bold text-base">Total Seva Offering</span>
                      <span className="font-serif font-bold text-2xl text-temple-green">
                        ₹{serviceDetails?.price_rupees?.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* Prominent Terms & Conditions Accordion */}
                  <div className="border border-amber-200 bg-amber-50/70 rounded-2xl p-4 space-y-2">
                    <button
                      type="button"
                      onClick={() => setShowTerms(t => !t)}
                      className="w-full flex items-center justify-between text-left font-bold text-amber-900 text-xs"
                    >
                      <span className="flex items-center gap-1.5">
                        <FileText size={15} className="text-amber-700" />
                        Terms & Conditions and Temple Guidelines
                      </span>
                      <span className="text-xs text-amber-700 underline">{showTerms ? 'Hide' : 'View'}</span>
                    </button>

                    {showTerms && (
                      <div className="pt-2 text-xs text-amber-800 space-y-1.5 border-t border-amber-200/60 leading-relaxed">
                        <p>1. <strong>Strict Non-Refundable Policy:</strong> Seva amounts are offered for divine temple rituals and are non-refundable and non-transferable once payment is completed.</p>
                        <p>2. <strong>Dress Code:</strong> Devotees must adhere to traditional South Indian temple attire (Dhoti/Kurta for Men; Saree/Salwar for Women).</p>
                        <p>3. <strong>Reporting Time:</strong> Please report at the temple seva counter at least 30 minutes before the scheduled session with your booking reference or receipt.</p>
                        <p>4. <strong>Annadhanam Meals:</strong> Sacred prasadam meals are distributed to devotees and visitors during temple dining hall hours.</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setStep(2)}
                      className="flex-1 py-3 rounded-xl border border-temple-gold/40 text-temple-brown font-semibold flex items-center justify-center gap-1 hover:bg-gray-50"
                    >
                      <ChevronLeft size={16} /> Back
                    </button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handlePay}
                      disabled={loading}
                      className="flex-1 py-3 rounded-xl bg-temple-green hover:bg-temple-green/90 text-white font-bold flex items-center justify-center gap-2 shadow-glowing-green disabled:opacity-60"
                    >
                      {loading ? <Loader2 size={16} className="animate-spin" /> : '🔒 Pay & Confirm Seva'}
                    </motion.button>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>
      </main>

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
      <Footer />
    </>
  )
}
