
import { useEffect, useState } from 'react'
import {
  Users,
  CalendarDays,
  Clock,
  Ambulance,
  UserPlus,
  Search,
  CalendarPlus,
  RefreshCw,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'

interface Patient {
  id: number
  firstName?: string
  lastName?: string
}

interface Appointment {
  id: number
  appointmentNo?: string
  scheduledAt?: string
  status?: string
  patient?: Patient
  doctor?: {
    user?: {
      firstName?: string
      lastName?: string
    }
  }
}

export default function ReceptionDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [patients, setPatients] = useState<Patient[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    setLoading(true)

    const [p, a] = await Promise.allSettled([
      api.get('/patients'),
      api.get('/appointments'),
    ])

    if (p.status === 'fulfilled') {
      const data = p.value.data
      setPatients(Array.isArray(data) ? data : data?.data ?? [])
    }

    if (a.status === 'fulfilled') {
      const data = a.value.data
      setAppointments(Array.isArray(data) ? data : data?.data ?? [])
    }

    setLoading(false)
  }

  useEffect(() => {
    void refresh()
  }, [])

  const today = new Date().toDateString()

  const todayAppointments = appointments.filter(
    a => a.scheduledAt &&
      new Date(a.scheduledAt).toDateString() === today
  )

  const pending = todayAppointments.filter(
    a => ['SCHEDULED', 'CONFIRMED'].includes(
      (a.status ?? '').toUpperCase()
    )
  )

  const cards = [
    {
      title: 'Registered Patients',
      value: patients.length,
      icon: Users,
      color: 'blue',
    },
    {
      title: "Today's Appointments",
      value: todayAppointments.length,
      icon: CalendarDays,
      color: 'teal',
    },
    {
      title: 'Pending Appointments',
      value: pending.length,
      icon: Clock,
      color: 'amber',
    },
    {
      title: 'Emergency Arrivals',
      value: '—',
      icon: Ambulance,
      color: 'rose',
    },
  ]

  return (
    <div className="mc-dashboard">
      <section className="mc-welcome-row">
        <div>
          <p className="mc-eyebrow">RECEPTION WORKSPACE</p>
          <h2>Welcome, {user?.firstName || 'Receptionist'}</h2>
          <p>Manage patient registration and hospital appointments.</p>
        </div>

        <button
          className="mc-secondary-button"
          onClick={() => void refresh()}
          disabled={loading}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </section>

      <section className="mc-metric-grid">
        {cards.map(card => (
          <article className="mc-metric-card" key={card.title}>
            <div className="mc-metric-top">
              <span>{card.title}</span>
              <div className={`mc-metric-icon ${card.color}`}>
                <card.icon size={20} />
              </div>
            </div>

            <div className="mc-metric-value">
              {loading ? '...' : card.value}
            </div>
          </article>
        ))}
      </section>

      <section className="mc-panel">
        <div className="mc-panel-heading">
          <div>
            <h3>Reception Quick Actions</h3>
            <p>Frequently used reception services</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
          <button
            className="mc-secondary-button"
            onClick={() => navigate('/patients')}
          >
            <UserPlus size={18} />
            Register / View Patients
          </button>

          <button
            className="mc-secondary-button"
            onClick={() => navigate('/appointments')}
          >
            <CalendarPlus size={18} />
            Manage Appointments
          </button>

          <button
            className="mc-secondary-button"
            onClick={() => navigate('/patients')}
          >
            <Search size={18} />
            Search Patients
          </button>

          <button
            className="mc-secondary-button"
            onClick={() => navigate('/emergency')}
          >
            <Ambulance size={18} />
            Emergency Registration
          </button>
        </div>
      </section>

      <section className="mc-panel mt-5">
        <div className="mc-panel-heading">
          <div>
            <h3>Today's Appointments</h3>
            <p>Appointments scheduled for today</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr>
                <th className="p-4">Appointment No.</th>
                <th className="p-4">Patient</th>
                <th className="p-4">Time</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>

            <tbody>
              {todayAppointments.map(a => (
                <tr key={a.id} className="border-t">
                  <td className="p-4">{a.appointmentNo ?? a.id}</td>
                  <td className="p-4">
                    {a.patient
                      ? `${a.patient.firstName ?? ''} ${a.patient.lastName ?? ''}`
                      : 'Patient'}
                  </td>
                  <td className="p-4">
                    {a.scheduledAt
                      ? new Date(a.scheduledAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </td>
                  <td className="p-4">{a.status ?? '—'}</td>
                </tr>
              ))}

              {!loading && todayAppointments.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-slate-500">
                    No appointments scheduled for today.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
