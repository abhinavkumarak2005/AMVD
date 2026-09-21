import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '../../store'

export default function UserManager() {
  const { profile } = useAuthStore()
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Tabs & Search state
  const [activeTab, setActiveTab] = useState('staff') // 'staff' | 'devotees'
  const [searchQuery, setSearchQuery] = useState('')

  const fetchUsersAndRoles = async () => {
    try {
      const { data: session } = await supabase.auth.getSession()
      
      const rolesRes = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/roles`, {
        headers: { 'Authorization': `Bearer ${session?.session?.access_token}` }
      })
      if (rolesRes.ok) {
        const rolesData = await rolesRes.json()
        setRoles(rolesData)
      }

      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/users`, {
        headers: { 'Authorization': `Bearer ${session?.session?.access_token}` }
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

  const filteredUsers = users.filter(u => {
    const isDevotee = u.role === 'devotee';
    const matchesTab = activeTab === 'devotees' ? isDevotee : !isDevotee;
    
    if (!matchesTab) return false;
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl font-semibold text-apple-ink">User Management</h2>
        <div className="relative w-full sm:w-64">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-apple-muted" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="apple-input w-full pl-9 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button 
          onClick={() => setActiveTab('staff')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'staff' 
              ? 'bg-temple-saffron text-white shadow-glowing-orange' 
              : 'bg-white text-apple-muted border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Staff & Admins
        </button>
        <button 
          onClick={() => setActiveTab('devotees')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'devotees' 
              ? 'bg-temple-green text-white shadow-glowing-green' 
              : 'bg-white text-apple-muted border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Devotees
        </button>
      </div>

      <div className="apple-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-apple-ink">
            <thead className="bg-gray-50 border-b border-gray-100 text-apple-muted text-xs uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Name / Email</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="4" className="text-center py-10"><Loader2 className="animate-spin mx-auto text-temple-saffron" /></td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan="4" className="text-center py-10 text-apple-muted">No users found.</td></tr>
              ) : (
                filteredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="font-semibold">{u.full_name || 'No Name'}</div>
                      <div className="text-xs text-apple-muted">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">{u.phone || 'N/A'}</td>
                    <td className="px-4 py-3">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <select 
                        className="apple-input text-xs py-1 px-2 pr-6"
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        disabled={u.id === profile?.id}
                      >
                        {roles.map(r => (
                          <option key={r.name} value={r.name}>{r.name.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
