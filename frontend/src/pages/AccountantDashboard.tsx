import { useCallback, useEffect, useState } from 'react'
import { BadgeCheck, ClipboardCheck, CreditCard, RefreshCw, ShieldCheck, Wallet } from 'lucide-react'
import api from '../lib/api'

type Stats = Record<string, any>
const money = (v: unknown) => `LKR ${Number(v ?? 0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`
export default function AccountantDashboard() {
  const [billing,setBilling] = useState<Stats|null>(null)
  const [insurance,setInsurance] = useState<Stats|null>(null)
  const [pending,setPending] = useState<any[]>([])
  const [claims,setClaims] = useState<any[]>([])
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState('')
  const load = useCallback(async()=>{
    setLoading(true); setError('')
    const results = await Promise.allSettled([
      api.get('/billing/statistics/overview'), api.get('/insurance/statistics/overview'),
      api.get('/billing/invoices/pending-verification'), api.get('/insurance/claims',{params:{status:'SUBMITTED'}}),
    ])
    if(results[0].status==='fulfilled') setBilling(results[0].value.data)
    if(results[1].status==='fulfilled') setInsurance(results[1].value.data)
    if(results[2].status==='fulfilled') setPending(Array.isArray(results[2].value.data)?results[2].value.data:[])
    if(results[3].status==='fulfilled') setClaims(Array.isArray(results[3].value.data)?results[3].value.data:[])
    if(results.every(x=>x.status==='rejected')) setError('Unable to load accountant summaries. Check your REPORT_VIEW and insurance permissions.')
    setLoading(false)
  },[])
  useEffect(()=>{void load()},[load])
  const cards=[
    {label:'Total invoiced',value:money(billing?.totalInvoiced),icon:CreditCard},
    {label:'Total collected',value:money(billing?.totalCollected),icon:Wallet},
    {label:'Outstanding',value:money(billing?.totalOutstanding),icon:BadgeCheck},
    {label:'Invoices awaiting review',value:String(pending.length),icon:ClipboardCheck},
    {label:'Insurance claims awaiting review',value:String(claims.length),icon:ShieldCheck},
    {label:'Insurance claims',value:String(insurance?.totalClaims ?? '—'),icon:ShieldCheck},
  ]
  return <div className="space-y-5"><header className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold tracking-widest text-teal-700">FINANCE WORKSPACE</p><h1 className="text-2xl font-bold text-slate-900">Accountant Dashboard</h1><p className="text-sm text-slate-500">Invoices, collections and insurance claim verification.</p></div><button onClick={()=>void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><RefreshCw size={15} className={loading?'animate-spin':''}/>Refresh</button></header>
  {error&&<p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{error}</p>}
  <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{cards.map(c=><article key={c.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-sm text-slate-500">{c.label}</span><c.icon className="text-teal-700" size={20}/></div><p className="mt-3 text-2xl font-bold text-slate-900">{loading?'…':c.value}</p></article>)}</section>
  <section className="grid gap-4 lg:grid-cols-2"><article className="rounded-xl border bg-white p-4"><h2 className="font-semibold">Pending invoice verification</h2>{pending.length===0?<p className="py-6 text-sm text-slate-500">No invoices awaiting review.</p>:pending.slice(0,8).map(x=><div key={x.id} className="flex justify-between border-b py-3 text-sm"><span>{x.invoiceNumber} · {x.patient?.firstName} {x.patient?.lastName}</span><strong>{money(x.totalAmount)}</strong></div>)}</article><article className="rounded-xl border bg-white p-4"><h2 className="font-semibold">Insurance claims awaiting review</h2>{claims.length===0?<p className="py-6 text-sm text-slate-500">No submitted claims awaiting review.</p>:claims.slice(0,8).map(x=><div key={x.id} className="flex justify-between border-b py-3 text-sm"><span>{x.claimNumber} · {x.patient?.firstName} {x.patient?.lastName}</span><strong>{money(x.claimedAmount)}</strong></div>)}</article></section>
  <p className="text-xs text-slate-400">This dashboard intentionally excludes clinical operations, laboratory workload, inpatient occupancy and staff attendance.</p></div>
}
