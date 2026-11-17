import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Loader2, Edit2, Check, X, Trash2, Plus, Tag, Layers } from 'lucide-react'
import { toast } from 'sonner'

export default function ServicesManager() {
  const [activeTab, setActiveTab] = useState('services') // 'services' | 'categories'
  const [services, setServices] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  // Service Edit/Create state
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [isCreating, setIsCreating] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: '',
    category: 'Pooja',
    price_rupees: 100,
    slot_capacity: 10,
    advance_days: 1,
    max_persons: 5,
    sessions: 'Morning, Evening',
    available_days: [0, 1, 2, 3, 4, 5, 6]
  })

  // Category Edit/Create state
  const [isCreatingCategory, setIsCreatingCategory] = useState(false)
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '', sort_order: 0 })
  const [editingCategoryId, setEditingCategoryId] = useState(null)
  const [editCategoryForm, setEditCategoryForm] = useState({ name: '', description: '', sort_order: 0 })

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/service-categories`)
      if (res.ok) {
        const data = await res.json()
        setCategories(data)
        if (data.length > 0 && !createForm.category) {
          setCreateForm(f => ({ ...f, category: data[0].name }))
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

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
    fetchCategories()
    fetchServices()
  }, [])

  const startEdit = (s) => {
    setEditingId(s.id)
    setEditForm({
      category: s.category || (categories[0]?.name || 'Pooja'),
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

  // --- Category CRUD Handlers ---
  const handleCreateCategory = async (e) => {
    e.preventDefault()
    if (!categoryForm.name.trim()) return
    try {
      const { data: session } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/service-categories`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(categoryForm)
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.detail || "Failed to create category")
      }
      toast.success(`Sub-menu category '${categoryForm.name}' created`)
      setIsCreatingCategory(false)
      setCategoryForm({ name: '', description: '', sort_order: 0 })
      fetchCategories()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const handleUpdateCategory = async (catId) => {
    try {
      const { data: session } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/service-categories/${catId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session?.session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editCategoryForm)
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.detail || "Failed to update category")
      }
      toast.success("Category updated")
      setEditingCategoryId(null)
      fetchCategories()
      fetchServices()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const handleDeleteCategory = async (cat) => {
    if (!window.confirm(`Are you sure you want to delete category '${cat.name}'?`)) return
    try {
      const { data: session } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/service-categories/${cat.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session?.session?.access_token}` }
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.detail || "Failed to delete category")
      }
      toast.success("Category deleted")
      fetchCategories()
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <div className="space-y-5">
      {/* Tab Switcher & Action */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('services')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'services'
                ? 'bg-temple-saffron text-white shadow-glowing-orange'
                : 'bg-white text-apple-muted border border-gray-200 hover:bg-gray-50'
            }`}
          >
            Services & Pricing ({services.length})
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-1.5 transition-all ${
              activeTab === 'categories'
                ? 'bg-temple-green text-white shadow-glowing-green'
                : 'bg-white text-apple-muted border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Layers size={15} /> Service Sub Menus / Categories ({categories.length})
          </button>
        </div>

        {activeTab === 'services' ? (
          <button 
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-temple-saffron text-white rounded-xl text-sm font-semibold hover:bg-temple-saffron-hover shadow-sm"
          >
            <Plus size={16} /> Add Service
          </button>
        ) : (
          <button 
            onClick={() => setIsCreatingCategory(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-temple-green text-white rounded-xl text-sm font-semibold hover:bg-temple-green/90 shadow-sm"
          >
            <Plus size={16} /> Add Sub Menu Category
          </button>
        )}
      </div>

      {/* --- TAB 1: SERVICES TABLE --- */}
      {activeTab === 'services' && (
        <div className="apple-card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-apple-ink">
              <thead className="bg-gray-50 border-b border-gray-100 text-apple-muted text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Service / Sub Menu</th>
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
                  <tr className="bg-amber-50/40 align-top">
                    <td className="px-4 py-3">
                      <input 
                        type="text" 
                        placeholder="Service Name (e.g. Annadhanam Meals)"
                        className="apple-input w-full px-2 py-1 text-sm font-medium"
                        value={createForm.name}
                        onChange={e => setCreateForm({...createForm, name: e.target.value})}
                      />
                      <select 
                        className="apple-input w-full px-2 py-1 text-xs mt-1"
                        value={createForm.category}
                        onChange={e => setCreateForm({...createForm, category: e.target.value})}
                      >
                        {categories.map(c => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
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
                              createForm.available_days.includes(i) 
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
                ) : services.length === 0 ? (
                  <tr><td colSpan="8" className="text-center py-10 text-apple-muted">No services found.</td></tr>
                ) : (
                  services.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50/50 align-top">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-apple-ink">{s.name}</div>
                        {editingId === s.id ? (
                          <select 
                            className="apple-input text-xs py-0.5 px-1 mt-1 w-full"
                            value={editForm.category}
                            onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                          >
                            {categories.map(c => (
                              <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="inline-block mt-0.5 text-[11px] font-medium bg-amber-50 text-temple-olive px-2 py-0.5 rounded-full border border-amber-200/50">
                            {s.category || 'General'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingId === s.id ? (
                          <input 
                            type="text" 
                            className="apple-input w-full px-2 py-1 text-xs"
                            value={editForm.sessions}
                            onChange={e => setEditForm({...editForm, sessions: e.target.value})}
                          />
                        ) : (
                          <div className="text-xs text-apple-muted">{Array.isArray(s.sessions) ? s.sessions.join(', ') : s.sessions}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-temple-green">
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
                            <button onClick={saveEdit} className="p-1.5 bg-temple-green text-white rounded-lg hover:bg-temple-green/90"><Check size={16}/></button>
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
      )}

      {/* --- TAB 2: SERVICE SUB MENUS / CATEGORIES --- */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          {/* Add Category Form Modal/Card */}
          {isCreatingCategory && (
            <form onSubmit={handleCreateCategory} className="apple-card p-4 border border-temple-green/40 bg-green-50/20 space-y-3">
              <h4 className="font-semibold text-apple-ink text-sm">Add New Service Sub Menu Category</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Category Name (e.g. Annadhanam, Homam)"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="apple-input px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  placeholder="Short Description"
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  className="apple-input px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  placeholder="Display Order (e.g. 1)"
                  value={categoryForm.sort_order}
                  onChange={(e) => setCategoryForm({ ...categoryForm, sort_order: Number(e.target.value) })}
                  className="apple-input px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingCategory(false)}
                  className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-temple-green hover:bg-temple-green/90 text-white rounded-lg text-xs font-semibold"
                >
                  Save Category
                </button>
              </div>
            </form>
          )}

          <div className="apple-card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-apple-ink">
                <thead className="bg-gray-50 border-b border-gray-100 text-apple-muted text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 font-medium">Order</th>
                    <th className="px-4 py-3 font-medium">Sub Menu Category Name</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 font-medium">Services Count</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {categories.map(cat => {
                    const servicesInCat = services.filter(s => s.category?.toLowerCase() === cat.name.toLowerCase()).length
                    const isEditing = editingCategoryId === cat.id

                    return (
                      <tr key={cat.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 text-xs font-mono text-apple-muted">
                          {isEditing ? (
                            <input
                              type="number"
                              className="apple-input w-14 px-2 py-1 text-xs"
                              value={editCategoryForm.sort_order}
                              onChange={(e) => setEditCategoryForm({ ...editCategoryForm, sort_order: Number(e.target.value) })}
                            />
                          ) : (
                            cat.sort_order || 0
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <input
                              type="text"
                              className="apple-input px-2 py-1 text-sm font-semibold w-full"
                              value={editCategoryForm.name}
                              onChange={(e) => setEditCategoryForm({ ...editCategoryForm, name: e.target.value })}
                            />
                          ) : (
                            <div className="font-semibold text-apple-ink flex items-center gap-1.5">
                              <Tag size={14} className="text-temple-saffron" />
                              {cat.name}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-apple-muted">
                          {isEditing ? (
                            <input
                              type="text"
                              className="apple-input px-2 py-1 text-xs w-full"
                              value={editCategoryForm.description}
                              onChange={(e) => setEditCategoryForm({ ...editCategoryForm, description: e.target.value })}
                            />
                          ) : (
                            cat.description || '—'
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span className="font-semibold text-temple-olive bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/50">
                            {servicesInCat} service(s)
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isEditing ? (
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => handleUpdateCategory(cat.id)}
                                className="p-1.5 bg-temple-green text-white rounded-lg hover:bg-temple-green/90"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={() => setEditingCategoryId(null)}
                                className="p-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setEditingCategoryId(cat.id)
                                  setEditCategoryForm({
                                    name: cat.name,
                                    description: cat.description || '',
                                    sort_order: cat.sort_order || 0
                                  })
                                }}
                                className="p-1.5 text-gray-500 hover:text-apple-ink hover:bg-gray-100 rounded-lg"
                                title="Edit Category"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteCategory(cat)}
                                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                title="Delete Category"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
