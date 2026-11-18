
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, UserRound, RefreshCw, AlertCircle, CalendarDays, FileText, Stethoscope, Activity, FlaskConical, ShieldCheck, Wallet, BedDouble, Pill } from 'lucide-react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'

type Row = Record<string, unknown>
type Tab = { id: string; label: string; endpoint?: string; icon: typeof UserRound; unavailable?: string }

const tabs: Tab[] = [
  { id: 'overview', label: 'Overview', icon: UserRound },
  { id: 'appointments', label: 'Appointments', endpoint: '/appointments', icon: CalendarDays },
  { id: 'history', label: 'Medical History', endpoint: 'history', icon: FileText },
  { id: 'nursing', label: 'Nursing Notes', endpoint: 'nursing-notes', icon: Stethoscope },
  { id: 'observations', label: 'Observations', endpoint: 'observations', icon: Activity },
  { id: 'laboratory', label: 'Laboratory', endpoint: '/laboratory/requests', icon: FlaskConical },
  { id: 'insurance', label: 'Insurance', endpoint: '/insurance/policies', icon: ShieldCheck },
  { id: 'billing', label: 'Billing', endpoint: '/billing/invoices', icon: Wallet },
  { id: 'admissions', label: 'Admissions', icon: BedDouble, unavailable: 'The current backend does not expose a patient admissions list endpoint yet.' },
  { id: 'prescriptions', label: 'Prescriptions', icon: Pill, unavailable: 'The current backend does not expose a patient prescriptions list endpoint yet.' },
]

function toRows(payload: unknown): Row[] {
  if (Array.isArray(payload)) return payload.filter(v => v && typeof v === 'object') as Row[]
  if (payload && typeof payload === 'object') {
    const obj = payload as Row
    for (const key of ['data', 'items', 'results', 'records']) {
      if (Array.isArray(obj[key])) return obj[key] as Row[]
    }
    return [obj]
  }
  return []
}
function label(key: string) { return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()) }
function safe(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') return Array.isArray(value) ? `${value.length} records` : JSON.stringify(value)
  return String(value)
}

export default function PatientProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const backTarget = user?.role?.trim().toUpperCase() === 'DOCTOR' ? '/dashboard' : '/patients'
  const [patient, setPatient] = useState<Row | null>(null)
  const [active, setActive] = useState('overview')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tabLoading, setTabLoading] = useState(false)
  const current = tabs.find(t => t.id === active) ?? tabs[0]

  const loadPatient = async () => {
    if (!id) return
    setLoading(true); setError('')
    try {
      const response = await api.get(`/patients/${id}`)
      setPatient(response.data as Row)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load patient profile.')
    } finally { setLoading(false) }
  }

  useEffect(() => { void loadPatient() }, [id])

  useEffect(() => {
    let cancelled = false
    const loadTab = async () => {
      if (!id || active === 'overview' || !current.endpoint || current.unavailable) { setRows([]); return }
      setTabLoading(true); setError('')
      try {
        let response
        if (active === 'history') response = await api.get(`/medical-records/patient/${id}/history`)
        else if (active === 'nursing') response = await api.get(`/nursing/patients/${id}/notes`)
        else if (active === 'observations') response = await api.get(`/nursing/patients/${id}/observations`)
        else response = await api.get(current.endpoint, { params: { patientId: Number(id) } })
        if (!cancelled) setRows(toRows(response.data))
      } catch (e: unknown) {
        if (!cancelled) {
          const message = e && typeof e === 'object' && 'response' in e
            ? String((e as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'This patient-specific list is not available from the API.')
            : e instanceof Error ? e.message : 'Unable to load records.'
          setRows([])
          setError(message)
        }
      } finally { if (!cancelled) setTabLoading(false) }
    }
    void loadTab()
    return () => { cancelled = true }
  }, [active, id])

  const profileFields = useMemo(() => patient ? Object.entries(patient).filter(([k,v]) => !/password|token/i.test(k) && (v === null || ['string','number','boolean'].includes(typeof v))).slice(0,24) : [], [patient])

  if (loading) return <div className="mc-panel p-8">Loading patient profile…</div>
  if (!patient) return <div className="mc-panel p-8"><p className="text-red-600">{error || 'Patient not found.'}</p><button className="mc-secondary-button mt-4" onClick={() => navigate(backTarget)}>Back</button></div>

  const fullName = `${safe(patient.firstName)} ${safe(patient.lastName)}`
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <button className="mc-icon-button" onClick={() => navigate(backTarget)} aria-label="Back"><ArrowLeft size={18}/></button>
        <div><p className="mc-eyebrow">PATIENT MANAGEMENT / PROFILE</p><h2 className="text-2xl font-bold text-slate-900">{fullName}</h2><p className="text-sm text-slate-500">Patient ID: {safe(patient.patientNumber)}</p></div>
      </div>
      <button className="mc-secondary-button" onClick={() => void loadPatient()}><RefreshCw size={15}/> Refresh profile</button>
    </div>
    <section className="mc-panel flex flex-wrap items-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-700 grid place-items-center"><UserRound size={28}/></div>
      <div className="flex-1 min-w-[180px]"><h3 className="font-bold text-slate-900">{fullName}</h3><p className="text-xs text-slate-500">{safe(patient.gender)} · {safe(patient.bloodGroup)} · {safe(patient.phone)}</p></div>
      <div className="text-sm"><span className="text-slate-400 block text-xs">Email</span>{safe(patient.email)}</div>
      <div className="text-sm"><span className="text-slate-400 block text-xs">Date of birth</span>{patient.dateOfBirth ? new Date(String(patient.dateOfBirth)).toLocaleDateString() : '—'}</div>
    </section>
    <section className="mc-panel p-3">
      <div className="flex gap-2 overflow-x-auto pb-1">{tabs.map(tab => { const Icon = tab.icon; return <button key={tab.id} onClick={() => setActive(tab.id)} className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold ${active === tab.id ? 'bg-[#142b49] text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}><Icon size={15}/>{tab.label}</button> })}</div>
    </section>
    {active === 'overview' ? <section className="mc-panel"><div className="mc-panel-heading mb-4"><div><h3>Patient information</h3><p>Information returned by the patient record API</p></div></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{profileFields.map(([key,value]) => <div className="rounded-lg bg-slate-50 p-3" key={key}><span className="block text-xs text-slate-500">{label(key)}</span><strong className="mt-1 block break-words text-sm text-slate-800">{safe(value)}</strong></div>)}</div></section> :
      <section className="mc-panel">
        <div className="mc-panel-heading mb-4"><div><h3>{current.label}</h3><p>Patient-specific records from the hospital API</p></div><span className="mc-record-count">{tabLoading ? 'Loading…' : `${rows.length} records`}</span></div>
        {current.unavailable ? <div className="mc-module-notice"><AlertCircle size={20}/><div><strong>API endpoint not available</strong><p>{current.unavailable}</p></div></div> :
          error ? <div className="mc-module-error"><AlertCircle size={16}/>{error}</div> :
          tabLoading ? <p className="py-8 text-center text-sm text-slate-500">Loading records…</p> :
          rows.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No records found for this patient.</p> :
          <div className="overflow-x-auto"><table className="mc-data-table"><thead><tr>{Object.keys(rows[0]).filter(k => !/password|token/i.test(k)).slice(0,7).map(k => <th key={k}>{label(k)}</th>)}</tr></thead><tbody>{rows.map((row,i) => <tr key={String(row.id ?? i)}>{Object.entries(row).filter(([k]) => !/password|token/i.test(k)).slice(0,7).map(([k,v]) => <td key={k}>{safe(v)}</td>)}</tr>)}</tbody></table></div>}
      </section>}
  </div>
}
