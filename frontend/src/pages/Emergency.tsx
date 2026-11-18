import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, AlertCircle, Ambulance, Clock3, Eye, RefreshCw, Search, X } from 'lucide-react'
import api from '../lib/api'

type Visit = Record<string, unknown> & { id?: number | string; status?: string; triageLevel?: string; priority?: string; createdAt?: string; arrivalAt?: string; patient?: Record<string, unknown> }

function asRows(payload: unknown): Visit[] {
  if (Array.isArray(payload)) return payload as Visit[]
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>
    for (const key of ['data', 'items', 'results', 'visits']) if (Array.isArray(obj[key])) return obj[key] as Visit[]
  }
  return []
}
function text(value: unknown) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
function patientName(row: Visit) {
  const p = row.patient
  if (p && typeof p === 'object') return text(p.fullName ?? [p.firstName, p.lastName].filter(Boolean).join(' ') ?? p.name)
  return text(row.patientName ?? row.patientId)
}
function tone(value: string) {
  const v = value.toUpperCase()
  if (['CRITICAL', 'RESUSCITATION', 'EMERGENCY', 'HIGH', 'RED'].some(x => v.includes(x))) return 'bg-rose-50 text-rose-700'
  if (['URGENT', 'ORANGE', 'YELLOW', 'IN_PROGRESS'].some(x => v.includes(x))) return 'bg-amber-50 text-amber-700'
  if (['COMPLETED', 'DISCHARGED', 'CLOSED'].some(x => v.includes(x))) return 'bg-emerald-50 text-emerald-700'
  return 'bg-slate-100 text-slate-700'
}

export default function Emergency() {
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('ALL')
  const [selected, setSelected] = useState<Visit | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { const response = await api.get('/emergency/visits'); setVisits(asRows(response.data)) }
    catch (err: unknown) {
      const message = err && typeof err === 'object' && 'response' in err
        ? String((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Unable to load emergency visits.')
        : err instanceof Error ? err.message : 'Unable to load emergency visits.'
      setError(message); setVisits([])
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() => visits.filter(row => {
    const matchesQuery = JSON.stringify(row).toLowerCase().includes(query.toLowerCase())
    const matchesStatus = status === 'ALL' || text(row.status).toUpperCase() === status
    return matchesQuery && matchesStatus
  }), [visits, query, status])
  const active = visits.filter(v => !['COMPLETED', 'DISCHARGED', 'CLOSED'].includes(text(v.status).toUpperCase())).length
  const critical = visits.filter(v => /CRITICAL|RESUSCITATION|RED/i.test(`${v.triageLevel ?? ''} ${v.priority ?? ''}`)).length

  return <div className="mc-module-page space-y-5">
    <section className="mc-welcome-row"><div><p className="mc-eyebrow">HOSPITAL WORKSPACE</p><h2>Emergency Management</h2><p>Monitor emergency visits and patient triage activity.</p></div><button className="mc-secondary-button" onClick={() => void load()} disabled={loading}><RefreshCw size={15} className={loading ? 'mc-spin' : ''}/> Refresh</button></section>

    <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <article className="mc-panel p-5 flex items-center justify-between"><div><p className="text-sm text-slate-500">Total emergency visits</p><strong className="block text-3xl text-slate-900 mt-2">{loading ? '—' : visits.length}</strong></div><span className="rounded-xl bg-blue-50 text-blue-700 p-3"><Ambulance size={23}/></span></article>
      <article className="mc-panel p-5 flex items-center justify-between"><div><p className="text-sm text-slate-500">Active visits</p><strong className="block text-3xl text-slate-900 mt-2">{loading ? '—' : active}</strong></div><span className="rounded-xl bg-amber-50 text-amber-700 p-3"><Activity size={23}/></span></article>
      <article className="mc-panel p-5 flex items-center justify-between"><div><p className="text-sm text-slate-500">Critical / resuscitation</p><strong className="block text-3xl text-slate-900 mt-2">{loading ? '—' : critical}</strong></div><span className="rounded-xl bg-rose-50 text-rose-700 p-3"><AlertCircle size={23}/></span></article>
    </section>

    <section className="mc-panel overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4"><div><h3 className="font-semibold text-slate-900">Emergency visits</h3><p className="text-sm text-slate-500 mt-1">Live records retrieved from the emergency API.</p></div><div className="flex flex-col sm:flex-row gap-2"><label className="mc-module-search"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search patient or visit..."/></label><select className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white" value={status} onChange={e => setStatus(e.target.value)}><option value="ALL">All statuses</option>{Array.from(new Set(visits.map(v => text(v.status).toUpperCase()).filter(v => v !== '—'))).map(v => <option key={v} value={v}>{v.replaceAll('_', ' ')}</option>)}</select></div></div>
      {error && <div className="m-5 p-4 rounded-xl bg-amber-50 text-amber-800 text-sm flex gap-2"><AlertCircle size={17}/><span>{error}</span></div>}
      <div className="overflow-x-auto"><table className="mc-data-table min-w-[760px]"><thead><tr><th>Visit ID</th><th>Patient</th><th>Chief complaint</th><th>Triage / priority</th><th>Status</th><th>Arrival</th><th>Details</th></tr></thead><tbody>
        {loading ? <tr><td colSpan={7} className="mc-table-empty">Loading emergency visits…</td></tr> : filtered.length === 0 ? <tr><td colSpan={7} className="mc-table-empty">{error ? 'Emergency records are currently unavailable.' : 'No emergency visits match your search.'}</td></tr> : filtered.map((v, i) => { const triage = text(v.triageLevel ?? v.priority); const state = text(v.status); return <tr key={String(v.id ?? i)}><td>#{text(v.id)}</td><td className="font-medium">{patientName(v)}</td><td>{text(v.chiefComplaint ?? v.reason ?? v.complaint)}</td><td><span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${tone(triage)}`}>{triage}</span></td><td><span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${tone(state)}`}>{state.replaceAll('_', ' ')}</span></td><td>{v.arrivalAt || v.createdAt ? new Date(String(v.arrivalAt ?? v.createdAt)).toLocaleString() : '—'}</td><td><button className="mc-row-action" onClick={() => setSelected(v)}><Eye size={15}/> View</button></td></tr> })}
      </tbody></table></div>
      <div className="p-4 border-t border-slate-100 flex justify-between text-xs text-slate-500"><span>Showing {filtered.length} of {visits.length} visits</span><span className="inline-flex items-center gap-1"><Clock3 size={13}/> API: /emergency/visits</span></div>
    </section>
    {selected && <div className="mc-modal-backdrop" onClick={() => setSelected(null)}><section className="mc-detail-modal" onClick={e => e.stopPropagation()}><div className="mc-panel-heading"><div><h3>Emergency visit details</h3><p>Visit #{text(selected.id)}</p></div><button className="mc-secondary-button" onClick={() => setSelected(null)}><X size={15}/> Close</button></div><div className="mc-detail-grid">{Object.entries(selected).filter(([k]) => !/password|token/i.test(k)).map(([k, v]) => <div className="mc-detail-field" key={k}><span>{k.replace(/([A-Z])/g, ' $1')}</span><strong>{text(v)}</strong></div>)}</div></section></div>}
  </div>
}
