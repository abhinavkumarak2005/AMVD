import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { User, LogOut, LayoutDashboard, ChevronDown, Menu, X, HeartHandshake } from 'lucide-react'
import { useAuthStore } from '../../store'
import logoGold from '../../assets/logo-gold.png'

const NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'About Us', href: '#history' },
  { label: 'Services', href: '/services' },
  { label: 'Pooja Booking', href: '/services' },
  { label: 'Timings', href: '#timings' },
  { label: 'Gallery', href: '#gallery' },
  { label: 'Donations', href: '/donations' },
  { label: 'Contact Us', href: '#contact' },
]

export default function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const { session, profile, openAuthModal, signOut } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={`sticky top-0 z-30 transition-all duration-300 ${
      scrolled
        ? 'bg-[#FDF8F0]/97 backdrop-blur-md border-b border-temple-gold/30 shadow-sm'
        : 'bg-[#FDF8F0]/90 backdrop-blur-sm border-b border-temple-gold/20'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-8 h-20 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-3 group focus:outline-none">
          <div className="w-12 h-12 rounded-lg bg-temple-cream border border-temple-gold/60 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform overflow-hidden p-1">
            <img src={logoGold} alt="Sri Manakula Vinayagar" className="w-full h-full object-contain" />
          </div>
          <div className="flex flex-col">
            <span className="font-serif text-lg sm:text-xl font-bold tracking-tight text-temple-brown leading-tight group-hover:text-temple-saffron transition-colors">
              Sri Manakula
            </span>
            <span className="font-serif text-xs sm:text-sm font-semibold tracking-wider uppercase text-temple-gold">
              Vinayagar Devasthanam
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden xl:flex items-center space-x-5 text-[13.5px] font-medium text-temple-brown">
          {NAV_LINKS.map((link) => (
            <Link key={link.label} to={link.href}
              className="relative hover:text-temple-saffron transition-colors py-1 group"
            >
              {link.label}
              <span className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-temple-saffron rounded-full scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
            </Link>
          ))}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {session ? (
            <div className="relative">
              <button onClick={() => setProfileOpen((o) => !o)}
                className="flex items-center gap-2 px-3 py-2 rounded-full border border-temple-gold/40 hover:bg-temple-cream transition-all text-sm font-medium text-temple-brown"
              >
                <div className="w-7 h-7 rounded-full bg-temple-saffron flex items-center justify-center text-white overflow-hidden">
                  <User size={16} className="mt-0.5" />
                </div>
                <span className="hidden sm:block max-w-[100px] truncate">
                  {(profile?.full_name || session.user.user_metadata?.full_name || 'Account').split(' ')[0]}
                </span>
                <ChevronDown size={14} className={`transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-apple-modal border border-gray-100 overflow-hidden z-50"
                  >
                    <div className="p-3 border-b border-gray-100">
                      <p className="text-sm font-semibold text-apple-ink truncate">{profile?.full_name || 'Devotee'}</p>
                      <p className="text-xs text-apple-muted truncate">{profile?.email || session.user.email}</p>
                    </div>
                    <div className="py-1">
                      <button onClick={() => { navigate('/dashboard'); setProfileOpen(false) }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-apple-ink hover:bg-gray-50 transition-colors"
                      >
                        <LayoutDashboard size={15} className="text-apple-muted" /> My Dashboard
                      </button>
                      <button onClick={() => { signOut(); setProfileOpen(false) }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut size={15} /> Sign Out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <button onClick={() => openAuthModal('login')}
              className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-full border border-temple-brown/30 text-sm font-medium text-temple-brown hover:bg-temple-cream transition-all"
            >
              <User size={15} /> Log In
            </button>
          )}

          <Link to="/donations"
            className="btn-bounce inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-temple-saffron text-white text-sm font-bold tracking-wide shadow-glowing-orange hover:bg-temple-saffron-hover transition-colors"
          >
            Donate <HeartHandshake size={16} />
          </Link>

          <button onClick={() => setMobileOpen((o) => !o)} className="xl:hidden p-2 rounded-lg hover:bg-temple-cream transition-colors">
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="xl:hidden overflow-hidden bg-[#FDF8F0] border-t border-temple-gold/20"
          >
            <div className="px-4 py-4 space-y-1">
              {NAV_LINKS.map((link) => (
                <Link key={link.label} to={link.href} onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2.5 rounded-lg text-sm font-medium text-temple-brown hover:bg-temple-cream transition-colors"
                >
                  {link.label}
                </Link>
              ))}
              {!session && (
                <button onClick={() => { openAuthModal('login'); setMobileOpen(false) }}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-temple-saffron hover:bg-temple-cream transition-colors"
                >
                  Log In / Sign Up
                </button>
              )}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  )
}
