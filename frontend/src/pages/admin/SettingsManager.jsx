import React, { useState, useEffect } from 'react'
import { Loader2, Save } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { toast } from 'sonner'

export default function SettingsManager() {
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/settings`)
      if (res.ok) {
        setSettings(await res.json())
      }
    } catch(e) {
      toast.error("Failed to load settings")
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/settings`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.session?.access_token}` 
        },
        body: JSON.stringify({ key: '80g_minimum_amount', value: settings['80g_minimum_amount'] })
      })
      if (!res.ok) throw new Error("Failed to save settings")
      toast.success("Settings saved successfully")
    } catch(e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-temple-saffron" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-apple-ink">System Settings</h2>
          <p className="text-sm text-apple-muted mt-1">Manage global system configurations.</p>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 max-w-2xl">
        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-apple-ink">80G Tax Exemption Minimum Amount (₹)</label>
            <p className="text-xs text-apple-muted">The minimum donation or booking amount required for a user to request an 80G Tax Exemption certificate automatically.</p>
            <input 
              type="number"
              required
              value={settings['80g_minimum_amount'] || ''}
              onChange={e => setSettings({ ...settings, '80g_minimum_amount': Number(e.target.value) })}
              className="w-full max-w-xs px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-temple-green/20 focus:border-temple-green transition-all"
            />
          </div>

          <button 
            type="submit" 
            disabled={saving}
            className="bg-temple-green text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-[#1f5a3c] flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Save Settings
          </button>
        </form>
      </div>
    </div>
  )
}
