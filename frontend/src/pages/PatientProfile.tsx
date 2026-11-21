
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, UserRound, RefreshCw, AlertCircle, CalendarDays,
  FileText, Stethoscope, Activity, FlaskConical, ShieldCheck,
  Wallet, BedDouble, Pill
} from 'lucide-react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'

type Row = Record<string, any>

type Tab = {
  id: string
  label: string
  endpoint?: string
  icon: typeof UserRound
}

const allTabs: Tab[] = [
  { id: 'overview', label: 'Overview', icon: UserRound },
  { id: 'appointments', label: 'Appointments', endpoint: '/appointments', icon: CalendarDays },
  { id: 'history', label: 'Medical History', endpoint: 'history', icon: FileText },
  { id: 'nursing', label: 'Nursing Notes', endpoint: 'nursing-notes', icon: Stethoscope },
  { id: 'observations', label: 'Observations', endpoint: 'observations', icon: Activity },
  { id: 'laboratory', label: 'Laboratory', endpoint: '/laboratory/requests', icon: FlaskConical },
  { id: 'insurance', label: 'Insurance', endpoint: '/insurance/policies', icon: ShieldCheck },
  { id: 'billing', label: 'Billing', endpoint: '/billing/invoices', icon: Wallet },
  { id: 'admissions', label: 'Admissions', endpoint: '/inpatient/admissions', icon: BedDouble },
  { id: 'prescriptions', label: 'Prescriptions', endpoint: '/pharmacy/prescriptions', icon: Pill },
]

function toRows(payload: unknown): Row[] {
  if (Array.isArray(payload)) {
    return payload.filter(v => v && typeof v === 'object') as Row[]
  }

  if (payload && typeof payload === 'object') {
    const obj = payload as Row

    for (const key of ['data', 'items', 'results', 'records']) {
      if (Array.isArray(obj[key])) return obj[key] as Row[]
    }

    return [obj]
  }

  return []
}

function label(key: string) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())
}

function safe(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'

  if (typeof value === 'boolean') return value ? 'Yes' : 'No'

  if (typeof value === 'object') {
    return Array.isArray(value) ? `${value.length} records` : JSON.stringify(value)
  }

  return String(value)
}

function date(value: unknown) {
  if (!value) return '—'
  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? safe(value) : parsed.toLocaleDateString()
}

function statusClass(value: unknown) {
  const status = String(value ?? '').toUpperCase()

  if (['COMPLETED', 'DISCHARGED', 'ACTIVE', 'DISPENSED'].includes(status)) {
    return 'bg-green-100 text-green-700'
  }

  if (['ADMITTED', 'PENDING', 'PARTIALLY_DISPENSED'].includes(status)) {
    return 'bg-amber-100 text-amber-700'
  }

  if (['CANCELLED', 'REJECTED'].includes(status)) {
    return 'bg-red-100 text-red-700'
  }

  return 'bg-slate-100 text-slate-700'
}

export default function PatientProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const role = user?.role?.trim().toUpperCase()
  const isDoctor = role === 'DOCTOR'

  // Doctors do not receive the Billing tab.
  const tabs = useMemo(
    () => allTabs.filter(tab => !(isDoctor && tab.id === 'billing')),
    [isDoctor]
  )

  const backTarget = isDoctor ? '/dashboard' : '/patients'

  const [patient, setPatient] = useState<Row | null>(null)
  const [active, setActive] = useState('overview')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tabLoading, setTabLoading] = useState(false)

  const current = tabs.find(t => t.id === active) ?? tabs[0]

  const loadPatient = async () => {
    if (!id) return

    setLoading(true)
    setError('')

    try {
      const response = await api.get(`/patients/${id}`)
      setPatient(response.data as Row)
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Unable to load patient profile.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadPatient()
  }, [id])

  // Ensure active tab remains valid if role changes.
  useEffect(() => {
    if (!tabs.some(tab => tab.id === active)) {
      setActive('overview')
    }
  }, [tabs, active])

  useEffect(() => {
    let cancelled = false

    const loadTab = async () => {
      if (!id || active === 'overview' || !current.endpoint) {
        setRows([])
        setError('')
        return
      }

      setTabLoading(true)
      setError('')
      setRows([])

      try {
        let response

        if (active === 'history') {
          response = await api.get(`/medical-records/patient/${id}/history`)
        } else if (active === 'nursing') {
          response = await api.get(`/nursing/patients/${id}/notes`)
        } else if (active === 'observations') {
          response = await api.get(`/nursing/patients/${id}/observations`)
        } else {
          response = await api.get(current.endpoint, {
            params: { patientId: Number(id) }
          })
        }

        if (!cancelled) {
          setRows(toRows(response.data))
        }
      } catch (e: any) {
        if (!cancelled) {
          const message =
            e?.response?.data?.message ||
            e?.message ||
            'Unable to load patient records.'

          setRows([])
          setError(
            Array.isArray(message) ? message.join(', ') : String(message)
          )
        }
      } finally {
        if (!cancelled) setTabLoading(false)
      }
    }

    void loadTab()

    return () => {
      cancelled = true
    }
  }, [active, id, current.endpoint])

  const profileFields = useMemo(
    () =>
      patient
        ? Object.entries(patient)
            .filter(([k, v]) =>
              !/password|token/i.test(k) &&
              (v === null || ['string', 'number', 'boolean'].includes(typeof v))
            )
            .slice(0, 24)
        : [],
    [patient]
  )

  if (loading) {
    return <div className="mc-panel p-8">Loading patient profile...</div>
  }

  if (!patient) {
    return (
      <div className="mc-panel p-8">
        <p className="text-red-600">{error || 'Patient not found.'}</p>
        <button className="mc-secondary-button mt-4" onClick={() => navigate(backTarget)}>
          Back
        </button>
      </div>
    )
  }

  const fullName = `${safe(patient.firstName)} ${safe(patient.lastName)}`

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            className="mc-icon-button"
            onClick={() => navigate(backTarget)}
            aria-label="Back"
          >
            <ArrowLeft size={18} />
          </button>

          <div>
            <p className="mc-eyebrow">PATIENT MANAGEMENT / PROFILE</p>
            <h2 className="text-2xl font-bold text-slate-900">{fullName}</h2>
            <p className="text-sm text-slate-500">
              Patient ID: {safe(patient.patientNumber)}
            </p>
          </div>
        </div>

        <button className="mc-secondary-button" onClick={() => void loadPatient()}>
          <RefreshCw size={15} /> Refresh profile
        </button>
      </div>

      {/* Patient summary */}
      <section className="mc-panel flex flex-wrap items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-700 grid place-items-center">
          <UserRound size={28} />
        </div>

        <div className="flex-1 min-w-[180px]">
          <h3 className="font-bold text-slate-900">{fullName}</h3>
          <p className="text-xs text-slate-500">
            {safe(patient.gender)} · {safe(patient.bloodGroup)} · {safe(patient.phone)}
          </p>
        </div>

        <div className="text-sm">
          <span className="text-slate-400 block text-xs">Email</span>
          {safe(patient.email)}
        </div>

        <div className="text-sm">
          <span className="text-slate-400 block text-xs">Date of birth</span>
          {date(patient.dateOfBirth)}
        </div>
      </section>

      {/* Navigation */}
      <section className="mc-panel p-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map(tab => {
            const Icon = tab.icon

            return (
              <button
                key={tab.id}
                onClick={() => setActive(tab.id)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold ${
                  active === tab.id
                    ? 'bg-[#142b49] text-white'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            )
          })}
        </div>
      </section>

      {/* Overview */}
      {active === 'overview' ? (
        <section className="mc-panel">
          <div className="mc-panel-heading mb-4">
            <div>
              <h3>Patient information</h3>
              <p>Information returned by the patient record API</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {profileFields.map(([key, value]) => (
              <div className="rounded-lg bg-slate-50 p-3" key={key}>
                <span className="block text-xs text-slate-500">{label(key)}</span>
                <strong className="mt-1 block break-words text-sm text-slate-800">
                  {safe(value)}
                </strong>
              </div>
            ))}
          </div>
        </section>
      ) : (

        /* Patient records */
        <section className="mc-panel">
          <div className="mc-panel-heading mb-4">
            <div>
              <h3>{current.label}</h3>
              <p>Patient-specific records from the hospital API</p>
            </div>

            <span className="mc-record-count">
              {tabLoading ? 'Loading...' : `${rows.length} records`}
            </span>
          </div>

          {error ? (
            <div className="mc-module-error">
              <AlertCircle size={16} />
              {error}
            </div>
          ) : tabLoading ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Loading records...
            </p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No records found for this patient.
            </p>
          ) : active === 'prescriptions' ? (

            /* Prescription cards */
            <div className="space-y-4">
              {rows.map((prescription, index) => (
                <div
                  key={prescription.id ?? index}
                  className="rounded-xl border border-slate-200 p-4 space-y-3"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-slate-800">
                        Prescription #{safe(prescription.id)}
                      </h4>
                      <p className="text-xs text-slate-500">
                        Date: {date(prescription.createdAt)}
                      </p>
                    </div>

                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(prescription.status)}`}>
                      {safe(prescription.status)}
                    </span>
                  </div>

                  <p className="text-sm text-slate-600">
                    Doctor: {safe(prescription.doctor?.user?.firstName)}{' '}
                    {safe(prescription.doctor?.user?.lastName)}
                  </p>

                  {prescription.notes && (
                    <p className="text-sm text-slate-600">
                      Notes: {safe(prescription.notes)}
                    </p>
                  )}

                  <div className="overflow-x-auto">
                    <table className="mc-data-table">
                      <thead>
                        <tr>
                          <th>Medicine</th>
                          <th>Dosage</th>
                          <th>Frequency</th>
                          <th>Duration</th>
                          <th>Quantity</th>
                          <th>Instructions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(prescription.items ?? []).map((item: Row, i: number) => (
                          <tr key={item.id ?? i}>
                            <td>{safe(item.medicineName || item.medicine?.name)}</td>
                            <td>{safe(item.dosage)}</td>
                            <td>{safe(item.frequency)}</td>
                            <td>{safe(item.duration)}</td>
                            <td>{safe(item.quantity)}</td>
                            <td>{safe(item.instructions)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>

          ) : active === 'admissions' ? (

            /* Admission cards */
            <div className="space-y-4">
              {rows.map((admission, index) => {
                const room = admission.bed?.room
                const ward = room?.ward

                return (
                  <div
                    key={admission.id ?? index}
                    className="rounded-xl border border-slate-200 p-4 space-y-3"
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <h4 className="font-bold text-slate-800">
                        Admission #{safe(admission.id)}
                      </h4>

                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(admission.status)}`}>
                        {safe(admission.status)}
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <span className="block text-xs text-slate-500">Admission date</span>
                        <strong className="text-sm">{date(admission.admissionDate)}</strong>
                      </div>

                      <div>
                        <span className="block text-xs text-slate-500">Discharge date</span>
                        <strong className="text-sm">{date(admission.dischargeDate)}</strong>
                      </div>

                      <div>
                        <span className="block text-xs text-slate-500">Ward</span>
                        <strong className="text-sm">{safe(ward?.name)}</strong>
                      </div>

                      <div>
                        <span className="block text-xs text-slate-500">Room</span>
                        <strong className="text-sm">{safe(room?.roomNumber)}</strong>
                      </div>

                      <div>
                        <span className="block text-xs text-slate-500">Bed</span>
                        <strong className="text-sm">{safe(admission.bed?.bedNumber)}</strong>
                      </div>

                      <div>
                        <span className="block text-xs text-slate-500">Reason</span>
                        <strong className="text-sm">{safe(admission.reason)}</strong>
                      </div>
                    </div>

                    {admission.dischargeSummary && (
                      <div className="rounded-lg bg-slate-50 p-3">
                        <h5 className="font-semibold text-sm mb-2">
                          Discharge Summary
                        </h5>
                        <p className="text-sm">
                          Diagnosis: {safe(admission.dischargeSummary.principalDiagnosis)}
                        </p>
                        <p className="text-sm">
                          Treatment: {safe(admission.dischargeSummary.treatmentSummary)}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

          ) : (

            /* Other existing patient records */
            <div className="overflow-x-auto">
              <table className="mc-data-table">
                <thead>
                  <tr>
                    {Object.keys(rows[0])
                      .filter(k => !/password|token/i.test(k))
                      .slice(0, 7)
                      .map(k => <th key={k}>{label(k)}</th>)}
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row, i) => (
                    <tr key={String(row.id ?? i)}>
                      {Object.entries(row)
                        .filter(([k]) => !/password|token/i.test(k))
                        .slice(0, 7)
                        .map(([k, v]) => <td key={k}>{safe(v)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
