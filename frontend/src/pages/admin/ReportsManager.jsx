import React, { useState, useEffect } from 'react'
import { Loader2, Download, TrendingUp, Users, Calendar, Banknote, FileText, XCircle } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { toast } from 'sonner'

export default function ReportsManager() {
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    fetchMetrics()
  }, [startDate, endDate])

  const fetchMetrics = async () => {
    setLoading(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      
      const params = new URLSearchParams()
      if (startDate) params.append('start_date', startDate)
      if (endDate) params.append('end_date', endDate)

      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/reports/metrics?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${session?.session?.access_token}` }
      })
      if (res.ok) {
        setMetrics(await res.json())
      }
    } catch(e) {
      toast.error("Failed to load metrics")
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async (type, format) => {
    setExporting(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      
      const params = new URLSearchParams()
      params.append('type', type)
      if (startDate) params.append('start_date', startDate)
      if (endDate) params.append('end_date', endDate)

      const endpoint = format === 'pdf' ? '/api/admin/reports/export/pdf' : '/api/admin/reports/export'
      const res = await fetch(`${import.meta.env.VITE_API_URL}${endpoint}?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${session?.session?.access_token}` }
      })
      
      if (!res.ok) throw new Error(`Failed to export ${format.toUpperCase()}`)
      
      if (format === 'csv') {
        const data = await res.json()
        if (data.length === 0) {
          toast.error("No data available to export.")
          setExporting(false)
          return
        }
        
        const headers = Object.keys(data[0]).join(',')
        const rows = data.map(obj => 
          Object.values(obj).map(v => typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v).join(',')
        ).join('\n')
        
        const csv = `${headers}\n${rows}`
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement("a")
        link.href = URL.createObjectURL(blob)
        link.download = `${type}_export_${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } else {
        // PDF download
        const blob = await res.blob()
        const link = document.createElement("a")
        link.href = URL.createObjectURL(blob)
        link.download = `${type}_report_${new Date().toISOString().split('T')[0]}.pdf`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }

      // Log action
      await fetch(`${import.meta.env.VITE_API_URL}/api/admin/audit-logs/client-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.session?.access_token}`
        },
        body: JSON.stringify({
          action_type: `EXPORT_${format.toUpperCase()}`,
          entity_type: "report",
          entity_id: type,
          details: { format, start_date: startDate, end_date: endDate }
        })
      })

    } catch (e) {
      toast.error(e.message)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-apple-ink">Reports & Analytics</h2>
          <p className="text-sm text-apple-muted mt-1">Detailed metrics and data exports for the temple.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <label className="text-[10px] font-semibold text-apple-muted uppercase tracking-wider mb-1">From Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none" />
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] font-semibold text-apple-muted uppercase tracking-wider mb-1">To Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none" />
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 flex flex-wrap gap-4 items-center justify-between">
        <h3 className="font-semibold text-apple-ink">Export Options</h3>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => handleExport('bookings', 'csv')} disabled={exporting} className="bg-white border border-gray-200 text-apple-ink px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-50 flex items-center gap-2 transition-colors disabled:opacity-50">
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} CSV (Bookings)
          </button>
          <button onClick={() => handleExport('bookings', 'pdf')} disabled={exporting} className="bg-white border border-gray-200 text-apple-ink px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-50 flex items-center gap-2 transition-colors disabled:opacity-50">
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />} PDF (Bookings)
          </button>
          <div className="w-px h-6 bg-gray-200 mx-2 hidden sm:block"></div>
          <button onClick={() => handleExport('donations', 'csv')} disabled={exporting} className="bg-temple-green text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#1f5a3c] flex items-center gap-2 transition-colors disabled:opacity-50">
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} CSV (Donations)
          </button>
          <button onClick={() => handleExport('donations', 'pdf')} disabled={exporting} className="bg-temple-green text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#1f5a3c] flex items-center gap-2 transition-colors disabled:opacity-50">
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />} PDF (Donations)
          </button>
        </div>
      </div>

      {loading && !metrics ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-temple-saffron" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-green-50 to-white border border-green-100 rounded-2xl p-5 shadow-sm lg:col-span-2">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700"><TrendingUp size={16} /></div>
              <p className="text-sm font-semibold text-green-800 uppercase tracking-wider">Today's Revenue</p>
            </div>
            <p className="text-4xl font-display font-bold text-green-900">₹{(metrics?.today_revenue || 0).toLocaleString('en-IN')}</p>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm lg:col-span-2">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-temple-green/10 flex items-center justify-center text-temple-green"><TrendingUp size={16} /></div>
              <p className="text-sm font-medium text-apple-muted">Total Revenue (Filtered)</p>
            </div>
            <p className="text-3xl font-display font-bold text-apple-ink">₹{(metrics?.total_revenue || 0).toLocaleString('en-IN')}</p>
          </div>
          
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-temple-saffron/10 flex items-center justify-center text-temple-saffron"><Banknote size={16} /></div>
              <p className="text-sm font-medium text-apple-muted">Donations Revenue</p>
            </div>
            <p className="text-2xl font-display font-bold text-apple-ink">₹{(metrics?.donations_revenue || 0).toLocaleString('en-IN')}</p>
            <p className="text-xs text-apple-muted mt-1">{metrics?.total_donations_count || 0} total donations</p>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"><Calendar size={16} /></div>
              <p className="text-sm font-medium text-apple-muted">Bookings Revenue</p>
            </div>
            <p className="text-2xl font-display font-bold text-apple-ink">₹{(metrics?.bookings_revenue || 0).toLocaleString('en-IN')}</p>
            <p className="text-xs text-apple-muted mt-1">{metrics?.bookings_count || 0} confirmed bookings</p>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600"><Users size={16} /></div>
              <p className="text-sm font-medium text-apple-muted">Unique Donors</p>
            </div>
            <p className="text-2xl font-display font-bold text-apple-ink">{metrics?.donors_count || 0}</p>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600"><XCircle size={16} /></div>
              <p className="text-sm font-medium text-apple-muted">Cancelled Bookings</p>
            </div>
            <p className="text-2xl font-display font-bold text-apple-ink">{metrics?.cancelled_bookings_count || 0}</p>
          </div>
        </div>
      )}
    </div>
  )
}
