import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Loader2, FileClock } from 'lucide-react'
import { format } from 'date-fns'

export default function AuditLogsManager() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchLogs = async () => {
    try {
      const { data: session } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/audit-logs`, {
        headers: { 'Authorization': `Bearer ${session?.session?.access_token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setLogs(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-apple-ink tracking-tight flex items-center gap-2">
            <FileClock className="text-temple-saffron" size={24} /> 
            Audit Logs
          </h2>
          <p className="text-sm text-apple-muted mt-1">Immutable record of sensitive administrative actions</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-apple-card border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-apple-ink">
            <thead className="bg-gray-50 border-b border-gray-100 text-apple-muted text-xs uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Timestamp</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Target</th>
                <th className="px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="5" className="text-center py-10"><Loader2 className="animate-spin mx-auto text-temple-saffron" /></td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-10 text-apple-muted">No logs found</td></tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50/50 align-top">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium">{format(new Date(log.created_at), 'dd MMM yyyy')}</div>
                      <div className="text-xs text-apple-muted">{format(new Date(log.created_at), 'hh:mm a')}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-sm">{log.user_name || 'Unknown User'}</div>
                      <div className="text-xs text-apple-muted capitalize">{log.user_role?.replace(/_/g, ' ')}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-1 text-[11px] font-bold tracking-wide rounded bg-blue-50 text-blue-700 border border-blue-100">
                        {log.action_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-apple-muted">
                      <div className="font-medium text-apple-ink">{log.entity_type.toUpperCase()}</div>
                      {log.entity_id && <div className="text-[10px] break-all max-w-[150px]">{log.entity_id}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <pre className="text-[10px] text-apple-muted bg-gray-50 p-2 rounded overflow-x-auto max-w-sm whitespace-pre-wrap">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
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
