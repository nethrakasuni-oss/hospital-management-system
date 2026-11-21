import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus, RefreshCw, Search, X, Pencil, FileCheck2 } from 'lucide-react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'

type Row = Record<string, any> & { id: number }
const rows = (value: any): Row[] => Array.isArray(value) ? value : Array.isArray(value?.data) ? value.data : []
const patientName = (patient: any) => patient ? [patient.firstName, patient.lastName].filter(Boolean).join(' ') || `Patient #${patient.id}` : '—'
const errorMessage = (error: any) => Array.isArray(error?.response?.data?.message) ? error.response.data.message.join(', ') : error?.response?.data?.message || 'Unable to complete the request.'

const emptyForm = () => ({
  admissionId: '',
  dischargeDate: '',
  principalDiagnosis: '',
  secondaryDiagnoses: '',
  proceduresPerformed: '',
  treatmentSummary: '',
  dischargeMedication: '',
  followUpInstructions: '',
  conditionAtDischarge: '',
})

export default function Discharges() {
  const { user } = useAuth()
  const role = user?.role?.toUpperCase()
  const canCreate = role === 'ADMIN' || role === 'DOCTOR'
  const [summaries, setSummaries] = useState<Row[]>([])
  const [activeAdmissions, setActiveAdmissions] = useState<Row[]>([])
  const [busy, setBusy] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [form, setForm] = useState(emptyForm())

  const load = useCallback(async () => {
    setBusy(true)
    setError('')
    const [summaryResult, admissionResult] = await Promise.allSettled([
      api.get('/discharges'),
      api.get('/inpatient/admissions', { params: { status: 'ADMITTED' } }),
    ])
    if (summaryResult.status === 'fulfilled') setSummaries(rows(summaryResult.value.data))
    else setError(errorMessage(summaryResult.reason))
    if (admissionResult.status === 'fulfilled') setActiveAdmissions(rows(admissionResult.value.data))
    else setActiveAdmissions([])
    setBusy(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() => summaries.filter(item =>
    `${patientName(item.patient)} ${item.principalDiagnosis ?? ''} ${item.admissionId ?? ''}`
      .toLowerCase().includes(query.toLowerCase())), [summaries, query])

  const selectedAdmission = activeAdmissions.find(item => String(item.id) === form.admissionId)

  const openNew = () => {
    setEditing(null)
    setForm(emptyForm())
    setError('')
    setOpen(true)
  }

  const openEdit = (item: Row) => {
    setEditing(item)
    setForm({
      ...emptyForm(),
      principalDiagnosis: item.principalDiagnosis ?? '',
      secondaryDiagnoses: item.secondaryDiagnoses ?? '',
      proceduresPerformed: item.proceduresPerformed ?? '',
      treatmentSummary: item.treatmentSummary ?? '',
      dischargeMedication: item.dischargeMedication ?? '',
      followUpInstructions: item.followUpInstructions ?? '',
      conditionAtDischarge: item.conditionAtDischarge ?? '',
    })
    setError('')
    setOpen(true)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!editing && !selectedAdmission) {
      setError('Select an active admission.')
      return
    }
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        principalDiagnosis: form.principalDiagnosis.trim(),
        secondaryDiagnoses: form.secondaryDiagnoses.trim() || undefined,
        proceduresPerformed: form.proceduresPerformed.trim() || undefined,
        treatmentSummary: form.treatmentSummary.trim(),
        dischargeMedication: form.dischargeMedication.trim() || undefined,
        followUpInstructions: form.followUpInstructions.trim() || undefined,
        conditionAtDischarge: form.conditionAtDischarge.trim() || undefined,
      }
      if (!editing && selectedAdmission) {
        body.patientId = Number(selectedAdmission.patientId)
        body.admissionId = Number(selectedAdmission.id)
        body.admissionDate = new Date(selectedAdmission.admissionDate).toISOString()
        if (form.dischargeDate) body.dischargeDate = new Date(`${form.dischargeDate}T12:00:00`).toISOString()
      }
      if (editing) await api.patch(`/discharges/${editing.id}`, body)
      else await api.post('/discharges', body)
      setOpen(false)
      await load()
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setSaving(false)
    }
  }

  return <main className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-bold tracking-widest text-teal-700">INPATIENT OPERATIONS</p><h1 className="text-2xl font-bold text-slate-900">Discharge Management</h1><p className="text-sm text-slate-500">Create clinical discharge summaries and review discharge history.</p></div>
      <div className="flex gap-2">
        {canCreate && <button onClick={openNew} className="flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white"><Plus size={16}/> New discharge</button>}
        <button onClick={() => void load()} disabled={busy} className="rounded-lg border border-slate-200 p-2.5 text-slate-700"><RefreshCw size={16} className={busy ? 'animate-spin' : ''}/></button>
      </div>
    </header>
    {error && !open && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <label className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3"><Search size={16}/><input className="w-full py-2 text-sm outline-none" placeholder="Search patient or diagnosis" value={query} onChange={event => setQuery(event.target.value)}/></label>
        <span className="text-xs text-slate-500">{filtered.length} records</span>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500"><tr>{['Patient','Admission','Discharge date','Principal diagnosis','Condition','Actions'].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {busy ? <tr><td colSpan={6} className="p-8 text-center text-slate-500">Loading discharge records…</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-slate-500">No discharge summaries found.</td></tr>
              : filtered.map(item => <tr key={item.id}>
                <td className="p-3 font-medium">{patientName(item.patient)}</td>
                <td className="p-3">#{item.admissionId}</td>
                <td className="p-3">{item.dischargeDate ? new Date(item.dischargeDate).toLocaleDateString() : '—'}</td>
                <td className="p-3">{item.principalDiagnosis}</td>
                <td className="p-3">{item.conditionAtDischarge ?? '—'}</td>
                <td className="p-3">{canCreate && <button onClick={() => openEdit(item)} className="rounded p-2 text-teal-700" aria-label="Edit discharge summary"><Pencil size={16}/></button>}</td>
              </tr>)}
          </tbody>
        </table>
      </div>
    </section>

    {open && <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-slate-950/50 p-4">
      <form onSubmit={submit} className="my-5 w-full max-w-2xl space-y-3 rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between"><div className="flex items-center gap-2"><FileCheck2 className="text-teal-700"/><h2 className="font-bold">{editing ? 'Edit discharge summary' : 'Prepare discharge summary'}</h2></div><button type="button" onClick={() => setOpen(false)}><X size={18}/></button></div>
        {!editing && <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">Active admission *
            <select required className="mt-1 w-full rounded-lg border p-2.5" value={form.admissionId} onChange={event => setForm(current => ({ ...current, admissionId: event.target.value }))}>
              <option value="">Select active patient admission</option>
              {activeAdmissions.map(admission => <option key={admission.id} value={admission.id}>{patientName(admission.patient)} · Admission #{admission.id} · {new Date(admission.admissionDate).toLocaleDateString()}</option>)}
            </select>
          </label>
          {selectedAdmission && <div className="sm:col-span-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            <strong>{patientName(selectedAdmission.patient)}</strong>
            <p>Patient ID: {selectedAdmission.patientId} · Admission date: {new Date(selectedAdmission.admissionDate).toLocaleDateString()}</p>
            <p>Bed: {selectedAdmission.bed?.room?.ward?.name ?? 'Ward'} / {selectedAdmission.bed?.room?.roomNumber ?? 'Room'} / {selectedAdmission.bed?.bedNumber ?? 'Bed'}</p>
          </div>}
          <label className="text-sm">Discharge date
            <input type="date" className="mt-1 w-full rounded-lg border p-2.5" value={form.dischargeDate} onChange={event => setForm(current => ({ ...current, dischargeDate: event.target.value }))}/>
          </label>
        </div>}
        {(['principalDiagnosis','secondaryDiagnoses','proceduresPerformed','treatmentSummary','dischargeMedication','followUpInstructions','conditionAtDischarge'] as const).map(key =>
          <label key={key} className="block text-sm capitalize">{key.replace(/[A-Z]/g, ' $&')} {['principalDiagnosis','treatmentSummary'].includes(key) ? '*' : ''}
            <textarea required={['principalDiagnosis','treatmentSummary'].includes(key)} rows={key === 'treatmentSummary' ? 3 : 2} className="mt-1 w-full rounded-lg border p-2.5" value={form[key]} onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))}/>
          </label>
        )}
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3"><button type="button" onClick={() => setOpen(false)} className="rounded-lg border px-4 py-2">Cancel</button><button disabled={saving} className="rounded-lg bg-teal-700 px-4 py-2 text-white disabled:opacity-60">{saving ? 'Saving…' : editing ? 'Save changes' : 'Discharge patient & save summary'}</button></div>
        {!editing && <p className="text-xs text-amber-700">Submitting this form marks the admission as DISCHARGED and releases its bed in the backend transaction.</p>}
      </form>
    </div>}
  </main>
}
