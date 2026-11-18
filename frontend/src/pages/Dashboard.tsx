import { useEffect, useState } from 'react'
import { Activity, BedDouble, CalendarDays, ClipboardList, RefreshCw, Stethoscope, Users, ArrowUpRight, CircleCheck, Clock3 } from 'lucide-react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'

function countOf(data: unknown): number | null {
  if (Array.isArray(data)) return data.length
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    for (const k of ['total','count','totalPatients','totalDoctors','totalAppointments']) if (typeof d[k] === 'number') return d[k] as number
    if (Array.isArray(d.data)) return d.data.length
  }
  return null
}
export default function Dashboard() {
  const { user } = useAuth()
  const [counts, setCounts] = useState({ patients: null as number | null, doctors: null as number | null, appointments: null as number | null })
  const [loading, setLoading] = useState(true)
  const [checkedAt, setCheckedAt] = useState<Date | null>(null)
  const refresh = async () => {
    setLoading(true)
    const [p,d,a] = await Promise.allSettled([api.get('/patients'),api.get('/doctors'),api.get('/appointments')])
    setCounts({ patients: p.status === 'fulfilled' ? countOf(p.value.data) : null, doctors: d.status === 'fulfilled' ? countOf(d.value.data) : null, appointments: a.status === 'fulfilled' ? countOf(a.value.data) : null })
    setCheckedAt(new Date()); setLoading(false)
  }
  useEffect(() => { void refresh() }, [])
  const cards = [
    { label: 'Registered patients', value: counts.patients, icon: Users, tone: 'blue', hint: 'Live patient records' },
    { label: 'Medical doctors', value: counts.doctors, icon: Stethoscope, tone: 'teal', hint: 'Doctor directory' },
    { label: 'Appointments', value: counts.appointments, icon: CalendarDays, tone: 'violet', hint: 'Appointment records' },
    { label: 'Bed availability', value: null, icon: BedDouble, tone: 'amber', hint: 'Bed statistics not connected' },
  ]
  return <div className="mc-dashboard">
    <section className="mc-welcome-row"><div><p className="mc-eyebrow">HOSPITAL OVERVIEW</p><h2>Good day, {user?.firstName || 'there'} <span>👋</span></h2><p>Here is the latest overview of your hospital workspace.</p></div><button className="mc-secondary-button" onClick={() => void refresh()} disabled={loading}><RefreshCw size={16} className={loading ? 'mc-spin' : ''}/> Refresh data</button></section>
    <section className="mc-metric-grid">{cards.map(c => <article className="mc-metric-card" key={c.label}><div className="mc-metric-top"><span>{c.label}</span><div className={`mc-metric-icon ${c.tone}`}><c.icon size={20}/></div></div><div className="mc-metric-value">{loading ? <span className="mc-skeleton"/> : c.value === null ? '—' : c.value.toLocaleString()}</div><div className="mc-metric-foot"><span>{c.value === null ? c.hint : c.hint}</span><ArrowUpRight size={15}/></div></article>)}</section>
    <section className="mc-dashboard-grid">
      <article className="mc-panel"><div className="mc-panel-heading"><div><h3>Operational overview</h3><p>Hospital module overview</p></div><span className="mc-live-pill"><i/> Workspace</span></div>
        <div className="mc-overview-list">
          <div className="mc-overview-item"><span className="mc-overview-symbol blue"><Users size={18}/></span><div><strong>Patient management</strong><small>Registration and patient records</small></div><span className="mc-status-tag">Available</span></div>
          <div className="mc-overview-item"><span className="mc-overview-symbol teal"><Stethoscope size={18}/></span><div><strong>Doctor management</strong><small>Medical staff directory</small></div><span className="mc-status-tag">API connected</span></div>
          <div className="mc-overview-item"><span className="mc-overview-symbol violet"><CalendarDays size={18}/></span><div><strong>Appointments</strong><small>Scheduling and appointment records</small></div><span className="mc-status-tag">API connected</span></div>
          <div className="mc-overview-item"><span className="mc-overview-symbol amber"><ClipboardList size={18}/></span><div><strong>Clinical operations</strong><small>Nursing, emergency and discharge workflows</small></div><span className="mc-planned-tag">Next integration</span></div>
        </div>
      </article>
      <article className="mc-panel"><div className="mc-panel-heading"><div><h3>API connectivity</h3><p>Latest dashboard data request</p></div><Activity size={19} className="mc-muted-icon"/></div>
        <div className="mc-status-summary"><div className="mc-status-check"><CircleCheck size={19}/></div><div><strong>Overview check completed</strong><span>Individual endpoint results below</span></div></div>
        {[['Patients',counts.patients],['Doctors',counts.doctors],['Appointments',counts.appointments]].map(([name,value]) => <div className="mc-status-line" key={String(name)}><span>{name}</span><strong>{value === null ? 'Unavailable' : 'Responding'}</strong></div>)}
        <div className="mc-last-updated"><Clock3 size={14}/>{checkedAt ? `Checked at ${checkedAt.toLocaleTimeString()}` : 'Waiting for first check'}</div>
      </article>
    </section>
    <p className="mc-data-note">Figures are retrieved from your backend. A dash means the endpoint or response format is unavailable; sample statistics are not displayed.</p>
  </div>
}
