import { useCallback, useEffect, useMemo, useState } from 'react'
import { ShieldCheck, FileText, ClipboardCheck, RefreshCw, Search, Eye, AlertCircle, X } from 'lucide-react'
import api from '../lib/api'

type Row = Record<string, any>
type Section = 'providers' | 'policies' | 'claims'
const sections: { key: Section; label: string; endpoint: string; icon: typeof ShieldCheck }[] = [
  { key: 'providers', label: 'Insurance Providers', endpoint: '/insurance/providers', icon: ShieldCheck },
  { key: 'policies', label: 'Patient Policies', endpoint: '/insurance/policies', icon: FileText },
  { key: 'claims', label: 'Insurance Claims', endpoint: '/insurance/claims', icon: ClipboardCheck },
]
function rowsFrom(value: any): Row[] {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  if (Array.isArray(value?.items)) return value.items
  if (Array.isArray(value?.results)) return value.results
  return []
}
function label(value: any) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') return value.name ?? value.providerName ?? value.policyNumber ?? JSON.stringify(value)
  return String(value)
}
function titleCase(value: string) { return value.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()) }

export default function Insurance() {
  const [section, setSection] = useState<Section>('providers')
  const [providers, setProviders] = useState<Row[]>([])
  const [policies, setPolicies] = useState<Row[]>([])
  const [claims, setClaims] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Row | null>(null)

  const current = sections.find(item => item.key === section)!
  const data = section === 'providers' ? providers : section === 'policies' ? policies : claims
  const setData = section === 'providers' ? setProviders : section === 'policies' ? setPolicies : setClaims

  const load = useCallback(async (target: Section = section) => {
    const resource = sections.find(item => item.key === target)!
    setLoading(true)
    setError('')
    try {
      const response = await api.get(resource.endpoint)
      const rows = rowsFrom(response.data)
      if (target === 'providers') setProviders(rows)
      if (target === 'policies') setPolicies(rows)
      if (target === 'claims') setClaims(rows)
    } catch (e: any) {
      setError(e?.response?.data?.message?.toString() ?? `Unable to load ${resource.label.toLowerCase()}. Check API access and server logs.`)
      setData([])
    } finally {
      setLoading(false)
    }
  }, [section])

  useEffect(() => { void load(section) }, [section, load])

  const filtered = useMemo(() => data.filter(row => JSON.stringify(row).toLowerCase().includes(query.toLowerCase())), [data, query])
  const columns = useMemo(() => {
    if (!filtered.length) return []
    const preferred = ['id', 'name', 'providerName', 'policyNumber', 'claimNumber', 'patientId', 'patient', 'provider', 'status', 'coverageAmount', 'claimAmount', 'createdAt']
    const keys = Object.keys(filtered[0]).filter(key => !/password|token/i.test(key))
    return [...preferred.filter(key => keys.includes(key)), ...keys.filter(key => !preferred.includes(key))].slice(0, 7)
  }, [filtered])

  const stats = [
    { label: 'Providers', value: providers.length, icon: ShieldCheck },
    { label: 'Patient policies', value: policies.length, icon: FileText },
    { label: 'Insurance claims', value: claims.length, icon: ClipboardCheck },
  ]

  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-bold tracking-widest text-teal-700">FINANCIAL & COVERAGE SERVICES</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Insurance Management</h1><p className="mt-1 text-sm text-slate-500">Manage insurance providers, patient policies and claim records.</p></div>
      <button onClick={() => void load(section)} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/> Refresh</button>
    </header>

    <section className="grid gap-3 sm:grid-cols-3">
      {stats.map(item => <article key={item.label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="grid h-10 w-10 place-items-center rounded-lg bg-teal-50 text-teal-700"><item.icon size={19}/></div><div><p className="text-xs text-slate-500">{item.label}</p><p className="text-2xl font-bold text-slate-900">{item.value}</p></div></article>)}
    </section>

    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-4">
        {sections.map(item => <button key={item.key} onClick={() => { setSection(item.key); setQuery(''); setSelected(null) }} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${section === item.key ? 'bg-[#142B49] text-white' : 'text-slate-600 hover:bg-slate-100'}`}><item.icon size={16}/>{item.label}</button>)}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div><h2 className="font-semibold text-slate-900">{current.label}</h2><p className="text-xs text-slate-500">{current.endpoint}</p></div>
        <label className="flex min-w-56 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-slate-400"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search records..." className="w-full text-sm text-slate-700 outline-none"/></label>
      </div>
      {error && <div role="alert" className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><AlertCircle size={17} className="mt-0.5 shrink-0"/><span>{error}</span></div>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{columns.map(col => <th key={col} className="px-3 py-3 font-semibold">{titleCase(col)}</th>)}<th className="px-3 py-3">Details</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? <tr><td colSpan={Math.max(columns.length + 1, 1)} className="p-8 text-center text-slate-500">Loading {current.label.toLowerCase()}…</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={Math.max(columns.length + 1, 1)} className="p-8 text-center text-slate-500">{error ? 'Records could not be loaded.' : 'No records found.'}</td></tr>
              : filtered.map((row, index) => <tr key={String(row.id ?? row.policyNumber ?? row.claimNumber ?? index)} className="hover:bg-slate-50">{columns.map(col => <td key={col} className="max-w-56 truncate px-3 py-3 text-slate-700">{label(row[col])}</td>)}<td className="px-3 py-3"><button onClick={() => setSelected(row)} className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50"><Eye size={14}/> View</button></td></tr>)}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-400">Showing {filtered.length} of {data.length} records · Live API data</p>
    </section>

    {selected && <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4" onClick={() => setSelected(null)}><section className="my-6 max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl" onClick={e => e.stopPropagation()}><div className="mb-4 flex items-center justify-between"><div><h2 className="font-bold text-slate-900">Insurance record details</h2><p className="text-xs text-slate-500">{current.label}</p></div><button onClick={() => setSelected(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18}/></button></div><div className="grid gap-3 sm:grid-cols-2">{Object.entries(selected).filter(([key]) => !/password|token/i.test(key)).map(([key, value]) => <div key={key} className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">{titleCase(key)}</p><p className="mt-1 break-words text-sm font-medium text-slate-800">{label(value)}</p></div>)}</div></section></div>}
  </div>
}
