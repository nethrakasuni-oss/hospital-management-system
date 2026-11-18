
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  FileText,
  Activity,
  Stethoscope,
  RefreshCw,
  Search,
  Eye,
  X,
  Plus,
  Save,
  AlertCircle,
  History,
  UserRound,
  ClipboardList,
} from 'lucide-react'
import api from '../lib/api'

type MedicalRecord = {
  id: number
  patientId: number
  doctorId: number
  diagnosis?: string | null
  symptoms?: string | null
  treatment?: string | null
  notes?: string | null
  createdAt?: string
  updatedAt?: string
  patient?: Record<string, any>
  doctor?: Record<string, any>
  [key: string]: any
}

type FormData = {
  patientId: string
  doctorId: string
  diagnosis: string
  symptoms: string
  treatment: string
  notes: string
}

const emptyForm: FormData = {
  patientId: '',
  doctorId: '',
  diagnosis: '',
  symptoms: '',
  treatment: '',
  notes: '',
}

const dateFormat = (date?: string) => {
  if (!date) return '—'
  const parsed = new Date(date)
  return Number.isNaN(parsed.getTime())
    ? '—'
    : parsed.toLocaleString()
}

const getName = (value: any, fallback: string) => {
  if (!value) return fallback
  if (typeof value === 'string') return value
  return (
    value.name ??
    value.firstName ??
    value.fullName ??
    value.employee?.user?.name ??
    fallback
  )
}

const errorMessage = (err: any) =>
  Array.isArray(err?.response?.data?.message)
    ? err.response.data.message.join(', ')
    : err?.response?.data?.message ??
      'Something went wrong. Please try again.'

export default function MedicalRecords() {
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [statistics, setStatistics] = useState<Record<string, any> | null>(null)

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [search, setSearch] = useState('')
  const [patientFilter, setPatientFilter] = useState('')
  const [doctorFilter, setDoctorFilter] = useState('')

  const [selected, setSelected] = useState<MedicalRecord | null>(null)
  const [history, setHistory] = useState<any>(null)
  const [historyLoading, setHistoryLoading] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)

  const loadRecords = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const params: Record<string, number> = {}

      if (patientFilter) {
        params.patientId = Number(patientFilter)
      }

      if (doctorFilter) {
        params.doctorId = Number(doctorFilter)
      }

      const response = await api.get('/medical-records', { params })

      const result = response.data

      setRecords(
        Array.isArray(result)
          ? result
          : Array.isArray(result?.data)
            ? result.data
            : [],
      )
    } catch (err: any) {
      setRecords([])
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [patientFilter, doctorFilter])

  const loadStatistics = useCallback(async () => {
    try {
      const response = await api.get(
        '/medical-records/statistics/overview',
      )
      setStatistics(response.data)
    } catch {
      setStatistics(null)
    }
  }, [])

  const refresh = useCallback(async () => {
    await Promise.all([
      loadRecords(),
      loadStatistics(),
    ])
  }, [loadRecords, loadStatistics])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const filteredRecords = useMemo(() => {
    const query = search.toLowerCase()

    return records.filter(record => {
      const patientName = getName(record.patient, '')
      const doctorName = getName(record.doctor, '')

      const searchable = [
        record.id,
        record.patientId,
        record.doctorId,
        patientName,
        doctorName,
        record.diagnosis,
        record.symptoms,
        record.treatment,
        record.notes,
      ]
        .join(' ')
        .toLowerCase()

      return searchable.includes(query)
    })
  }, [records, search])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setError('')
    setShowForm(true)
  }

  const openEdit = (record: MedicalRecord) => {
    setEditingId(record.id)

    setForm({
      patientId: String(record.patientId),
      doctorId: String(record.doctorId),
      diagnosis: record.diagnosis ?? '',
      symptoms: record.symptoms ?? '',
      treatment: record.treatment ?? '',
      notes: record.notes ?? '',
    })

    setSelected(null)
    setError('')
    setShowForm(true)
  }

  const saveRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    setError('')
    setSuccess('')

    if (
      !editingId &&
      (
        !Number.isInteger(Number(form.patientId)) ||
        Number(form.patientId) < 1 ||
        !Number.isInteger(Number(form.doctorId)) ||
        Number(form.doctorId) < 1
      )
    ) {
      setError('Please enter valid Patient ID and Doctor ID.')
      return
    }

    const payload: Record<string, any> = {
      diagnosis: form.diagnosis.trim(),
      symptoms: form.symptoms.trim(),
      treatment: form.treatment.trim(),
      notes: form.notes.trim(),
    }

    if (!editingId) {
      payload.patientId = Number(form.patientId)
      payload.doctorId = Number(form.doctorId)
    }

    setSaving(true)

    try {
      if (editingId) {
        await api.patch(
          `/medical-records/${editingId}`,
          payload,
        )
        setSuccess('Medical record updated successfully.')
      } else {
        await api.post('/medical-records', payload)
        setSuccess('Medical record created successfully.')
      }

      setShowForm(false)
      setEditingId(null)
      setForm(emptyForm)

      await refresh()
    } catch (err: any) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const viewRecord = async (record: MedicalRecord) => {
    setError('')

    try {
      const response = await api.get(
        `/medical-records/${record.id}`,
      )
      setSelected(response.data)
    } catch (err: any) {
      setError(errorMessage(err))
    }
  }

  const loadPatientHistory = async (patientId: number) => {
    setHistoryLoading(true)
    setHistory(null)
    setError('')

    try {
      const response = await api.get(
        `/medical-records/patient/${patientId}/history`,
      )
      setHistory(response.data)
    } catch (err: any) {
      setError(errorMessage(err))
    } finally {
      setHistoryLoading(false)
    }
  }

  const statCards = [
    {
      label: 'Total Records',
      value:
        statistics?.total ??
        statistics?.totalRecords ??
        records.length,
      icon: FileText,
      style: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'Diagnoses',
      value: statistics?.diagnoses ?? '—',
      icon: Activity,
      style: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: 'Doctors',
      value: statistics?.doctors ?? '—',
      icon: Stethoscope,
      style: 'bg-purple-50 text-purple-700',
    },
    {
      label: 'Patient Records',
      value: statistics?.patients ?? '—',
      icon: UserRound,
      style: 'bg-amber-50 text-amber-700',
    },
  ]

  return (
    <main className="space-y-5">

      {/* HEADER */}

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-widest text-teal-700">
            CLINICAL MANAGEMENT
          </p>

          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Medical Records
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage patient diagnoses, symptoms, treatments and clinical history.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-slate-700"
          >
            <RefreshCw
              size={16}
              className={loading ? 'animate-spin' : ''}
            />
            Refresh
          </button>

          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-[#142B49] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1d3c61]"
          >
            <Plus size={16} />
            Add Medical Record
          </button>
        </div>
      </header>

      {/* ALERTS */}

      {error && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <span className="flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </span>
          <button onClick={() => setError('')}>
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {success}
          <button onClick={() => setSuccess('')}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* STATISTICS */}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map(item => (
          <article
            key={item.label}
            className="flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm"
          >
            <div className={`grid h-11 w-11 place-items-center rounded-lg ${item.style}`}>
              <item.icon size={20} />
            </div>

            <div>
              <p className="text-xs text-slate-500">
                {item.label}
              </p>
              <p className="text-2xl font-bold text-slate-900">
                {item.value}
              </p>
            </div>
          </article>
        ))}
      </section>

      {/* RECORDS */}

      <section className="rounded-xl border bg-white p-4 shadow-sm">

        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <div>
            <h2 className="font-semibold text-slate-900">
              Patient Medical Records
            </h2>
            <p className="text-xs text-slate-500">
              {filteredRecords.length} displayed records
            </p>
          </div>

          <button
            onClick={() => void loadPatientHistory(
              Number(patientFilter),
            )}
            disabled={!patientFilter || historyLoading}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold text-teal-700 disabled:opacity-40"
          >
            <History size={16} />
            Patient History
          </button>
        </div>

        {/* FILTERS */}

        <div className="grid gap-3 py-4 sm:grid-cols-2 lg:grid-cols-3">

          <label className="flex items-center gap-2 rounded-lg border px-3">
            <Search size={16} className="text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search medical records..."
              className="w-full py-2 text-sm outline-none"
            />
          </label>

          <input
            type="number"
            min="1"
            value={patientFilter}
            onChange={e => setPatientFilter(e.target.value)}
            placeholder="Filter by Patient ID"
            className="rounded-lg border px-3 py-2 text-sm"
          />

          <input
            type="number"
            min="1"
            value={doctorFilter}
            onChange={e => setDoctorFilter(e.target.value)}
            placeholder="Filter by Doctor ID"
            className="rounded-lg border px-3 py-2 text-sm"
          />

        </div>

        {/* TABLE */}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">

            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-3">Record ID</th>
                <th className="px-3 py-3">Patient</th>
                <th className="px-3 py-3">Doctor</th>
                <th className="px-3 py-3">Diagnosis</th>
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">

              {loading ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-500">
                    Loading medical records...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-500">
                    No medical records found.
                  </td>
                </tr>
              ) : (
                filteredRecords.map(record => (
                  <tr
                    key={record.id}
                    className="hover:bg-slate-50"
                  >
                    <td className="px-3 py-3 font-semibold text-slate-700">
                      MR-{record.id}
                    </td>

                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-800">
                        {getName(record.patient, `Patient #${record.patientId}`)}
                      </p>
                      <p className="text-xs text-slate-400">
                        ID: {record.patientId}
                      </p>
                    </td>

                    <td className="px-3 py-3">
                      {getName(record.doctor, `Doctor #${record.doctorId}`)}
                    </td>

                    <td className="max-w-52 truncate px-3 py-3 text-slate-600">
                      {record.diagnosis || 'Not specified'}
                    </td>

                    <td className="px-3 py-3 text-slate-500">
                      {dateFormat(record.createdAt)}
                    </td>

                    <td className="px-3 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => void viewRecord(record)}
                          className="inline-flex items-center gap-1 rounded-lg border px-2 py-2 text-xs font-semibold text-teal-700"
                        >
                          <Eye size={14} />
                          View
                        </button>

                        <button
                          onClick={() => openEdit(record)}
                          className="rounded-lg border px-2 py-2 text-xs font-semibold text-slate-600"
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}

            </tbody>
          </table>
        </div>

      </section>

      {/* PATIENT HISTORY */}

      {history !== null && (
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">
                Patient Medical History
              </h2>
              <p className="text-xs text-slate-500">
                Patient ID: {patientFilter}
              </p>
            </div>

            <button
              onClick={() => setHistory(null)}
              className="rounded-lg p-2 hover:bg-slate-100"
            >
              <X size={18} />
            </button>
          </div>

          {historyLoading ? (
            <p className="text-sm text-slate-500">Loading history...</p>
          ) : (
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-4 text-xs text-slate-700">
              {JSON.stringify(history, null, 2)}
            </pre>
          )}
        </section>
      )}

      {/* CREATE / EDIT MODAL */}

      {showForm && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4"
          onClick={() => setShowForm(false)}
        >
          <section
            onClick={e => e.stopPropagation()}
            className="my-5 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl"
          >

            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingId ? 'Update Medical Record' : 'Create Medical Record'}
                </h2>

                <p className="text-xs text-slate-500">
                  Enter clinical information.
                </p>
              </div>

              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X size={19} />
              </button>
            </div>

            <form
              onSubmit={saveRecord}
              className="space-y-4"
            >

              {!editingId && (
                <div className="grid gap-3 sm:grid-cols-2">

                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Patient ID *
                    </label>

                    <input
                      required
                      type="number"
                      min="1"
                      value={form.patientId}
                      onChange={e => setForm({
                        ...form,
                        patientId: e.target.value,
                      })}
                      placeholder="Enter patient ID"
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Doctor ID *
                    </label>

                    <input
                      required
                      type="number"
                      min="1"
                      value={form.doctorId}
                      onChange={e => setForm({
                        ...form,
                        doctorId: e.target.value,
                      })}
                      placeholder="Enter doctor ID"
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </div>

                </div>
              )}

              {editingId && (
                <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                  Editing record MR-{editingId}. Patient and doctor assignments cannot be changed here.
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Diagnosis
                </label>

                <textarea
                  rows={3}
                  maxLength={5000}
                  value={form.diagnosis}
                  onChange={e => setForm({
                    ...form,
                    diagnosis: e.target.value,
                  })}
                  placeholder="Enter diagnosis..."
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Symptoms
                </label>

                <textarea
                  rows={3}
                  maxLength={5000}
                  value={form.symptoms}
                  onChange={e => setForm({
                    ...form,
                    symptoms: e.target.value,
                  })}
                  placeholder="Describe patient symptoms..."
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Treatment
                </label>

                <textarea
                  rows={3}
                  maxLength={5000}
                  value={form.treatment}
                  onChange={e => setForm({
                    ...form,
                    treatment: e.target.value,
                  })}
                  placeholder="Enter treatment details..."
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Clinical Notes
                </label>

                <textarea
                  rows={4}
                  maxLength={10000}
                  value={form.notes}
                  onChange={e => setForm({
                    ...form,
                    notes: e.target.value,
                  })}
                  placeholder="Additional clinical notes..."
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">

                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#142B49] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <Save size={15} />
                  {saving ? 'Saving...' : 'Save Record'}
                </button>

              </div>

            </form>
          </section>
        </div>
      )}

      {/* RECORD DETAILS */}

      {selected && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4"
          onClick={() => setSelected(null)}
        >
          <section
            onClick={e => e.stopPropagation()}
            className="my-5 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl"
          >

            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Medical Record Details
                </h2>
                <p className="text-xs text-slate-500">
                  Record MR-{selected.id}
                </p>
              </div>

              <button
                onClick={() => setSelected(null)}
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Patient</p>
                  <p className="font-semibold">
                    {getName(selected.patient, `Patient #${selected.patientId}`)}
                  </p>
                </div>

                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Doctor</p>
                  <p className="font-semibold">
                    {getName(selected.doctor, `Doctor #${selected.doctorId}`)}
                  </p>
                </div>
              </div>

              {[
                ['Diagnosis', selected.diagnosis],
                ['Symptoms', selected.symptoms],
                ['Treatment', selected.treatment],
                ['Clinical Notes', selected.notes],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border p-4">
                  <p className="mb-1 text-xs font-semibold uppercase text-slate-400">
                    {label}
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-slate-700">
                    {value || 'Not specified'}
                  </p>
                </div>
              ))}

              <div className="flex flex-wrap justify-between gap-2 border-t pt-3 text-xs text-slate-400">
                <span>
                  Created: {dateFormat(selected.createdAt)}
                </span>
                <span>
                  Updated: {dateFormat(selected.updatedAt)}
                </span>
              </div>

              <button
                onClick={() => openEdit(selected)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#142B49] px-4 py-3 text-sm font-semibold text-white"
              >
                <ClipboardList size={16} />
                Edit Medical Record
              </button>

            </div>
          </section>
        </div>
      )}

    </main>
  )
}
