import { create } from 'zustand'
import { supabase } from '../lib/supabaseClient'

// ── Auth Store ───────────────────────────────────────────────────────────
export const useAuthStore = create((set, get) => ({
  session: null,
  user: null,
  profile: null,
  isLoading: true,
  authModalOpen: false,
  authModalMode: 'login',

  init: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    
    // Check if session is older than 24 hours
    if (session?.user?.last_sign_in_at) {
      const lastSignIn = new Date(session.user.last_sign_in_at).getTime()
      if (Date.now() - lastSignIn > 24 * 60 * 60 * 1000) {
        await supabase.auth.signOut()
        set({ session: null, user: null, profile: null, isLoading: false })
        return
      }
    }

    // Fetch profile before ending loading state to prevent route redirects
    if (session?.user) {
      await get().fetchProfile(session.user.id)
    }

    set({ session, user: session?.user ?? null, isLoading: false })
    
    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user?.last_sign_in_at) {
        const lastSignIn = new Date(session.user.last_sign_in_at).getTime()
        if (Date.now() - lastSignIn > 24 * 60 * 60 * 1000) {
          supabase.auth.signOut()
          set({ session: null, user: null, profile: null })
          return
        }
      }
      
      if (session?.user) {
        await get().fetchProfile(session.user.id)
      } else {
        set({ profile: null })
      }
      
      set({ session, user: session?.user ?? null })
    })
  },

  fetchProfile: async (userId) => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    if (data) set({ profile: data })
  },

  openAuthModal: (mode = 'login') => set({ authModalOpen: true, authModalMode: mode }),
  closeAuthModal: () => set({ authModalOpen: false }),

  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, user: null, profile: null })
  },
}))

// ── Notice Store ──────────────────────────────────────────────────────────
export const useNoticeStore = create((set) => ({
  notices: [],
  dismissed: [],

  fetchNotices: async () => {
    const { data } = await supabase
      .from('notices')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: true })
      .limit(5)
    if (data) set({ notices: data })
  },

  dismiss: (id) => set((s) => ({ dismissed: [...s.dismissed, id] })),
}))

// ── Booking Hold Store ───────────────────────────────────────────────────
export const useBookingStore = create((set, get) => ({
  hold: null,
  secondsLeft: 0,
  timerInterval: null,

  setHold: (hold) => {
    const old = get().timerInterval
    if (old) clearInterval(old)
    const expiresAt = new Date(hold.expiresAt).getTime()
    const tick = () => {
      const secs = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
      set({ secondsLeft: secs })
      if (secs === 0) {
        clearInterval(get().timerInterval)
        set({ hold: null, timerInterval: null })
      }
    }
    tick()
    const interval = setInterval(tick, 1000)
    set({ hold, timerInterval: interval })
  },

  clearHold: () => {
    const old = get().timerInterval
    if (old) clearInterval(old)
    set({ hold: null, secondsLeft: 0, timerInterval: null })
  },
}))
