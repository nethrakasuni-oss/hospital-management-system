import { useCallback, useEffect, useState, type ElementType } from 'react'
import {
  Activity,
  AlertCircle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  FileCheck2,
  FileText,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'

type ReportData = Record<string, any>

const money = (value: unknown) => {
  const amount = Number(value ?? 0)
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0)
}

const count = (value: unknown) =>
  new Intl.NumberFormat('en-LK').format(Number(value ?? 0) || 0)

function Metric({
  label,
  value,
  helper,
  icon: Icon,
  tone = 'indigo',
}: {
  label: string
  value: string
  helper?: string
  icon: ElementType
  tone?: 'indigo' | 'teal' | 'amber' | 'green' | 'rose'
}) {
  const tones = {
    indigo: 'bg-indigo-50 text-indigo-700',
    teal: 'bg-teal-50 text-teal-700',
    amber: 'bg-amber-50 text-amber-700',
    green: 'bg-emerald-50 text-emerald-700',
    rose: 'bg-rose-50 text-rose-700',
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 break-words text-xl font-bold tracking-tight text-slate-900">{value}</p>
          {helper && <p className="mt-1 text-xs text-slate-500">{helper}</p>}
        </div>
        <span className={`rounded-lg p-2 ${tones[tone]}`}>
          <Icon size={19} />
        </span>
      </div>
    </div>
  )
}

function StatusRow({ label, value, total }: { label: string; value: number; total: number }) {
  const percentage = total > 0 ? Math.min(100, (value / total) * 100) : 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="capitalize text-slate-600">{label.replaceAll('_', ' ').toLowerCase()}</span>
        <span className="font-semibold tabular-nums text-slate-900">{count(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-indigo-600" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  )
}

export default function ReportsAnalytics() {
  const { user } = useAuth()
  const accountant = user?.role?.toUpperCase() === 'ACCOUNTANT'
  const [data, setData] = useState<ReportData>({})
  const [errors, setErrors] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const allowed: [string, string][] = accountant
      ? [
          ['Billing', '/billing/statistics/overview'],
          ['Insurance', '/insurance/statistics/overview'],
        ]
      : [
          ['Billing', '/billing/statistics/overview'],
          ['Insurance', '/insurance/statistics/overview'],
          ['Pharmacy', '/pharmacy/dashboard'],
          ['Laboratory', '/laboratory/statistics/overview'],
          ['Inpatient', '/inpatient/dashboard'],
          ['Attendance', '/attendance/statistics/overview'],
          ['Appointments', '/appointments/daily'],
        ]

    const results = await Promise.all(
      allowed.map(async ([label, url]) => {
        try {
          const response = await api.get(url)
          return [label, response.data, null] as const
        } catch (error: any) {
          return [
            label,
            null,
            `${label}: ${error?.response?.data?.message ?? 'Report unavailable for this role'}`,
          ] as const
        }
      }),
    )

    const next: ReportData = {}
    const nextErrors: string[] = []
    results.forEach(([key, value, error]) => {
      if (value !== null) next[key] = value
      if (error) nextErrors.push(error)
    })
    setData(next)
    setErrors(nextErrors)
    setLastUpdated(new Date())
    setLoading(false)
  }, [accountant])

  useEffect(() => {
    void load()
  }, [load])

  const billing = data.Billing ?? {}
  const insurance = data.Insurance ?? {}
  const claimStatuses = insurance.byStatus ?? {}
  const totalClaims = Number(insurance.totalClaims ?? 0)
  const statusEntries = Object.entries(claimStatuses) as [string, number][]
  const currencyMetrics = [
    { label: 'Total invoiced', value: billing.totalInvoiced, icon: FileText, tone: 'indigo' as const },
    { label: 'Total collected', value: billing.totalCollected, icon: Wallet, tone: 'green' as const },
    { label: 'Outstanding balance', value: billing.totalOutstanding, icon: AlertCircle, tone: 'amber' as const },
  ]
  const invoiceMetrics = [
    { label: 'Total invoices', value: billing.invoiceCount },
    { label: 'Fully paid', value: billing.fullyPaidInvoices },
    { label: 'Partially paid', value: billing.partiallyPaidInvoices },
    { label: 'Unpaid', value: billing.unpaidInvoices },
  ]

  if (accountant) {
    return (
      <div className="space-y-6">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-teal-700">FINANCE WORKSPACE</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Reports &amp; Analytics</h1>
            <p className="mt-1 text-sm text-slate-500">Billing performance, collections and insurance claim summaries.</p>
            {lastUpdated && (
              <p className="mt-1 text-xs text-slate-400">Last updated: {lastUpdated.toLocaleTimeString()}</p>
            )}
          </div>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh reports
          </button>
        </header>

        {errors.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Some report data could not be loaded.</p>
              <p className="mt-1">{errors.join(' · ')}</p>
            </div>
          </div>
        )}

        <section>
          <div className="mb-3 flex items-center gap-2">
            <CreditCard size={18} className="text-indigo-700" />
            <h2 className="font-semibold text-slate-900">Billing &amp; collections</h2>
          </div>
          {loading && !data.Billing ? (
            <div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">Loading billing report…</div>
          ) : !data.Billing ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Billing report is unavailable. Check the accountant's report permissions.</div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {currencyMetrics.map((metric) => (
                  <Metric
                    key={metric.label}
                    label={metric.label}
                    value={money(metric.value)}
                    icon={metric.icon}
                    tone={metric.tone}
                  />
                ))}
              </div>
              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-slate-800">Invoice summary</h3>
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                  {invoiceMetrics.map((metric) => (
                    <div key={metric.label} className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">{metric.label}</p>
                      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{count(metric.value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck size={18} className="text-indigo-700" />
            <h2 className="font-semibold text-slate-900">Insurance claims</h2>
          </div>
          {loading && !data.Insurance ? (
            <div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">Loading insurance report…</div>
          ) : !data.Insurance ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Insurance report is unavailable. Check the accountant's report permissions.</div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="Total claims" value={count(totalClaims)} icon={FileCheck2} tone="indigo" />
                <Metric label="Total claimed" value={money(insurance.claimedAmount)} icon={FileText} tone="teal" />
                <Metric label="Approved amount" value={money(insurance.approvedAmount)} icon={CheckCircle2} tone="green" />
                <Metric label="Paid amount" value={money(insurance.paidAmount)} icon={Wallet} tone="indigo" />
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-slate-900">Claim status breakdown</h3>
                    <span className="text-xs text-slate-500">{count(totalClaims)} claims</span>
                  </div>
                  {statusEntries.length > 0 ? (
                    <div className="mt-4 space-y-4">
                      {statusEntries.map(([status, value]) => (
                        <StatusRow key={status} label={status} value={Number(value)} total={totalClaims} />
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-500">No claim status data available.</p>
                  )}
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="font-semibold text-slate-900">Settlement overview</h3>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-lg bg-amber-50 p-3">
                      <p className="text-sm text-amber-800">Outstanding approved amount</p>
                      <p className="mt-1 text-xl font-bold text-amber-900">{money(insurance.outstandingApprovedAmount)}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-sm text-slate-600">Approval progress</p>
                      <p className="mt-1 text-xl font-bold text-slate-900">
                        {money(insurance.approvedAmount)} approved
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {money(insurance.paidAmount)} received so far
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    )
  }

  const cards = [
    { title: 'Billing & collections', key: 'Billing', icon: CreditCard },
    { title: 'Insurance claims', key: 'Insurance', icon: ShieldCheck },
    { title: 'Pharmacy', key: 'Pharmacy', icon: BarChart3 },
    { title: 'Laboratory', key: 'Laboratory', icon: Activity },
    { title: 'Inpatient occupancy', key: 'Inpatient', icon: BarChart3 },
    { title: 'Staff attendance', key: 'Attendance', icon: CalendarDays },
    { title: "Today's appointments", key: 'Appointments', icon: TrendingUp },
  ]

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-widest text-teal-700">REPORTING</p>
          <h1 className="text-2xl font-bold">Reports &amp; Analytics</h1>
          <p className="text-sm text-slate-500">Hospital operational and financial reports</p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm disabled:opacity-60">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />Refresh
        </button>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => {
          const Icon = card.icon
          const value = data[card.key]
          return (
            <article key={card.key} className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="flex justify-between">
                <div>
                  <h2 className="font-semibold">{card.title}</h2>
                  <p className="mt-1 text-xs text-slate-500">Live report endpoint</p>
                </div>
                <Icon className="text-indigo-700" />
              </div>
              {loading ? (
                <p className="mt-5 text-sm text-slate-500">Loading…</p>
              ) : value ? (
                <pre className="mt-4 max-h-52 overflow-auto rounded-lg bg-slate-50 p-3 text-xs">{JSON.stringify(value, null, 2)}</pre>
              ) : (
                <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Report unavailable or permission denied.</p>
              )}
            </article>
          )
        })}
      </div>
      {errors.length > 0 && <p className="text-xs text-slate-400">Some reports are unavailable: {errors.join(' · ')}</p>}
    </div>
  )
}
