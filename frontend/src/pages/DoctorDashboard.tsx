import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock3,
  RefreshCw,
  Stethoscope,
  UserRound,
  UserX,
} from 'lucide-react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'

interface AppointmentPatient {
  id?: number
  firstName?: string
  lastName?: string
  patientNumber?: string
  patientNo?: string
}

interface Appointment {
  id: number
  appointmentNo?: string
  scheduledAt?: string
  status?: string
  patient?: AppointmentPatient
  department?: { id?: number; name?: string }
}

function todayLocal(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function addLocalDays(dateString: string, amount: number): string {
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day + amount)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatSelectedDate(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function unwrapAppointments(payload: unknown): Appointment[] {
  if (Array.isArray(payload)) return payload as Appointment[]
  if (payload && typeof payload === 'object') {
    const value = payload as { data?: unknown; appointments?: unknown }
    if (Array.isArray(value.data)) return value.data as Appointment[]
    if (Array.isArray(value.appointments)) return value.appointments as Appointment[]
  }
  return []
}

function patientName(patient?: AppointmentPatient): string {
  if (!patient) return 'Patient'
  return [patient.firstName, patient.lastName].filter(Boolean).join(' ') || 'Patient'
}

function statusClass(status: string): string {
  switch (status) {
    case 'COMPLETED': return 'completed'
    case 'CONFIRMED': return 'confirmed'
    case 'SCHEDULED': return 'scheduled'
    case 'CANCELLED': return 'cancelled'
    case 'NO_SHOW': return 'no-show'
    default: return 'scheduled'
  }
}

export default function DoctorDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [selectedDate, setSelectedDate] = useState(todayLocal())
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError('')

      try {
        const response = await api.get('/appointments/daily', {
          params: { date: selectedDate },
        })
        if (!cancelled) setAppointments(unwrapAppointments(response.data))
      } catch (requestError: unknown) {
        if (!cancelled) {
          if (axios.isAxiosError(requestError)) {
            const message = requestError.response?.data?.message
            setError(Array.isArray(message) ? message.join(', ') : String(message ?? 'Unable to load your appointment schedule.'))
          } else {
            setError('Unable to load your appointment schedule.')
          }
          setAppointments([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [selectedDate])

  const refresh = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get('/appointments/daily', {
        params: { date: selectedDate },
      })
      setAppointments(unwrapAppointments(response.data))
    } catch (requestError: unknown) {
      if (axios.isAxiosError(requestError)) {
        const message = requestError.response?.data?.message
        setError(Array.isArray(message) ? message.join(', ') : String(message ?? 'Unable to load your appointment schedule.'))
      } else {
        setError('Unable to load your appointment schedule.')
      }
      setAppointments([])
    } finally {
      setLoading(false)
    }
  }

  const sortedAppointments = useMemo(
    () => [...appointments].sort((a, b) => {
      const aTime = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0
      const bTime = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0
      return aTime - bTime
    }),
    [appointments],
  )

  const stats = useMemo(() => {
    const statuses = appointments.map(appointment => String(appointment.status ?? '').toUpperCase())
    return {
      appointments: statuses.filter(status => status !== 'CANCELLED').length,
      waiting: statuses.filter(status => status === 'SCHEDULED' || status === 'CONFIRMED').length,
      completed: statuses.filter(status => status === 'COMPLETED').length,
      noShow: statuses.filter(status => status === 'NO_SHOW').length,
    }
  }, [appointments])

  const cards = [
    { label: "Today's Appointments", value: stats.appointments, icon: CalendarDays, tone: 'blue' },
    { label: 'Waiting Patients', value: stats.waiting, icon: Clock3, tone: 'amber' },
    { label: 'Completed Consultations', value: stats.completed, icon: CircleCheck, tone: 'teal' },
    { label: 'No Show', value: stats.noShow, icon: UserX, tone: 'rose' },
  ]

  return (
    <div className="mc-dashboard doctor-dashboard">
      <section className="mc-welcome-row">
        <div>
          <p className="mc-eyebrow">DOCTOR WORKSPACE</p>
          <h2>Welcome, Dr. {user?.firstName ?? ''} {user?.lastName ?? ''}</h2>
          <p>{formatSelectedDate(selectedDate)}</p>
        </div>

        <button className="mc-secondary-button" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'mc-spin' : ''} />
          Refresh
        </button>
      </section>

      <section className="doctor-date-nav" aria-label="Appointment date navigation">
        <button type="button" onClick={() => setSelectedDate(todayLocal())} className={selectedDate === todayLocal() ? 'active' : ''}>
          Today
        </button>
        <button type="button" onClick={() => setSelectedDate(addLocalDays(selectedDate, -1))} aria-label="Previous day">
          <ChevronLeft size={16} />
          Previous
        </button>
        <button type="button" onClick={() => setSelectedDate(addLocalDays(selectedDate, 1))} aria-label="Next day">
          Next
          <ChevronRight size={16} />
        </button>
        <label>
          <CalendarDays size={16} />
          <input
            type="date"
            value={selectedDate}
            onChange={event => {
              if (event.target.value) setSelectedDate(event.target.value)
            }}
            aria-label="Select appointment date"
          />
        </label>
      </section>

      {error && (
        <div role="alert" className="doctor-error">
          {error}
        </div>
      )}

      <section className="mc-metric-grid">
        {cards.map(card => (
          <article className="mc-metric-card" key={card.label}>
            <div className="mc-metric-top">
              <span>{card.label}</span>
              <div className={`mc-metric-icon ${card.tone}`}>
                <card.icon size={20} />
              </div>
            </div>
            <div className="mc-metric-value">
              {loading ? <span className="mc-skeleton" /> : card.value.toLocaleString()}
            </div>
          </article>
        ))}
      </section>

      <section className="mc-panel doctor-schedule">
        <div className="mc-panel-heading">
          <div>
            <h3>Appointment Schedule</h3>
            <p>{formatSelectedDate(selectedDate)}</p>
          </div>
          <span className="mc-live-pill">
            <i />
            {loading ? 'Loading' : `${sortedAppointments.length} appointments`}
          </span>
        </div>

        <div className="doctor-table-wrap">
          <table className="doctor-table">
            <thead>
              <tr>
                <th>Appointment</th>
                <th>Patient</th>
                <th>Patient No.</th>
                <th>Time</th>
                <th>Department</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="doctor-empty">Loading appointment schedule…</td>
                </tr>
              ) : sortedAppointments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="doctor-empty">
                    <div className="doctor-empty-state">
                      <Stethoscope size={28} />
                      <strong>No appointments scheduled</strong>
                      <span>There are no appointments for this date.</span>
                    </div>
                  </td>
                </tr>
              ) : sortedAppointments.map(appointment => {
                const status = String(appointment.status ?? 'SCHEDULED').toUpperCase()
                const patientId = appointment.patient?.id
                return (
                  <tr key={appointment.id}>
                    <td className="doctor-appointment-no">{appointment.appointmentNo ?? `APT-${appointment.id}`}</td>
                    <td>
                      <div className="doctor-patient-name">
                        <span><UserRound size={15} /></span>
                        {patientName(appointment.patient)}
                      </div>
                    </td>
                    <td>{appointment.patient?.patientNumber ?? appointment.patient?.patientNo ?? (patientId ? `PT-${patientId}` : '—')}</td>
                    <td>
                      {appointment.scheduledAt
                        ? new Date(appointment.scheduledAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </td>
                    <td>{appointment.department?.name ?? '—'}</td>
                    <td>
                      <span className={`doctor-status ${statusClass(status)}`}>
                        {status.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      {patientId ? (
                        <button
                          type="button"
                          className="doctor-view-button"
                          onClick={() => navigate(`/patients/${patientId}`)}
                        >
                          View patient
                        </button>
                      ) : <span className="doctor-muted-action">Unavailable</span>}
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
