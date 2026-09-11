/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      // ── Sacred Temple Palette ───────────────────────────────
      colors: {
        // Temple surface
        'temple-ivory':      '#FBF3E7',
        'temple-cream':      '#FAF0E1',
        'temple-tan':        '#9E7C4A',

        // Temple brand
        'temple-saffron':       '#E8791A',
        'temple-saffron-hover': '#C96A12',
        'temple-gold':          '#C99A3E',
        'temple-olive':         '#3A4222',
        'temple-dark-olive':    '#2B3218',
        'temple-green':         '#4C5A26',
        'temple-brown':         '#2E2417',

        // Apple HIG Dashboard
        'apple-bg':   '#F5F5F7',
        'apple-ink':  '#1D1D1F',
        'apple-muted':'#6E6E73',
        'apple-blue': '#0071E3',
        'apple-amber':'#F5A623',
      },

      fontFamily: {
        serif:   ['Playfair Display', 'Georgia', 'serif'],
        script:  ['Great Vibes', 'cursive'],
        sans:    ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        display: ['-apple-system', 'Inter', 'sans-serif'],
      },

      animation: {
        float:         'float 4s ease-in-out infinite',
        'float-slow':  'float 6s ease-in-out infinite',
        glow:          'glow 3s ease-in-out infinite',
        'fade-in':     'fadeIn 0.4s ease both',
      },
      keyframes: {
        float:   { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        glow:    { '0%,100%': { opacity: 0.6 }, '50%': { opacity: 1 } },
        fadeIn:  { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'none' } },
      },

      backdropBlur: { xs: '2px' },

      boxShadow: {
        'sacred':         '0 0 32px 8px rgba(201,154,62,0.22), 0 8px 32px rgba(0,0,0,0.10)',
        'card-lift':      '0 4px 24px rgba(58,66,34,0.06), 0 1px 4px rgba(0,0,0,0.04)',
        'glowing-orange': '0 4px 20px rgba(232,121,26,0.35)',
        'glowing-green':  '0 4px 20px rgba(76,90,38,0.35)',
        'apple-modal':    '0 20px 60px rgba(0,0,0,0.14), 0 4px 12px rgba(0,0,0,0.06)',
      },

      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
    },
  },
  plugins: [],
}
