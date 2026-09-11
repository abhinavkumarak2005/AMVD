import React from 'react'
import { Link } from 'react-router-dom'
import logoGold from '../../assets/logo-gold.png'

export default function Footer() {
  return (
    <footer className="bg-temple-dark-olive text-white/80 pt-16 pb-8 border-t-2 border-temple-gold/40 relative overflow-hidden" id="contact">
      <div className="absolute -bottom-10 right-0 opacity-5 pointer-events-none">
        <img src={logoGold} alt="" className="w-80 h-80 object-contain" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-12 gap-8 pb-12 border-b border-[#4B5927]">
          {/* About */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-temple-cream/10 border border-temple-gold/40 flex items-center justify-center p-1">
                <img src={logoGold} alt="Temple Logo" className="w-full h-full object-contain" />
              </div>
              <span className="font-serif text-base font-bold text-white tracking-wide">
                Sri Manakula Vinayagar Devasthanam
              </span>
            </div>
            <p className="text-xs text-white/70 leading-relaxed text-justify">
              Sri Manakula Vinayagar Temple is one of the most celebrated and historic Ganesha temples
              in South India, situated in the coastal town of Puducherry. Believed to have manifested
              over five centuries ago, it serves as a fountainhead of peace, unity, and divine grace.
            </p>
            <div className="pt-2">
              <span className="text-xs font-semibold uppercase text-temple-gold tracking-wider">Follow Our Social Updates</span>
              <div className="flex items-center gap-2.5 mt-2">
                {[
                  { label: 'f', name: 'Facebook' },
                  { label: '📷', name: 'Instagram' },
                  { label: '▶', name: 'YouTube' },
                  { label: 'wa', name: 'WhatsApp' },
                ].map(({ label, name }) => (
                  <a key={name} href="#" aria-label={name}
                    className="w-8 h-8 rounded-full bg-[#394220] hover:bg-temple-saffron flex items-center justify-center text-temple-gold hover:text-white transition text-xs font-bold"
                  >{label}</a>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="font-serif text-sm font-bold text-temple-gold tracking-wider uppercase">Quick Links</h4>
            <ul className="space-y-2 text-xs">
              {['About Us', 'History', 'Pooja Booking', 'Donations', 'Photo Gallery', 'Contact Us'].map((l) => (
                <li key={l}><a href="#" className="hover:text-temple-saffron transition">{l}</a></li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="font-serif text-sm font-bold text-temple-gold tracking-wider uppercase">Services</h4>
            <ul className="space-y-2 text-xs">
              {['Daily Pooja', 'Special Pooja', 'Annadhanam', 'Thiru Kalyanam', 'Maha Abhishekam', 'e-Hundi Kanikkai'].map((l) => (
                <li key={l}><a href="#" className="hover:text-temple-saffron transition">{l}</a></li>
              ))}
            </ul>
          </div>

          {/* Information */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="font-serif text-sm font-bold text-temple-gold tracking-wider uppercase">Information</h4>
            <ul className="space-y-2 text-xs">
              {['Temple Timings', 'Festivals & Events', 'News & Updates', 'Spiritual Blog', 'FAQs', 'Privacy Policy'].map((l) => (
                <li key={l}><a href="#" className="hover:text-temple-saffron transition">{l}</a></li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="font-serif text-sm font-bold text-temple-gold tracking-wider uppercase">Newsletter</h4>
            <p className="text-xs text-white/70 leading-relaxed">
              Subscribe to receive divine darshan updates, festival dates, and temple announcements.
            </p>
            <form className="space-y-2" onSubmit={(e) => e.preventDefault()}>
              <input type="email" required placeholder="Enter your email"
                className="w-full px-3 py-2 text-xs rounded bg-white text-temple-brown placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-temple-saffron"
              />
              <button type="submit"
                className="w-full py-2 rounded bg-temple-saffron hover:bg-temple-saffron-hover text-white text-xs font-bold tracking-wide transition shadow-sm"
              >
                Subscribe
              </button>
            </form>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-white/60">
          <p>© 2026 Sri Manakula Vinayagar Devasthanam. All Rights Reserved. Reg: PY-DHRE-00103</p>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-temple-gold transition">Privacy Policy</a>
            <span>•</span>
            <a href="#" className="hover:text-temple-gold transition">Terms & Conditions</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
