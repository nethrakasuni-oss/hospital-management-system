import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Activity, AlertCircle, BedDouble, Building2, ClipboardList, DoorOpen, Plus, RefreshCw, Search, X, Users, CheckCircle2 } from 'lucide-react'
import api from '../lib/api'

type Row = Record<string, any> & { id: number }
type Tab = 'Overview' | 'Admissions' | 'Wards' | 'Rooms' | 'Beds'
const tabs: Tab[] = ['Overview', 'Admissions', 'Wards', 'Rooms', 'Beds']
const asRows = (v: any): Row[] => Array.isArray(v) ? v : Array.isArray(v?.data) ? v.data : []
const patientName = (p: any) => p ? [p.firstName, p.lastName].filter(Boolean).join(' ') || `Patient #${p.id}` : '—'
const dateText = (v: any) => v ? new Date(v).toLocaleDateString() : '—'
const errorText = (e: any) => Array.isArray(e?.response?.data?.message) ? e.response.data.message.join(', ') : e?.response?.data?.message || 'The request could not be completed.'

export default function AdmissionsBeds() {
  const [tab, setTab] = useState<Tab>('Overview')
  const [admissions, setAdmissions] = useState<Row[]>([])
  const [wards, setWards] = useState<Row[]>([])
  const [rooms, setRooms] = useState<Row[]>([])
  const [beds, setBeds] = useState<Row[]>([])
  const [patients, setPatients] = useState<Row[]>([])
  const [departments, setDepartments] = useState<Row[]>([])
  const [stats, setStats] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState<Tab | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [bedStatus, setBedStatus] = useState('ALL')

  const load = useCallback(async () => {
    setLoading(true); setError(''); setNotice('')
    const results = await Promise.allSettled([
      api.get('/inpatient/dashboard'), api.get('/inpatient/admissions'),
      api.get('/inpatient/wards'), api.get('/inpatient/rooms'),
      api.get('/inpatient/beds'), api.get('/patients'), api.get('/departments'),
    ])
    const failed: string[] = []
    const [s, a, w, r, b, p, d] = results
    if (s.status === 'fulfilled') setStats(s.value.data)
    else failed.push('dashboard')
    if (a.status === 'fulfilled') setAdmissions(asRows(a.value.data)); else failed.push('admissions')
    if (w.status === 'fulfilled') setWards(asRows(w.value.data)); else failed.push('wards')
    if (r.status === 'fulfilled') setRooms(asRows(r.value.data)); else failed.push('rooms')
    if (b.status === 'fulfilled') setBeds(asRows(b.value.data)); else failed.push('beds')
    if (p.status === 'fulfilled') setPatients(asRows(p.value.data)); else failed.push('patients')
    if (d.status === 'fulfilled') setDepartments(asRows(d.value.data))
    if (failed.length) setError(`Unable to load: ${failed.join(', ')}. Check your access permissions and backend connection.`)
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])

  const filteredAdmissions = useMemo(() => admissions.filter(x => `${patientName(x.patient)} ${x.reason ?? ''} ${x.status ?? ''} ${x.id}`.toLowerCase().includes(query.toLowerCase())), [admissions, query])
  const filteredWards = useMemo(() => wards.filter(x => `${x.name} ${x.description ?? ''}`.toLowerCase().includes(query.toLowerCase())), [wards, query])
  const filteredRooms = useMemo(() => rooms.filter(x => `${x.roomNumber} ${x.ward?.name ?? ''}`.toLowerCase().includes(query.toLowerCase())), [rooms, query])
  const filteredBeds = useMemo(() => beds.filter(x => `${x.bedNumber} ${x.room?.roomNumber ?? ''} ${x.room?.ward?.name ?? ''}`.toLowerCase().includes(query.toLowerCase()) && (bedStatus === 'ALL' || x.status === bedStatus)), [beds, query, bedStatus])

  function openCreate(section: Tab) { setModal(section); setDraft(section === 'Admissions' ? { admissionDate: new Date().toISOString().slice(0, 10) } : {}); setError(''); setNotice('') }
  async function submit(e: FormEvent) {
    e.preventDefault(); if (!modal) return
    setSaving(true); setError('')
    try {
      if (modal === 'Wards') await api.post('/inpatient/wards', { name: draft.name, description: draft.description || undefined, departmentId: draft.departmentId ? Number(draft.departmentId) : undefined })
      if (modal === 'Rooms') await api.post('/inpatient/rooms', { wardId: Number(draft.wardId), roomNumber: draft.roomNumber })
      if (modal === 'Beds') await api.post('/inpatient/beds', { roomId: Number(draft.roomId), bedNumber: draft.bedNumber })
      if (modal === 'Admissions') await api.post('/inpatient/admissions', { patientId: Number(draft.patientId), bedId: Number(draft.bedId), admissionDate: draft.admissionDate ? new Date(`${draft.admissionDate}T00:00:00`).toISOString() : undefined, reason: draft.reason || undefined })
      setModal(null); setNotice(`${modal === 'Admissions' ? 'Admission' : modal.slice(0, -1)} saved successfully.`); await load()
    } catch (e: any) { setError(errorText(e)) } finally { setSaving(false) }
  }
  async function changeBedStatus(bed: Row, status: string) {
    if (status === bed.status) return
    setError('')
    try { await api.patch(`/inpatient/beds/${bed.id}`, { status }); await load() }
    catch (e: any) { setError(errorText(e)) }
  }

  const cards = [
    { label: 'Active admissions', value: stats.activeAdmissions ?? admissions.filter(a => a.status === 'ADMITTED').length, icon: Users, tone: 'blue' },
    { label: 'Available beds', value: stats.availableBeds ?? beds.filter(b => b.status === 'AVAILABLE').length, icon: BedDouble, tone: 'teal' },
    { label: 'Occupied beds', value: stats.occupiedBeds ?? beds.filter(b => b.status === 'OCCUPIED').length, icon: Activity, tone: 'amber' },
    { label: 'Total wards', value: stats.totalWards ?? wards.length, icon: Building2, tone: 'violet' },
  ]
  const field = (key: string, label: string, required = false, type = 'text', options?: { value: string; label: string }[]) => (
    <label className="block text-sm font-medium text-slate-700" key={key}>{label}{required && ' *'}
      {options ? <select required={required} value={draft[key] ?? ''} onChange={e => setDraft(v => ({ ...v, [key]: e.target.value }))} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-teal-600"><option value="">Select {label.toLowerCase()}</option>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
      : <input required={required} type={type} value={draft[key] ?? ''} onChange={e => setDraft(v => ({ ...v, [key]: e.target.value }))} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-teal-600" />}
    </label>
  )
  const section = tab === 'Admissions' ? filteredAdmissions : tab === 'Wards' ? filteredWards : tab === 'Rooms' ? filteredRooms : filteredBeds
  const title = tab === 'Admissions' ? 'Admission' : tab.slice(0, -1)

  return <div className="mc-module-page space-y-5">
    <section className="mc-welcome-row">
      <div><p className="mc-eyebrow">INPATIENT OPERATIONS</p><h2>Admissions &amp; Beds</h2><p>Manage patient admissions, ward structure, rooms and live bed allocation.</p></div>
      <button className="mc-secondary-button" onClick={() => void load()} disabled={loading}><RefreshCw size={15} className={loading ? 'mc-spin' : ''}/> Refresh</button>
    </section>
    {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={18} className="mt-0.5 shrink-0"/><span>{error}</span></div>}
    {notice && <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 size={17}/>{notice}</div>}
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(c => <article key={c.label} className="mc-panel flex items-center justify-between p-5"><div><p className="text-sm text-slate-500">{c.label}</p><p className="mt-2 text-3xl font-bold text-slate-900">{loading ? '…' : c.value}</p></div><span className="rounded-xl bg-blue-50 p-3 text-blue-800"><c.icon size={22}/></span></article>)}
    </section>
    <section className="mc-panel overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div><h3 className="font-semibold text-slate-900">Inpatient management</h3><p className="mt-1 text-sm text-slate-500">Live records from the hospital database.</p></div>
        <div className="flex flex-wrap gap-2">{tabs.map(t => <button key={t} onClick={() => { setTab(t); setQuery('') }} className={`rounded-lg px-3 py-2 text-sm font-medium ${tab === t ? 'bg-blue-950 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{t}</button>)}</div>
      </div>
      {tab === 'Overview' ? <div className="grid gap-4 p-5 sm:grid-cols-2">
        {[{heading:'Admissions',desc:'Register existing patients and allocate available beds.',Icon:ClipboardList,target:'Admissions' as Tab},{heading:'Ward directory',desc:'Manage wards and their department associations.',Icon:Building2,target:'Wards' as Tab},{heading:'Room directory',desc:'Organise rooms within each ward.',Icon:DoorOpen,target:'Rooms' as Tab},{heading:'Bed inventory',desc:'Track available, occupied and maintenance beds.',Icon:BedDouble,target:'Beds' as Tab}].map(({heading,desc,Icon,target}) => <button key={heading} onClick={() => setTab(target)} className="flex items-start gap-4 rounded-xl border border-slate-200 p-4 text-left hover:border-teal-300 hover:bg-slate-50"><span className="rounded-xl bg-teal-50 p-3 text-teal-700"><Icon size={21}/></span><span><strong className="text-slate-900">{heading}</strong><span className="mt-1 block text-sm leading-6 text-slate-500">{desc}</span><span className="mt-3 inline-block text-sm font-semibold text-teal-700">Open section →</span></span></button>)}
      </div> : <>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <label className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 sm:w-80"><Search size={16} className="text-slate-400"/><input className="w-full border-0 bg-transparent text-sm outline-none" placeholder={`Search ${tab.toLowerCase()}...`} value={query} onChange={e => setQuery(e.target.value)}/></label>
          <div className="flex flex-wrap gap-2">{tab === 'Beds' && <select value={bedStatus} onChange={e => setBedStatus(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="ALL">All statuses</option>{['AVAILABLE','OCCUPIED','MAINTENANCE','UNAVAILABLE'].map(s => <option key={s}>{s}</option>)}</select>}
            <button onClick={() => openCreate(tab)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-900"><Plus size={16}/> Add {title.toLowerCase()}</button>
          </div>
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{(tab === 'Admissions' ? ['Patient','Admission date','Ward / Room / Bed','Reason','Status'] : tab === 'Wards' ? ['Ward','Department','Rooms','Beds'] : tab === 'Rooms' ? ['Room','Ward','Beds'] : ['Bed','Room','Ward','Status','Update status']).map(x => <th key={x} className="px-5 py-3">{x}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">
          {loading ? <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-500">Loading live records…</td></tr> : section.length === 0 ? <tr><td colSpan={5} className="px-5 py-14 text-center text-slate-500">No {tab.toLowerCase()} found.</td></tr> : section.map((r: Row) => <tr key={r.id} className="hover:bg-slate-50">
            {tab === 'Admissions' && <><td className="px-5 py-4"><strong>{patientName(r.patient)}</strong><span className="block text-xs text-slate-400">Patient #{r.patientId}</span></td><td className="px-5 py-4">{dateText(r.admissionDate)}</td><td className="px-5 py-4">{r.bed ? `${r.bed.room?.ward?.name ?? '—'} / ${r.bed.room?.roomNumber ?? '—'} / ${r.bed.bedNumber}` : 'No bed assigned'}</td><td className="px-5 py-4">{r.reason || '—'}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${r.status === 'ADMITTED' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{r.status}</span></td></>}
            {tab === 'Wards' && <><td className="px-5 py-4 font-semibold">{r.name}</td><td className="px-5 py-4">{r.department?.name ?? '—'}</td><td className="px-5 py-4">{r.rooms?.length ?? 0}</td><td className="px-5 py-4">{r.rooms?.reduce((n: number, room: Row) => n + (room.beds?.length ?? 0), 0) ?? 0}</td></>}
            {tab === 'Rooms' && <><td className="px-5 py-4 font-semibold">{r.roomNumber}</td><td className="px-5 py-4">{r.ward?.name ?? '—'}</td><td className="px-5 py-4">{r.beds?.length ?? 0}</td></>}
            {tab === 'Beds' && <><td className="px-5 py-4 font-semibold">{r.bedNumber}</td><td className="px-5 py-4">{r.room?.roomNumber ?? '—'}</td><td className="px-5 py-4">{r.room?.ward?.name ?? '—'}</td><td className="px-5 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">{r.status}</span></td><td className="px-5 py-4"><select disabled={r.status === 'OCCUPIED'} value={r.status} onChange={e => void changeBedStatus(r, e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs disabled:opacity-50">{['AVAILABLE','OCCUPIED','MAINTENANCE','UNAVAILABLE'].map(s => <option key={s}>{s}</option>)}</select></td></>}
          </tr>)}
        </tbody></table></div>
        <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">{section.length} records · Live backend data</div>
      </>}
    </section>
    {modal && <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4" onMouseDown={e => { if (e.target === e.currentTarget) setModal(null) }}><form onSubmit={submit} className="my-5 w-full max-w-xl space-y-4 rounded-2xl bg-white p-5 shadow-2xl">
      <div className="flex items-start justify-between"><div><h3 className="text-lg font-bold text-slate-900">Create {modal === 'Admissions' ? 'admission' : modal.slice(0,-1).toLowerCase()}</h3><p className="mt-1 text-sm text-slate-500">This record will be saved to the hospital database.</p></div><button type="button" onClick={() => setModal(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18}/></button></div>
      {modal === 'Admissions' && <div className="grid gap-4 sm:grid-cols-2">{field('patientId','Patient',true,'text',patients.map(p => ({ value:String(p.id), label:`${patientName(p)} · #${p.id}`})))}{field('bedId','Available bed',true,'text',beds.filter(b => b.status === 'AVAILABLE').map(b => ({value:String(b.id),label:`${b.room?.ward?.name ?? 'Ward'} · Room ${b.room?.roomNumber ?? '—'} · Bed ${b.bedNumber}`})))}{field('admissionDate','Admission date',true,'date')}<label className="block text-sm font-medium text-slate-700 sm:col-span-2">Admission reason<textarea rows={3} value={draft.reason ?? ''} onChange={e => setDraft(v => ({...v,reason:e.target.value}))} className="mt-1.5 w-full rounded-lg border border-slate-200 p-3 font-normal outline-none focus:border-teal-600"/></label></div>}
      {modal === 'Wards' && <div className="grid gap-4">{field('name','Ward name',true)}{field('departmentId','Department',false,'text',departments.map(d=>({value:String(d.id),label:d.name})))}<label className="block text-sm font-medium text-slate-700">Description<textarea rows={2} value={draft.description ?? ''} onChange={e=>setDraft(v=>({...v,description:e.target.value}))} className="mt-1.5 w-full rounded-lg border border-slate-200 p-3 font-normal"/></label></div>}
      {modal === 'Rooms' && <div className="grid gap-4">{field('wardId','Ward',true,'text',wards.map(w=>({value:String(w.id),label:w.name})))}{field('roomNumber','Room number',true)}</div>}
      {modal === 'Beds' && <div className="grid gap-4">{field('roomId','Room',true,'text',rooms.map(r=>({value:String(r.id),label:`${r.ward?.name ?? 'Ward'} · ${r.roomNumber}`})))}{field('bedNumber','Bed number',true)}</div>}
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={()=>setModal(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">Cancel</button><button disabled={saving} className="rounded-lg bg-blue-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving?'Saving…':'Save record'}</button></div>
    </form></div>}
  </div>
}
