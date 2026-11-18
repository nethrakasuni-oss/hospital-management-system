
import { useCallback, useEffect, useState } from 'react'
import {
  Bell, BellRing, CheckCheck, RefreshCw, Search,
  Eye, X, Plus, Send, ChevronLeft, ChevronRight,
  AlertCircle, Mail, Smartphone
} from 'lucide-react'
import api from '../lib/api'

type Notification = {
  id: number
  title: string
  message: string
  type: string
  channel: string
  status: string
  userId?: number | null
  recipientEmail?: string | null
  recipientPhone?: string | null
  createdAt: string
  readAt?: string | null
  sentAt?: string | null
  metadata?: unknown
}

type Statistics = {
  total: number
  pending: number
  sent: number
  read: number
  failed: number
  byChannel?: { channel: string; count: number }[]
}

const TYPES = [
  'SYSTEM',
  'APPOINTMENT',
  'LAB_RESULT',
  'PRESCRIPTION',
  'BILLING',
  'ADMISSION',
  'LEAVE'
]

const CHANNELS = ['IN_APP', 'EMAIL', 'SMS']

const STATUS = ['PENDING', 'SENT', 'READ', 'FAILED']

const dateFormat = (date?: string | null) => {
  if (!date) return '—'
  const parsed = new Date(date)
  return Number.isNaN(parsed.getTime())
    ? '—'
    : parsed.toLocaleString()
}

const badgeClass = (status: string) => {
  switch (status) {
    case 'READ':
      return 'bg-slate-100 text-slate-600'
    case 'SENT':
      return 'bg-emerald-50 text-emerald-700'
    case 'PENDING':
      return 'bg-amber-50 text-amber-700'
    case 'FAILED':
      return 'bg-red-50 text-red-700'
    default:
      return 'bg-blue-50 text-blue-700'
  }
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [statistics, setStatistics] = useState<Statistics | null>(null)

  const [unreadCount, setUnreadCount] = useState(0)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [channel, setChannel] = useState('')
  const [type, setType] = useState('')

  const [selected, setSelected] = useState<Notification | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    title: '',
    message: '',
    type: 'SYSTEM',
    channel: 'IN_APP',
    userId: '',
    recipientEmail: '',
    recipientPhone: ''
  })

  const loadNotifications = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const params: Record<string, string | number> = {
        page,
        limit: 20
      }

      if (status) params.status = status
      if (channel) params.channel = channel
      if (type) params.type = type

      const response = await api.get('/notifications', { params })

      const result = response.data

      setNotifications(
        Array.isArray(result?.data) ? result.data : []
      )

      setTotal(result?.pagination?.total ?? 0)
      setTotalPages(result?.pagination?.totalPages ?? 1)
      setUnreadCount(result?.unreadCount ?? 0)

    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
        'Unable to load notifications.'
      )
    } finally {
      setLoading(false)
    }
  }, [page, status, channel, type])

  const loadUnreadCount = useCallback(async () => {
    try {
      const response = await api.get('/notifications/unread-count')
      setUnreadCount(response.data?.unreadCount ?? 0)
    } catch {
      // The main notification request will show access errors.
    }
  }, [])

  const loadStatistics = useCallback(async () => {
    try {
      const response = await api.get(
        '/notifications/statistics/overview'
      )
      setStatistics(response.data)
    } catch {
      // Statistics are restricted to ADMIN and HR_MANAGER.
      setStatistics(null)
    }
  }, [])

  const refresh = useCallback(async () => {
    await Promise.all([
      loadNotifications(),
      loadUnreadCount(),
      loadStatistics()
    ])
  }, [loadNotifications, loadUnreadCount, loadStatistics])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const filteredNotifications = notifications.filter(item => {
    const text = `${item.title} ${item.message} ${item.type} ${item.channel}`
      .toLowerCase()

    return text.includes(search.toLowerCase())
  })

  const markAsRead = async (id: number) => {
    try {
      await api.patch(`/notifications/${id}/read`)

      setSuccess('Notification marked as read.')
      setSelected(null)

      await refresh()
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
        'Unable to mark notification as read.'
      )
    }
  }

  const markAllRead = async () => {
    if (unreadCount === 0) return

    try {
      await api.patch('/notifications/read-all')

      setSuccess('All your notifications have been marked as read.')

      await refresh()
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
        'Unable to mark all notifications as read.'
      )
    }
  }

  const createNotification = async (event: React.FormEvent) => {
    event.preventDefault()

    setError('')
    setSuccess('')

    if (form.channel === 'IN_APP' && !form.userId) {
      setError('User ID is required for in-app notifications.')
      return
    }

    if (form.channel === 'EMAIL' && !form.recipientEmail) {
      setError('Recipient email is required.')
      return
    }

    if (form.channel === 'SMS' && !form.recipientPhone) {
      setError('Recipient phone number is required.')
      return
    }

    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      message: form.message.trim(),
      type: form.type,
      channel: form.channel
    }

    if (form.userId) payload.userId = Number(form.userId)
    if (form.recipientEmail) payload.recipientEmail = form.recipientEmail
    if (form.recipientPhone) payload.recipientPhone = form.recipientPhone

    setSubmitting(true)

    try {
      await api.post('/notifications', payload)

      setSuccess('Notification created successfully.')

      setForm({
        title: '',
        message: '',
        type: 'SYSTEM',
        channel: 'IN_APP',
        userId: '',
        recipientEmail: '',
        recipientPhone: ''
      })

      setShowCreate(false)
      setPage(1)

      await refresh()

    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
        'Unable to create notification.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  const openNotification = async (item: Notification) => {
    try {
      const response = await api.get(`/notifications/${item.id}`)
      setSelected(response.data)
    } catch {
      setSelected(item)
    }
  }

  const statCards = [
    {
      label: 'Total Notifications',
      value: statistics?.total ?? total,
      icon: Bell,
      color: 'bg-blue-50 text-blue-700'
    },
    {
      label: 'Unread',
      value: unreadCount,
      icon: BellRing,
      color: 'bg-amber-50 text-amber-700'
    },
    {
      label: 'Sent',
      value: statistics?.sent ?? '—',
      icon: Send,
      color: 'bg-emerald-50 text-emerald-700'
    },
    {
      label: 'Failed',
      value: statistics?.failed ?? '—',
      icon: AlertCircle,
      color: 'bg-red-50 text-red-700'
    }
  ]

  return (
    <main className="space-y-5">

      {/* Header */}

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-widest text-teal-700">
            COMMUNICATION CENTRE
          </p>

          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Notifications
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage hospital notifications and communication.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-slate-700"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>
            Refresh
          </button>

          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#142B49] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1d3c61]"
          >
            <Plus size={16}/>
            Create Notification
          </button>
        </div>
      </header>

      {/* Alerts */}

      {error && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={() => setError('')}>
            <X size={16}/>
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          <span>{success}</span>
          <button onClick={() => setSuccess('')}>
            <X size={16}/>
          </button>
        </div>
      )}

      {/* Statistics */}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map(item => (
          <article
            key={item.label}
            className="flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm"
          >
            <div className={`grid h-11 w-11 place-items-center rounded-lg ${item.color}`}>
              <item.icon size={20}/>
            </div>

            <div>
              <p className="text-xs text-slate-500">{item.label}</p>
              <p className="text-2xl font-bold text-slate-900">
                {item.value}
              </p>
            </div>
          </article>
        ))}
      </section>

      {/* Notification list */}

      <section className="rounded-xl border bg-white p-4 shadow-sm">

        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <div>
            <h2 className="font-semibold text-slate-900">
              Notification Centre
            </h2>
            <p className="text-xs text-slate-500">
              {total} notification records
            </p>
          </div>

          <button
            onClick={() => void markAllRead()}
            disabled={unreadCount === 0}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold text-teal-700 disabled:opacity-40"
          >
            <CheckCheck size={16}/>
            Mark All Read
          </button>
        </div>

        {/* Filters */}

        <div className="grid gap-3 py-4 sm:grid-cols-2 lg:grid-cols-4">

          <label className="flex items-center gap-2 rounded-lg border px-3">
            <Search size={16} className="text-slate-400"/>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search notifications..."
              className="w-full py-2 text-sm outline-none"
            />
          </label>

          <select
            value={status}
            onChange={e => {
              setStatus(e.target.value)
              setPage(1)
            }}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">All Statuses</option>
            {STATUS.map(value => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>

          <select
            value={channel}
            onChange={e => {
              setChannel(e.target.value)
              setPage(1)
            }}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">All Channels</option>
            {CHANNELS.map(value => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>

          <select
            value={type}
            onChange={e => {
              setType(e.target.value)
              setPage(1)
            }}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">All Types</option>
            {TYPES.map(value => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>

        </div>

        {/* Records */}

        <div className="space-y-3">

          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Loading notifications...
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-10 text-center">
              <Bell size={35} className="mx-auto mb-3 text-slate-300"/>
              <p className="font-semibold text-slate-700">
                No notifications found
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Try changing your filters.
              </p>
            </div>
          ) : (
            filteredNotifications.map(item => (
              <article
                key={item.id}
                className={`flex flex-col gap-3 rounded-xl border p-4 transition hover:border-teal-300 sm:flex-row sm:items-center sm:justify-between ${
                  item.status !== 'READ' && item.channel === 'IN_APP'
                    ? 'border-l-4 border-l-teal-500 bg-teal-50/30'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex min-w-0 items-start gap-3">

                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">
                    {item.channel === 'EMAIL' ? (
                      <Mail size={19}/>
                    ) : item.channel === 'SMS' ? (
                      <Smartphone size={19}/>
                    ) : (
                      <Bell size={19}/>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900">
                        {item.title}
                      </h3>

                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${badgeClass(item.status)}`}>
                        {item.status}
                      </span>
                    </div>

                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                      {item.message}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
                      <span>{item.type}</span>
                      <span>{item.channel}</span>
                      <span>{dateFormat(item.createdAt)}</span>
                    </div>
                  </div>

                </div>

                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => void openNotification(item)}
                    className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Eye size={14}/>
                    View
                  </button>

                  {item.channel === 'IN_APP' && item.status !== 'READ' && (
                    <button
                      onClick={() => void markAsRead(item.id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-700 hover:bg-teal-100"
                    >
                      <CheckCheck size={14}/>
                      Mark Read
                    </button>
                  )}
                </div>

              </article>
            ))
          )}

        </div>

        {/* Pagination */}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-xs text-slate-500">
            Page {page} of {totalPages} · {total} records
          </p>

          <div className="flex gap-2">
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="rounded-lg border p-2 disabled:opacity-30"
            >
              <ChevronLeft size={17}/>
            </button>

            <button
              disabled={page >= totalPages || loading}
              onClick={() => setPage(p => p + 1)}
              className="rounded-lg border p-2 disabled:opacity-30"
            >
              <ChevronRight size={17}/>
            </button>
          </div>
        </div>

      </section>

      {/* Create notification modal */}

      {showCreate && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4"
          onClick={() => setShowCreate(false)}
        >
          <section
            onClick={e => e.stopPropagation()}
            className="my-5 w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Create Notification
                </h2>
                <p className="text-xs text-slate-500">
                  Send a hospital notification.
                </p>
              </div>

              <button
                onClick={() => setShowCreate(false)}
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X size={19}/>
              </button>
            </div>

            <form onSubmit={createNotification} className="space-y-4">

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Notification Title *
                </label>
                <input
                  required
                  maxLength={180}
                  value={form.title}
                  onChange={e => setForm({...form, title: e.target.value})}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-teal-500"
                  placeholder="Enter notification title"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Message *
                </label>
                <textarea
                  required
                  maxLength={5000}
                  rows={4}
                  value={form.message}
                  onChange={e => setForm({...form, message: e.target.value})}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-teal-500"
                  placeholder="Enter notification message"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Notification Type
                  </label>
                  <select
                    value={form.type}
                    onChange={e => setForm({...form, type: e.target.value})}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  >
                    {TYPES.map(value => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Delivery Channel
                  </label>
                  <select
                    value={form.channel}
                    onChange={e => setForm({...form, channel: e.target.value})}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  >
                    {CHANNELS.map(value => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </div>
              </div>

              {form.channel === 'IN_APP' && (
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Recipient User ID *
                  </label>
                  <input
                    required
                    type="number"
                    min="1"
                    value={form.userId}
                    onChange={e => setForm({...form, userId: e.target.value})}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="Enter existing user ID"
                  />
                </div>
              )}

              {form.channel === 'EMAIL' && (
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Recipient Email *
                  </label>
                  <input
                    required
                    type="email"
                    value={form.recipientEmail}
                    onChange={e => setForm({...form, recipientEmail: e.target.value})}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="recipient@example.com"
                  />
                </div>
              )}

              {form.channel === 'SMS' && (
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Recipient Phone *
                  </label>
                  <input
                    required
                    value={form.recipientPhone}
                    onChange={e => setForm({...form, recipientPhone: e.target.value})}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="Enter phone number"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 border-t pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg border px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#142B49] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <Send size={15}/>
                  {submitting ? 'Sending...' : 'Create Notification'}
                </button>
              </div>

            </form>
          </section>
        </div>
      )}

      {/* Notification details */}

      {selected && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4"
          onClick={() => setSelected(null)}
        >
          <section
            onClick={e => e.stopPropagation()}
            className="my-5 w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-bold text-slate-900">
                Notification Details
              </h2>

              <button
                onClick={() => setSelected(null)}
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X size={18}/>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-500">Title</p>
                <p className="font-semibold text-slate-900">
                  {selected.title}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">Message</p>
                <p className="whitespace-pre-wrap text-sm text-slate-700">
                  {selected.message}
                </p>
              </div>

              {[
                ['Type', selected.type],
                ['Channel', selected.channel],
                ['Status', selected.status],
                ['Recipient User ID', selected.userId],
                ['Recipient Email', selected.recipientEmail],
                ['Recipient Phone', selected.recipientPhone],
                ['Created At', dateFormat(selected.createdAt)],
                ['Sent At', dateFormat(selected.sentAt)],
                ['Read At', dateFormat(selected.readAt)]
              ].map(([key, value]) => (
                <div key={String(key)} className="flex justify-between gap-3 border-b pb-2 text-sm">
                  <span className="text-slate-500">{key}</span>
                  <span className="break-all text-right font-medium text-slate-800">
                    {value === null || value === undefined ? '—' : String(value)}
                  </span>
                </div>
              ))}
            </div>

            {selected.channel === 'IN_APP' && selected.status !== 'READ' && (
              <button
                onClick={() => void markAsRead(selected.id)}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#142B49] px-4 py-3 text-sm font-semibold text-white"
              >
                <CheckCheck size={16}/>
                Mark as Read
              </button>
            )}
          </section>
        </div>
      )}

    </main>
  )
}
