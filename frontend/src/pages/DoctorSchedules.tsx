
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Pencil, Trash2, RefreshCw } from 'lucide-react'
import api from '../lib/api'

type Schedule = {
  id: number
  doctorId: number
  dayOfWeek: number
  startTime: string
  endTime: string
  slotDurationMinutes: number
  maxAppointments?: number
  active: boolean
}

const days = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday',
  'Thursday', 'Friday', 'Saturday'
]

const blank = {
  dayOfWeek: 1,
  startTime: '09:00',
  endTime: '17:00',
  slotDurationMinutes: 15,
  maxAppointments: 20,
  active: true
}

export default function DoctorSchedules() {
  const { id } = useParams()
  const navigate = useNavigate()

  const doctorId = Number(id)

  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [doctor, setDoctor] = useState<any>(null)
  const [form, setForm] = useState(blank)
  const [editing, setEditing] = useState<number | null>(null)
  const [modal, setModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [doctorResponse, scheduleResponse] =
        await Promise.all([
          api.get(`/doctors/${doctorId}`),
          api.get(`/doctors/${doctorId}/schedules`)
        ])

      setDoctor(doctorResponse.data)
      setSchedules(
        Array.isArray(scheduleResponse.data)
          ? scheduleResponse.data
          : scheduleResponse.data?.data ?? []
      )
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
        'Unable to load doctor schedules.'
      )
    } finally {
      setLoading(false)
    }
  }, [doctorId])

  useEffect(() => {
    if (!Number.isInteger(doctorId) || doctorId < 1) {
      setError('Invalid doctor ID.')
      setLoading(false)
      return
    }

    void load()
  }, [load, doctorId])

  const openNew = () => {
    setEditing(null)
    setForm(blank)
    setModal(true)
  }

  const openEdit = (schedule: Schedule) => {
    setEditing(schedule.id)

    setForm({
      dayOfWeek: schedule.dayOfWeek,
      startTime: schedule.startTime.slice(0, 5),
      endTime: schedule.endTime.slice(0, 5),
      slotDurationMinutes: schedule.slotDurationMinutes,
      maxAppointments: schedule.maxAppointments ?? 20,
      active: schedule.active
    })

    setModal(true)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const payload = {
        ...form,
        dayOfWeek: Number(form.dayOfWeek),
        slotDurationMinutes: Number(form.slotDurationMinutes),
        maxAppointments: Number(form.maxAppointments)
      }

      if (editing !== null) {
        await api.patch(
          `/doctors/${doctorId}/schedules/${editing}`,
          payload
        )
      } else {
        await api.post(
          `/doctors/${doctorId}/schedules`,
          payload
        )
      }

      setModal(false)
      await load()
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
        'Unable to save schedule.'
      )
    } finally {
      setSaving(false)
    }
  }

  const remove = async (scheduleId: number) => {
    if (!window.confirm('Delete this doctor schedule?')) return

    try {
      await api.delete(
        `/doctors/${doctorId}/schedules/${scheduleId}`
      )
      await load()
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
        'Unable to delete schedule.'
      )
    }
  }

  return (
    <div className="space-y-6">

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button
            onClick={() => navigate('/doctors')}
            className="mb-3 flex items-center gap-2 text-sm text-teal-700"
          >
            <ArrowLeft size={16} /> Back to doctors
          </button>

          <h2 className="text-2xl font-bold text-slate-900">
            Doctor Schedule Management
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {doctor
              ? `Dr. ${doctor.user?.firstName ?? doctor.firstName ?? ''} ${doctor.user?.lastName ?? doctor.lastName ?? ''}`
              : 'Manage weekly working hours'}
          </p>
        </div>

        <button
          onClick={openNew}
          className="flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white"
        >
          <Plus size={17} /> Add schedule
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {Array.isArray(error) ? error.join(', ') : error}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">

        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">
            Weekly working hours
          </h3>

          <button
            onClick={() => void load()}
            className="rounded-lg border p-2 text-slate-600"
            title="Refresh"
          >
            <RefreshCw size={17} />
          </button>
        </div>

        {loading ? (
          <p className="p-8 text-center text-slate-500">
            Loading schedules...
          </p>
        ) : schedules.length === 0 ? (
          <p className="p-8 text-center text-slate-500">
            No schedules configured for this doctor.
          </p>
        ) : (
          <div className="space-y-3">
            {schedules.map(schedule => (
              <div
                key={schedule.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-4"
              >
                <div>
                  <h4 className="font-semibold text-slate-800">
                    {days[schedule.dayOfWeek]}
                  </h4>

                  <p className="mt-1 text-sm text-slate-500">
                    {schedule.startTime.slice(0, 5)}
                    {' – '}
                    {schedule.endTime.slice(0, 5)}
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    Slot: {schedule.slotDurationMinutes} minutes
                    {' · '}
                    Max appointments: {schedule.maxAppointments ?? 'Not specified'}
                  </p>

                  <span className={
                    schedule.active
                      ? 'text-xs font-semibold text-green-600'
                      : 'text-xs font-semibold text-slate-400'
                  }>
                    {schedule.active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => openEdit(schedule)}
                    className="rounded-lg border p-2 text-teal-700"
                    title="Edit"
                  >
                    <Pencil size={16} />
                  </button>

                  <button
                    onClick={() => void remove(schedule.id)}
                    className="rounded-lg border p-2 text-red-600"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {modal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">

          <form
            onSubmit={save}
            className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl"
          >
            <h3 className="text-lg font-bold text-slate-900">
              {editing !== null ? 'Edit schedule' : 'Create doctor schedule'}
            </h3>

            <label className="block text-sm font-medium">
              Working day
              <select
                value={form.dayOfWeek}
                onChange={e => setForm({
                  ...form,
                  dayOfWeek: Number(e.target.value)
                })}
                className="mt-1 w-full rounded-lg border p-2.5"
              >
                {days.map((day, index) => (
                  <option key={day} value={index}>{day}</option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-medium">
                Start time
                <input
                  type="time"
                  required
                  value={form.startTime}
                  onChange={e => setForm({
                    ...form,
                    startTime: e.target.value
                  })}
                  className="mt-1 w-full rounded-lg border p-2.5"
                />
              </label>

              <label className="text-sm font-medium">
                End time
                <input
                  type="time"
                  required
                  value={form.endTime}
                  onChange={e => setForm({
                    ...form,
                    endTime: e.target.value
                  })}
                  className="mt-1 w-full rounded-lg border p-2.5"
                />
              </label>
            </div>

            <label className="block text-sm font-medium">
              Appointment duration (minutes)
              <input
                type="number"
                min="5"
                required
                value={form.slotDurationMinutes}
                onChange={e => setForm({
                  ...form,
                  slotDurationMinutes: Number(e.target.value)
                })}
                className="mt-1 w-full rounded-lg border p-2.5"
              />
            </label>

            <label className="block text-sm font-medium">
              Maximum appointments
              <input
                type="number"
                min="1"
                required
                value={form.maxAppointments}
                onChange={e => setForm({
                  ...form,
                  maxAppointments: Number(e.target.value)
                })}
                className="mt-1 w-full rounded-lg border p-2.5"
              />
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={e => setForm({
                  ...form,
                  active: e.target.checked
                })}
              />
              Active schedule
            </label>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setModal(false)}
                className="rounded-lg border px-4 py-2 text-sm"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-teal-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save schedule'}
              </button>
            </div>

          </form>
        </div>
      )}

    </div>
  )
}
