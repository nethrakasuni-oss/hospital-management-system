import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, RefreshCw, Search, X, Pencil, Ban, CheckCircle2 } from 'lucide-react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'

type Row = Record<string, any>
type Slot = { time: string; scheduledAt: string; available: boolean }
type FormState = { patientId: string; doctorId: string; scheduledAt: string; duration: string; reason: string; notes: string; consultationFee: string; appointmentType: string; departmentId: string }
const blank: FormState = { patientId: '', doctorId: '', scheduledAt: '', duration: '30', reason: '', notes: '', consultationFee: '0', appointmentType: 'IN_PERSON', departmentId: '' }
function unwrap(value: any): Row[] { if (Array.isArray(value)) return value; if (Array.isArray(value?.data)) return value.data; if (Array.isArray(value?.items)) return value.items; return [] }
function personName(value: any) { return value ? [value.firstName, value.lastName].filter(Boolean).join(' ') || value.name || `#${value.id ?? ''}` : '—' }
function localDate(value: string) { const d = new Date(value); return Number.isNaN(d.getTime()) ? value : d.toLocaleString() }
function todayLocal() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }

export default function Appointments() {
  const { user } = useAuth()
  const role = String(user?.role ?? '').trim().toUpperCase()
  const canManage = ['ADMIN', 'ADMINISTRATOR', 'RECEPTIONIST'].includes(role)
  const canView = ['ADMIN', 'ADMINISTRATOR', 'RECEPTIONIST', 'DOCTOR'].includes(role)
  const [rows, setRows] = useState<Row[]>([])
  const [patients, setPatients] = useState<Row[]>([])
  const [doctors, setDoctors] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('ALL')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [form, setForm] = useState<FormState>(blank)
  const [saving, setSaving] = useState(false)
  const [availabilityDate, setAvailabilityDate] = useState(todayLocal())
  const [availableSlots, setAvailableSlots] = useState<Slot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsError, setSlotsError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    if (!canView) { setRows([]); setLoading(false); setError('Your staff role does not have permission to view appointments.'); return } 
    const results = await Promise.allSettled([api.get('/appointments'), api.get('/patients'), api.get('/doctors')])
    if (results[0].status === 'fulfilled') setRows(unwrap(results[0].value.data))
    else setError('Unable to load appointments. Please check your access and API connection.')
    if (results[1].status === 'fulfilled') setPatients(unwrap(results[1].value.data))
    if (results[2].status === 'fulfilled') setDoctors(unwrap(results[2].value.data))
    setLoading(false)
  }, [canView])
  useEffect(() => { void load() }, [load])

  // Automatically refresh slots whenever doctor, date or duration changes.
  useEffect(() => {
    if (!modal || editing || !form.doctorId || !availabilityDate || !form.duration) {
      setAvailableSlots([])
      setSlotsError('')
      return
    }
    const duration = Number(form.duration)
    if (!Number.isInteger(duration) || duration < 5 || duration > 480) {
      setAvailableSlots([])
      setSlotsError('Enter an appointment duration between 5 and 480 minutes.')
      return
    }

    let cancelled = false
    setSlotsLoading(true)
    setSlotsError('')
    setAvailableSlots([])
    setForm(current => ({ ...current, scheduledAt: '' }))

    api.get('/appointments/availability', {
      params: { doctorId: Number(form.doctorId), date: availabilityDate, duration },
    }).then(response => {
      if (!cancelled) setAvailableSlots(unwrap(response.data) as Slot[])
    }).catch((e: any) => {
      if (!cancelled) {
        setAvailableSlots([])
        const message = e?.response?.data?.message
        setSlotsError(Array.isArray(message) ? message.join(', ') : message?.toString() || 'Unable to load available appointment slots.')
      }
    }).finally(() => {
      if (!cancelled) setSlotsLoading(false)
    })

    return () => { cancelled = true }
  }, [modal, editing, form.doctorId, form.duration, availabilityDate])

  const visible = useMemo(() => rows.filter(row => {
    const text = `${row.appointmentNo ?? ''} ${personName(row.patient)} ${personName(row.doctor)} ${row.reason ?? ''}`.toLowerCase()
    return text.includes(query.toLowerCase()) && (status === 'ALL' || row.status === status)
  }), [rows, query, status])

  const openCreate = () => { if (!canManage) return; setEditing(null); setForm(blank); setAvailabilityDate(todayLocal()); setAvailableSlots([]); setSlotsError(''); setModal(true) }
  const openEdit = (row: Row) => {
    if (!canManage) return
    setEditing(row)
    const date = new Date(row.scheduledAt)
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,16)
    setForm({ patientId: String(row.patientId), doctorId: String(row.doctorId), scheduledAt: local, duration: String(row.duration ?? 30), reason: row.reason ?? '', notes: row.notes ?? '', consultationFee: String(row.consultationFee ?? 0), appointmentType: row.appointmentType ?? 'IN_PERSON', departmentId: row.departmentId ? String(row.departmentId) : '' })
    setSlotsError('')
    setModal(true)
  }
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (!canManage) return; if (!form.scheduledAt) { setSlotsError('Please select an available appointment time.'); return }; setSaving(true); setError('')
    const payload: Record<string, unknown> = {
      scheduledAt: new Date(form.scheduledAt).toISOString(), duration: Number(form.duration),
      reason: form.reason || undefined, notes: form.notes || undefined,
      consultationFee: Number(form.consultationFee), appointmentType: form.appointmentType,
      departmentId: form.departmentId ? Number(form.departmentId) : undefined,
    }
    try {
      if (editing) await api.patch(`/appointments/${editing.id}`, payload)
      else await api.post('/appointments', { ...payload, patientId: Number(form.patientId), doctorId: Number(form.doctorId) })
      setModal(false); await load()
    } catch (e: any) { setError(e?.response?.data?.message?.toString() ?? 'Unable to save appointment. Check required fields and scheduling conflicts.') }
    finally { setSaving(false) }
  }
  const changeStatus = async (row: Row, next: string) => {
    if (!canManage) return
    try { await api.patch(`/appointments/${row.id}/status`, { status: next }); await load() }
    catch (e: any) { setError(e?.response?.data?.message?.toString() ?? 'Unable to update appointment status.') }
  }
  const cancel = async (row: Row) => {
    if (!canManage) return
    const reason = window.prompt('Cancellation reason (optional):')
    if (reason === null) return
    try { await api.patch(`/appointments/${row.id}/cancel`, { cancellationReason: reason }); await load() }
    catch (e: any) { setError(e?.response?.data?.message?.toString() ?? 'Unable to cancel appointment.') }
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold tracking-widest text-teal-700">CLINICAL OPERATIONS</p><h2 className="mt-1 text-2xl font-bold text-slate-900">Appointments</h2><p className="mt-1 text-sm text-slate-500">Schedule and manage patient appointments.</p></div>{canManage && <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"><Plus size={17}/> New appointment</button>}</div>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap gap-3"><label className="flex min-w-56 flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-slate-400"><Search size={17}/><input className="w-full outline-none text-sm text-slate-700" placeholder="Search appointment, patient, doctor..." value={query} onChange={e=>setQuery(e.target.value)}/></label><select className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={status} onChange={e=>setStatus(e.target.value)}><option value="ALL">All statuses</option>{['SCHEDULED','CONFIRMED','COMPLETED','CANCELLED','NO_SHOW'].map(s=><option key={s}>{s}</option>)}</select><button onClick={()=>void load()} className="rounded-lg border border-slate-200 p-2 text-slate-600" title="Refresh"><RefreshCw size={17}/></button></div>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{['Appointment','Patient','Doctor','Date & time','Type','Status','Actions'].map(x=><th key={x} className="px-3 py-3 font-semibold">{x}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan={7} className="p-8 text-center text-slate-500">Loading appointments…</td></tr> : visible.length===0 ? <tr><td colSpan={7} className="p-8 text-center text-slate-500">No appointments found.</td></tr> : visible.map(row=><tr key={row.id} className="hover:bg-slate-50/70"><td className="px-3 py-3 font-semibold text-slate-800">{row.appointmentNo ?? `APT-${row.id}`}</td><td className="px-3 py-3">{personName(row.patient)}</td><td className="px-3 py-3">{personName(row.doctor?.user ?? row.doctor)}</td><td className="px-3 py-3">{localDate(row.scheduledAt)}</td><td className="px-3 py-3">{row.appointmentType?.replace('_',' ') ?? '—'}</td><td className="px-3 py-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{row.status ?? '—'}</span></td><td className="px-3 py-3"><div className="flex items-center gap-1">{canManage && <><button title="Edit" onClick={()=>openEdit(row)} className="rounded-md p-2 text-slate-500 hover:bg-teal-50 hover:text-teal-700"><Pencil size={15}/></button>{!['COMPLETED','CANCELLED'].includes(row.status) && <><button title="Confirm" onClick={()=>void changeStatus(row,'CONFIRMED')} className="rounded-md p-2 text-slate-500 hover:bg-green-50 hover:text-green-700"><CheckCircle2 size={15}/></button><button title="Cancel" onClick={()=>void cancel(row)} className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-700"><Ban size={15}/></button></>}</>}</div></td></tr>)}</tbody></table></div>
      <p className="mt-3 text-xs text-slate-400">Showing {visible.length} of {rows.length} appointments</p>
    </div>
    {modal && canManage && <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4"><div className="my-6 w-full max-w-2xl rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h3 className="font-bold text-slate-900">{editing?'Edit appointment':'Create appointment'}</h3><p className="text-xs text-slate-500">Fields are submitted to the hospital appointment API.</p></div><button onClick={()=>setModal(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={19}/></button></div><form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2">
      {!editing && <><label className="text-sm font-medium text-slate-700">Patient *<select required value={form.patientId} onChange={e=>setForm({...form,patientId:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5"><option value="">Select patient</option>{patients.map(p=><option key={p.id} value={p.id}>{p.patientNo ?? `#${p.id}`} – {personName(p)}</option>)}</select></label><label className="text-sm font-medium text-slate-700">Doctor *<select required value={form.doctorId} onChange={e=>setForm({...form,doctorId:e.target.value,scheduledAt:''})} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5"><option value="">Select doctor</option>{doctors.map(d=><option key={d.id} value={d.id}>Dr. {personName(d.user ?? d)}{d.specialization?` – ${d.specialization}`:''}</option>)}</select></label></>}
      {!editing ? <>
        <label className="text-sm font-medium text-slate-700">Appointment date *
          <input required type="date" min={todayLocal()} value={availabilityDate} onChange={e=>{setAvailabilityDate(e.target.value);setForm(current=>({...current,scheduledAt:''}))}} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5" />
        </label>
        <label className="text-sm font-medium text-slate-700">Available time slot *
          <select required value={form.scheduledAt} disabled={!form.doctorId || slotsLoading || availableSlots.length===0} onChange={e=>setForm(current=>({...current,scheduledAt:e.target.value}))} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 disabled:bg-slate-100">
            <option value="">{!form.doctorId ? 'Select a doctor first' : slotsLoading ? 'Loading available times…' : availableSlots.length ? 'Select an available time' : 'No available slots'}</option>
            {availableSlots.map(slot=><option key={slot.scheduledAt} value={slot.scheduledAt}>{slot.time}</option>)}
          </select>
          {slotsLoading && <span className="mt-1 block text-xs text-slate-500">Checking the doctor’s schedule…</span>}
          {slotsError && <span role="alert" className="mt-1 block text-xs text-red-600">{slotsError}</span>}
          {!slotsLoading && !slotsError && form.doctorId && availableSlots.length===0 && <span className="mt-1 block text-xs text-amber-700">No available appointments for this doctor on the selected date.</span>}
        </label>
      </> : <label className="text-sm font-medium text-slate-700">Date & time *<input required type="datetime-local" value={form.scheduledAt} onChange={e=>setForm({...form,scheduledAt:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5"/></label>}
      <label className="text-sm font-medium text-slate-700">Duration (minutes)<input required type="number" min="5" max="480" value={form.duration} onChange={e=>setForm({...form,duration:e.target.value,scheduledAt:''})} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5"/></label>
      <label className="text-sm font-medium text-slate-700">Appointment type<select value={form.appointmentType} onChange={e=>setForm({...form,appointmentType:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5"><option value="IN_PERSON">In person</option><option value="ONLINE">Online</option></select></label>
      <label className="text-sm font-medium text-slate-700">Consultation fee<input type="number" min="0" step="0.01" value={form.consultationFee} onChange={e=>setForm({...form,consultationFee:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5"/></label>
      <label className="text-sm font-medium text-slate-700 sm:col-span-2">Reason<input maxLength={1000} value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5"/></label>
      <label className="text-sm font-medium text-slate-700 sm:col-span-2">Notes<textarea maxLength={2000} rows={3} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5"/></label>
      <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={()=>setModal(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={saving} className="rounded-lg bg-teal-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving?'Saving…':editing?'Save changes':'Create appointment'}</button></div>
    </form></div></div>}
  </div>
}
