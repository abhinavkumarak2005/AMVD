import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Loader2, Edit2, Check, X, Trash2, Plus } from 'lucide-react'
import { toast } from 'sonner'

export default function ServicesManager() {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  
  const [isCreating, setIsCreating] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: '',
    category: 'pooja',
    price_rupees: 100,
    slot_capacity: 10,
    advance_days: 1,
    max_persons: 5,
    sessions: 'Morning, Evening',
    available_days: [0, 1, 2, 3, 4, 5, 6]
  })

  const fetchServices = async () => {
    try {
      const { data: session } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/services`, {
        headers: { 'Authorization': `Bearer ${session?.session?.access_token}` }
      })
      if (!res.ok) throw new Error("Failed to fetch services")
      const data = await res.json()
      setServices(data)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchServices()
  }, [])

  const startEdit = (s) => {
    setEditingId(s.id)
    setEditForm({
      price_rupees: s.price_rupees,
      slot_capacity: s.slot_capacity,
      advance_days: s.advance_days,
      max_persons: s.max_persons || 5,
      sessions: (s.sessions || ['Morning', 'Evening']).join(', '),
      available_days: s.available_days || [0,1,2,3,4,5,6]
    })
  }

  const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

  const toggleDay = (dayIndex, isCreate = false) => {
    const setFunc = isCreate ? setCreateForm : setEditForm
    setFunc(prev => {
      const current = prev.available_days || []
      if (current.includes(dayIndex)) {
        return { ...prev, available_days: current.filter(d => d !== dayIndex) }
      } else {
        return { ...prev, available_days: [...current, dayIndex].sort() }
      }
    })
  }

  const saveEdit = async () => {
    try {
      const { data: session } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/services/${editingId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session?.session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...editForm,
          sessions: editForm.sessions.split(',').map(s => s.trim()).filter(s => s)
        })
      })
      if (!res.ok) throw new Error("Failed to update service")
      toast.success("Service updated")
      setEditingId(null)
      fetchServices()
    } catch (e) {
      toast.error(e.message)
    }
  }
  
  const createService = async () => {
    if (!createForm.name.trim()) {
      toast.error("Service name is required")
      return
    }
    try {
      const { data: session } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/services`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...createForm,
          sessions: createForm.sessions.split(',').map(s => s.trim()).filter(s => s)
        })
      })
      if (!res.ok) throw new Error("Failed to create service")
      toast.success("Service created")
      setIsCreating(false)
      fetchServices()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const deleteService = async (id) => {
    if (!window.confirm("Are you sure you want to remove this service? This cannot be undone.")) return
    try {
      const { data: session } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/services/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session?.session?.access_token}` }
      })
      if (!res.ok) throw new Error("Failed to delete service")
      toast.success("Service deleted")
      fetchServices()
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-apple-ink">Services & Pricing</h2>
        <button 
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-temple-saffron text-white rounded-lg text-sm font-medium hover:bg-temple-saffron-hover"
        >
          <Plus size={16} /> Add Service
        </button>
      </div>

      <div className="apple-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-apple-ink">
            <thead className="bg-gray-50 border-b border-gray-100 text-apple-muted text-xs uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Service</th>
                <th className="px-4 py-3 font-medium">Sessions</th>
                <th className="px-4 py-3 font-medium">Price (₹)</th>
                <th className="px-4 py-3 font-medium">Slot Cap</th>
                <th className="px-4 py-3 font-medium">Max Pax</th>
                <th className="px-4 py-3 font-medium">Adv. Days</th>
                <th className="px-4 py-3 font-medium">Available Days</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isCreating && (
                <tr className="bg-blue-50/30 align-top">
                  <td className="px-4 py-3">
                    <input 
                      type="text" 
                      placeholder="Service Name"
                      className="apple-input w-full px-2 py-1 text-sm font-medium"
                      value={createForm.name}
                      onChange={e => setCreateForm({...createForm, name: e.target.value})}
                    />
                    <select 
                      className="apple-input w-full px-2 py-1 text-xs mt-1"
                      value={createForm.category}
                      onChange={e => setCreateForm({...createForm, category: e.target.value})}
                    >
                      <option value="pooja">Pooja</option>
                      <option value="darshan">Darshan</option>
                      <option value="facility">Facility</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input 
                      type="text" 
                      className="apple-input w-full px-2 py-1 text-xs mt-1"
                      value={createForm.sessions}
                      onChange={e => setCreateForm({...createForm, sessions: e.target.value})}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input 
                      type="number" 
                      className="apple-input w-16 px-2 py-1 text-sm"
                      value={createForm.price_rupees}
                      onChange={e => setCreateForm({...createForm, price_rupees: parseInt(e.target.value) || 0})}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input 
                      type="number" 
                      className="apple-input w-16 px-2 py-1 text-sm"
                      value={createForm.slot_capacity}
                      onChange={e => setCreateForm({...createForm, slot_capacity: parseInt(e.target.value) || 1})}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input 
                      type="number" 
                      className="apple-input w-16 px-2 py-1 text-sm"
                      value={createForm.max_persons}
                      onChange={e => setCreateForm({...createForm, max_persons: parseInt(e.target.value) || 1})}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input 
                      type="number" 
                      className="apple-input w-16 px-2 py-1 text-sm"
                      value={createForm.advance_days}
                      onChange={e => setCreateForm({...createForm, advance_days: parseInt(e.target.value) || 1})}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap w-40">
                      {DAY_NAMES.map((d, i) => (
                        <button key={d} onClick={() => toggleDay(i, true)}
                          className={`text-[10px] px-1.5 py-0.5 rounded border ${
                            (createForm.available_days || []).includes(i) 
                              ? 'bg-temple-green text-white border-temple-green' 
                              : 'bg-white text-apple-muted border-gray-200'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={createService} className="p-1.5 bg-temple-green text-white rounded-lg hover:bg-temple-green/90"><Check size={16}/></button>
                      <button onClick={() => setIsCreating(false)} className="p-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"><X size={16}/></button>
                    </div>
                  </td>
                </tr>
              )}

              {loading ? (
                <tr><td colSpan="8" className="text-center py-10"><Loader2 className="animate-spin mx-auto text-temple-saffron" /></td></tr>
              ) : (
                services.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50/50 align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium text-sm">{s.name}</div>
                      <div className="text-[10px] text-apple-muted uppercase tracking-wide mt-1">{s.category}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-apple-muted mt-1">
                        {editingId === s.id ? (
                          <input 
                            type="text" 
                            placeholder="e.g. Morning, Evening (6pm - 8pm)"
                            className="apple-input w-full px-2 py-1 text-xs"
                            value={editForm.sessions}
                            onChange={e => setEditForm({...editForm, sessions: e.target.value})}
                          />
                        ) : (
                          <div className="flex gap-1 flex-wrap">
                            {(s.sessions || ['Morning', 'Evening']).map(sess => (
                              <span key={sess} className="px-2 py-1 bg-temple-ivory border border-temple-brown/10 rounded text-temple-brown whitespace-nowrap">
                                {sess}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {editingId === s.id ? (
                        <input 
                          type="number" 
                          className="apple-input w-16 px-2 py-1 text-sm"
                          value={editForm.price_rupees}
                          onChange={e => setEditForm({...editForm, price_rupees: parseInt(e.target.value) || 0})}
                        />
                      ) : (
                        `₹${s.price_rupees}`
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === s.id ? (
                        <input 
                          type="number" 
                          className="apple-input w-16 px-2 py-1 text-sm"
                          value={editForm.slot_capacity}
                          onChange={e => setEditForm({...editForm, slot_capacity: parseInt(e.target.value) || 1})}
                        />
                      ) : (
                        s.slot_capacity
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === s.id ? (
                        <input 
                          type="number" 
                          className="apple-input w-16 px-2 py-1 text-sm"
                          value={editForm.max_persons}
                          onChange={e => setEditForm({...editForm, max_persons: parseInt(e.target.value) || 1})}
                        />
                      ) : (
                        s.max_persons || 5
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === s.id ? (
                        <input 
                          type="number" 
                          className="apple-input w-16 px-2 py-1 text-sm"
                          value={editForm.advance_days}
                          onChange={e => setEditForm({...editForm, advance_days: parseInt(e.target.value) || 1})}
                        />
                      ) : (
                        s.advance_days
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === s.id ? (
                        <div className="flex gap-1 flex-wrap w-40">
                          {DAY_NAMES.map((d, i) => (
                            <button key={d} onClick={() => toggleDay(i)}
                              className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                (editForm.available_days || []).includes(i) 
                                  ? 'bg-temple-green text-white border-temple-green' 
                                  : 'bg-white text-apple-muted border-gray-200'
                              }`}
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-apple-muted">
                          {!s.available_days || s.available_days.length === 7 ? 'Everyday' : s.available_days.map(d => DAY_NAMES[d]).join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingId === s.id ? (
                        <div className="flex justify-end gap-2">
                          <button onClick={saveEdit} className="p-1.5 bg-temple-green/10 text-temple-green rounded-lg hover:bg-temple-green/20"><Check size={16}/></button>
                          <button onClick={() => setEditingId(null)} className="p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"><X size={16}/></button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1">
                          <button onClick={() => startEdit(s)} className="p-1.5 text-apple-muted hover:text-apple-ink hover:bg-gray-100 rounded-lg"><Edit2 size={16}/></button>
                          <button onClick={() => deleteService(s.id)} className="p-1.5 text-apple-muted hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
                        </div>
                      )}
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
