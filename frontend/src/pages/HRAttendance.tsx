import { useCallback, useEffect, useMemo, useState } from 'react'
import { Users, CalendarCheck, Clock3, ClipboardList, RefreshCw, Search, Eye, X, AlertCircle } from 'lucide-react'
import api from '../lib/api'

type Row = Record<string, any>
type Tab = 'employees' | 'attendance' | 'leaves' | 'corrections'
const resources: Record<Tab,{title:string;endpoint:string}> = {
 employees:{title:'Employees',endpoint:'/employees'},
 attendance:{title:'Attendance Records',endpoint:'/attendance'},
 leaves:{title:'Leave Records',endpoint:'/attendance/leaves'},
 corrections:{title:'Attendance Corrections',endpoint:'/attendance/corrections'},
}
const rows=(v:any):Row[]=>Array.isArray(v)?v:Array.isArray(v?.data)?v.data:Array.isArray(v?.items)?v.items:[]
const value=(v:any)=>v===null||v===undefined||v===''?'—':typeof v==='object'?(v.name??v.fullName??JSON.stringify(v)):String(v)
const nice=(v:string)=>v.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase())

export default function HRAttendance(){
 const [tab,setTab]=useState<Tab>('employees')
 const [employees,setEmployees]=useState<Row[]>([])
 const [attendance,setAttendance]=useState<Row[]>([])
 const [leaves,setLeaves]=useState<Row[]>([])
 const [corrections,setCorrections]=useState<Row[]>([])
 const [loading,setLoading]=useState(false)
 const [error,setError]=useState('')
 const [search,setSearch]=useState('')
 const [selected,setSelected]=useState<Row|null>(null)
 const target=resources[tab]
 const store=(key:Tab,data:Row[])=>{if(key==='employees')setEmployees(data);if(key==='attendance')setAttendance(data);if(key==='leaves')setLeaves(data);if(key==='corrections')setCorrections(data)}
 const load=useCallback(async(key:Tab=tab)=>{
  setLoading(true);setError('')
  try{const response=await api.get(resources[key].endpoint);store(key,rows(response.data))}
  catch(e:any){setError(e?.response?.data?.message?.toString()??`Unable to load ${resources[key].title}. Verify the API route and access permissions.`);store(key,[])}
  finally{setLoading(false)}
 },[tab])
 useEffect(()=>{void load(tab)},[tab,load])
 const current=tab==='employees'?employees:tab==='attendance'?attendance:tab==='leaves'?leaves:corrections
 const filtered=useMemo(()=>current.filter(r=>JSON.stringify(r).toLowerCase().includes(search.toLowerCase())),[current,search])
 const preferred:Record<Tab,string[]>={employees:['employeeNo','firstName','lastName','designation','department','joinedDate','isActive'],attendance:['employee','employeeId','date','checkIn','checkOut','hoursWorked','status'],leaves:['employee','employeeId','leaveType','startDate','endDate','status'],corrections:['employee','employeeId','attendanceDate','requestedCheckIn','requestedCheckOut','reason','status']}
 const columns=filtered.length?[...preferred[tab].filter(k=>k in filtered[0]),...Object.keys(filtered[0]).filter(k=>!preferred[tab].includes(k)&&!/(password|token)/i.test(k))].slice(0,7):[]
 const statCards=[{label:'Employees',count:employees.length,icon:Users},{label:'Attendance records',count:attendance.length,icon:CalendarCheck},{label:'Leave records',count:leaves.length,icon:Clock3},{label:'Correction requests',count:corrections.length,icon:ClipboardList}]
 return <main className="space-y-5">
  <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold tracking-widest text-teal-700">PEOPLE & WORKFORCE</p><h1 className="mt-1 text-2xl font-bold text-slate-900">HR & Attendance</h1><p className="mt-1 text-sm text-slate-500">Review employee profiles, attendance, leave and correction records.</p></div><button onClick={()=>void load(tab)} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"><RefreshCw size={16} className={loading?'animate-spin':''}/> Refresh</button></header>
  <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{statCards.map(s=><article key={s.label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="grid h-10 w-10 place-items-center rounded-lg bg-teal-50 text-teal-700"><s.icon size={19}/></div><div><p className="text-xs text-slate-500">{s.label}</p><p className="text-2xl font-bold text-slate-900">{s.count}</p></div></article>)}</section>
  <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
   <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-4">{(Object.keys(resources) as Tab[]).map(t=><button key={t} onClick={()=>{setTab(t);setSearch('');setSelected(null)}} className={`rounded-lg px-3 py-2 text-sm font-semibold capitalize ${tab===t?'bg-[#142B49] text-white':'text-slate-600 hover:bg-slate-100'}`}>{t}</button>)}</div>
   <div className="flex flex-wrap items-center justify-between gap-3 py-4"><div><h2 className="font-semibold text-slate-900">{target.title}</h2><p className="text-xs text-slate-500">{target.endpoint}</p></div><label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 text-slate-400"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search records..." className="w-48 py-2 text-sm text-slate-700 outline-none"/></label></div>
   {error&&<div role="alert" className="mb-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><AlertCircle size={17}/>{error}</div>}
   <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{columns.map(c=><th key={c} className="px-3 py-3">{nice(c)}</th>)}<th className="px-3 py-3">Details</th></tr></thead><tbody className="divide-y divide-slate-100">{loading?<tr><td colSpan={Math.max(columns.length+1,1)} className="p-8 text-center text-slate-500">Loading…</td></tr>:filtered.length===0?<tr><td colSpan={Math.max(columns.length+1,1)} className="p-8 text-center text-slate-500">{error?'Unable to retrieve records.':'No records found.'}</td></tr>:filtered.map((r,i)=><tr key={r.id??i} className="hover:bg-slate-50">{columns.map(c=><td key={c} className="max-w-56 truncate px-3 py-3 text-slate-700">{value(r[c])}</td>)}<td className="px-3 py-3"><button onClick={()=>setSelected(r)} className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700"><Eye size={14}/> View</button></td></tr>)}</tbody></table></div>
   <p className="mt-3 text-xs text-slate-400">Showing {filtered.length} of {current.length} records. Read-only view.</p>
  </section>
  {selected&&<div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-slate-950/50 p-4" onClick={()=>setSelected(null)}><section onClick={e=>e.stopPropagation()} className="my-5 max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-bold text-slate-900">Record details</h2><p className="text-xs text-slate-500">{target.title}</p></div><button onClick={()=>setSelected(null)} className="rounded-lg p-2 hover:bg-slate-100"><X size={18}/></button></div><div className="grid gap-3 sm:grid-cols-2">{Object.entries(selected).filter(([k])=>!/(password|token)/i.test(k)).map(([k,v])=><div key={k} className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">{nice(k)}</p><p className="mt-1 break-words text-sm font-medium text-slate-800">{value(v)}</p></div>)}</div></section></div>}
 </main>
}
