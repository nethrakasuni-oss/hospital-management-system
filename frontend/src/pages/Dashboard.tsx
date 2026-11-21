import { useEffect, useState } from 'react'
import { Activity, BedDouble, CalendarDays, ClipboardList, RefreshCw, Stethoscope, Users, ArrowUpRight, CircleCheck, Clock3, Wallet, FlaskConical, Pill } from 'lucide-react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'

function countOf(data: unknown): number | null {
  if (Array.isArray(data)) return data.length
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    for (const key of ['total', 'count', 'totalPatients', 'totalDoctors', 'totalAppointments']) {
      if (typeof d[key] === 'number') return d[key] as number
    }
    for (const key of ['data', 'items', 'results', 'records']) if (Array.isArray(d[key])) return (d[key] as unknown[]).length
  }
  return null
}

function metricOf(data: unknown, keys: string[]): number | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const record = data as Record<string, unknown>
  for (const key of keys) if (typeof record[key] === 'number') return record[key] as number
  for (const value of Object.values(record)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = metricOf(value, keys)
      if (nested !== null) return nested
    }
  }
  return null
}

const money = (value: number | null) => value === null ? '—' : `LKR ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`

export default function Dashboard() {
  const { user } = useAuth()
  const [counts, setCounts] = useState({
    patients: null as number | null,
    doctors: null as number | null,
    appointments: null as number | null,
    availableBeds: null as number | null,
    revenue: null as number | null,
    labRequests: null as number | null,
    pharmacyAlerts: null as number | null,
  })
  const [loading, setLoading] = useState(true)
  const [checkedAt, setCheckedAt] = useState<Date | null>(null)

  const refresh = async () => {
    setLoading(true)
    const [p, d, a, inpatient, billing, laboratory, pharmacy] = await Promise.allSettled([
      api.get('/patients'),
      api.get('/doctors'),
      api.get('/appointments/daily'),
      api.get('/inpatient/dashboard'),
      api.get('/billing/statistics/overview'),
      api.get('/laboratory/statistics/overview'),
      api.get('/pharmacy/dashboard'),
    ])
    const data = (result: PromiseSettledResult<any>) => result.status === 'fulfilled' ? result.value.data : null
    const inpatientData = data(inpatient)
    const billingData = data(billing)
    const labData = data(laboratory)
    const pharmacyData = data(pharmacy)
    setCounts({
      patients: p.status === 'fulfilled' ? countOf(p.value.data) : null,
      doctors: d.status === 'fulfilled' ? countOf(d.value.data) : null,
      appointments: a.status === 'fulfilled' ? countOf(a.value.data) : null,
      availableBeds: metricOf(inpatientData, ['availableBeds']),
      revenue: metricOf(billingData, ['totalRevenue', 'totalCollected', 'revenue', 'collectedAmount']),
      labRequests: metricOf(labData, ['totalRequests', 'pendingRequests', 'total', 'count']),
      pharmacyAlerts: metricOf(pharmacyData, ['lowStockCount', 'lowStockItems', 'expiringSoon', 'alertsCount']),
    })
    setCheckedAt(new Date())
    setLoading(false)
  }

  useEffect(() => { void refresh() }, [])

  const cards = [
    { label: 'Total patients', value: counts.patients, display: counts.patients?.toLocaleString() ?? '—', icon: Users, tone: 'blue', hint: 'Registered patient records' },
    { label: 'Medical doctors', value: counts.doctors, display: counts.doctors?.toLocaleString() ?? '—', icon: Stethoscope, tone: 'teal', hint: 'Doctor directory' },
    { label: "Today's appointments", value: counts.appointments, display: counts.appointments?.toLocaleString() ?? '—', icon: CalendarDays, tone: 'violet', hint: 'Daily appointment schedule' },
    { label: 'Available beds', value: counts.availableBeds, display: counts.availableBeds?.toLocaleString() ?? '—', icon: BedDouble, tone: 'amber', hint: 'Inpatient bed availability' },
    { label: 'Revenue summary', value: counts.revenue, display: money(counts.revenue), icon: Wallet, tone: 'teal', hint: 'Backend billing statistics' },
    { label: 'Laboratory requests', value: counts.labRequests, display: counts.labRequests?.toLocaleString() ?? '—', icon: FlaskConical, tone: 'blue', hint: 'Laboratory overview' },
    { label: 'Pharmacy alerts', value: counts.pharmacyAlerts, display: counts.pharmacyAlerts?.toLocaleString() ?? '—', icon: Pill, tone: 'amber', hint: 'Stock and expiry alerts' },
  ]

  return <div className="mc-dashboard">
    <section className="mc-welcome-row"><div><p className="mc-eyebrow">HOSPITAL OVERVIEW</p><h2>Good day, {user?.firstName || 'there'} <span>👋</span></h2><p>Here is the latest overview of your hospital workspace.</p></div><button className="mc-secondary-button" onClick={() => void refresh()} disabled={loading}><RefreshCw size={16} className={loading ? 'mc-spin' : ''}/> Refresh data</button></section>
    <section className="mc-metric-grid">{cards.map(card => <article className="mc-metric-card" key={card.label}><div className="mc-metric-top"><span>{card.label}</span><div className={`mc-metric-icon ${card.tone}`}><card.icon size={20}/></div></div><div className="mc-metric-value">{loading ? <span className="mc-skeleton"/> : card.display}</div><div className="mc-metric-foot"><span>{card.hint}</span><ArrowUpRight size={15}/></div></article>)}</section>
    <section className="mc-dashboard-grid">
      <article className="mc-panel"><div className="mc-panel-heading"><div><h3>Operational overview</h3><p>Hospital module overview</p></div><span className="mc-live-pill"><i/> Workspace</span></div>
        <div className="mc-overview-list">
          <div className="mc-overview-item"><span className="mc-overview-symbol blue"><Users size={18}/></span><div><strong>Patient management</strong><small>Registration and patient records</small></div><span className="mc-status-tag">Connected</span></div>
          <div className="mc-overview-item"><span className="mc-overview-symbol teal"><Stethoscope size={18}/></span><div><strong>Doctor management</strong><small>Medical staff directory</small></div><span className="mc-status-tag">Connected</span></div>
          <div className="mc-overview-item"><span className="mc-overview-symbol violet"><CalendarDays size={18}/></span><div><strong>Appointments</strong><small>Scheduling and appointment records</small></div><span className="mc-status-tag">Connected</span></div>
          <div className="mc-overview-item"><span className="mc-overview-symbol amber"><ClipboardList size={18}/></span><div><strong>Clinical operations</strong><small>Nursing, emergency, inpatient and discharge workflows</small></div><span className="mc-status-tag">Connected</span></div>
        </div>
      </article>
      <article className="mc-panel"><div className="mc-panel-heading"><div><h3>API connectivity</h3><p>Latest dashboard data request</p></div><Activity size={19} className="mc-muted-icon"/></div>
        <div className="mc-status-summary"><div className="mc-status-check"><CircleCheck size={19}/></div><div><strong>Overview check completed</strong><span>Figures are only shown when returned by the API</span></div></div>
        {[['Patients', counts.patients], ['Doctors', counts.doctors], ['Appointments', counts.appointments], ['Available beds', counts.availableBeds], ['Revenue', counts.revenue], ['Laboratory requests', counts.labRequests], ['Pharmacy alerts', counts.pharmacyAlerts]].map(([name, value]) => <div className="mc-status-line" key={String(name)}><span>{name}</span><strong>{value === null ? 'Unavailable' : 'Responding'}</strong></div>)}
        <div className="mc-last-updated"><Clock3 size={14}/>{checkedAt ? `Checked at ${checkedAt.toLocaleTimeString()}` : 'Waiting for first check'}</div>
      </article>
    </section>
    <p className="mc-data-note">Revenue, laboratory and pharmacy figures depend on the current user's API permissions and the fields returned by each backend endpoint. Unavailable values are not replaced with sample statistics.</p>
  </div>
}
