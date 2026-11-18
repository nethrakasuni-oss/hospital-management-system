import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Eye, RefreshCw, Search } from 'lucide-react'
import api from '../lib/api'

type Resource = { label: string; endpoint: string; description?: string }
type ModuleConfig = { title: string; description: string; resources: Resource[]; unavailable?: string }

export const moduleConfigs: Record<string, ModuleConfig> = {
  appointments: { title: 'Appointments', description: 'Manage appointment schedules and patient visits.', resources: [{ label: 'All appointments', endpoint: '/appointments' }, { label: 'Today', endpoint: '/appointments/daily' }, { label: 'Overview statistics', endpoint: '/appointments/statistics/overview' }] },
  doctors: { title: 'Doctors', description: 'Doctor directory, specializations and clinical schedules.', resources: [{ label: 'Doctor directory', endpoint: '/doctors' }, { label: 'Specializations', endpoint: '/doctors/specializations' }, { label: 'Pending leave requests', endpoint: '/doctors/leaves/pending' }] },
  departments: { title: 'Departments', description: 'Hospital departments, staffing and department leadership.', resources: [{ label: 'All departments', endpoint: '/departments' }, { label: 'Active departments', endpoint: '/departments/active' }, { label: 'Staffing overview', endpoint: '/departments/statistics/staffing' }] },
  admissions: { title: 'Admissions & Beds', description: 'Admission and bed management workspace.', resources: [], unavailable: 'The uploaded backend currently has Admission and Bed data models, but no admissions or beds controller is registered. The screens can be connected when those API endpoints are added.' },
  medicalRecords: { title: 'Medical Records', description: 'Clinical history, diagnoses, symptoms and treatment records.', resources: [{ label: 'Medical records', endpoint: '/medical-records' }, { label: 'Overview statistics', endpoint: '/medical-records/statistics/overview' }] },
  nursing: { title: 'Nursing', description: 'Nursing assignments, clinical notes and patient observations.', resources: [{ label: 'Assignments', endpoint: '/nursing/assignments' }] },
  emergency: { title: 'Emergency', description: 'Emergency visits and triage workflow.', resources: [{ label: 'Emergency visits', endpoint: '/emergency/visits' }] },
  surgeries: { title: 'Surgery & Theatre', description: 'Surgery bookings and operating theatre availability.', resources: [{ label: 'Surgery bookings', endpoint: '/surgeries' }, { label: 'Operating theatres', endpoint: '/operation-theatres' }] },
  transfers: { title: 'Transfers & Discharge', description: 'Patient transfer requests and discharge summaries.', resources: [{ label: 'Patient transfers', endpoint: '/patient-transfers' }, { label: 'Discharge summaries', endpoint: '/discharge' }] },
  laboratory: { title: 'Laboratory', description: 'Test catalogue, laboratory requests and results.', resources: [{ label: 'Test catalogue', endpoint: '/laboratory/tests' }, { label: 'Lab requests', endpoint: '/laboratory/requests' }, { label: 'Overview statistics', endpoint: '/laboratory/statistics/overview' }] },
  pharmacy: { title: 'Pharmacy', description: 'Medicine catalogue, stock levels and dispensing.', resources: [{ label: 'Medicines', endpoint: '/pharmacy/medicines' }, { label: 'Categories', endpoint: '/pharmacy/categories' }, { label: 'Stock overview', endpoint: '/pharmacy/stock/overview' }, { label: 'Stock transactions', endpoint: '/pharmacy/stock/transactions' }] },
  insurance: { title: 'Insurance', description: 'Insurance providers, patient policies and claims.', resources: [{ label: 'Providers', endpoint: '/insurance/providers' }, { label: 'Patient policies', endpoint: '/insurance/policies' }, { label: 'Claims', endpoint: '/insurance/claims' }, { label: 'Overview statistics', endpoint: '/insurance/statistics/overview' }] },
  billing: { title: 'Billing & Payments', description: 'Invoices, payment records and revenue overview.', resources: [{ label: 'Invoices', endpoint: '/billing/invoices' }, { label: 'Revenue by method', endpoint: '/billing/statistics/revenue-by-method' }, { label: 'Overview statistics', endpoint: '/billing/statistics/overview' }] },
  employees: { title: 'Staff & Attendance', description: 'Employee directory, attendance and leave workflows.', resources: [{ label: 'Employees', endpoint: '/employees' }, { label: 'Attendance records', endpoint: '/attendance' }, { label: 'Daily attendance', endpoint: '/attendance/daily' }, { label: 'Pending attendance corrections', endpoint: '/attendance/corrections/pending' }] },
  procurement: { title: 'Procurement', description: 'Suppliers, purchase orders and medicine procurement.', resources: [{ label: 'Suppliers', endpoint: '/pharmacy-procurement/suppliers' }, { label: 'Purchase orders', endpoint: '/pharmacy-procurement/purchase-orders' }] },
  administration: { title: 'Administration', description: 'Users, roles, permissions, system settings and audit history.', resources: [{ label: 'Users', endpoint: '/administration/users' }, { label: 'Roles', endpoint: '/administration/roles' }, { label: 'Permissions', endpoint: '/administration/permissions' }, { label: 'System settings', endpoint: '/administration/settings' }, { label: 'Audit logs', endpoint: '/administration/audit-logs' }] },
  notifications: { title: 'Notifications', description: 'System alerts and user notification history.', resources: [{ label: 'All notifications', endpoint: '/notifications' }, { label: 'Unread count', endpoint: '/notifications/unread-count' }] },
}

function rowsFrom(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter(x => x && typeof x === 'object') as Record<string, unknown>[]
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>
    for (const key of ['data', 'items', 'results', 'records']) {
      if (Array.isArray(obj[key])) return (obj[key] as unknown[]).filter(x => x && typeof x === 'object') as Record<string, unknown>[]
    }
    return [obj]
  }
  return []
}
function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') return Array.isArray(value) ? `${value.length} items` : '[View details]'
  return String(value)
}
function titleCase(value: string) { return value.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()) }

export default function ModuleWorkspace({ moduleKey }: { moduleKey: string }) {
  const config = moduleConfigs[moduleKey]
  const [resourceIndex, setResourceIndex] = useState(0)
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null)
  const resource = config?.resources[resourceIndex]

  const load = async () => {
    if (!resource) return
    setLoading(true); setError('')
    try {
      const response = await api.get(resource.endpoint)
      setRows(rowsFrom(response.data))
    } catch (e: unknown) {
      const message = e && typeof e === 'object' && 'response' in e
        ? String((e as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'The API request could not be completed.')
        : e instanceof Error ? e.message : 'The API request could not be completed.'
      setRows([]); setError(message)
    } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [resource?.endpoint])

  const filtered = useMemo(() => rows.filter(row => JSON.stringify(row).toLowerCase().includes(query.toLowerCase())), [rows, query])
  const columns = useMemo(() => {
    if (!rows.length) return []
    const preferred = ['id', 'patientNumber', 'appointmentNo', 'firstName', 'name', 'title', 'status', 'email', 'phone', 'createdAt']
    const keys = Object.keys(rows[0])
    return [...preferred.filter(k => keys.includes(k)), ...keys.filter(k => !preferred.includes(k) && !['passwordHash'].includes(k))].slice(0, 6)
  }, [rows])

  if (!config) return <section className="mc-panel"><h2>Module not found</h2><p>This module is not configured.</p></section>
  return <div className="mc-module-page">
    <section className="mc-welcome-row"><div><p className="mc-eyebrow">HOSPITAL WORKSPACE</p><h2>{config.title}</h2><p>{config.description}</p></div>{resource && <button className="mc-secondary-button" onClick={() => void load()} disabled={loading}><RefreshCw size={15} className={loading ? 'mc-spin' : ''}/> Refresh</button>}</section>
    {config.unavailable ? <article className="mc-panel mc-module-notice"><AlertCircle size={22}/><div><strong>Backend connection pending</strong><p>{config.unavailable}</p></div></article> : <>
      <section className="mc-module-toolbar mc-panel">
        <div className="mc-module-tabs">{config.resources.map((item, index) => <button key={item.endpoint} className={index === resourceIndex ? 'selected' : ''} onClick={() => { setResourceIndex(index); setQuery('') }}>{item.label}</button>)}</div>
        <label className="mc-module-search"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search records..."/></label>
      </section>
      <section className="mc-panel mc-module-table-panel">
        <div className="mc-panel-heading"><div><h3>{resource?.label ?? config.title}</h3><p>{resource?.endpoint}</p></div><span className="mc-record-count">{loading ? 'Loading…' : `${filtered.length} records`}</span></div>
        {error && <div className="mc-module-error"><AlertCircle size={16}/><span>{error}</span></div>}
        <div className="mc-table-wrap"><table className="mc-data-table"><thead><tr>{columns.map(col => <th key={col}>{titleCase(col)}</th>)}<th>Details</th></tr></thead><tbody>
          {loading ? <tr><td colSpan={Math.max(columns.length + 1, 1)} className="mc-table-empty">Loading records…</td></tr>
            : filtered.length === 0 ? <tr><td colSpan={Math.max(columns.length + 1, 1)} className="mc-table-empty">{error ? 'No records available from this endpoint.' : 'No records found.'}</td></tr>
            : filtered.map((row, i) => <tr key={String(row.id ?? row.patientNumber ?? row.appointmentNo ?? i)}>{columns.map(col => <td key={col}>{display(row[col])}</td>)}<td><button className="mc-row-action" onClick={() => setSelected(row)} aria-label="View record details"><Eye size={16}/> View</button></td></tr>)}
        </tbody></table></div>
        <div className="mc-table-footer"><span>Showing {filtered.length} of {rows.length} records</span><span>Live backend data</span></div>
      </section>
    </>}
    {selected && <div className="mc-modal-backdrop" onClick={() => setSelected(null)}><section className="mc-detail-modal" onClick={e => e.stopPropagation()}><div className="mc-panel-heading"><div><h3>Record details</h3><p>Returned by {resource?.endpoint}</p></div><button className="mc-secondary-button" onClick={() => setSelected(null)}>Close</button></div><div className="mc-detail-grid">{Object.entries(selected).filter(([key]) => !/password|token/i.test(key)).map(([key, value]) => <div className="mc-detail-field" key={key}><span>{titleCase(key)}</span><strong>{typeof value === 'object' && value !== null ? JSON.stringify(value) : display(value)}</strong></div>)}</div></section></div>}
  </div>
}
