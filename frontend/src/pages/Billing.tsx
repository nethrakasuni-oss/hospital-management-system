import { useCallback, useEffect, useMemo, useState } from 'react'
import { ReceiptText, CreditCard, Wallet, RefreshCw, Search, Eye, X, AlertCircle } from 'lucide-react'
import api from '../lib/api'

type Row = Record<string, any>
type Tab = 'invoices' | 'payments'
const endpoints: Record<Tab,string> = { invoices:'/billing/invoices', payments:'/billing/payments' }
const unwrap=(v:any):Row[]=>Array.isArray(v)?v:Array.isArray(v?.data)?v.data:Array.isArray(v?.items)?v.items:[]
const fmt=(v:any)=>v===null||v===undefined||v===''?'—':typeof v==='object'?(v.name??v.invoiceNo??v.paymentNo??JSON.stringify(v)):String(v)
const nice=(s:string)=>s.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase())
const money=(v:any,currency='LKR')=>Number.isFinite(Number(v))?`${currency} ${Number(v).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`:'—'

export default function Billing(){
 const [tab,setTab]=useState<Tab>('invoices')
 const [invoices,setInvoices]=useState<Row[]>([])
 const [payments,setPayments]=useState<Row[]>([])
 const [loading,setLoading]=useState(false)
 const [error,setError]=useState('')
 const [query,setQuery]=useState('')
 const [status,setStatus]=useState('ALL')
 const [selected,setSelected]=useState<Row|null>(null)
 const load=useCallback(async(which:Tab=tab)=>{
  setLoading(true);setError('')
  try{const r=await api.get(endpoints[which]);const data=unwrap(r.data);which==='invoices'?setInvoices(data):setPayments(data)}
  catch(e:any){setError(e?.response?.data?.message?.toString()??`Could not load ${which}. Verify the Billing API route and your permissions.`);which==='invoices'?setInvoices([]):setPayments([])}
  finally{setLoading(false)}
 },[tab])
 useEffect(()=>{void load(tab)},[tab,load])
 const source=tab==='invoices'?invoices:payments
 const filtered=useMemo(()=>source.filter(r=>{
  const q=JSON.stringify(r).toLowerCase().includes(query.toLowerCase())
  const s=status==='ALL'||String(r.status??'').toUpperCase()===status
  return q&&s
 }),[source,query,status])
 const totalInvoiced=invoices.reduce((s,r)=>s+Number(r.totalAmount??r.total??r.amount??0),0)
 const totalPaid=payments.reduce((s,r)=>s+Number(r.amount??r.paidAmount??0),0)
 const outstanding=invoices.reduce((s,r)=>s+Math.max(0,Number(r.balanceAmount??r.balance??0)),0)
 const preferred=tab==='invoices'?['invoiceNo','patient','patientId','issueDate','dueDate','totalAmount','balanceAmount','status']:['paymentNo','invoiceId','patient','amount','paymentMethod','paymentDate','status']
 const cols=filtered.length?([...preferred.filter(k=>k in filtered[0]),...Object.keys(filtered[0]).filter(k=>!preferred.includes(k)&&!/(password|token)/i.test(k))].slice(0,7)):[]

 return <main className="space-y-5">
  <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold tracking-widest text-teal-700">FINANCE & REVENUE</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Billing & Payments</h1><p className="mt-1 text-sm text-slate-500">Review invoices, payments and outstanding balances.</p></div><button onClick={()=>void load(tab)} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-slate-700"><RefreshCw size={16} className={loading?'animate-spin':''}/> Refresh</button></header>
  <section className="grid gap-3 sm:grid-cols-3">
   {[{label:'Total invoiced',value:money(totalInvoiced),icon:ReceiptText},{label:'Payments recorded',value:money(totalPaid),icon:CreditCard},{label:'Outstanding balance',value:money(outstanding),icon:Wallet}].map(x=><article key={x.label} className="flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm"><div className="grid h-10 w-10 place-items-center rounded-lg bg-teal-50 text-teal-700"><x.icon size={19}/></div><div><p className="text-xs text-slate-500">{x.label}</p><p className="text-xl font-bold text-slate-900">{x.value}</p></div></article>)}
  </section>
  <section className="rounded-xl border bg-white p-4 shadow-sm">
   <div className="flex flex-wrap gap-2 border-b pb-4">{(['invoices','payments'] as Tab[]).map(t=><button key={t} onClick={()=>{setTab(t);setQuery('');setStatus('ALL');setSelected(null)}} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab===t?'bg-[#142B49] text-white':'text-slate-600 hover:bg-slate-100'}`}>{t==='invoices'?'Invoices':'Payments'}</button>)}</div>
   <div className="flex flex-wrap items-center justify-between gap-3 py-4"><div><h2 className="font-semibold text-slate-900">{tab==='invoices'?'Invoice register':'Payment register'}</h2><p className="text-xs text-slate-500">{endpoints[tab]}</p></div><div className="flex flex-wrap gap-2"><label className="flex items-center gap-2 rounded-lg border px-3 text-slate-400"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search records" className="w-44 py-2 text-sm text-slate-700 outline-none"/></label><select value={status} onChange={e=>setStatus(e.target.value)} className="rounded-lg border px-3 py-2 text-sm"><option value="ALL">All statuses</option>{['DRAFT','PENDING','PARTIALLY_PAID','PAID','OVERDUE','CANCELLED','COMPLETED','REFUNDED'].map(s=><option key={s}>{s}</option>)}</select></div></div>
   {error&&<div role="alert" className="mb-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><AlertCircle size={17}/>{error}</div>}
   <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{cols.map(c=><th key={c} className="px-3 py-3">{nice(c)}</th>)}<th className="px-3 py-3">Details</th></tr></thead><tbody className="divide-y">{loading?<tr><td colSpan={Math.max(cols.length+1,1)} className="p-8 text-center text-slate-500">Loading…</td></tr>:filtered.length===0?<tr><td colSpan={Math.max(cols.length+1,1)} className="p-8 text-center text-slate-500">{error?'Unable to retrieve records.':'No records found.'}</td></tr>:filtered.map((r,i)=><tr key={r.id??i} className="hover:bg-slate-50">{cols.map(c=><td key={c} className="max-w-56 truncate px-3 py-3 text-slate-700">{fmt(r[c])}</td>)}<td className="px-3 py-3"><button onClick={()=>setSelected(r)} className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700"><Eye size={14}/> View</button></td></tr>)}</tbody></table></div>
   <p className="mt-3 text-xs text-slate-400">Showing {filtered.length} of {source.length} records. Totals are calculated from fields returned by the API.</p>
  </section>
  {selected&&<div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-slate-950/50 p-4" onClick={()=>setSelected(null)}><section onClick={e=>e.stopPropagation()} className="my-5 max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-bold">Record details</h2><p className="text-xs text-slate-500">{tab==='invoices'?'Invoice':'Payment'}</p></div><button onClick={()=>setSelected(null)} className="rounded-lg p-2 hover:bg-slate-100"><X size={18}/></button></div><div className="grid gap-3 sm:grid-cols-2">{Object.entries(selected).filter(([k])=>!/(password|token)/i.test(k)).map(([k,v])=><div key={k} className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">{nice(k)}</p><p className="mt-1 break-words text-sm font-medium text-slate-800">{fmt(v)}</p></div>)}</div></section></div>}
 </main>
}
