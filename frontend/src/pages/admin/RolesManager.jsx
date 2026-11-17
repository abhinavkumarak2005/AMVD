import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Loader2, Plus, Edit2, Trash2, Check, X, ShieldAlert } from 'lucide-react'
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

const SYSTEM_ROLES = ['super_admin', 'admin', 'devotee', 'staff']

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

  // Rename Role State
  const [editingRole, setEditingRole] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [submittingRename, setSubmittingRename] = useState(false)

  // Delete Role State
  const [roleToDelete, setRoleToDelete] = useState(null)
  const [deletingRole, setDeletingRole] = useState(false)

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

  const handleRenameRole = async () => {
    if (!renameValue.trim() || !editingRole) return
    const formatted = renameValue.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
    if (formatted === editingRole.name) {
      setEditingRole(null)
      return
    }

    setSubmittingRename(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/roles/${editingRole.name}/rename`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session?.session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ new_name: formatted })
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.detail || "Failed to rename role")
      }
      toast.success(`Role renamed to '${formatted}'`)
      setEditingRole(null)
      fetchRoles()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSubmittingRename(false)
    }
  }

  const handleDeleteRole = async () => {
    if (!roleToDelete) return
    setDeletingRole(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/roles/${roleToDelete.name}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.session?.access_token}`
        }
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.detail || "Failed to delete role")
      }
      toast.success(`Role '${roleToDelete.name}' deleted`)
      setRoleToDelete(null)
      fetchRoles()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setDeletingRole(false)
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
        <div>
          <h2 className="text-xl font-semibold text-apple-ink">Roles & Permissions</h2>
          <p className="text-xs text-apple-muted mt-0.5">Manage administrative roles, module access levels, and custom staff roles</p>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-temple-saffron hover:bg-temple-saffron-hover text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
        >
          <Plus size={16} /> New Role
        </button>
      </div>

      {isCreating && (
        <div className="apple-card p-4 flex gap-3 items-center">
          <input 
            type="text" 
            placeholder="Role Name (e.g., accounts_manager, puja_coordinator)"
            className="apple-input flex-1"
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
          />
          <button onClick={handleCreateRole} className="px-4 py-2 bg-temple-green text-white rounded-lg text-sm font-medium hover:bg-temple-green/90">
            Create Role
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
          {roles.filter(r => r.name !== 'devotee').map(role => {
            const isSystemRole = SYSTEM_ROLES.includes(role.name)
            return (
              <div key={role.name} className="apple-card p-0 overflow-hidden border border-gray-100 flex flex-col h-full shadow-sm">
                <div className="bg-gray-50/80 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-apple-ink capitalize">{role.name.replace(/_/g, ' ')}</h3>
                    <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-mono">{role.name}</span>
                    {isSystemRole && (
                      <span className="text-[10px] bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded-full">System</span>
                    )}
                  </div>

                  {/* Rename & Delete for Custom / Dummy Roles */}
                  {!isSystemRole && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingRole(role)
                          setRenameValue(role.name)
                        }}
                        title="Rename Role"
                        className="p-1.5 text-gray-500 hover:text-temple-saffron hover:bg-white rounded-lg transition"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => setRoleToDelete(role)}
                        title="Delete Role"
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-white rounded-lg transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="p-4 flex-1 flex flex-col gap-3">
                  {PERMISSION_MODULES.map(mod => {
                    const isInherited = role.permissions?.['all'] && mod.key !== 'all'
                    const hasView = !!role.permissions?.[`view_${mod.key}`]
                    const hasManage = !!role.permissions?.[`manage_${mod.key}`]
                    
                    return (
                      <div key={mod.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                        <span className={`text-sm ${hasView || hasManage || (mod.key === 'all' && role.permissions?.['all']) ? 'text-apple-ink font-medium' : 'text-apple-muted'}`}>
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
            )
          })}
        </div>
      )}

      {/* Rename Role Modal */}
      {editingRole && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-apple-ink flex items-center gap-2">
                <Edit2 size={18} className="text-temple-saffron" /> Alter Role Name
              </h3>
              <button onClick={() => setEditingRole(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-700 block">Current Name: <span className="font-mono text-apple-ink">{editingRole.name}</span></label>
              <input
                type="text"
                placeholder="New role name"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="apple-input w-full px-3 py-2 text-sm"
              />
              <p className="text-xs text-apple-muted">All staff assigned to this role will automatically be migrated to the new name.</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingRole(null)}
                className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRenameRole}
                disabled={submittingRename || !renameValue.trim()}
                className="px-4 py-2 bg-temple-saffron hover:bg-temple-saffron-hover text-white rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
              >
                {submittingRename ? <Loader2 size={16} className="animate-spin" /> : 'Save New Name'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Role Modal */}
      {roleToDelete && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <ShieldAlert size={24} />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-apple-ink">Delete Custom Role</h3>
              <p className="text-sm text-apple-muted">
                Are you sure you want to permanently delete role <strong className="text-apple-ink">{roleToDelete.name}</strong>?
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRoleToDelete(null)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteRole}
                disabled={deletingRole}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {deletingRole ? <Loader2 size={16} className="animate-spin" /> : 'Delete Role'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
