import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Loader2, Plus, Save, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'

const AVAILABLE_PERMISSIONS = [
  { key: 'manage_users', label: 'Manage Users' },
  { key: 'manage_roles', label: 'Manage Roles' },
  { key: 'manage_services', label: 'Manage Services' },
  { key: 'manage_bookings', label: 'Manage Bookings' },
  { key: 'manage_calendar', label: 'Manage Calendar' },
  { key: 'manage_notices', label: 'Manage Notices' },
  { key: 'view_reports', label: 'View Reports' },
  { key: 'manage_exemptions', label: 'Manage Tax Exemptions' },
  { key: 'all', label: 'Super Admin Access (All)' }
]

export default function RolesManager() {
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [newRoleName, setNewRoleName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const fetchRoles = async () => {
    try {
      const { data: session } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/roles`, {
        headers: { 'Authorization': `Bearer ${session?.session?.access_token}` }
      })
      if (!res.ok) throw new Error("Permission denied")
      const data = await res.json()
      setRoles(data)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRoles()
  }, [])

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return
    const formattedName = newRoleName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
    
    try {
      const { data: session } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/roles`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: formattedName, permissions: {} })
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.detail || "Failed to create role")
      }
      toast.success(`Role '${formattedName}' created`)
      setNewRoleName('')
      setIsCreating(false)
      fetchRoles()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const handlePermissionToggle = async (roleName, permKey, currentValue, currentPermissions) => {
    if (roleName === 'super_admin' && permKey === 'all' && currentValue) {
      toast.error("Cannot revoke super_admin master access")
      return
    }

    const newPermissions = { ...currentPermissions, [permKey]: !currentValue }
    
    // Optimistic UI update
    setRoles(prev => prev.map(r => r.name === roleName ? { ...r, permissions: newPermissions } : r))

    try {
      const { data: session } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/roles/${roleName}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session?.session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: roleName, permissions: newPermissions })
      })
      if (!res.ok) throw new Error("Failed to update permissions")
    } catch (e) {
      toast.error(e.message)
      fetchRoles() // Revert on error
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-apple-ink">Roles & Permissions</h2>
        <button 
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-temple-saffron hover:bg-temple-saffron-hover text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} /> New Role
        </button>
      </div>

      {isCreating && (
        <div className="apple-card p-4 flex gap-3 items-center">
          <input 
            type="text" 
            placeholder="Role Name (e.g., manager)"
            className="apple-input flex-1"
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
          />
          <button onClick={handleCreateRole} className="px-4 py-2 bg-temple-green text-white rounded-lg text-sm font-medium hover:bg-temple-green/90">
            Create
          </button>
          <button onClick={() => setIsCreating(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
            Cancel
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-temple-saffron" /></div>
      ) : roles.length === 0 ? (
        <div className="py-10 text-center text-apple-muted">No roles found or access denied.</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {roles.map(role => (
            <div key={role.name} className="apple-card p-0 overflow-hidden border border-gray-100">
              <div className="bg-gray-50/80 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-semibold text-apple-ink capitalize">{role.name.replace(/_/g, ' ')}</h3>
                <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-mono">{role.name}</span>
              </div>
              <div className="p-4 space-y-3">
                {AVAILABLE_PERMISSIONS.map(perm => {
                  const hasPerm = role.permissions?.[perm.key] || role.permissions?.['all']
                  const isInherited = perm.key !== 'all' && role.permissions?.['all']
                  return (
                    <label key={perm.key} className="flex items-center justify-between cursor-pointer group">
                      <span className={`text-sm ${hasPerm ? 'text-apple-ink font-medium' : 'text-apple-muted'}`}>
                        {perm.label}
                      </span>
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          className="sr-only peer"
                          checked={!!role.permissions?.[perm.key]}
                          disabled={isInherited}
                          onChange={(e) => handlePermissionToggle(role.name, perm.key, !!role.permissions?.[perm.key], role.permissions)}
                        />
                        <div className={`w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-temple-green ${isInherited ? 'opacity-50 cursor-not-allowed' : ''}`}></div>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
