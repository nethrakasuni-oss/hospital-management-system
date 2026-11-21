import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, RefreshCw, Search, X, Truck, ClipboardList } from 'lucide-react'
import api from '../lib/api'
type Row=Record<string,any>
const rows=(v:any):Row[]=>Array.isArray(v)?v:Array.isArray(v?.data)?v.data:Array.isArray(v?.items)?v.items:[]
const msg = (e: any) => e?.response?.data?.message?.toString() ?? 'Request failed. Check API availability and your role permissions.'
export default function Procurement() {
     const [selectedOrder, setSelectedOrder] = useState<Row | null>(null)
 const [tab,T]=useState<'suppliers'|'orders'>('suppliers'),[suppliers,S]=useState<Row[]>([]),[orders,O]=useState<Row[]>([]),[medicines,M]=useState<Row[]>([]),[loading,L]=useState(false),[error,E]=useState(''),[query,Q]=useState(''),[modal,D]=useState(''),[saving,V]=useState(false),[f,F]=useState<Record<string,string>>({})
 const load=useCallback(async()=>{L(true);E('');const r=await Promise.allSettled([api.get('/pharmacy-procurement/suppliers'),api.get('/pharmacy-procurement/purchase-orders'),api.get('/pharmacy/medicines')]);if(r[0].status==='fulfilled')S(rows(r[0].value.data));else E(msg(r[0].reason));if(r[1].status==='fulfilled')O(rows(r[1].value.data));if(r[2].status==='fulfilled')M(rows(r[2].value.data));L(false)},[])
 useEffect(()=>{void load()},[load])
 const supplierList=useMemo(()=>suppliers.filter(s=>JSON.stringify(s).toLowerCase().includes(query.toLowerCase())),[suppliers,query]);const orderList=useMemo(()=>orders.filter(o=>JSON.stringify(o).toLowerCase().includes(query.toLowerCase())),[orders,query])
 const open=(kind:string)=>{F({kind});D(kind)}
 const submit=async(e:React.FormEvent)=>{e.preventDefault();V(true);E('');try{if(modal==='supplier')await api.post('/pharmacy-procurement/suppliers',{name:f.name,code:f.code||undefined,contactPerson:f.contactPerson||undefined,email:f.email||undefined,phone:f.phone||undefined,address:f.address||undefined});if(modal==='order')await api.post('/pharmacy-procurement/purchase-orders',{supplierId:Number(f.supplierId),expectedAt:f.expectedAt||undefined,notes:f.notes||undefined,items:[{medicineId:Number(f.medicineId),quantityOrdered:Number(f.quantityOrdered),unitCost:Number(f.unitCost),description:f.description||undefined}]});if(modal==='receive')await api.post(`/pharmacy-procurement/purchase-orders/${f.orderId}/receive`,{items:[{itemId:Number(f.itemId),quantityReceived:Number(f.quantityReceived),batchNumber:f.batchNumber,expiryDate:f.expiryDate||undefined}],notes:f.notes||undefined});D('');await load()}catch(e:any){E(msg(e))}finally{V(false)}}
 const act=async(id:number,action:'submit'|'cancel')=>{try{await api.patch(`/pharmacy-procurement/purchase-orders/${id}/${action}`);await load()}catch(e:any){E(msg(e))}}
 return <main className="space-y-5"><header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold tracking-widest text-teal-700">SUPPLY CHAIN</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Pharmacy Procurement</h1><p className="mt-1 text-sm text-slate-500">Manage medicine suppliers, purchase orders and stock receipts.</p></div><div className="flex gap-2"><button onClick={()=>void load()} className="rounded-lg border p-2.5 text-slate-600"><RefreshCw size={17}/></button><button onClick={()=>open(tab==='suppliers'?'supplier':'order')} className="flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white"><Plus size={16}/>{tab==='suppliers'?'Add supplier':'Create purchase order'}</button></div></header>
 {error&&<div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
 <section className="grid gap-3 sm:grid-cols-3">{[{label:'Suppliers',value:suppliers.length},{label:'Purchase orders',value:orders.length},{label:'Pending orders',value:orders.filter(o=>['DRAFT','ORDERED','PARTIALLY_RECEIVED'].includes(o.status)).length}].map(x=><article className="rounded-xl border bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">{x.label}</p><p className="mt-2 text-2xl font-bold text-slate-900">{x.value}</p></article>)}</section>
 <section className="rounded-xl border bg-white p-4 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><nav className="flex gap-2">{[['suppliers','Suppliers',Truck],['orders','Purchase orders',ClipboardList]].map(([id,label,Icon]:any)=><button onClick={()=>{T(id);Q('')}} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${tab===id?'bg-[#142B49] text-white':'border text-slate-600'}`}><Icon size={15}/>{label}</button>)}</nav><label className="flex min-w-52 items-center gap-2 rounded-lg border px-3 py-2 text-slate-400"><Search size={16}/><input className="w-full text-sm outline-none" placeholder="Search..." value={query} onChange={e=>Q(e.target.value)}/></label></div>
 <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{(tab==='suppliers'?['Supplier','Code','Contact person','Email','Phone','Status','Action']:['Order number','Supplier','Ordered','Expected','Total amount','Status','Actions']).map(x=><th className="px-3 py-3">{x}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">
             {tab === 'suppliers' ? (supplierList.length ? supplierList.map(s => <tr><td className="px-3 py-3 font-medium">{s.name}</td><td className="px-3 py-3">{s.code ?? '—'}</td><td className="px-3 py-3">{s.contactPerson ?? '—'}</td><td className="px-3 py-3">{s.email ?? '—'}</td><td className="px-3 py-3">{s.phone ?? '—'}</td><td className="px-3 py-3">{s.isActive === false ? 'Inactive' : 'Active'}</td><td className="px-3 py-3">—</td></tr>) : <tr><td colSpan={7} className="p-8 text-center text-slate-500">{loading ? 'Loading suppliers…' : 'No suppliers found.'}</td></tr>) : (orderList.length ? orderList.map(o => <tr><td className="px-3 py-3 font-medium">{o.orderNumber ?? `PO-${o.id}`}</td><td className="px-3 py-3">{o.supplier?.name ?? `#${o.supplierId}`}</td><td className="px-3 py-3">{o.orderedAt ? new Date(o.orderedAt).toLocaleDateString() : '—'}</td><td className="px-3 py-3">{o.expectedAt ? new Date(o.expectedAt).toLocaleDateString() : '—'}</td><td className="px-3 py-3">{Number(o.totalAmount ?? 0).toLocaleString()}</td><td className="px-3 py-3">{o.status}</td><td className="px-3 py-3"><div className="flex gap-1">{o.status === 'DRAFT' && <button onClick={() => void act(o.id, 'submit')} className="rounded-md border px-2 py-1 text-xs text-teal-700">Submit</button>}{['DRAFT', 'SUBMITTED'].includes(o.status) && <button onClick={() => void act(o.id, 'cancel')} className="rounded-md border px-2 py-1 text-xs text-red-600">Cancel</button>}{['SUBMITTED', 'PARTIALLY_RECEIVED'].includes(o.status) && <button onClick={() => {
                 setSelectedOrder(o)
                 F({ kind: 'receive', orderId: String(o.id) }); D('receive')
             }} className="rounded-md border px-2 py-1 text-xs text-slate-700">Receive</button>}</div></td></tr>) : <tr><td colSpan={7} className="p-8 text-center text-slate-500">{loading ? 'Loading purchase orders…' : 'No purchase orders found.'}</td></tr>)}
 </tbody></table></div></section>
 {modal&&<div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-slate-950/50 p-4"><form onSubmit={submit} className="my-5 w-full max-w-xl space-y-3 rounded-2xl bg-white p-5 shadow-xl"><div className="flex items-center justify-between"><h2 className="font-bold">{modal==='supplier'?'Add supplier':modal==='order'?'Create purchase order':'Receive purchase order items'}</h2><button type="button" onClick={()=>D('')}><X size={18}/></button></div>
 {modal==='supplier'&&<>{[['name','Supplier name',true],['code','Supplier code',false],['contactPerson','Contact person',false],['email','Email',false],['phone','Phone',false],['address','Address',false]].map(([k,l,req]:any)=><label className="block text-sm">{l}<input required={req} type={k==='email'?'email':'text'} value={f[k]??''} onChange={e=>F({...f,[k]:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5"/></label>)}</>}
         {modal === 'order' && <><label className="block text-sm">Supplier *<select required value={f.supplierId ?? ''} onChange={e => F({ ...f, supplierId: e.target.value })} className="mt-1 w-full rounded-lg border p-2.5"><option value="">Select supplier</option>{suppliers.map(s => <option value={s.id}>{s.name}</option>)}</select></label><label className="block text-sm">Medicine *<select required value={f.medicineId ?? ''} onChange={e => F({ ...f, medicineId: e.target.value })} className="mt-1 w-full rounded-lg border p-2.5"><option value="">Select medicine</option>{medicines.map(m => <option value={m.id}>{m.code} – {m.name}</option>)}</select></label><div className="grid grid-cols-2 gap-3"><label className="text-sm">Quantity *<input required type="number" min="1" value={f.quantityOrdered ?? ''} onChange={e => F({ ...f, quantityOrdered: e.target.value })} className="mt-1 w-full rounded-lg border p-2.5" /></label><label className="text-sm">Unit cost *<input required type="number" min="0" step="0.01" value={f.unitCost ?? ''} onChange={e => F({ ...f, unitCost: e.target.value })} className="mt-1 w-full rounded-lg border p-2.5" /></label></div><label className="block text-sm">Expected date<input type="date" value={f.expectedAt ?? ''} onChange={e => F({ ...f, expectedAt: e.target.value })} className="mt-1 w-full rounded-lg border p-2.5" /></label><label className="block text-sm">Notes<textarea value={f.notes ?? ''} onChange={e => F({ ...f, notes: e.target.value })} className="mt-1 w-full rounded-lg border p-2.5" /></label></>}
         {modal === 'receive' && <>
  <p className="text-sm text-slate-500">
    Select the medicine item and enter the quantity actually received.
  </p>

  <label className="block text-sm">
    Medicine / Order item *

    <select
      required
      value={f.itemId ?? ''}
      onChange={e => F({...f,itemId:e.target.value})}
      className="mt-1 w-full rounded-lg border p-2.5"
    >
      <option value="">Select medicine</option>

      {(selectedOrder?.items ?? []).map((item: Row) => (
        <option key={item.id} value={item.id}>
          {item.medicine?.name ?? `Medicine #${item.medicineId}`}
          {' — '}
          Ordered: {item.quantityOrdered},
          Received: {item.quantityReceived}
        </option>
      ))}
    </select>
  </label>

  <label className="block text-sm">
    Quantity received *

    <input
      required
      type="number"
      min="1"
      value={f.quantityReceived ?? ''}
      onChange={e => F({...f,quantityReceived:e.target.value})}
      className="mt-1 w-full rounded-lg border p-2.5"
    />
  </label>

  <label className="block text-sm">
    Batch number *

    <input
      required
      value={f.batchNumber ?? ''}
      onChange={e => F({...f,batchNumber:e.target.value})}
      className="mt-1 w-full rounded-lg border p-2.5"
    />
  </label>

  <label className="block text-sm">
    Expiry date *

    <input
      required
      type="date"
      value={f.expiryDate ?? ''}
      onChange={e => F({...f,expiryDate:e.target.value})}
      className="mt-1 w-full rounded-lg border p-2.5"
    />
  </label>
</>}
 <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={()=>D('')} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={saving} className="rounded-lg bg-teal-700 px-5 py-2 text-sm font-semibold text-white">{saving?'Saving…':'Save'}</button></div></form></div>}
 </main>
}
