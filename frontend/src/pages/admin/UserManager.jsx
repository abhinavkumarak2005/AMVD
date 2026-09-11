import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Loader2, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '../../store'

export default function UserManager() {
  const { profile } = useAuthStore()
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)

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

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-apple-ink">User Management</h2>
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
              ) : users.length === 0 ? (
                <tr><td colSpan="4" className="text-center py-10 text-apple-muted">No access or no users found.</td></tr>
              ) : (
                users.map(u => (
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
                          <option key={r.name} value={r.name}>{r.name}</option>
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
