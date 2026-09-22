import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Header from '../components/layout/Header'
import Footer from '../components/layout/Footer'
import { useAuthStore } from '../store'

export default function Services() {
  const [activeCategory, setActiveCategory] = useState('All')
  const [catalogue, setCatalogue] = useState([])
  const [categories, setCategories] = useState(['All'])
  const [loading, setLoading] = useState(true)
  const { session, openAuthModal } = useAuthStore()

  useEffect(() => {
    async function fetchServices() {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/bookings/services`)
        if (res.ok) {
          const data = await res.json()
          // Map DB records to catalogue structure
          const mapped = data.map(s => {
            // Handle sessions properly - backend returns array of strings
            let sessionText = 'Any';
            if (Array.isArray(s.sessions) && s.sessions.length > 0) {
              sessionText = s.sessions.join(', ');
            } else if (s.session_type) {
              sessionText = s.session_type;
            }

            return {
              id: s.id,
              name: s.name,
              category: s.category || 'General',
              session: sessionText,
              maxPersons: s.max_persons || 1,
              advanceDays: s.advance_days || 1,
              price: s.price_rupees || 0,
              icon: '🪔' // default icon since it's not in DB
            };
          })
          setCatalogue(mapped)
          const uniqueCats = ['All', ...new Set(mapped.map(s => s.category))]
          setCategories(uniqueCats)
        } else {
          console.error("Failed to fetch services: API returned", res.status);
        }
      } catch (e) {
        console.error("Failed to fetch services", e)
      } finally {
        setLoading(false)
      }
    }
    fetchServices()
  }, [])

  // Safely fallback if activeCategory not found in mapped data
  const filtered = activeCategory === 'All' ? catalogue : catalogue.filter((s) => s.category === activeCategory)

  const navigate = useNavigate()

  const handleBook = (serviceId, serviceName) => {
    if (!session) { openAuthModal('login'); return }
    if (serviceName && serviceName.toLowerCase().includes('archanai (online)')) {
      const agreed = window.confirm("By booking this Archanai, you will not be coming to the temple in person, but the temple management will do the Archanai in your name and then will notify you after it has been done.\n\nDo you wish to proceed?");
      if (!agreed) return;
    }
    navigate(`/book/${serviceId}`)
  }

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gradient-to-b from-[#FBF3E7] to-[#F5E8D6] py-12 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto space-y-10">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="text-temple-saffron font-script text-3xl sm:text-4xl">Divine Services</div>
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-temple-brown">
              Book Your Sacred Service
            </h1>
            <p className="text-temple-tan text-base max-w-2xl mx-auto">
              Select a service, choose your preferred date, and receive blessings from Lord Arulmigu Manakula Vinayagar.
            </p>
            <div className="w-24 h-0.5 bg-temple-gold mx-auto" />
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2 justify-center">
            {categories.map((cat) => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  activeCategory === cat
                    ? 'bg-temple-saffron text-white shadow-glowing-orange'
                    : 'bg-white border border-temple-gold/40 text-temple-brown hover:bg-temple-cream'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Service Cards */}
          {loading ? (
            <div className="py-20 text-center text-temple-tan">Loading services...</div>
          ) : (
            <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" layout>
            {filtered.map((svc, i) => (
              <motion.div key={svc.id} layout
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="bg-white rounded-2xl p-6 border border-temple-gold/40 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-temple-cream border border-temple-gold/40 flex items-center justify-center text-2xl">{svc.icon}</div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-temple-cream text-temple-olive border border-temple-gold/30">{svc.category}</span>
                </div>
                <h3 className="font-serif text-lg font-bold text-temple-brown mb-3 group-hover:text-temple-saffron transition-colors">{svc.name}</h3>
                <div className="space-y-1.5 mb-5">
                  {[
                    ['Session', svc.session],
                    ['Max Persons', svc.maxPersons],
                    ['Book at least', `${svc.advanceDays} days ahead`],
                  ].map(([label, val]) => (
                    <div key={label} className="flex justify-between text-xs">
                      <span className="text-temple-tan">{label}</span>
                      <span className="font-medium text-temple-brown">{val}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs pt-1 border-t border-temple-gold/20">
                    <span className="text-temple-tan">Seva Amount</span>
                    <span className="font-bold text-temple-green text-sm">₹{svc.price}</span>
                  </div>
                </div>
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={() => handleBook(svc.id, svc.name)}
                  className="w-full py-2.5 rounded-xl bg-temple-saffron hover:bg-temple-saffron-hover text-white font-bold text-sm shadow-glowing-orange transition-colors"
                >
                  Book Now ›
                </motion.button>
              </motion.div>
            ))}
          </motion.div>
          )}

          {/* Info note */}
          <p className="text-center text-xs text-temple-tan bg-white/60 rounded-xl border border-temple-gold/30 p-3 max-w-2xl mx-auto">
            All service prices are default seva amounts. Booking is confirmed only after payment.
            For queries, call <span className="font-semibold text-temple-brown">+91 12345 67890</span>.
          </p>
        </div>
      </main>
      <Footer />
    </>
  )
}
