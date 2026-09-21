import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'

const PERMISSION_MODULES = [
  { key: 'users', label: 'Users', options: ['full'] },
  { key: 'roles', label: 'Roles', options: ['full'] },
  { key: 'services', label: 'Services', options: ['view', 'full'] },
  { key: 'bookings', label: 'Bookings', options: ['view', 'full'] },
  { key: 'donations', label: 'Donations (eHundi)', options: ['view', 'full'] },
  { key: 'calendar', label: 'Calendar', options: ['full'] },
  { key: 'notices', label: 'Notices', options: ['full'] },
  { key: 'reports', label: 'Reports', options: ['view', 'full'] },
  { key: 'exemptions', label: 'Tax Exemptions', options: ['view', 'full'] },
  { key: 'all', label: 'Super Admin Access (All)', options: ['full'] }
]

const ToggleSwitch = ({ checked, onChange, disabled }) => (
  <div className="relative inline-block">
    <input 
      type="checkbox" 
      className="sr-only peer"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
    />
    <div className={`w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-temple-green ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}></div>
  </div>
)

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

  const handlePermissionToggle = async (roleName, modKey, accessLevel, isChecked, currentPermissions) => {
    if (roleName === 'super_admin' && modKey === 'all' && !isChecked) {
      toast.error("Cannot revoke super_admin master access")
      return
    }

    let newPermissions = { ...currentPermissions }
    
    if (modKey === 'all') {
      newPermissions['all'] = isChecked
    } else {
      if (accessLevel === 'manage') {
        newPermissions[`manage_${modKey}`] = isChecked
        if (isChecked) {
          newPermissions[`view_${modKey}`] = true
        }
      } else if (accessLevel === 'view') {
        newPermissions[`view_${modKey}`] = isChecked
        if (!isChecked) {
          newPermissions[`manage_${modKey}`] = false
        }
      }
    }
    
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
      fetchRoles()
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
          {roles.filter(r => r.name !== 'devotee').map(role => (
            <div key={role.name} className="apple-card p-0 overflow-hidden border border-gray-100 flex flex-col h-full">
              <div className="bg-gray-50/80 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-semibold text-apple-ink capitalize">{role.name.replace(/_/g, ' ')}</h3>
                <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-mono">{role.name}</span>
              </div>
              <div className="p-4 flex-1 flex flex-col gap-3">
                {PERMISSION_MODULES.map(mod => {
                  const isInherited = role.permissions?.['all'] && mod.key !== 'all'
                  const hasView = !!role.permissions?.[`view_${mod.key}`]
                  const hasManage = !!role.permissions?.[`manage_${mod.key}`]
                  
                  return (
                    <div key={mod.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                      <span className={`text-sm ${hasView || hasManage || mod.key === 'all' && role.permissions?.['all'] ? 'text-apple-ink font-medium' : 'text-apple-muted'}`}>
                        {mod.label}
                      </span>
                      
                      {mod.key === 'all' ? (
                        <div className="self-end sm:self-auto">
                          <ToggleSwitch 
                            checked={!!role.permissions?.['all']}
                            disabled={role.name === 'super_admin'}
                            onChange={c => handlePermissionToggle(role.name, mod.key, 'all', c, role.permissions || {})}
                          />
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-4 ml-4">
                          {mod.options.includes('view') && (
                            <label className="flex items-center gap-2 cursor-pointer">
                              <span className="text-xs text-apple-muted">View</span>
                              <ToggleSwitch 
                                checked={isInherited || hasView}
                                disabled={isInherited}
                                onChange={c => handlePermissionToggle(role.name, mod.key, 'view', c, role.permissions || {})}
                              />
                            </label>
                          )}
                          {mod.options.includes('full') && (
                            <label className="flex items-center gap-2 cursor-pointer">
                              <span className="text-xs text-apple-muted">Manage</span>
                              <ToggleSwitch 
                                checked={isInherited || hasManage}
                                disabled={isInherited}
                                onChange={c => handlePermissionToggle(role.name, mod.key, 'manage', c, role.permissions || {})}
                              />
                            </label>
                          )}
                        </div>
                      )}
                    </div>
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
