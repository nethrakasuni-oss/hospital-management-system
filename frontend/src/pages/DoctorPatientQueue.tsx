import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { ChevronRight, RefreshCw, Search, Stethoscope, UserRound } from 'lucide-react'
import api from '../lib/api'

interface Appointment {
  id: number
  appointmentNo?: string
  scheduledAt?: string
  appointmentType?: string
  status?: string
  patient?: {
    id?: number
    patientNumber?: string
    firstName?: string
    lastName?: string
  }
  department?: { name?: string }
}

function todayLocal(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function unwrap(payload: unknown): Appointment[] {
  if (Array.isArray(payload)) return payload as Appointment[]
  if (payload && typeof payload === 'object') {
    const value = payload as { data?: unknown }
    if (Array.isArray(value.data)) return value.data as Appointment[]
  }
  return []
}

export default function DoctorPatientQueue() {
  const navigate = useNavigate()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [selectedDate, setSelectedDate] = useState(todayLocal())
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get('/appointments/daily', { params: { date: selectedDate } })
      setAppointments(unwrap(response.data))
    } catch (requestError: unknown) {
      if (axios.isAxiosError(requestError)) {
        const message = requestError.response?.data?.message
        setError(Array.isArray(message) ? message.join(', ') : String(message ?? 'Unable to load the patient queue.'))
      } else setError('Unable to load the patient queue.')
      setAppointments([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [selectedDate])

  const visible = useMemo(() => appointments
    .filter(appointment => statusFilter === 'ALL' || String(appointment.status ?? '').toUpperCase() === statusFilter)
    .filter(appointment => {
      const patient = appointment.patient
      const name = `${patient?.firstName ?? ''} ${patient?.lastName ?? ''}`.trim()
      const text = `${appointment.appointmentNo ?? ''} ${name} ${patient?.patientNumber ?? ''} ${appointment.appointmentType ?? ''}`.toLowerCase()
      return text.includes(search.trim().toLowerCase())
    })
    .sort((a, b) => new Date(a.scheduledAt ?? 0).getTime() - new Date(b.scheduledAt ?? 0).getTime()),
  [appointments, statusFilter, search])

  return (
    <div className="doctor-queue mc-dashboard">
      <section className="mc-welcome-row">
        <div>
          <p className="mc-eyebrow">CLINICAL WORKFLOW</p>
          <h2>Patient Queue</h2>
          <p>Review appointments and manage consultations.</p>
        </div>
        <button className="mc-secondary-button" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'mc-spin' : ''} /> Refresh
        </button>
      </section>

      {error && <div role="alert" className="doctor-error">{error}</div>}

      <section className="doctor-queue-toolbar mc-panel">
        <label className="doctor-queue-search">
          <Search size={16} />
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search patient, appointment or patient ID..." />
        </label>
        <input type="date" value={selectedDate} onChange={event => setSelectedDate(event.target.value)} aria-label="Queue date" />
        <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} aria-label="Appointment status">
          <option value="ALL">Today's appointments</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="NO_SHOW">No-show</option>
        </select>
      </section>

      <section className="mc-panel doctor-schedule">
        <div className="mc-panel-heading">
          <div>
            <h3>Patient appointments</h3>
            <p>{new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>
          <span className="mc-record-count">{loading ? 'Loading...' : `${visible.length} patients`}</span>
        </div>
        <div className="doctor-table-wrap">
          <table className="doctor-table">
            <thead>
              <tr>
                <th>Appointment No.</th><th>Patient</th><th>Patient ID</th><th>Date & time</th><th>Type</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="doctor-empty">Loading patient queue...</td></tr>
              ) : visible.length === 0 ? (
                <tr><td colSpan={7} className="doctor-empty"><div className="doctor-empty-state"><Stethoscope size={28}/><strong>No patients in this queue</strong><span>Try another date or status filter.</span></div></td></tr>
              ) : visible.map(appointment => {
                const status = String(appointment.status ?? 'SCHEDULED').toUpperCase()
                const patientId = appointment.patient?.id
                const canStart = ['SCHEDULED', 'CONFIRMED'].includes(status)
                return (
                  <tr key={appointment.id}>
                    <td className="doctor-appointment-no">{appointment.appointmentNo ?? `APT-${appointment.id}`}</td>
                    <td><div className="doctor-patient-name"><span><UserRound size={15}/></span>{[appointment.patient?.firstName, appointment.patient?.lastName].filter(Boolean).join(' ') || 'Patient'}</div></td>
                    <td>{appointment.patient?.patientNumber ?? (patientId ? `PT-${patientId}` : '—')}</td>
                    <td>{appointment.scheduledAt ? new Date(appointment.scheduledAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</td>
                    <td>{appointment.appointmentType?.replace('_', ' ') ?? 'In person'}</td>
                    <td><span className={`doctor-status ${status.toLowerCase().replace('_', '-')}`}>{status.replace('_', ' ')}</span></td>
                    <td>
                      <div className="doctor-queue-actions">
                        {patientId && <button type="button" onClick={() => navigate(`/patients/${patientId}`)}>View patient</button>}
                        {canStart && <button type="button" className="primary" onClick={() => navigate(`/patient-queue/${appointment.id}`)}>Start consultation <ChevronRight size={14}/></button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
