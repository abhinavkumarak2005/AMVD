import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Loader2, FileClock, Search, Calendar, ChevronLeft, ChevronRight, Eye, X, Activity, UserCheck } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

export default function AuditLogsManager() {
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [category, setCategory] = useState('all') // 'all' | 'admin' | 'devotee'

  // Details Modal
  const [activeLogDetail, setActiveLogDetail] = useState(null)

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token

      let url = `${import.meta.env.VITE_API_URL}/api/admin/audit-logs?page=${page}&page_size=${pageSize}`
      if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`
      if (startDate) url += `&start_date=${startDate}`
      if (endDate) url += `&end_date=${endDate}`
      if (category !== 'all') url += `&category=${category}`

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs || [])
        setTotal(data.total || 0)
      } else {
        throw new Error("Failed to load audit logs")
      }
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [page, pageSize, category])

  const handleApplyFilter = (e) => {
    e.preventDefault()
    setPage(1)
    fetchLogs()
  }

  const handleResetFilters = () => {
    setSearch('')
    setStartDate('')
    setEndDate('')
    setCategory('all')
    setPage(1)
  }

  const totalPages = Math.ceil(total / pageSize) || 1

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
        <div>
          <h2 className="text-2xl font-bold text-apple-ink tracking-tight flex items-center gap-2">
            <FileClock className="text-temple-saffron" size={24} /> 
            Audit Logs & Activity Monitor
          </h2>
          <p className="text-sm text-apple-muted mt-0.5">
            Immutable tracking of administrative actions and devotee activity (logins, logouts, page visits)
          </p>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { setCategory('all'); setPage(1); }}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            category === 'all'
              ? 'bg-temple-saffron text-white shadow-glowing-orange'
              : 'bg-white text-apple-muted border border-gray-200 hover:bg-gray-50'
          }`}
        >
          All Activity
        </button>
        <button
          onClick={() => { setCategory('admin'); setPage(1); }}
          className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-1.5 transition-all ${
            category === 'admin'
              ? 'bg-temple-saffron text-white shadow-glowing-orange'
              : 'bg-white text-apple-muted border border-gray-200 hover:bg-gray-50'
          }`}
        >
          <UserCheck size={15} /> Administrative Actions
        </button>
        <button
          onClick={() => { setCategory('devotee'); setPage(1); }}
          className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-1.5 transition-all ${
            category === 'devotee'
              ? 'bg-temple-green text-white shadow-glowing-green'
              : 'bg-white text-apple-muted border border-gray-200 hover:bg-gray-50'
          }`}
        >
          <Activity size={15} /> Devotee Monitoring (Visits / Logins)
        </button>
      </div>

      {/* Search & Date Filters Bar */}
      <form onSubmit={handleApplyFilter} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-apple-muted" />
          <input
            type="text"
            placeholder="Search by user, action, role, details..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="apple-input w-full pl-9 py-2 text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-apple-muted">
            <span>From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-apple-ink text-xs focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-apple-muted">
            <span>To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-apple-ink text-xs focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="px-4 py-2 bg-temple-saffron hover:bg-temple-saffron-hover text-white rounded-xl text-sm font-semibold shadow-xs transition"
          >
            Search
          </button>
          {(search || startDate || endDate || category !== 'all') && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-3 py-2 text-gray-500 hover:text-gray-800 text-xs font-medium"
            >
              Reset
            </button>
          )}
        </div>
      </form>

      {/* Table Card */}
      <div className="bg-white rounded-2xl shadow-apple-card border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-apple-ink">
            <thead className="bg-gray-50 border-b border-gray-100 text-apple-muted text-xs uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Timestamp</th>
                <th className="px-4 py-3 font-medium">User / Role</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Target / Page</th>
                <th className="px-4 py-3 font-medium">IP Address</th>
                <th className="px-4 py-3 font-medium text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="6" className="text-center py-10"><Loader2 className="animate-spin mx-auto text-temple-saffron" /></td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-10 text-apple-muted">No audit logs matching criteria</td></tr>
              ) : (
                logs.map(log => {
                  const isDevoteeAction = ['PAGE_VISIT', 'LOGIN', 'LOGOUT'].includes(log.action_type) || log.user_role === 'devotee'
                  return (
                    <tr key={log.id} className="hover:bg-gray-50/50 align-top">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-xs font-semibold text-apple-ink">{format(new Date(log.created_at), 'dd MMM yyyy')}</div>
                        <div className="text-[11px] text-apple-muted font-mono">{format(new Date(log.created_at), 'hh:mm:ss a')}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-xs text-apple-ink">{log.user_name || 'Anonymous Devotee'}</div>
                        <div className="text-[11px] text-apple-muted capitalize">{log.user_role?.replace(/_/g, ' ') || 'visitor'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 text-[11px] font-bold tracking-wide rounded border ${
                          isDevoteeAction 
                            ? 'bg-green-50 text-green-700 border-green-200' 
                            : 'bg-blue-50 text-blue-700 border-blue-100'
                        }`}>
                          {log.action_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-apple-muted text-xs">
                        <div className="font-medium text-apple-ink">{log.entity_type?.toUpperCase()}</div>
                        {log.entity_id && <div className="text-[11px] font-mono break-all max-w-[160px] truncate">{log.entity_id}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs text-apple-muted font-mono">
                        {log.ip_address || '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setActiveLogDetail(log)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-gray-100 hover:bg-temple-saffron hover:text-white rounded-lg transition-colors text-apple-ink"
                        >
                          <Eye size={13} /> View
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-apple-muted">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs text-apple-ink"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>Showing {total === 0 ? 0 : (page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} entries</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-gray-200 text-apple-ink disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="px-3 font-semibold text-apple-ink">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-gray-200 text-apple-ink disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Log Details Modal */}
      {activeLogDetail && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-gray-100 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-apple-ink flex items-center gap-2">
                  <FileClock size={18} className="text-temple-saffron" />
                  Audit Log Details
                </h3>
                <span className="text-xs text-apple-muted font-mono">{activeLogDetail.id}</span>
              </div>
              <button onClick={() => setActiveLogDetail(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50 p-3 rounded-xl">
              <div>
                <span className="text-apple-muted block">Timestamp:</span>
                <span className="font-semibold text-apple-ink">{format(new Date(activeLogDetail.created_at), 'dd MMM yyyy, hh:mm:ss a')}</span>
              </div>
              <div>
                <span className="text-apple-muted block">Action Type:</span>
                <span className="font-semibold text-blue-700">{activeLogDetail.action_type}</span>
              </div>
              <div>
                <span className="text-apple-muted block">User / Operator:</span>
                <span className="font-semibold text-apple-ink">{activeLogDetail.user_name || 'N/A'} ({activeLogDetail.user_role || 'devotee'})</span>
              </div>
              <div>
                <span className="text-apple-muted block">Entity Target:</span>
                <span className="font-semibold text-apple-ink">{activeLogDetail.entity_type} {activeLogDetail.entity_id ? `(#${activeLogDetail.entity_id})` : ''}</span>
              </div>
              {activeLogDetail.ip_address && (
                <div className="col-span-2">
                  <span className="text-apple-muted block">Client IP:</span>
                  <span className="font-mono text-apple-ink">{activeLogDetail.ip_address}</span>
                </div>
              )}
            </div>

            <div>
              <span className="text-xs font-semibold text-apple-ink block mb-1">Payload / Changes Details:</span>
              <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded-xl overflow-x-auto max-h-60 font-mono whitespace-pre-wrap">
                {JSON.stringify(activeLogDetail.details, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setActiveLogDetail(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-apple-ink rounded-xl text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
