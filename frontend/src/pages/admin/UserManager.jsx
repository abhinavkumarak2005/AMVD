import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Loader2, Search, UserPlus, Trash2, Power, CheckCircle2, Clock, X, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '../../store'

export default function UserManager() {
  const { profile } = useAuthStore()
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Tabs & Search state
  const [activeTab, setActiveTab] = useState('staff') // 'staff' | 'devotees'
  const [devoteeFilter, setDevoteeFilter] = useState('all') // 'all' | 'verified' | 'unverified'
  const [searchQuery, setSearchQuery] = useState('')

  // Add User Modal State
  const [showAddModal, setShowAddModal] = useState(false)
  const [submittingUser, setSubmittingUser] = useState(false)
  const [newUserForm, setNewUserForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'staff',
    password: ''
  })

  // Delete Devotee Confirmation State
  const [userToDelete, setUserToDelete] = useState(null)
  const [deletingUser, setDeletingUser] = useState(false)

  const fetchUsersAndRoles = async () => {
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token

      const rolesRes = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/roles`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (rolesRes.ok) {
        const rolesData = await rolesRes.json()
        setRoles(rolesData)
      }

      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) {
        if (res.status === 403) throw new Error("Permission denied")
        throw new Error("Failed to fetch users")
      }
      const data = await res.json()
      setUsers(data)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsersAndRoles()
  }, [])

  const handleRoleChange = async (userId, newRole) => {
    try {
      const { data: session } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session?.session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: newRole })
      })
      if (!res.ok) throw new Error("Failed to update role")
      toast.success("Role updated successfully")
      fetchUsersAndRoles()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const handleToggleStatus = async (user) => {
    const nextStatus = !user.is_active
    try {
      const { data: session } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/users/${user.id}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session?.session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_active: nextStatus })
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || "Failed to update user status")
      }
      toast.success(`User ${user.full_name || user.email} ${nextStatus ? 'activated' : 'disabled'}`)
      fetchUsersAndRoles()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const handleCreateStaffOrAdmin = async (e) => {
    e.preventDefault()
    if (!newUserForm.fullName || !newUserForm.email || !newUserForm.password) {
      toast.error("Please fill all required fields")
      return
    }
    if (newUserForm.password.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }

    setSubmittingUser(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          full_name: newUserForm.fullName.trim(),
          email: newUserForm.email.trim(),
          phone: newUserForm.phone.trim() || null,
          role: newUserForm.role,
          password: newUserForm.password
        })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || "Failed to create user")
      }

      toast.success(`User created with role '${newUserForm.role}'`)
      setShowAddModal(false)
      setNewUserForm({ fullName: '', email: '', phone: '', role: 'staff', password: '' })
      fetchUsersAndRoles()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSubmittingUser(false)
    }
  }

  const handleDeleteDevotee = async () => {
    if (!userToDelete) return
    setDeletingUser(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/users/${userToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.session?.access_token}`
        }
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || "Failed to delete devotee")
      }
      toast.success(`Devotee ${userToDelete.full_name || userToDelete.email} removed`)
      setUserToDelete(null)
      fetchUsersAndRoles()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setDeletingUser(false)
    }
  }

  const filteredUsers = users.filter(u => {
    const isDevotee = u.role === 'devotee';
    const matchesTab = activeTab === 'devotees' ? isDevotee : !isDevotee;
    if (!matchesTab) return false;

    if (activeTab === 'devotees') {
      if (devoteeFilter === 'verified' && !u.is_verified) return false;
      if (devoteeFilter === 'unverified' && u.is_verified) return false;
    }
    
    if (!searchQuery) return true;
    
    const q = searchQuery.toLowerCase();
    return (
      (u.full_name && u.full_name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.phone && u.phone.includes(q))
    );
  })

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-apple-ink">User Management</h2>
          <p className="text-xs text-apple-muted mt-0.5">Manage administrators, temple staff, and registered devotees</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-apple-muted" />
            <input
              type="text"
              placeholder="Search by name, email, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="apple-input w-full pl-9 py-2 text-sm"
            />
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-temple-saffron hover:bg-temple-saffron-hover text-white rounded-xl text-sm font-medium transition-colors shadow-sm shrink-0"
          >
            <UserPlus size={16} /> Add Staff / Admin
          </button>
        </div>
      </div>

      {/* Main Tab Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('staff')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'staff' 
                ? 'bg-temple-saffron text-white shadow-glowing-orange' 
                : 'bg-white text-apple-muted border border-gray-200 hover:bg-gray-50'
            }`}
          >
            Staff & Admins ({users.filter(u => u.role !== 'devotee').length})
          </button>
          <button 
            onClick={() => setActiveTab('devotees')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'devotees' 
                ? 'bg-temple-green text-white shadow-glowing-green' 
                : 'bg-white text-apple-muted border border-gray-200 hover:bg-gray-50'
            }`}
          >
            Devotees ({users.filter(u => u.role === 'devotee').length})
          </button>
        </div>

        {/* Devotees Verification Sub-Tabs */}
        {activeTab === 'devotees' && (
          <div className="flex items-center bg-gray-100 p-1 rounded-xl text-xs font-medium">
            <button
              onClick={() => setDevoteeFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${devoteeFilter === 'all' ? 'bg-white text-apple-ink shadow-xs font-semibold' : 'text-apple-muted hover:text-apple-ink'}`}
            >
              All Devotees
            </button>
            <button
              onClick={() => setDevoteeFilter('verified')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all ${devoteeFilter === 'verified' ? 'bg-white text-temple-green shadow-xs font-semibold' : 'text-apple-muted hover:text-apple-ink'}`}
            >
              <CheckCircle2 size={13} /> Verified (OTP Done)
            </button>
            <button
              onClick={() => setDevoteeFilter('unverified')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all ${devoteeFilter === 'unverified' ? 'bg-white text-amber-600 shadow-xs font-semibold' : 'text-apple-muted hover:text-apple-ink'}`}
            >
              <Clock size={13} /> Unverified (Pending OTP)
            </button>
          </div>
        )}
      </div>

      {/* Users Table */}
      <div className="apple-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-apple-ink">
            <thead className="bg-gray-50 border-b border-gray-100 text-apple-muted text-xs uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Name / Email</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Status</th>
                {activeTab === 'devotees' && <th className="px-4 py-3 font-medium">Verification</th>}
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="7" className="text-center py-10"><Loader2 className="animate-spin mx-auto text-temple-saffron" /></td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan="7" className="text-center py-10 text-apple-muted">No users found.</td></tr>
              ) : (
                filteredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-apple-ink">{u.full_name || 'No Name'}</div>
                      <div className="text-xs text-apple-muted font-mono">{u.email}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">{u.phone || 'N/A'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        u.is_active !== false 
                          ? 'bg-green-50 text-green-700 border border-green-200' 
                          : 'bg-red-50 text-red-600 border border-red-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.is_active !== false ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        {u.is_active !== false ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    {activeTab === 'devotees' && (
                      <td className="px-4 py-3">
                        {u.is_verified ? (
                          <span className="inline-flex items-center gap-1 text-xs text-temple-green font-medium">
                            <CheckCircle2 size={14} /> Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                            <Clock size={14} /> Pending OTP
                          </span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      {activeTab === 'staff' ? (
                        <select 
                          className="apple-input text-xs py-1 px-2 pr-6"
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          disabled={u.id === profile?.id}
                        >
                          {roles.filter(r => r.name !== 'devotee').map(r => (
                            <option key={r.name} value={r.name}>{r.name.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs font-mono px-2 py-0.5 bg-gray-100 rounded text-gray-700">Devotee</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-apple-muted whitespace-nowrap">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Disable/Enable Toggle */}
                        <button
                          onClick={() => handleToggleStatus(u)}
                          disabled={u.id === profile?.id || u.role === 'super_admin'}
                          title={u.is_active !== false ? "Disable User" : "Enable User"}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            u.is_active !== false
                              ? 'border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50'
                              : 'border-green-200 text-green-600 hover:bg-green-50'
                          } disabled:opacity-40 disabled:cursor-not-allowed`}
                        >
                          <Power size={14} />
                        </button>

                        {/* Delete Devotee Button */}
                        {activeTab === 'devotees' && (
                          <button
                            onClick={() => setUserToDelete(u)}
                            title="Delete Devotee"
                            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Staff / Admin Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-apple-ink flex items-center gap-2">
                <UserPlus size={20} className="text-temple-saffron" />
                Add Admin / Staff Member
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateStaffOrAdmin} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={newUserForm.fullName}
                  onChange={(e) => setNewUserForm({ ...newUserForm, fullName: e.target.value })}
                  className="apple-input w-full px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="ramesh@temple.org"
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  className="apple-input w-full px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Phone Number</label>
                <input
                  type="tel"
                  placeholder="+91 9876543210"
                  value={newUserForm.phone}
                  onChange={(e) => setNewUserForm({ ...newUserForm, phone: e.target.value })}
                  className="apple-input w-full px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Role *</label>
                <select
                  value={newUserForm.role}
                  onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                  className="apple-input w-full px-3 py-2 text-sm"
                >
                  {roles.filter(r => r.name !== 'devotee').map(r => (
                    <option key={r.name} value={r.name}>{r.name.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Temporary Password (min 8 chars) *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="••••••••"
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                  className="apple-input w-full px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingUser}
                  className="px-4 py-2 bg-temple-saffron hover:bg-temple-saffron-hover text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm disabled:opacity-60"
                >
                  {submittingUser ? <Loader2 size={16} className="animate-spin" /> : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Devotee Confirmation Dialog */}
      {userToDelete && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle size={24} />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-apple-ink">Delete Devotee Account</h3>
              <p className="text-sm text-apple-muted">
                Are you sure you want to delete <strong className="text-apple-ink">{userToDelete.full_name || userToDelete.email}</strong>?
              </p>
              <p className="text-xs text-red-600 bg-red-50 p-2 rounded-lg mt-2">
                Note: If this devotee has booking or donation records, their profile will be safely disabled and anonymized to protect temple audit records.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteDevotee}
                disabled={deletingUser}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {deletingUser ? <Loader2 size={16} className="animate-spin" /> : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
