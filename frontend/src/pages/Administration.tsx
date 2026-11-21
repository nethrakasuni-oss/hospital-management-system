
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ShieldCheck, Users, KeyRound, Settings, Building2, ClipboardList,
  RefreshCw, Search, Eye, X, AlertCircle, LayoutDashboard,
  UserPlus, UserCheck, Stethoscope, Loader2,
} from 'lucide-react'
import api from '../lib/api'

type Row = Record<string, any>
type Section = 'overview' | 'users' | 'roles' | 'permissions' | 'settings' | 'hospital' | 'audit'

type StaffForm = {
  firstName: string
  lastName: string
  email: string
  phone: string
  password: string
  role: string
  departmentId: string
  employeeNo: string
  designation: string
  joinedDate: string
  registrationNo: string
  specialization: string
  qualification: string
  consultationFee: string
}

const initialForm: StaffForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  role: 'RECEPTIONIST',
  departmentId: '',
  employeeNo: '',
  designation: '',
  joinedDate: '',
  registrationNo: '',
  specialization: '',
  qualification: '',
  consultationFee: '0',
}

const roles = [
  'ADMIN',
  'DOCTOR',
  'NURSE',
  'RECEPTIONIST',
  'LAB_TECHNICIAN',
  'PHARMACIST',
  'ACCOUNTANT',
  'HR_MANAGER',
  'INVENTORY_MANAGER',
  'LAB_MANAGER',
  'PATHOLOGIST',
]

const sections: {
  key: Section
  label: string
  endpoint?: string
  icon: typeof ShieldCheck
}[] = [
  { key: 'overview', label: 'Overview', endpoint: '/admin/dashboard', icon: LayoutDashboard },
  { key: 'users', label: 'Users', endpoint: '/admin/users', icon: Users },
  { key: 'roles', label: 'Roles', endpoint: '/admin/roles', icon: ShieldCheck },
  { key: 'permissions', label: 'Permissions', endpoint: '/admin/permissions', icon: KeyRound },
  { key: 'settings', label: 'System Settings', endpoint: '/admin/settings', icon: Settings },
  { key: 'hospital', label: 'Hospital Profile', endpoint: '/admin/hospital-profile', icon: Building2 },
  { key: 'audit', label: 'Audit Logs', endpoint: '/admin/audit-logs', icon: ClipboardList },
]

const rowsFrom = (value: any): Row[] => {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.data)) return value.data
  if (Array.isArray(value?.items)) return value.items
  if (Array.isArray(value?.results)) return value.results
  if (Array.isArray(value?.records)) return value.records
  return []
}

const display = (value: any): string => {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') {
    return value.name ?? value.email ?? value.title ?? JSON.stringify(value)
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

const pretty = (key: string) =>
  key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100'

const labelClass = 'mb-1.5 block text-sm font-medium text-slate-700'

export default function Administration() {
  const [section, setSection] = useState<Section>('overview')
  const [records, setRecords] = useState<Row[]>([])
  const [overview, setOverview] = useState<Row | null>(null)
  const [hospital, setHospital] = useState<Row | null>(null)

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Row | null>(null)

  const [showRegistration, setShowRegistration] = useState(false)
  const [form, setForm] = useState<StaffForm>(initialForm)
  const [departments, setDepartments] = useState<Row[]>([])

  const current = sections.find(item => item.key === section)!

  const load = useCallback(async (target: Section = section) => {
    const config = sections.find(item => item.key === target)!
    setLoading(true)
    setError('')

    try {
      const response = await api.get(config.endpoint!)

      if (target === 'overview') {
        const payload = response.data
        setOverview(
          payload && typeof payload === 'object'
            ? payload as Row
            : { result: payload },
        )
        setRecords([])
      } else if (target === 'hospital') {
        const payload = response.data
        setHospital(
          payload && typeof payload === 'object'
            ? payload as Row
            : { result: payload },
        )
        setRecords([])
      } else {
        setRecords(rowsFrom(response.data))
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.message?.toString() ??
        `Unable to load ${config.label}. Check your ADMIN account.`,
      )

      if (target === 'overview') setOverview(null)
      else if (target === 'hospital') setHospital(null)
      else setRecords([])
    } finally {
      setLoading(false)
    }
  }, [section])

  useEffect(() => {
    void load(section)
  }, [section, load])

  useEffect(() => {
    api.get('/departments')
      .then(response => setDepartments(rowsFrom(response.data)))
      .catch(() => setDepartments([]))
  }, [])

  const filtered = useMemo(
    () => records.filter(row =>
      JSON.stringify(row).toLowerCase().includes(search.toLowerCase()),
    ),
    [records, search],
  )

  const columns = useMemo(() => {
    if (!filtered.length) return []

    const keys = Object.keys(filtered[0]).filter(
      key => !/(password|token|secret)/i.test(key),
    )

    const preferred = [
      'id', 'firstName', 'lastName', 'email',
      'role', 'status', 'createdAt',
    ]

    return [
      ...preferred.filter(key => keys.includes(key)),
      ...keys.filter(key => !preferred.includes(key)),
    ].slice(0, 7)
  }, [filtered])

  const updateForm = (field: keyof StaffForm, value: string) => {
    setForm(previous => ({ ...previous, [field]: value }))
  }

  const resetRegistration = () => {
    setForm(initialForm)
    setError('')
    setShowRegistration(false)
  }

  const submitStaff = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (form.role === 'DOCTOR' && !form.registrationNo.trim()) {
      setError('Doctor registration number is required.')
      return
    }

    if (
      form.role !== 'DOCTOR' &&
      form.role !== 'ADMIN' &&
      (!form.employeeNo.trim() || !form.designation.trim())
    ) {
      setError('Employee number and designation are required.')
      return
    }

    const payload: Row = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      password: form.password,
      role: form.role,
      departmentId: form.departmentId
        ? Number(form.departmentId)
        : undefined,
    }

    if (form.role === 'DOCTOR') {
      payload.registrationNo = form.registrationNo.trim()
      payload.specialization = form.specialization.trim() || undefined
      payload.qualification = form.qualification.trim() || undefined
      payload.consultationFee = Number(form.consultationFee || 0)
    } else if (form.role !== 'ADMIN') {
      payload.employeeNo = form.employeeNo.trim()
      payload.designation = form.designation.trim()
      payload.joinedDate = form.joinedDate || undefined
    }

    setSaving(true)

    try {
      const response = await api.post('/admin/staff', payload)

      setSuccess(
        response.data?.message || 'Staff account created successfully.',
      )

      setForm(initialForm)
      setShowRegistration(false)

      if (section === 'users') {
        await load('users')
      }
    } catch (err: any) {
      const message = err?.response?.data?.message
      setError(
        Array.isArray(message)
          ? message.join(', ')
          : message || 'Unable to create staff account.',
      )
    } finally {
      setSaving(false)
    }
  }

  const renderObject = (data: Row) => (
    <div className="grid gap-3 sm:grid-cols-2">
      {Object.entries(data)
        .filter(([key]) => !/(password|token|secret)/i.test(key))
        .map(([key, value]) => (
          <div key={key} className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500">{pretty(key)}</p>
            <p className="mt-1 break-words text-sm font-medium text-slate-800">
              {display(value)}
            </p>
          </div>
        ))}
    </div>
  )

  const field = (
    name: keyof StaffForm,
    label: string,
    type = 'text',
    required = false,
  ) => (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        type={type}
        required={required}
        className={inputClass}
        value={form[name]}
        onChange={event => updateForm(name, event.target.value)}
      />
    </div>
  )

  return (
    <main className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-widest text-teal-700">
            SYSTEM CONTROL CENTRE
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Administration
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage users, roles, permissions and hospital settings.
          </p>
        </div>

        <button
          onClick={() => void load(section)}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </header>

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {success}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Users', icon: Users, key: 'users' as Section },
          { label: 'Roles', icon: ShieldCheck, key: 'roles' as Section },
          { label: 'Permissions', icon: KeyRound, key: 'permissions' as Section },
          { label: 'Audit Logs', icon: ClipboardList, key: 'audit' as Section },
        ].map(item => (
          <button
            key={item.label}
            onClick={() => setSection(item.key)}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-teal-300"
          >
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-teal-50 text-teal-700">
              <item.icon size={19} />
            </span>
            <span>
              <span className="block text-xs text-slate-500">{item.label}</span>
              <span className="text-lg font-bold text-slate-900">
                {section === item.key ? records.length : 'Open'}
              </span>
            </span>
          </button>
        ))}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <nav className="flex flex-wrap gap-2 border-b border-slate-100 pb-4">
          {sections.map(item => (
            <button
              key={item.key}
              onClick={() => {
                setSection(item.key)
                setSearch('')
                setSelected(null)
                setError('')
              }}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                section === item.key
                  ? 'bg-[#142B49] text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <item.icon size={15} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">{current.label}</h2>
            <p className="text-xs text-slate-500">{current.endpoint}</p>
          </div>

          {section === 'users' && (
            <button
              onClick={() => {
                setError('')
                setSuccess('')
                setShowRegistration(true)
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
            >
              <UserPlus size={17} />
              Register New Staff
            </button>
          )}

          {!['overview', 'hospital'].includes(section) && (
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 text-slate-400">
              <Search size={15} />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search records..."
                className="w-48 py-2 text-sm text-slate-700 outline-none"
              />
            </label>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
          >
            <AlertCircle size={17} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Loading {current.label.toLowerCase()}...
          </div>
        ) : section === 'overview' ? (
          overview
            ? renderObject(overview)
            : <p className="p-8 text-center text-sm text-slate-500">No dashboard summary returned.</p>
        ) : section === 'hospital' ? (
          hospital
            ? renderObject(hospital)
            : <p className="p-8 text-center text-sm text-slate-500">No hospital profile returned.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    {columns.map(key => (
                      <th key={key} className="px-3 py-3 font-semibold">
                        {pretty(key)}
                      </th>
                    ))}
                    <th className="px-3 py-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={Math.max(columns.length + 1, 1)}
                        className="p-8 text-center text-slate-500"
                      >
                        No records found.
                      </td>
                    </tr>
                  ) : filtered.map((row, index) => (
                    <tr
                      key={String(row.id ?? row.key ?? index)}
                      className="hover:bg-slate-50"
                    >
                      {columns.map(key => (
                        <td
                          key={key}
                          className="max-w-56 truncate px-3 py-3 text-slate-700"
                        >
                          {display(row[key])}
                        </td>
                      ))}
                      <td className="px-3 py-3">
                        <button
                          onClick={() => setSelected(row)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50"
                        >
                          <Eye size={14} />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Showing {filtered.length} of {records.length} records.
            </p>
          </>
        )}
      </section>

      {showRegistration && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4">
          <section className="my-5 max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-teal-700">
                  <UserPlus size={20} />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Staff Management
                  </span>
                </div>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  Register New Staff
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Create a hospital staff login account.
                </p>
              </div>
              <button
                onClick={resetRegistration}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={submitStaff} className="space-y-5">
              <div>
                <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
                  <Users size={17} />
                  Personal Information
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {field('firstName', 'First Name', 'text', true)}
                  {field('lastName', 'Last Name', 'text', true)}
                  {field('email', 'Email Address', 'email', true)}
                  {field('phone', 'Phone Number', 'tel')}
                  {field('password', 'Temporary Password', 'password', true)}
                  <div>
                    <label className={labelClass}>Staff Role</label>
                    <select
                      required
                      className={inputClass}
                      value={form.role}
                      onChange={event => updateForm('role', event.target.value)}
                    >
                      {roles.map(role => (
                        <option key={role} value={role}>
                          {role.replaceAll('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {form.role !== 'ADMIN' && (
                <div>
                  <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
                    <Building2 size={17} />
                    Department
                  </h3>
                  <select
                    className={inputClass}
                    value={form.departmentId}
                    onChange={event => updateForm('departmentId', event.target.value)}
                  >
                    <option value="">Select Department (optional)</option>
                    {departments.map(department => (
                      <option key={department.id} value={department.id}>
                        {department.name ?? department.departmentName ?? `Department ${department.id}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {form.role === 'DOCTOR' ? (
                <div>
                  <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
                    <Stethoscope size={17} />
                    Doctor Professional Details
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {field('registrationNo', 'Registration Number', 'text', true)}
                    {field('specialization', 'Specialization')}
                    {field('qualification', 'Qualification')}
                    {field('consultationFee', 'Consultation Fee (LKR)', 'number')}
                  </div>
                </div>
              ) : form.role !== 'ADMIN' ? (
                <div>
                  <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
                    <UserCheck size={17} />
                    Employee Details
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {field('employeeNo', 'Employee Number', 'text', true)}
                    {field('designation', 'Designation', 'text', true)}
                    {field('joinedDate', 'Joined Date', 'date')}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={resetRegistration}
                  disabled={saving}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
                >
                  {saving
                    ? <><Loader2 size={16} className="animate-spin" /> Creating...</>
                    : <><UserPlus size={16} /> Create Staff Account</>}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-slate-950/50 p-4"
          onClick={() => setSelected(null)}
        >
          <section
            onClick={event => event.stopPropagation()}
            className="my-5 max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-900">Record Details</h2>
                <p className="text-xs text-slate-500">{current.label}</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>
            {renderObject(selected)}
          </section>
        </div>
      )}

      <p className="text-xs text-slate-400">
        Administration endpoints are restricted to users with the ADMIN role.
        Staff registration is administrator-only.
      </p>
    </main>
  )
}
