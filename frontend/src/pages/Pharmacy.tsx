import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, RefreshCw, Search, X, Package, Tags, Activity, AlertTriangle } from 'lucide-react'
import api from '../lib/api'

type Row = Record<string, any>
type Tab = 'medicines' | 'categories' | 'stock' | 'transactions'
const listOf = (v: any): Row[] => Array.isArray(v) ? v : Array.isArray(v?.data) ? v.data : Array.isArray(v?.items) ? v.items : []
const errorText = (e: any) => e?.response?.data?.message?.toString() ?? 'The request could not be completed. Check the API and your role permissions.'

export default function Pharmacy() {
  const [tab, setTab] = useState<Tab>('medicines')
  const [medicines, setMedicines] = useState<Row[]>([])
  const [categories, setCategories] = useState<Row[]>([])
  const [overview, setOverview] = useState<Row | null>(null)
  const [transactions, setTransactions] = useState<Row[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Record<string,string>>({})

  const load = useCallback(async () => {
    setLoading(true); setError('')
    const results = await Promise.allSettled([
      api.get('/pharmacy/medicines?includeInactive=true'), api.get('/pharmacy/categories'),
      api.get('/pharmacy/stock/overview'), api.get('/pharmacy/stock/transactions'),
    ])
    if (results[0].status === 'fulfilled') setMedicines(listOf(results[0].value.data))
    else setError(errorText(results[0].reason))
    if (results[1].status === 'fulfilled') setCategories(listOf(results[1].value.data))
    if (results[2].status === 'fulfilled') setOverview(results[2].value.data)
    if (results[3].status === 'fulfilled') setTransactions(listOf(results[3].value.data))
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])

  const filteredMedicines = useMemo(() => medicines.filter(m => `${m.code} ${m.name} ${m.genericName ?? ''} ${m.manufacturer ?? ''}`.toLowerCase().includes(query.toLowerCase())), [medicines, query])
  const filteredCategories = useMemo(() => categories.filter(c => `${c.name} ${c.description ?? ''}`.toLowerCase().includes(query.toLowerCase())), [categories, query])
  const filteredTransactions = useMemo(() => transactions.filter(t => JSON.stringify(t).toLowerCase().includes(query.toLowerCase())), [transactions, query])
  const open = (kind: string) => { setForm({ kind }); setModal(true) }
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const f = form
      if (f.kind === 'medicine') await api.post('/pharmacy/medicines', { code:f.code, name:f.name, genericName:f.genericName || undefined, manufacturer:f.manufacturer || undefined, unit:f.unit, sellingPrice:Number(f.sellingPrice), categoryId:f.categoryId ? Number(f.categoryId) : undefined })
      if (f.kind === 'category') await api.post('/pharmacy/categories', { name:f.name, description:f.description || undefined })
      if (f.kind === 'batch') await api.post('/pharmacy/batches', { medicineId:Number(f.medicineId), batchNumber:f.batchNumber, quantity:Number(f.quantity), costPrice:Number(f.costPrice), expiryDate:f.expiryDate || undefined, supplierId:f.supplierId ? Number(f.supplierId) : undefined })
      if (f.kind === 'adjust') await api.post('/pharmacy/stock/adjustments', { medicineId:Number(f.medicineId), quantity:Number(f.quantity), type:f.type, batchId:f.batchId ? Number(f.batchId) : undefined, notes:f.notes })
      setModal(false); await load()
    } catch (e: any) { setError(errorText(e)) } finally { setSaving(false) }
  }
  const title = tab === 'medicines' ? 'Medicine Catalogue' : tab === 'categories' ? 'Medicine Categories' : tab === 'stock' ? 'Stock Overview' : 'Inventory Transactions'
  const tabs: {id:Tab;label:string;icon:any}[] = [{id:'medicines',label:'Medicines',icon:Package},{id:'categories',label:'Categories',icon:Tags},{id:'stock',label:'Stock overview',icon:Activity},{id:'transactions',label:'Transactions',icon:RefreshCw}]

  return <main className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold tracking-widest text-teal-700">PHARMACY OPERATIONS</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Pharmacy & Inventory</h1><p className="mt-1 text-sm text-slate-500">Manage medicines, categories, batches and stock movements.</p></div><div className="flex gap-2"><button onClick={()=>void load()} className="rounded-lg border border-slate-200 p-2.5 text-slate-600" title="Refresh"><RefreshCw size={17}/></button><button onClick={()=>open(tab==='medicines'?'medicine':tab==='categories'?'category':tab==='stock'?'batch':'adjust')} className="flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white"><Plus size={16}/>{tab==='medicines'?'Add medicine':tab==='categories'?'Add category':tab==='stock'?'Add stock batch':'Adjust stock'}</button></div></header>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[{label:'Medicines',value:medicines.length,icon:Package},{label:'Categories',value:categories.length,icon:Tags},{label:'Low stock items',value:overview?.lowStock?.length ?? overview?.lowStockCount ?? '—',icon:AlertTriangle},{label:'Expiring soon',value:overview?.expiringSoon?.length ?? overview?.expiringCount ?? '—',icon:Activity}].map(x=><article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between text-slate-500"><span className="text-sm">{x.label}</span><x.icon size={18}/></div><p className="mt-3 text-2xl font-bold text-slate-900">{x.value}</p></article>)}</section>
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><nav className="flex flex-wrap gap-2">{tabs.map(t=><button key={t.id} onClick={()=>{setTab(t.id);setQuery('')}} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${tab===t.id?'bg-[#142B49] text-white':'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}><t.icon size={15}/>{t.label}</button>)}</nav><label className="flex min-w-52 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-slate-400"><Search size={16}/><input className="w-full text-sm text-slate-700 outline-none" placeholder="Search records..." value={query} onChange={e=>setQuery(e.target.value)}/></label></div>
      <div className="mt-5"><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold text-slate-900">{title}</h2><span className="text-xs text-slate-400">{loading?'Loading…':tab==='medicines'?filteredMedicines.length:tab==='categories'?filteredCategories.length:tab==='transactions'?filteredTransactions.length:'Live API data'}</span></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{(tab==='medicines'?['Code','Medicine','Generic name','Category','Unit','Selling price','Status']:tab==='categories'?['Category','Description','Medicines']:tab==='transactions'?['Date','Medicine','Batch','Type','Quantity','Notes']:['Medicine','Batch','On hand','Expiry date','Supplier','Stock status']).map(h=><th className="px-3 py-3 font-semibold">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">
      {tab==='medicines' && (filteredMedicines.length?filteredMedicines.map(m=><tr><td className="px-3 py-3 font-medium">{m.code}</td><td className="px-3 py-3">{m.name}</td><td className="px-3 py-3">{m.genericName??'—'}</td><td className="px-3 py-3">{m.category?.name??'—'}</td><td className="px-3 py-3">{m.unit}</td><td className="px-3 py-3">{Number(m.sellingPrice??0).toLocaleString()}</td><td className="px-3 py-3">{m.active===false?'Inactive':'Active'}</td></tr>):<tr><td colSpan={7} className="p-8 text-center text-slate-500">{loading?'Loading medicines…':'No medicines found.'}</td></tr>)}
      {tab==='categories' && (filteredCategories.length?filteredCategories.map(c=><tr><td className="px-3 py-3 font-medium">{c.name}</td><td className="px-3 py-3">{c.description??'—'}</td><td className="px-3 py-3">{c._count?.medicines??'—'}</td></tr>):<tr><td colSpan={3} className="p-8 text-center text-slate-500">No categories found.</td></tr>)}
      {tab==='transactions' && (filteredTransactions.length?filteredTransactions.map(t=><tr><td className="px-3 py-3">{t.createdAt?new Date(t.createdAt).toLocaleString():'—'}</td><td className="px-3 py-3">{t.medicine?.name??`#${t.medicineId}`}</td><td className="px-3 py-3">{t.batch?.batchNumber??'—'}</td><td className="px-3 py-3">{t.type}</td><td className="px-3 py-3">{t.quantity}</td><td className="px-3 py-3">{t.notes??'—'}</td></tr>):<tr><td colSpan={6} className="p-8 text-center text-slate-500">No inventory transactions found.</td></tr>)}
      {tab==='stock' && (listOf(overview?.batches ?? overview?.stockItems ?? overview?.items).length?listOf(overview?.batches ?? overview?.stockItems ?? overview?.items).filter(x=>JSON.stringify(x).toLowerCase().includes(query.toLowerCase())).map(b=><tr><td className="px-3 py-3">{b.medicine?.name??'—'}</td><td className="px-3 py-3">{b.batchNumber}</td><td className="px-3 py-3 font-semibold">{b.quantity}</td><td className="px-3 py-3">{b.expiryDate?new Date(b.expiryDate).toLocaleDateString():'—'}</td><td className="px-3 py-3">{b.supplier?.name??'—'}</td><td className="px-3 py-3">{b.quantity<=10?'Low stock':'Normal'}</td></tr>):<tr><td colSpan={6} className="p-8 text-center text-slate-500">Stock overview returned no batch list. Review the summary response or use transactions.</td></tr>)}
      </tbody></table></div></div>
    </section>
    {modal && <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-slate-950/50 p-4"><form onSubmit={submit} className="my-5 w-full max-w-xl space-y-3 rounded-2xl bg-white p-5 shadow-xl"><div className="flex items-center justify-between"><h2 className="font-bold text-slate-900">{form.kind==='medicine'?'Add medicine':form.kind==='category'?'Add category':form.kind==='batch'?'Add stock batch':'Adjust stock'}</h2><button type="button" onClick={()=>setModal(false)} className="rounded-lg p-2 hover:bg-slate-100"><X size={18}/></button></div>
      {form.kind==='medicine' && <>{[['code','Medicine code'],['name','Medicine name'],['genericName','Generic name'],['manufacturer','Manufacturer'],['unit','Unit (tablet, bottle...)'],['sellingPrice','Selling price']].map(([k,l])=><label className="block text-sm font-medium text-slate-700">{l}{k==='sellingPrice'?<input required type="number" min="0" step="0.01" value={form[k]??''} onChange={e=>setForm({...form,[k]:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5"/>:<input required={['code','name','unit'].includes(k)} value={form[k]??''} onChange={e=>setForm({...form,[k]:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5"/>}</label>)}<label className="block text-sm">Category<select value={form.categoryId??''} onChange={e=>setForm({...form,categoryId:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5"><option value="">No category</option>{categories.map(c=><option value={c.id}>{c.name}</option>)}</select></label></>}
      {form.kind==='category' && <><label className="block text-sm">Category name *<input required value={form.name??''} onChange={e=>setForm({...form,name:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5"/></label><label className="block text-sm">Description<textarea value={form.description??''} onChange={e=>setForm({...form,description:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5"/></label></>}
      {(form.kind==='batch'||form.kind==='adjust') && <><label className="block text-sm">Medicine *<select required value={form.medicineId??''} onChange={e=>setForm({...form,medicineId:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5"><option value="">Select medicine</option>{medicines.map(m=><option value={m.id}>{m.code} – {m.name}</option>)}</select></label><label className="block text-sm">Quantity *<input required type="number" min="1" value={form.quantity??''} onChange={e=>setForm({...form,quantity:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5"/></label>{form.kind==='batch'?<><label className="block text-sm">Batch number *<input required value={form.batchNumber??''} onChange={e=>setForm({...form,batchNumber:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5"/></label><label className="block text-sm">Cost price *<input required type="number" min="0" step="0.01" value={form.costPrice??''} onChange={e=>setForm({...form,costPrice:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5"/></label><label className="block text-sm">Expiry date<input type="date" value={form.expiryDate??''} onChange={e=>setForm({...form,expiryDate:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5"/></label><label className="block text-sm">Supplier ID (optional)<input type="number" min="1" value={form.supplierId??''} onChange={e=>setForm({...form,supplierId:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5"/></label></>:<><label className="block text-sm">Adjustment type<select required value={form.type??'ADJUSTMENT'} onChange={e=>setForm({...form,type:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5"><option>ADJUSTMENT</option><option>RETURN</option><option>EXPIRED</option></select></label><label className="block text-sm">Batch ID (optional)<input type="number" min="1" value={form.batchId??''} onChange={e=>setForm({...form,batchId:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5"/></label><label className="block text-sm">Notes *<textarea required value={form.notes??''} onChange={e=>setForm({...form,notes:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5"/></label></>}</>}
      <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={()=>setModal(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={saving} className="rounded-lg bg-teal-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving?'Saving…':'Save'}</button></div>
    </form></div>}
  </main>
}
