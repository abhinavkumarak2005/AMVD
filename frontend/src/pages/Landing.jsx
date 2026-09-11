import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import { Phone, Mail, MapPin } from 'lucide-react'
import { useAuthStore, useNoticeStore } from '../store'
import Header from '../components/layout/Header'
import Footer from '../components/layout/Footer'

// Real assets
import logoGold from '../assets/logo-gold.png'
import imgHero from '../assets/img/September_2023.jpg'
import imgHero2 from '../assets/img/IMG_7664.jpg'
import imgServices from '../assets/img/IMG_7700.jpg'
import imgServices2 from '../assets/img/IMG_7702.jpg'
import imgEhundi from '../assets/img/IMG_7865.jpg'
import imgGallery1 from '../assets/img/IMG_7788.jpg'
import imgGallery2 from '../assets/img/IMG_7798.jpg'
import imgGallery3 from '../assets/img/IMG_7800.jpg'
import imgGallery4 from '../assets/img/IMG_7831.jpg'
import imgGallery5 from '../assets/img/IMG_7836.jpg'
import imgGallery6 from '../assets/img/IMG_7842.jpg'

// ── Animation Variants ────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.55, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] },
  }),
}
const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
}

function ScrollReveal({ children, className = '', delay = 0 }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div ref={ref} className={className}
      initial="hidden" animate={inView ? 'visible' : 'hidden'} custom={delay} variants={fadeUp}
    >
      {children}
    </motion.div>
  )
}

// ── E-Hundi Donation Card ─────────────────────────────────────────────────
const AMOUNTS = [100, 500, 1000, 2500, 5000]

function EHundiCard() {
  const [selected, setSelected] = useState(1000)
  const [custom, setCustom] = useState('')
  const { session, openAuthModal } = useAuthStore()

  const handleDonate = () => {
    if (!session) { openAuthModal('login'); return }
    alert('Redirecting to Razorpay...')
  }
  const amount = custom ? parseInt(custom) : selected

  return (
    <div className="bg-white/95 backdrop-blur rounded-2xl p-6 sm:p-7 shadow-lg border border-temple-gold/40 space-y-5">
      <div className="text-center space-y-1">
        <h3 className="font-serif text-2xl font-bold text-temple-brown">Make Your Offering</h3>
        <p className="text-xs text-temple-tan">Choose an amount or enter your own contribution</p>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {AMOUNTS.map((a) => (
          <button key={a} onClick={() => { setSelected(a); setCustom('') }}
            className={`py-2.5 rounded-xl border text-xs sm:text-sm font-bold transition-all duration-200 ${
              selected === a && !custom
                ? 'border-2 border-temple-green bg-temple-green text-white shadow-sm'
                : 'border-temple-gold/60 text-temple-brown hover:bg-temple-cream'
            }`}
          >
            ₹{a.toLocaleString('en-IN')}
          </button>
        ))}
        <button onClick={() => { setSelected(0); setCustom('') }}
          className={`py-2.5 rounded-xl border border-dashed text-xs sm:text-sm font-semibold transition-all ${
            !AMOUNTS.includes(selected) && !custom ? 'border-temple-green text-temple-green' : 'border-temple-gold/80 text-temple-brown hover:bg-temple-cream'
          }`}
        >Custom</button>
      </div>

      <div className="relative">
        <span className="absolute inset-y-0 left-3 flex items-center text-temple-tan text-sm font-bold">₹</span>
        <input type="number" placeholder="Enter custom amount" value={custom}
          onChange={(e) => { setCustom(e.target.value); setSelected(0) }}
          className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-temple-gold/60 bg-white/80 text-sm
                     focus:ring-2 focus:ring-temple-saffron/40 focus:border-temple-saffron transition"
        />
      </div>

      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={handleDonate}
        className="w-full py-3.5 px-6 rounded-xl bg-temple-green hover:bg-[#3D491E] text-white font-bold
                   text-base flex items-center justify-center gap-2 shadow-glowing-green transition-colors"
      >
        Donate {amount ? `₹${amount.toLocaleString('en-IN')}` : ''} 🔒
      </motion.button>

      <div className="pt-2 text-center border-t border-temple-gold/20 space-y-1.5">
        <p className="text-[11px] font-medium text-temple-tan tracking-wide">
          UPI · Cards · Net Banking · Wallets
        </p>
        <div className="flex items-center justify-center gap-3 text-xs opacity-70">
          <span className="font-bold text-blue-700">VISA</span>
          <span className="font-bold text-red-600">Mastercard</span>
          <span className="font-bold text-amber-700">UPI</span>
          <span className="font-bold text-green-700">NetBanking</span>
        </div>
      </div>
    </div>
  )
}

// ── Gallery ───────────────────────────────────────────────────────────────
const GALLERY = [imgGallery1, imgGallery2, imgGallery3, imgGallery4, imgGallery5, imgGallery6]

// ── QR Placeholder ────────────────────────────────────────────────────────
function QRPlaceholder() {
  return (
    <svg className="w-full h-full text-temple-olive" fill="currentColor" viewBox="0 0 100 100">
      <rect height="30" rx="3" width="30"/><rect fill="white" height="18" width="18" x="6" y="6"/><rect height="10" width="10" x="10" y="10"/>
      <rect height="30" rx="3" width="30" x="70"/><rect fill="white" height="18" width="18" x="76" y="6"/><rect height="10" width="10" x="80" y="10"/>
      <rect height="30" rx="3" width="30" y="70"/><rect fill="white" height="18" width="18" x="6" y="76"/><rect height="10" width="10" x="10" y="80"/>
      <rect height="18" width="8" x="36" y="6"/><rect height="8" width="14" x="48" y="16"/>
      <rect height="28" width="28" x="36" y="38"/><rect height="8" width="18" x="72" y="42"/>
      <rect height="16" width="12" x="80" y="56"/><rect height="14" width="16" x="40" y="78"/>
      <rect height="12" width="18" x="66" y="80"/>
    </svg>
  )
}

// ── Temple Timings ────────────────────────────────────────────────────────
const TIMINGS = [
  { session: 'Morning Darshan', time: '5:45 AM – 12:00 PM', note: 'Thiruvanandal, Thiruvanandal Pooja, Ucchikala Pooja' },
  { session: 'Afternoon Break', time: '12:00 PM – 4:00 PM', note: 'Temple closed for rest' },
  { session: 'Evening Darshan', time: '4:00 PM – 9:00 PM', note: 'Sayarakshai Pooja, Ardhajama Pooja' },
]

// ── Main Page ─────────────────────────────────────────────────────────────
export default function Landing() {
  const { fetchNotices } = useNoticeStore()
  const [services, setServices] = useState([])

  useEffect(() => { 
    fetchNotices() 
    
    async function fetchServices() {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/bookings/services`)
        if (res.ok) {
          const data = await res.json()
          setServices(data.slice(0, 4).map(s => ({
            icon: '🪔',
            title: s.name,
            desc: `Book a ${s.category} session. Price starts at ₹${s.price_rupees}.`,
            cta: 'Book Now',
            href: '/services',
            featured: false
          })))
        }
      } catch (e) {
        console.error("Failed to fetch services")
      }
    }
    fetchServices()
  }, [fetchNotices])

  return (
    <>
      <Header />

      {/* ── Utility Top Bar ──────────────────────────────────────────── */}
      <aside className="bg-temple-olive text-white/90 text-xs py-2 px-4 sm:px-8 border-b border-[#4F5B2F] z-40">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 sm:gap-6 font-medium tracking-wide">
            <a href="tel:+911234567890" className="flex items-center gap-1.5 hover:text-temple-gold transition-colors">
              <Phone size={12} className="text-temple-gold" /> +91 12345 67890
            </a>
            <a href="mailto:info@manakulavinayagartemple.org" className="flex items-center gap-1.5 hover:text-temple-gold transition-colors">
              <Mail size={12} className="text-temple-gold" /> info@manakulavinayagartemple.org
            </a>
            <span className="hidden lg:flex items-center gap-1.5 text-white/80">
              <MapPin size={12} className="text-temple-gold" /> White Town, Puducherry, India
            </span>
          </div>
          <div className="flex items-center gap-3 text-white/80 text-xs">
            <a href="#timings" className="hover:text-temple-gold transition">Timings</a>
            <span className="text-white/30">|</span>
            <a href="#services" className="hover:text-temple-gold transition">Services</a>
            <span className="text-white/30">|</span>
            <a href="#gallery" className="hover:text-temple-gold transition">Gallery</a>
            <span className="text-white/30">|</span>
            <a href="#contact" className="hover:text-temple-gold transition">Contact Us</a>
          </div>
        </div>
      </aside>

      <main>
        {/* ── Hero Section ──────────────────────────────────────────────── */}
        <section className="relative overflow-hidden py-14 lg:py-20 bg-gradient-to-b from-[#FDF8F0] via-[#FBF3E7] to-[#F5E8D6]" id="history">
          {/* Mandala glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-mandala-glow opacity-60" />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-8 relative">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
              {/* Left: Narrative */}
              <div className="lg:col-span-6 xl:col-span-7 space-y-6">
                <ScrollReveal>
                  <div className="flex items-center gap-3 text-temple-saffron font-script text-3xl sm:text-4xl">
                    <span className="text-temple-gold text-lg">༻❁༺</span>
                    <span>History of the Temple</span>
                    <span className="text-temple-gold text-lg">༻❁༺</span>
                  </div>
                </ScrollReveal>
                <ScrollReveal delay={0.1}>
                  <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-temple-brown leading-tight">
                    Sri Manakula<br className="hidden sm:inline" /> Vinayagar Devasthanam
                  </h1>
                </ScrollReveal>
                <ScrollReveal delay={0.2}>
                  <p className="text-temple-tan text-base sm:text-lg leading-relaxed text-justify">
                    The temple is deeply steeped in over 500 years of glorious lore and divine intervention.
                    Located in the French Quarter of Puducherry facing the Bay of Bengal, the presiding deity,
                    Lord Bhuvaneswara Ganesha, has showered limitless benevolence upon countless seekers.
                    Even during historical trials when efforts were made to relocate the sacred stone, the idol
                    miraculously reappeared at this holy pond site, affirming the immortal presence of the Lord.
                  </p>
                  <p className="text-temple-tan text-sm sm:text-base leading-relaxed mt-3">
                    Devotees from every corner of the world gather here to offer prayers before commencing any
                    new endeavor, seeking blessings for prosperity, clarity of soul, and total liberation.
                  </p>
                </ScrollReveal>
                <ScrollReveal delay={0.3}>
                  <Link to="/services"
                    className="btn-bounce inline-flex items-center gap-3 px-8 py-3 rounded-full bg-temple-saffron text-white
                               font-semibold text-sm tracking-wider shadow-glowing-orange hover:bg-temple-saffron-hover"
                  >
                    <span>Explore Services</span><span className="text-xs">➜</span>
                  </Link>
                </ScrollReveal>
              </div>

              {/* Right: Real deity photo */}
              <ScrollReveal className="lg:col-span-6 xl:col-span-5 flex justify-center relative" delay={0.15}>
                <div className="relative max-w-md w-full">
                  <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                    className="relative rounded-3xl p-3 bg-gradient-to-b from-[#E7C78B] via-[#C99A3E] to-[#997127] shadow-sacred"
                  >
                    <div className="relative rounded-2xl overflow-hidden bg-[#241A13] border-2 border-temple-gold/40">
                      <img
                        src={logoGold}
                        alt="Sri Manakula Vinayagar — Moolavar Deity"
                        className="w-full h-auto object-cover object-top"
                        loading="eager"
                      />
                      <div className="absolute inset-0 pointer-events-none ring-1 ring-inset ring-amber-300/30" />
                    </div>
                  </motion.div>
                  {/* Floating badge */}
                  <motion.div
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                    className="absolute -bottom-5 left-4 bg-temple-cream/90 backdrop-blur border border-temple-gold/40
                               rounded-full px-4 py-1.5 shadow-md flex items-center gap-2"
                  >
                    <span className="text-amber-500 animate-pulse text-sm">🪔</span>
                    <span className="text-xs font-semibold tracking-wide text-temple-brown">Nithya Pooja Darshan</span>
                  </motion.div>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* ── e-Hundi Spotlight ─────────────────────────────────────────── */}
        <section className="py-12 lg:py-16 px-4 sm:px-8" id="ehundi">
          <div className="max-w-7xl mx-auto">
            <ScrollReveal>
              <div className="relative rounded-[32px] bg-gradient-to-br from-[#FAF0E1] via-[#F4E3CB] to-[#EEDBBF]
                              border-2 border-[#D4B680] shadow-card-lift p-6 sm:p-10 lg:p-12 overflow-hidden">
                {/* Glow decorations */}
                <div className="absolute -top-12 -left-12 w-48 h-48 rounded-full bg-temple-gold/10 blur-xl pointer-events-none" />
                <div className="absolute -bottom-12 -right-12 w-64 h-64 rounded-full bg-temple-saffron/10 blur-2xl pointer-events-none" />

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center relative">
                  {/* Deity Portrait — real temple photo */}
                  <div className="lg:col-span-4 flex flex-col items-center justify-center">
                    <div className="relative w-64 h-80 sm:w-72 sm:h-96 rounded-2xl overflow-hidden p-2
                                    bg-gradient-to-tr from-temple-gold to-amber-200 shadow-lg filigree-border">
                      <div className="w-full h-full bg-[#3b2a1a] rounded-xl overflow-hidden">
                        <img
                          src={imgEhundi}
                          alt="Sri Manakula Vinayagar Temple — Procession"
                          className="w-full h-full object-cover object-center hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                    </div>
                    <p className="mt-3 font-serif text-sm font-semibold tracking-wide text-temple-brown text-center">
                      Maha Ganapathi Anugraha
                    </p>
                  </div>

                  {/* Value Prop */}
                  <div className="lg:col-span-4 text-center lg:text-left space-y-5">
                    <div className="flex items-center justify-center lg:justify-start gap-2 text-temple-saffron font-script text-2xl">
                      <span>⊰❖⊱</span>
                      <span>The Easiest Way to Serve Lord Vinayagar</span>
                      <span>⊰❖⊱</span>
                    </div>
                    <div className="space-y-1">
                      <h2 className="font-serif text-5xl sm:text-6xl font-extrabold text-temple-green tracking-tight leading-none drop-shadow-sm">
                        e-Hundi
                      </h2>
                      <p className="font-serif italic text-lg sm:text-xl text-temple-brown/90 font-medium">
                        Your Devotion. Our Responsibility.
                      </p>
                    </div>
                    <p className="text-xs sm:text-sm text-temple-tan leading-relaxed">
                      Offer your sacred kanikkai and hundi offerings directly into the devasthanam treasury
                      from anywhere across the globe with complete spiritual sanctity.
                    </p>
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      {[
                        { icon: '🛡️', title: 'Secure & Trusted', sub: 'Official Gateway' },
                        { icon: '📜', title: 'Instant Receipt', sub: 'Tax Exemption 80G' },
                        { icon: '🛕', title: 'Temple Activities', sub: 'Annadhanam & Seva' },
                        { icon: '🌍', title: 'Serve Anywhere', sub: 'Global Devotees' },
                      ].map(({ icon, title, sub }) => (
                        <div key={title} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/70 border border-temple-gold/30 shadow-xs">
                          <div className="w-9 h-9 rounded-full bg-temple-gold/20 flex items-center justify-center text-lg shrink-0">{icon}</div>
                          <div className="text-left">
                            <p className="font-bold text-xs text-temple-brown leading-tight">{title}</p>
                            <span className="text-[10px] text-temple-tan">{sub}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Donation Card */}
                  <div className="lg:col-span-4">
                    <EHundiCard />
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ── Services Section ──────────────────────────────────────────── */}
        <section className="py-12 lg:py-16 bg-gradient-to-b from-[#FBF3E7] to-[#F5E8D6]" id="services">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 space-y-12">
            <ScrollReveal className="text-center space-y-2">
              <div className="text-temple-saffron font-script text-3xl sm:text-4xl">Our Services</div>
              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-temple-brown">
                What we do and how we serve Lord Vinayagar
              </h2>
              <div className="w-24 h-0.5 bg-temple-gold mx-auto mt-2" />
            </ScrollReveal>

            {/* About strip with real photos */}
            <ScrollReveal>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-white/60 rounded-3xl
                              p-6 sm:p-8 border border-temple-gold/40 shadow-sm">
                <div className="lg:col-span-4">
                  <div className="rounded-2xl overflow-hidden border-2 border-temple-gold shadow-md">
                    <img src={imgServices} alt="Temple Sanctum Darshan" className="w-full h-56 object-cover object-center" />
                  </div>
                </div>
                <div className="lg:col-span-5 space-y-4">
                  <h3 className="font-serif text-2xl font-bold text-temple-brown">
                    Sri Manakula Vinayagar <span className="font-normal text-temple-tan text-lg">Devasthanam</span>
                  </h3>
                  <p className="text-temple-tan text-sm leading-relaxed">
                    Every day at the shrine is marked with sacred rituals following centuries-old Agama Shastra traditions.
                    From early morning Suprabhatham and Sahasranama archana to royal golden chariot processions, devotees
                    are invited to partake in timeless spiritual offerings.
                  </p>
                  <Link to="/services"
                    className="btn-bounce inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-temple-saffron
                               text-white text-xs font-bold tracking-wider hover:bg-temple-saffron-hover shadow-md"
                  >
                    <span>View All Services</span> <span>➜</span>
                  </Link>
                </div>
                <div className="lg:col-span-3 flex justify-center">
                  <div className="w-44 h-56 rounded-2xl overflow-hidden border border-temple-gold/40 p-1 bg-amber-50 shadow-inner">
                    <img src={imgServices2} alt="Lord Vinayagar" className="w-full h-full object-cover object-top rounded-xl" />
                  </div>
                </div>
              </div>
            </ScrollReveal>

            {/* 4 Service Cards */}
            <motion.div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-4"
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} variants={stagger}
            >
              {services.map((svc) => (
                <motion.div key={svc.title} variants={fadeUp}
                  className={`relative bg-white rounded-2xl p-6 border transition-all flex flex-col justify-between text-center space-y-4
                    ${svc.featured
                      ? 'border-2 border-temple-green shadow-sacred sm:-translate-y-2 ring-2 ring-temple-gold/30'
                      : 'border-temple-gold/40 shadow-sm hover:shadow-md hover:-translate-y-1'
                    }`}
                >
                  {svc.featured && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full
                                    bg-gradient-to-r from-temple-saffron to-amber-500 text-white text-[10px] font-extrabold uppercase tracking-wider shadow-sm">
                      Most Popular
                    </div>
                  )}
                  <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center text-2xl shadow-inner mt-1
                    ${svc.featured ? 'bg-[#EBF0DC] border border-temple-green/50' : 'bg-temple-cream border border-temple-gold/60'}`}>
                    {svc.icon}
                  </div>
                  <div className="space-y-2">
                    <h4 className={`font-serif text-xl font-bold ${svc.featured ? 'text-temple-green' : 'text-temple-brown'}`}>{svc.title}</h4>
                    <p className="text-xs text-temple-tan leading-relaxed">{svc.desc}</p>
                  </div>
                  <Link to={svc.href}
                    className={`btn-bounce inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-full text-white text-xs font-bold shadow-sm
                      ${svc.featured ? 'bg-temple-green hover:bg-[#3D491E]' : 'bg-temple-saffron hover:bg-temple-saffron-hover'}`}
                  >
                    <span>{svc.cta}</span> <span>›</span>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── Temple Timings ────────────────────────────────────────────── */}
        <section className="py-12 lg:py-16 bg-white border-t border-temple-gold/20" id="timings">
          <div className="max-w-5xl mx-auto px-4 sm:px-8 space-y-8">
            <ScrollReveal className="text-center space-y-2">
              <div className="text-temple-saffron font-script text-3xl sm:text-4xl">Daily Schedule</div>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-temple-brown">Temple Darshan Timings</h2>
              <div className="w-24 h-0.5 bg-temple-gold mx-auto" />
            </ScrollReveal>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {TIMINGS.map((t, i) => (
                <ScrollReveal key={t.session} delay={i * 0.1}>
                  <div className="bg-gradient-to-b from-[#FAF0E1] to-[#F4E3CB] rounded-2xl p-6 border border-temple-gold/50 text-center space-y-3 hover:shadow-sacred transition-shadow">
                    <div className="text-3xl">{i === 0 ? '🌅' : i === 1 ? '🌞' : '🌆'}</div>
                    <h3 className="font-serif text-lg font-bold text-temple-brown">{t.session}</h3>
                    <p className="font-bold text-temple-saffron text-base">{t.time}</p>
                    <p className="text-xs text-temple-tan leading-relaxed">{t.note}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Gallery ───────────────────────────────────────────────────── */}
        <section className="py-12 lg:py-16 bg-gradient-to-b from-[#F5E8D6] to-[#FBF3E7]" id="gallery">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 space-y-8">
            <ScrollReveal className="text-center space-y-2">
              <div className="text-temple-saffron font-script text-3xl sm:text-4xl">Sacred Moments</div>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-temple-brown">Photo Gallery</h2>
              <div className="w-24 h-0.5 bg-temple-gold mx-auto" />
            </ScrollReveal>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {GALLERY.map((src, i) => (
                <ScrollReveal key={i} delay={i * 0.07}>
                  <div className="overflow-hidden rounded-2xl border border-temple-gold/30 shadow-sm hover:shadow-sacred transition-all group">
                    <img
                      src={src}
                      alt={`Temple moment ${i + 1}`}
                      className="w-full h-52 md:h-64 object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Quick Donation Strip ──────────────────────────────────────── */}
        <section className="py-12 lg:py-16 bg-[#FDF8F0] border-t border-temple-gold/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 space-y-8">
            <ScrollReveal className="text-center space-y-2">
              <div className="text-temple-saffron font-script text-3xl">Support The Temple</div>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-temple-brown">
                Help Support the Temple and Its Activities
              </h2>
            </ScrollReveal>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <ScrollReveal className="lg:col-span-7 bg-temple-cream/60 rounded-3xl p-6 sm:p-8 border border-temple-gold/50 space-y-5" delay={0.1}>
                <QuickDonationStrip />
              </ScrollReveal>

              <ScrollReveal className="lg:col-span-5" delay={0.2}>
                <div className="bg-white rounded-3xl p-6 border border-temple-gold/50 shadow-md flex flex-col sm:flex-row items-center gap-6">
                  <div className="w-32 h-32 p-2 bg-white rounded-xl border border-dashed border-temple-gold flex items-center justify-center shrink-0">
                    <QRPlaceholder />
                  </div>
                  <div className="space-y-2 text-center sm:text-left">
                    <h3 className="font-serif text-lg font-bold text-temple-brown">Scan & Donate</h3>
                    <p className="text-xs text-temple-tan leading-tight">
                      Scan using any UPI App (GPay, PhonePe, Paytm, BHIM) for instant seva contribution.
                    </p>
                    <div className="flex items-center justify-center sm:justify-start gap-2 pt-1 flex-wrap">
                      {['GPay', 'PhonePe', 'Paytm', 'BHIM'].map((app) => (
                        <span key={app} className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-gray-50 text-gray-700 border border-gray-200">{app}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}

// ── Quick Donation Strip ──────────────────────────────────────────────────
function QuickDonationStrip() {
  const [selected, setSelected] = useState(1000)
  const [custom, setCustom] = useState('')
  const { session, openAuthModal } = useAuthStore()

  const handleDonate = () => {
    if (!session) { openAuthModal('login'); return }
    alert('Redirecting to payment...')
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        {[100, 500, 1000].map((a) => (
          <button key={a} onClick={() => { setSelected(a); setCustom('') }}
            className={`px-5 py-2.5 rounded-xl border font-bold text-xs sm:text-sm transition-all duration-200 ${
              selected === a && !custom
                ? 'border-2 border-temple-saffron bg-temple-saffron text-white shadow-sm'
                : 'border-temple-gold/70 bg-white text-temple-brown hover:bg-temple-cream'
            }`}
          >
            ₹{a.toLocaleString('en-IN')}
          </button>
        ))}
        <div className="relative flex-1 min-w-[140px]">
          <span className="absolute inset-y-0 left-3 flex items-center text-temple-tan text-xs font-bold">₹</span>
          <input type="number" placeholder="Enter Amount" value={custom}
            onChange={(e) => { setCustom(e.target.value); setSelected(0) }}
            className="w-full pl-7 pr-3 py-2 rounded-xl border border-temple-gold/70 bg-white text-xs sm:text-sm focus:ring-1 focus:ring-temple-saffron"
          />
        </div>
        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={handleDonate}
          className="px-6 py-2.5 rounded-xl bg-temple-saffron hover:bg-temple-saffron-hover text-white text-xs sm:text-sm font-bold shadow-glowing-orange shrink-0"
        >
          Donate Now ➜
        </motion.button>
      </div>
      <p className="text-[11px] text-temple-tan leading-relaxed">
        Official Devasthanam Registration: PY-DHRE-00103. Donations may be eligible for income tax exemption under Section 80G.
      </p>
      <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-bold text-temple-tan border-t border-temple-gold/30">
        <span className="text-xs uppercase tracking-wider text-temple-brown">Secured By:</span>
        <span className="text-blue-600">Razorpay</span>
        <span className="text-indigo-800">VISA</span>
        <span className="text-red-500">Mastercard</span>
        <span className="text-emerald-700">UPI AutoPay</span>
      </div>
    </>
  )
}
