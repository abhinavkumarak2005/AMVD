import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle2, Download, Home, LayoutDashboard } from 'lucide-react'
import Header from '../components/layout/Header'
import logoBlack from '../assets/logo-black.png'

export default function BookingSuccess() {
  const { state } = useLocation()
  const bookingId = state?.bookingId || 'SMV-XXXX-XXXX'

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-b from-[#FBF3E7] to-[#F5E8D6] flex items-center justify-center py-12 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md bg-white rounded-3xl shadow-card-lift border border-temple-gold/30 overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-br from-temple-green to-[#3D491E] p-8 text-center text-white">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="w-20 h-20 mx-auto mb-4 bg-white/20 rounded-full flex items-center justify-center"
            >
              <CheckCircle2 size={40} className="text-white" />
            </motion.div>
            <h1 className="font-serif text-2xl font-bold">Booking Confirmed!</h1>
            <p className="text-white/80 text-sm mt-1">Your seva has been successfully registered</p>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5">
            {/* Logo for receipt branding */}
            <div className="flex items-center gap-3 justify-center border border-temple-gold/30 rounded-xl p-3 bg-temple-cream/30">
              <img src={logoBlack} alt="Temple Logo" className="w-10 h-10 object-contain" />
              <div className="text-center">
                <p className="text-xs font-bold text-temple-brown">Arulmigu Manakula Vinayagar Devasthanam</p>
                <p className="text-[10px] text-temple-tan">Official Booking Receipt</p>
              </div>
            </div>

            <div className="text-center">
              <p className="text-xs text-temple-tan">Booking Reference</p>
              <p className="font-mono text-xl font-bold text-temple-brown tracking-wider mt-1">{bookingId}</p>
            </div>

            <div className="bg-temple-cream/50 rounded-xl p-4 text-center border border-temple-gold/20">
              <p className="text-sm text-temple-tan leading-relaxed">
                May Lord Arulmigu Manakula Vinayagar shower his blessings upon you and your family.
                A confirmation has been sent to your email.
              </p>
            </div>

            <div className="space-y-3">
              <div className="pt-2">
                <Link to="/dashboard/receipts"
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-temple-saffron text-white font-bold text-sm shadow-glowing-orange hover:bg-temple-saffron-hover transition-colors"
                >
                  <LayoutDashboard size={16} /> View Receipts in Dashboard
                </Link>
              </div>
              <Link to="/" className="w-full flex items-center justify-center gap-2 py-2.5 text-temple-tan text-sm hover:text-temple-saffron transition-colors">
                <Home size={14} /> Back to Homepage
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  )
}
