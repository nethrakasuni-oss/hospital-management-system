import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ShieldCheck, FileText, ClipboardCheck, RefreshCw, Search, Eye, AlertCircle, X } from 'lucide-react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'

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
  const { user } = useAuth()
  const role = user?.role?.toUpperCase() ?? ''
  const isAdmin = role === 'ADMIN'
  const isAccountant = role === 'ACCOUNTANT'
  const isReceptionist = role === 'RECEPTIONIST'
  const canReviewClaims = isAdmin || isAccountant
  const canCreateProvider = isAdmin || isAccountant
  const canCreatePolicy = isAdmin || isAccountant
  const canCreateClaim = isReceptionist
  const [formOpen, setFormOpen] = useState(false)
  const [formBusy, setFormBusy] = useState(false)
  const [form, setForm] = useState<Record<string,string>>({})
  const [patientOptions, setPatientOptions] = useState<Row[]>([])
  const [providerOptions, setProviderOptions] = useState<Row[]>([])
  const [policyOptions, setPolicyOptions] = useState<Row[]>([])
  const [invoiceOptions, setInvoiceOptions] = useState<Row[]>([])
  const [invoiceLoading, setInvoiceLoading] = useState(false)

  const current = sections.find(item => item.key === section)!
  const data = section === 'providers' ? providers : section === 'policies' ? policies : claims
  const setData = section === 'providers' ? setProviders : section === 'policies' ? setPolicies : setClaims

  const load = useCallback(async (target: Section = section) => {
    const resource = sections.find(item => item.key === target)!
    setLoading(true)
    setError('')
    try {
      const response = await api.get(resource.endpoint, target === 'providers' && (isAdmin || isAccountant) ? { params: { includeInactive: 'true' } } : undefined)
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
  }, [section, isAdmin, isAccountant])

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

  const openCreate = async () => {
    setForm({}); setError(''); setPolicyOptions([]); setInvoiceOptions([])
    setFormOpen(true)
    if (section === 'policies' || section === 'claims') {
      try {
        const [patientResponse, providerResponse] = await Promise.all([
          api.get('/patients'),
          api.get('/insurance/providers'),
        ])
        setPatientOptions(rowsFrom(patientResponse.data))
        setProviderOptions(rowsFrom(providerResponse.data).filter((provider: Row) => provider.isActive !== false))
      } catch (e: any) {
        setError(e?.response?.data?.message?.toString() ?? 'Unable to load patients and insurance providers.')
      }
    }
  }

  const handleClaimPatientChange = async (patientId: string) => {
    setForm(current => ({
      ...current,
      patientId,
      providerId: '',
      patientInsuranceId: '',
      invoiceId: '',
      claimedAmount: '',
    }))
    setPolicyOptions([])
    setInvoiceOptions([])
    if (!patientId) return

    setInvoiceLoading(true)
    try {
      const [invoiceResponse, policyResponse] = await Promise.all([
        api.get('/billing/invoices', { params: { patientId } }),
        api.get('/insurance/policies', { params: { patientId, active: 'true' } }),
      ])
      setInvoiceOptions(rowsFrom(invoiceResponse.data))
      setPolicyOptions(rowsFrom(policyResponse.data))
    } catch (e: any) {
      setError(e?.response?.data?.message?.toString() ?? 'Unable to load this patient’s invoices and insurance policies.')
    } finally {
      setInvoiceLoading(false)
    }
  }

  const handleClaimInvoiceChange = (invoiceId: string) => {
    const invoice = invoiceOptions.find(item => String(item.id) === invoiceId)
    setForm(current => ({
      ...current,
      invoiceId,
      claimedAmount: invoice ? String(invoice.totalAmount ?? '') : '',
    }))
  }
  const submitCreate = async (event: FormEvent) => {
    event.preventDefault(); setFormBusy(true); setError('')
    try {
      if (section === 'providers') {
        await api.post('/insurance/providers', { name: form.name, code: form.code || undefined, contactPerson: form.contactPerson || undefined, email: form.email || undefined, phone: form.phone || undefined, address: form.address || undefined })
      } else if (section === 'policies') {
        await api.post('/insurance/policies', { patientId: Number(form.patientId), providerId: Number(form.providerId), policyNumber: form.policyNumber, memberNumber: form.memberNumber || undefined, coverageStart: form.coverageStart || undefined, coverageEnd: form.coverageEnd || undefined, coverageLimit: form.coverageLimit ? Number(form.coverageLimit) : undefined, isPrimary: form.isPrimary === 'true', notes: form.notes || undefined })
      } else {
        if (!form.patientId || !form.providerId || !form.invoiceId || !form.claimedAmount) {
          throw new Error('Select a patient, insurance provider, invoice and claimed amount.')
        }
        const selectedInvoice = invoiceOptions.find(item => String(item.id) === form.invoiceId)
        if (!selectedInvoice || Number(selectedInvoice.patientId) !== Number(form.patientId)) {
          throw new Error('Please select an invoice belonging to the selected patient.')
        }
        const response = await api.post('/insurance/claims', {
          patientId: Number(form.patientId),
          providerId: Number(form.providerId),
          patientInsuranceId: form.patientInsuranceId ? Number(form.patientInsuranceId) : undefined,
          invoiceId: Number(form.invoiceId),
          claimedAmount: Number(form.claimedAmount),
          reviewNotes: form.reviewNotes || undefined,
        })
        if (isReceptionist) await api.patch(`/insurance/claims/${response.data.id}/submit`)
      }
      setFormOpen(false); await load(section)
    } catch (e: any) { setError(e?.response?.data?.message?.toString() ?? e?.message ?? 'Unable to save insurance record.') }
    finally { setFormBusy(false) }
  }
  const review = async (row: Row, status: 'APPROVED'|'PARTIALLY_APPROVED'|'REJECTED') => {
    const note = status === 'REJECTED' ? window.prompt('Enter rejection reason:') : window.prompt('Review note (optional):')
    if (status === 'REJECTED' && !note?.trim()) return
    const partial = status === 'PARTIALLY_APPROVED' ? window.prompt('Enter approved amount:') : null
    if (status === 'PARTIALLY_APPROVED' && (!partial || !Number.isFinite(Number(partial)) || Number(partial) <= 0 || Number(partial) >= Number(row.claimedAmount))) return
    try {
      await api.patch(`/insurance/claims/${row.id}/review`, { status, approvedAmount: status === 'APPROVED' ? Number(row.claimedAmount) : status === 'PARTIALLY_APPROVED' ? Number(partial) : undefined, reviewNotes: note?.trim() || undefined })
      await load('claims')
    } catch (e: any) { setError(e?.response?.data?.message?.toString() ?? 'Unable to review claim.') }
  }

  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-bold tracking-widest text-teal-700">FINANCIAL & COVERAGE SERVICES</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Insurance Management</h1><p className="mt-1 text-sm text-slate-500">Manage insurance providers, patient policies and claim records.</p></div>
      {((section === 'providers' && canCreateProvider) || (section === 'policies' && canCreatePolicy) || (section === 'claims' && canCreateClaim)) && <button onClick={openCreate} className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white">+ Add {section === 'providers' ? 'Provider' : section === 'policies' ? 'Patient Policy' : 'Claim'}</button>}<button onClick={() => void load(section)} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/> Refresh</button>
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
              : filtered.map((row, index) => <tr key={String(row.id ?? row.policyNumber ?? row.claimNumber ?? index)} className="hover:bg-slate-50">{columns.map(col => <td key={col} className="max-w-56 truncate px-3 py-3 text-slate-700">{label(row[col])}</td>)}<td className="px-3 py-3"><div className="flex items-center gap-1"><button onClick={() => setSelected(row)} className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50"><Eye size={14}/> View</button>{(isAdmin || isAccountant) && section === 'providers' && <button onClick={async()=>{const name=window.prompt('Provider name',row.name);if(!name?.trim())return;try{await api.patch(`/insurance/providers/${row.id}`,{name});await load('providers')}catch(e:any){setError(e?.response?.data?.message??'Unable to update provider')}}} className="rounded-md px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-100">Edit</button>}{(isAdmin || isAccountant) && section === 'providers' && row.isActive && <button onClick={async()=>{if(!window.confirm('Deactivate this provider?'))return;try{await api.patch(`/insurance/providers/${row.id}`,{isActive:false});await load('providers')}catch(e:any){setError(e?.response?.data?.message??'Unable to deactivate provider')}}} className="rounded-md px-2 py-1.5 text-xs text-rose-700 hover:bg-rose-50">Deactivate</button>}{(isAdmin || isAccountant) && section === 'providers' && row.isActive === false && <button onClick={async()=>{try{await api.patch(`/insurance/providers/${row.id}`,{isActive:true});await load('providers')}catch(e:any){setError(e?.response?.data?.message??'Unable to activate provider')}}} className="rounded-md px-2 py-1.5 text-xs text-emerald-700 hover:bg-emerald-50">Activate</button>}{(isAdmin || isAccountant) && section === 'policies' && <button onClick={async()=>{const policyNumber=window.prompt('Policy number',row.policyNumber);if(!policyNumber?.trim())return;try{await api.patch(`/insurance/policies/${row.id}`,{policyNumber});await load('policies')}catch(e:any){setError(e?.response?.data?.message??'Unable to update policy')}}} className="rounded-md px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-100">Edit</button>}{(isAdmin || isAccountant) && section === 'policies' && row.isActive && <button onClick={async()=>{if(!window.confirm('Deactivate this patient policy?'))return;try{await api.patch(`/insurance/policies/${row.id}`,{isActive:false});await load('policies')}catch(e:any){setError(e?.response?.data?.message??'Unable to deactivate policy')}}} className="rounded-md px-2 py-1.5 text-xs text-rose-700 hover:bg-rose-50">Deactivate</button>}{section === 'claims' && isReceptionist && row.status === 'DRAFT' && <button onClick={async()=>{try{await api.patch(`/insurance/claims/${row.id}/submit`);await load('claims')}catch(e:any){setError(e?.response?.data?.message??'Unable to submit claim')}}} className="rounded-md bg-amber-50 px-2 py-1.5 text-xs font-semibold text-amber-700">Submit</button>}{section === 'claims' && canReviewClaims && ['SUBMITTED','UNDER_REVIEW'].includes(row.status) && <><button onClick={() => void review(row,'APPROVED')} className="rounded-md bg-emerald-50 px-2 py-1.5 text-xs font-semibold text-emerald-700">Approve</button><button onClick={() => void review(row,'PARTIALLY_APPROVED')} className="rounded-md bg-sky-50 px-2 py-1.5 text-xs font-semibold text-sky-700">Partial</button><button onClick={() => void review(row,'REJECTED')} className="rounded-md bg-rose-50 px-2 py-1.5 text-xs font-semibold text-rose-700">Reject</button></>}</div></td></tr>)}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-400">Showing {filtered.length} of {data.length} records · Live API data</p>
    </section>

    {formOpen && <div className="fixed inset-0 z-[95] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4"><form onSubmit={submitCreate} className="my-6 max-h-[90vh] w-full max-w-xl space-y-3 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-lg font-bold">Add {section === 'providers' ? 'Insurance Provider' : section === 'policies' ? 'Patient Policy' : 'Insurance Claim'}</h2><button type="button" onClick={() => setFormOpen(false)} className="rounded p-2">✕</button></div>
      {section === 'providers' && [['name','Provider name'],['code','Provider code'],['contactPerson','Contact person'],['email','Email'],['phone','Phone'],['address','Address']].map(([key,labelText]) => <label key={key} className="block text-sm font-medium text-slate-700">{labelText}<input required={key === 'name'} type="text" value={form[key] ?? ''} onChange={e => setForm(v => ({...v,[key]:e.target.value}))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>)}

      {section === 'policies' && <>
        <label className="block text-sm font-medium text-slate-700">Patient<select required value={form.patientId ?? ''} onChange={e => setForm(v => ({...v,patientId:e.target.value}))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"><option value="">Select patient</option>{patientOptions.map(patient => <option key={patient.id} value={patient.id}>{[patient.patientNumber, patient.firstName, patient.lastName].filter(Boolean).join(' · ') || `Patient #${patient.id}`} (ID: {patient.id})</option>)}</select></label>
        <label className="block text-sm font-medium text-slate-700">Insurance provider<select required value={form.providerId ?? ''} onChange={e => setForm(v => ({...v,providerId:e.target.value}))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"><option value="">Select provider</option>{providerOptions.map(provider => <option key={provider.id} value={provider.id}>{provider.name} (ID: {provider.id})</option>)}</select></label>
        {(['policyNumber','memberNumber','coverageStart','coverageEnd','coverageLimit','notes'] as const).map(key => <label key={key} className="block text-sm font-medium text-slate-700">{({policyNumber:'Policy number',memberNumber:'Member number',coverageStart:'Coverage start',coverageEnd:'Coverage end',coverageLimit:'Coverage limit',notes:'Notes'} as Record<string,string>)[key]}<input required={key === 'policyNumber'} type={key.includes('coverage') && key !== 'coverageLimit' ? 'date' : key === 'coverageLimit' ? 'number' : 'text'} min={key === 'coverageLimit' ? '0' : undefined} value={form[key] ?? ''} onChange={e => setForm(v => ({...v,[key]:e.target.value}))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>)}
        <label className="block text-sm font-medium text-slate-700">Primary policy<select value={form.isPrimary ?? 'false'} onChange={e => setForm(v => ({...v,isPrimary:e.target.value}))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"><option value="false">No</option><option value="true">Yes</option></select></label>
      </>}

      {section === 'claims' && <>
        <label className="block text-sm font-medium text-slate-700">Patient<select required value={form.patientId ?? ''} onChange={e => void handleClaimPatientChange(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"><option value="">Select patient first</option>{patientOptions.map(patient => <option key={patient.id} value={patient.id}>{[patient.patientNumber, patient.firstName, patient.lastName].filter(Boolean).join(' · ') || `Patient #${patient.id}`} (ID: {patient.id})</option>)}</select></label>
        <label className="block text-sm font-medium text-slate-700">Insurance provider<select required value={form.providerId ?? ''} onChange={e => setForm(v => ({...v,providerId:e.target.value,patientInsuranceId:''}))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" disabled={!form.patientId}><option value="">Select provider</option>{providerOptions.map(provider => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select></label>
        <label className="block text-sm font-medium text-slate-700">Patient insurance policy<select value={form.patientInsuranceId ?? ''} onChange={e => setForm(v => ({...v,patientInsuranceId:e.target.value}))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" disabled={!form.patientId}><option value="">Select policy (optional)</option>{policyOptions.filter(policy => !form.providerId || String(policy.providerId) === form.providerId).map(policy => <option key={policy.id} value={policy.id}>{policy.policyNumber} · {policy.provider?.name ?? 'Provider'}{policy.isPrimary ? ' · Primary' : ''}</option>)}</select></label>
        <label className="block text-sm font-medium text-slate-700">Patient invoice<select required value={form.invoiceId ?? ''} onChange={e => handleClaimInvoiceChange(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" disabled={!form.patientId || invoiceLoading}><option value="">{invoiceLoading ? 'Loading patient invoices…' : 'Select invoice'}</option>{invoiceOptions.map(invoice => <option key={invoice.id} value={invoice.id}>{invoice.invoiceNumber ?? `Invoice #${invoice.id}`} · Total: {invoice.totalAmount} · Paid: {invoice.paidAmount ?? 0} · {invoice.status ?? '—'}</option>)}</select></label>
        {form.patientId && !invoiceLoading && invoiceOptions.length === 0 && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">No invoices were found for this patient. Create the invoice in Billing before submitting an insurance claim.</p>}
        {form.invoiceId && (() => { const invoice = invoiceOptions.find(item => String(item.id) === form.invoiceId); return invoice ? <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-sm"><div><p className="text-xs text-slate-500">Invoice total</p><p className="font-semibold">LKR {Number(invoice.totalAmount ?? 0).toLocaleString()}</p></div><div><p className="text-xs text-slate-500">Paid at counter</p><p className="font-semibold">LKR {Number(invoice.paidAmount ?? 0).toLocaleString()}</p></div><div><p className="text-xs text-slate-500">Balance</p><p className="font-semibold">LKR {Number(invoice.balance ?? Math.max(0, Number(invoice.totalAmount ?? 0) - Number(invoice.paidAmount ?? 0))).toLocaleString()}</p></div><div><p className="text-xs text-slate-500">Invoice status</p><p className="font-semibold">{invoice.status ?? '—'}</p></div></div> : null })()}
        <label className="block text-sm font-medium text-slate-700">Claimed amount (LKR)<input required type="number" min="0.01" step="0.01" max={invoiceOptions.find(item => String(item.id) === form.invoiceId)?.totalAmount ?? undefined} value={form.claimedAmount ?? ''} onChange={e => setForm(v => ({...v,claimedAmount:e.target.value}))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
        <label className="block text-sm font-medium text-slate-700">Claim notes<textarea value={form.reviewNotes ?? ''} onChange={e => setForm(v => ({...v,reviewNotes:e.target.value}))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" rows={3}/></label>
      </>}
      <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setFormOpen(false)} className="rounded-lg border px-4 py-2">Cancel</button><button disabled={formBusy} className="rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white">{formBusy ? 'Saving…' : section === 'claims' && isReceptionist ? 'Submit claim' : 'Save'}</button></div></form></div>}

    {selected && <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4" onClick={() => setSelected(null)}><section className="my-6 max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl" onClick={e => e.stopPropagation()}><div className="mb-4 flex items-center justify-between"><div><h2 className="font-bold text-slate-900">Insurance record details</h2><p className="text-xs text-slate-500">{current.label}</p></div><button onClick={() => setSelected(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18}/></button></div><div className="grid gap-3 sm:grid-cols-2">{Object.entries(selected).filter(([key]) => !/password|token/i.test(key)).map(([key, value]) => <div key={key} className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">{titleCase(key)}</p><p className="mt-1 break-words text-sm font-medium text-slate-800">{label(value)}</p></div>)}</div></section></div>}
  </div>
}
