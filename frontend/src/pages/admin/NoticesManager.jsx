import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Loader2, Plus, Edit2, Trash2, Check, X } from 'lucide-react'
import { toast } from 'sonner'

export default function NoticesManager() {
  const [notices, setNotices] = useState([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  
  const [form, setForm] = useState({ title: '', body: '', type: 'banner', is_active: true })

  const fetchNotices = async () => {
    try {
      const { data: session } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/notices`, {
        headers: { 'Authorization': `Bearer ${session?.session?.access_token}` }
      })
      if (!res.ok) throw new Error("Failed to fetch notices")
      const data = await res.json()
      setNotices(data)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotices()
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    try {
      const { data: session } = await supabase.auth.getSession()
      const url = editingId 
        ? `${import.meta.env.VITE_API_URL}/api/admin/notices/${editingId}`
        : `${import.meta.env.VITE_API_URL}/api/admin/notices`
        
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${session?.session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(form)
      })
      if (!res.ok) throw new Error("Failed to save notice")
      toast.success(editingId ? "Notice updated" : "Notice created")
      setIsAdding(false)
      setEditingId(null)
      fetchNotices()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this notice?")) return
    try {
      const { data: session } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/notices/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session?.session?.access_token}` }
      })
      if (!res.ok) throw new Error("Failed to delete notice")
      toast.success("Notice deleted")
      fetchNotices()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const startEdit = (n) => {
    setEditingId(n.id)
    setIsAdding(true)
    setForm({ title: n.title, body: n.body, type: n.type, is_active: n.is_active })
  }

  const cancelEdit = () => {
    setIsAdding(false)
    setEditingId(null)
    setForm({ title: '', body: '', type: 'banner', is_active: true })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-apple-ink">Notice Management</h2>
        {!isAdding && (
          <button 
            onClick={() => { setIsAdding(true); setForm({ title: '', body: '', type: 'banner', is_active: true }) }}
            className="apple-button flex items-center gap-2 py-1.5 px-3 text-sm"
          >
            <Plus size={16} /> Create Notice
          </button>
        )}
      </div>

      {isAdding && (
        <div className="apple-card max-w-2xl">
          <h3 className="text-sm font-bold text-apple-ink mb-4">{editingId ? 'Edit Notice' : 'New Notice'}</h3>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-apple-muted mb-1">Title</label>
                <input 
                  type="text" 
                  className="apple-input w-full" 
                  value={form.title}
                  onChange={e => setForm({...form, title: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-apple-muted mb-1">Type</label>
                <select 
                  className="apple-input w-full"
                  value={form.type}
                  onChange={e => setForm({...form, type: e.target.value})}
                >
                  <option value="banner">Homepage Banner</option>
                  <option value="popup">Homepage Popup</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-apple-muted mb-1">Message Body</label>
              <textarea 
                className="apple-input w-full" 
                rows="3"
                value={form.body}
                onChange={e => setForm({...form, body: e.target.value})}
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="isActive" 
                checked={form.is_active}
                onChange={e => setForm({...form, is_active: e.target.checked})}
                className="rounded text-temple-saffron focus:ring-temple-saffron"
              />
              <label htmlFor="isActive" className="text-sm text-apple-ink">Visible to Public</label>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button type="button" onClick={cancelEdit} className="apple-button-secondary py-1.5 px-4 text-sm">Cancel</button>
              <button type="submit" className="apple-button py-1.5 px-6 text-sm">Save Notice</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-10 flex justify-center"><Loader2 className="animate-spin text-temple-saffron" /></div>
        ) : notices.length === 0 ? (
          <div className="col-span-full py-10 text-center text-apple-muted apple-card">No notices found.</div>
        ) : (
          notices.map(n => (
            <div key={n.id} className={`apple-card flex flex-col justify-between border ${n.is_active ? 'border-temple-saffron/30' : 'border-gray-200 opacity-70'}`}>
              <div>
                <div className="flex items-start justify-between mb-2">
                  <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${n.type === 'banner' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                    {n.type}
                  </span>
                  <span className={`text-[10px] font-bold ${n.is_active ? 'text-green-500' : 'text-gray-400'}`}>
                    {n.is_active ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>
                <h4 className="font-semibold text-apple-ink text-sm mb-1">{n.title}</h4>
                <p className="text-xs text-apple-muted line-clamp-3">{n.body}</p>
              </div>
              <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-gray-100">
                <button onClick={() => startEdit(n)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={14} /></button>
                <button onClick={() => handleDelete(n.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
