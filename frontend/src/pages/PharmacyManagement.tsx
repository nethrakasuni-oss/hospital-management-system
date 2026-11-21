import { useEffect, useMemo, useState, type FormEvent } from 'react'
import axios from 'axios'
import { AlertTriangle, Boxes, CheckCircle2, ClipboardList, PackagePlus, Pill, RefreshCw, Search, X } from 'lucide-react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'

type Row = Record<string, any>
type Tab = 'dashboard' | 'prescriptions' | 'inventory' | 'movements' | 'reports'

const arr = (value: unknown): Row[] => {
  if (Array.isArray(value)) return value as Row[]
  if (value && typeof value === 'object') {
    const valueRecord = value as Row
    if (Array.isArray(valueRecord.data)) return valueRecord.data as Row[]
  }
  return []
}

const errorText = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message
    return Array.isArray(message) ? message.join(', ') : String(message ?? 'Unable to complete the pharmacy request.')
  }
  return error instanceof Error ? error.message : 'Unable to complete the pharmacy request.'
}

export default function PharmacyManagement() {
  const { user } = useAuth()
  const role = user?.role?.trim().toUpperCase()
  const canManage = role === 'ADMIN' || role === 'PHARMACIST'
  const [tab, setTab] = useState<Tab>('dashboard')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [dashboard, setDashboard] = useState<Row | null>(null)
  const [prescriptions, setPrescriptions] = useState<Row[]>([])
  const [medicines, setMedicines] = useState<Row[]>([])
  const [stockOverview, setStockOverview] = useState<Row | null>(null)
  const [transactions, setTransactions] = useState<Row[]>([])
  const [unlinkedItems, setUnlinkedItems] = useState<Row[]>([])
  const [usage, setUsage] = useState<Row[]>([])
  const [dailyReport, setDailyReport] = useState<Row | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('ALL')
  const [selected, setSelected] = useState<Row | null>(null)
  const [verifyReason, setVerifyReason] = useState('')
  const [partialQuantities, setPartialQuantities] = useState<Record<string, string>>({})
  const [categories, setCategories] = useState<Row[]>([])
  const [medicineForm, setMedicineForm] = useState({
    code:'',
    name:'',
    genericName:'',
    manufacturer:'',
    unit:'tablet',
    sellingPrice:'',
    categoryId:'',
  })
  const [batchForm, setBatchForm] = useState({ medicineId:'', batchNumber:'', quantity:'', costPrice:'', expiryDate:'', supplierId:'' })
  const [adjustForm, setAdjustForm] = useState({ medicineId:'', batchId:'', quantity:'', type:'ADJUSTMENT', notes:'' })

  const load = async () => {
    setLoading(true); setError('')
    try {
      const requests: Promise<any>[] = [
        canManage ? api.get('/pharmacy/dashboard') : Promise.resolve({ data: null }),
        api.get('/pharmacy/prescriptions'),
        api.get('/pharmacy/medicines'),
        api.get('/pharmacy/stock/overview'),
        api.get('/pharmacy/stock/transactions'),
        api.get('/pharmacy/categories'),
      ]
      const [dashboardResponse, prescriptionResponse, medicineResponse, overviewResponse, transactionResponse, categoryResponse] = await Promise.all(requests)
      setDashboard(dashboardResponse.data)
      setPrescriptions(arr(prescriptionResponse.data))
      setMedicines(arr(medicineResponse.data))
      setStockOverview(overviewResponse.data)
      setTransactions(arr(transactionResponse.data))
      setCategories(arr(categoryResponse.data))
      if (role === 'ADMIN') {
        try {
          const unlinkedResponse = await api.get('/pharmacy/prescriptions/unlinked-items')
          setUnlinkedItems(arr(unlinkedResponse.data))
        } catch {
          setUnlinkedItems([])
        }
      }
    } catch (requestError) { setError(errorText(requestError)) }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  const filteredPrescriptions = useMemo(() => prescriptions.filter(prescription => {
    const patientName = `${prescription.patient?.firstName ?? ''} ${prescription.patient?.lastName ?? ''}`
    const doctorName = `${prescription.doctor?.user?.firstName ?? ''} ${prescription.doctor?.user?.lastName ?? ''}`
    const matchesSearch = `${prescription.id} ${prescription.patient?.patientNumber ?? ''} ${patientName} ${doctorName}`.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = status === 'ALL' || String(prescription.status ?? '').toUpperCase() === status
    return matchesSearch && matchesStatus
  }), [prescriptions, search, status])

  const refreshPrescriptions = async () => {
    const response = await api.get('/pharmacy/prescriptions')
    setPrescriptions(arr(response.data))
  }

  const verifyPrescription = async (action: 'VERIFY' | 'REJECT') => {
    if (!selected) return
    if (action === 'REJECT' && !verifyReason.trim()) { setError('A rejection reason is required.'); return }
    setSaving(true); setError(''); setSuccess('')
    try {
      await api.patch(`/pharmacy/prescriptions/${selected.id}/verify`, { action, reason: verifyReason || undefined })
      setSuccess(action === 'VERIFY' ? 'Prescription verified successfully.' : 'Prescription rejected successfully.')
      setVerifyReason('')
      await refreshPrescriptions()
      setSelected(null)
    } catch (requestError) { setError(errorText(requestError)) }
    finally { setSaving(false) }
  }

  const dispensePrescription = async () => {
    if (!selected) return
    if (String(selected.verificationStatus).toUpperCase() !== 'VERIFIED') {
      setError('Prescription must be verified before dispensing.')
      return
    }
    const items = selected.items?.map((item: Row) => {
      const quantity = partialQuantities[String(item.id)]
      return quantity ? { itemId:item.id, quantity:Number(quantity) } : null
    }).filter(Boolean)
    setSaving(true); setError(''); setSuccess('')
    try {
      const response = await api.post(`/pharmacy/prescriptions/${selected.id}/dispense`, items?.length ? { items } : {})
      setSuccess(`Dispensing completed. Receipt ${response.data.receipt?.receiptNo ?? `RXD-${selected.id}`}`)
      setPartialQuantities({})
      await refreshPrescriptions()
      await load()
      setSelected(null)
    } catch (requestError) { setError(errorText(requestError)) }
    finally { setSaving(false) }
  }

  const addMedicine = async (event: FormEvent) => {
    event.preventDefault()
    if (!medicineForm.code.trim() || !medicineForm.name.trim() || !medicineForm.unit.trim() || medicineForm.sellingPrice === '') {
      setError('Medicine code, name, unit, and selling price are required.')
      return
    }
    setSaving(true); setError(''); setSuccess('')
    try {
      await api.post('/pharmacy/medicines', {
        code: medicineForm.code,
        name: medicineForm.name,
        genericName: medicineForm.genericName || undefined,
        manufacturer: medicineForm.manufacturer || undefined,
        unit: medicineForm.unit,
        sellingPrice: Number(medicineForm.sellingPrice),
        categoryId: medicineForm.categoryId ? Number(medicineForm.categoryId) : undefined,
      })
      setSuccess('Medicine saved successfully.')
      setMedicineForm({ code:'', name:'', genericName:'', manufacturer:'', unit:'tablet', sellingPrice:'', categoryId:'' })
      await load()
    } catch (requestError) { setError(errorText(requestError)) }
    finally { setSaving(false) }
  }

  const addBatch = async (event: FormEvent) => {
    event.preventDefault()
    if (!batchForm.medicineId || !batchForm.batchNumber || !batchForm.quantity || !batchForm.costPrice) {
      setError('Medicine, batch number, quantity and cost price are required.')
      return
    }
    setSaving(true); setError(''); setSuccess('')
    try {
      await api.post('/pharmacy/batches', {
        medicineId:Number(batchForm.medicineId),
        batchNumber:batchForm.batchNumber,
        quantity:Number(batchForm.quantity),
        costPrice:Number(batchForm.costPrice),
        expiryDate:batchForm.expiryDate || undefined,
        supplierId:batchForm.supplierId ? Number(batchForm.supplierId) : undefined,
      })
      setSuccess('Medicine batch added successfully.')
      setBatchForm({ medicineId:'', batchNumber:'', quantity:'', costPrice:'', expiryDate:'', supplierId:'' })
      await load()
    } catch (requestError) { setError(errorText(requestError)) }
    finally { setSaving(false) }
  }

  const adjustStock = async (event: FormEvent) => {
    event.preventDefault()
    if (!adjustForm.medicineId || !adjustForm.quantity || !adjustForm.notes) {
      setError('Medicine, quantity and adjustment notes are required.')
      return
    }
    if (['ADJUSTMENT','EXPIRED'].includes(adjustForm.type) && !adjustForm.batchId) {
      setError('Select a batch for reductions or expired-stock adjustments.')
      return
    }
    setSaving(true); setError(''); setSuccess('')
    try {
      await api.post('/pharmacy/stock/adjustments', {
        medicineId:Number(adjustForm.medicineId),
        batchId:adjustForm.batchId ? Number(adjustForm.batchId) : undefined,
        quantity:Number(adjustForm.quantity),
        type:adjustForm.type,
        notes:adjustForm.notes,
      })
      setSuccess('Stock adjustment recorded successfully.')
      setAdjustForm({ medicineId:'', batchId:'', quantity:'', type:'ADJUSTMENT', notes:'' })
      await load()
    } catch (requestError) { setError(errorText(requestError)) }
    finally { setSaving(false) }
  }

  const loadReports = async () => {
    setLoading(true); setError('')
    try {
      const today = new Date().toISOString().slice(0,10)
      const [usageResponse, dailyResponse] = await Promise.all([
        api.get('/pharmacy/reports/medicine-usage'),
        api.get('/pharmacy/reports/dispensing/daily', { params: { date:today } }),
      ])
      setUsage(arr(usageResponse.data))
      setDailyReport(dailyResponse.data)
    } catch (requestError) { setError(errorText(requestError)) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (tab === 'reports' && canManage) void loadReports()
  }, [tab, canManage])

  const tabs: {id:Tab,label:string,icon:typeof Pill}[] = [
    { id:'dashboard', label:'Dashboard', icon:Boxes },
    { id:'prescriptions', label:'Prescriptions', icon:ClipboardList },
    { id:'inventory', label:'Inventory', icon:Pill },
    { id:'movements', label:'Stock Movements', icon:PackagePlus },
    { id:'reports', label:'Reports', icon:AlertTriangle },
  ]

  return (
    <div className="mc-dashboard pharmacy-page">
      <section className="mc-welcome-row">
        <div>
          <p className="mc-eyebrow">PHARMACY WORKSPACE</p>
          <h2>Pharmacy & Medication Dispensing</h2>
          <p>Prescriptions, medicines, inventory and dispensing operations.</p>
        </div>
        <button type="button" className="mc-secondary-button" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={15} className={loading?'mc-spin':''}/> Refresh
        </button>
      </section>

      {error && <div role="alert" className="doctor-error">{error}</div>}
      {success && <div role="status" className="consultation-success">{success}</div>}

      <nav className="consultation-tabs pharmacy-tabs">
        {tabs.map(item => (
          <button type="button" key={item.id} className={tab===item.id?'active':''} onClick={()=>setTab(item.id)}>
            <item.icon size={16}/>{item.label}
          </button>
        ))}
      </nav>

      {tab === 'dashboard' && (
        <>
          <section className="nursing-cards">
            <article><span><Pill size={20}/></span><div><strong>{dashboard?.totalMedicines ?? 0}</strong><p>Total medicines</p></div></article>
            <article><span><Boxes size={20}/></span><div><strong>{dashboard?.availableStock ?? 0}</strong><p>Available stock</p></div></article>
            <article><span><AlertTriangle size={20}/></span><div><strong>{dashboard?.lowStockMedicines ?? 0}</strong><p>Low-stock medicines</p></div></article>
            <article><span><AlertTriangle size={20}/></span><div><strong>{dashboard?.expiredMedicines ?? 0}</strong><p>Expired medicines</p></div></article>
          </section>
          <section className="nursing-grid">
            <article className="mc-panel">
              <div className="consultation-section-heading"><ClipboardList size={18}/><div><h3>Prescription Queue</h3><p>Current dispensing queue</p></div></div>
              <div className="nursing-task-list">
                <div><span>Pending prescriptions</span><strong>{dashboard?.pendingPrescriptions ?? 0}</strong></div>
                <div><span>Today's transactions</span><strong>{dashboard?.todaysDispensing?.transactionCount ?? 0}</strong></div>
                <div><span>Today's dispensed quantity</span><strong>{dashboard?.todaysDispensing?.quantity ?? 0}</strong></div>
              </div>
            </article>
            <article className="mc-panel">
              <div className="consultation-section-heading"><AlertTriangle size={18}/><div><h3>Stock Alerts</h3><p>Low stock, expired and out-of-stock items</p></div></div>
              {(stockOverview?.lowStock ?? []).slice(0,8).map((medicine:Row)=><div className="nursing-alert" key={medicine.id}><AlertTriangle size={16}/>{medicine.name}: {medicine.currentStock} {medicine.unit}</div>)}
              {!(stockOverview?.lowStock?.length)&&<p className="consultation-empty">No low-stock alerts.</p>}
            </article>
          </section>
        </>
      )}

      {tab === 'prescriptions' && (
        <section className="mc-panel pharmacy-table-panel">
          <div className="pharmacy-toolbar">
            <label><Search size={16}/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search prescription, patient or doctor"/></label>
            <select value={status} onChange={event=>setStatus(event.target.value)}>
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="PARTIALLY_DISPENSED">Partially dispensed</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div className="doctor-table-wrap">
            <table className="doctor-table">
              <thead><tr><th>Prescription</th><th>Patient</th><th>Doctor</th><th>Date</th><th>Status</th><th>Verification</th><th>Action</th></tr></thead>
              <tbody>
                {loading?<tr><td colSpan={7} className="doctor-empty">Loading prescriptions...</td></tr>:filteredPrescriptions.length===0?<tr><td colSpan={7} className="doctor-empty">No prescriptions found.</td></tr>:filteredPrescriptions.map(prescription=>(
                  <tr key={prescription.id}>
                    <td className="doctor-appointment-no">RX-{prescription.id}</td>
                    <td>{prescription.patient?.firstName} {prescription.patient?.lastName}</td>
                    <td>Dr. {prescription.doctor?.user?.firstName ?? ''} {prescription.doctor?.user?.lastName ?? ''}</td>
                    <td>{prescription.createdAt?new Date(prescription.createdAt).toLocaleString(): '—'}</td>
                    <td><span className="doctor-status confirmed">{prescription.status?.replace('_',' ')}</span></td>
                    <td><span className={`doctor-status ${String(prescription.verificationStatus).toLowerCase()}`}>{prescription.verificationStatus ?? 'PENDING'}</span></td>
                    <td><button type="button" className="doctor-view-button" onClick={()=>setSelected(prescription)}>View / Verify</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'inventory' && (
        <div className="nursing-grid">
          {canManage && (
            <form className="mc-panel nursing-form" onSubmit={addMedicine}>
              <div className="consultation-section-heading"><Pill size={18}/><div><h3>Add Medicine</h3><p>Register a medicine in the pharmacy directory</p></div></div>
              <div className="nursing-fields">
                <label>Medicine code *<input required value={medicineForm.code} onChange={e=>setMedicineForm({...medicineForm,code:e.target.value})}/></label>
                <label>Medicine name *<input required value={medicineForm.name} onChange={e=>setMedicineForm({...medicineForm,name:e.target.value})}/></label>
                <label>Generic name<input value={medicineForm.genericName} onChange={e=>setMedicineForm({...medicineForm,genericName:e.target.value})}/></label>
                <label>Manufacturer<input value={medicineForm.manufacturer} onChange={e=>setMedicineForm({...medicineForm,manufacturer:e.target.value})}/></label>
                <label>Unit *<input required value={medicineForm.unit} onChange={e=>setMedicineForm({...medicineForm,unit:e.target.value})}/></label>
                <label>Selling price *<input required type="number" min="0" step="0.01" value={medicineForm.sellingPrice} onChange={e=>setMedicineForm({...medicineForm,sellingPrice:e.target.value})}/></label>
                <label className="full">Category<select value={medicineForm.categoryId} onChange={e=>setMedicineForm({...medicineForm,categoryId:e.target.value})}><option value="">No category</option>{categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
              </div>
              <button type="submit" className="consultation-save" disabled={saving}>Save medicine</button>
            </form>
          )}
          {role === 'ADMIN' && unlinkedItems.length > 0 && (
            <section className="mc-panel nursing-form">
              <div className="consultation-section-heading"><AlertTriangle size={18}/><div><h3>Prescription Medicine Corrections</h3><p>Existing items without a medicine association</p></div></div>
              <div className="nursing-history">
                {unlinkedItems.map(item=><article key={item.id}><strong>Prescription #{item.prescriptionId} · Item #{item.id}</strong><span>{item.medicineName} — {item.dosage} · {item.frequency}</span><label className="mt-3 block">Correct medicine<select id={`correct-medicine-${item.id}`} defaultValue=""><option value="">Select medicine explicitly</option>{medicines.map(medicine=><option key={medicine.id} value={medicine.id}>{medicine.name} · {medicine.code}</option>)}</select></label><button type="button" className="consultation-save mt-3" onClick={async()=>{
                  const select=document.getElementById(`correct-medicine-${item.id}`) as HTMLSelectElement|null
                  if(!select?.value){setError('Select a medicine explicitly before correcting this prescription item.');return}
                  setSaving(true);setError('');setSuccess('')
                  try{
                    await api.patch(`/pharmacy/prescription-items/${item.id}/correct-medicine`,{medicineId:Number(select.value)})
                    setSuccess(`Prescription item ${item.id} corrected successfully.`)
                    await load()
                  }catch(requestError){setError(errorText(requestError))}finally{setSaving(false)}
                }} disabled={saving}>Correct medicine</button></article>)}
              </div>
            </section>
          )}
          {canManage && (
            <form className="mc-panel nursing-form" onSubmit={addBatch}>
              <div className="consultation-section-heading"><PackagePlus size={18}/><div><h3>Add Medicine Batch</h3><p>Receive stock into an existing medicine batch</p></div></div>
              <div className="nursing-fields">
                <label className="full">Medicine<select value={batchForm.medicineId} onChange={e=>setBatchForm({...batchForm,medicineId:e.target.value})}><option value="">Select medicine</option>{medicines.map(medicine=><option key={medicine.id} value={medicine.id}>{medicine.name} · {medicine.code}</option>)}</select></label>
                <label>Batch number<input value={batchForm.batchNumber} onChange={e=>setBatchForm({...batchForm,batchNumber:e.target.value})}/></label>
                <label>Quantity<input type="number" min="1" value={batchForm.quantity} onChange={e=>setBatchForm({...batchForm,quantity:e.target.value})}/></label>
                <label>Cost price<input type="number" min="0" step="0.01" value={batchForm.costPrice} onChange={e=>setBatchForm({...batchForm,costPrice:e.target.value})}/></label>
                <label>Expiry date<input type="date" value={batchForm.expiryDate} onChange={e=>setBatchForm({...batchForm,expiryDate:e.target.value})}/></label>
              </div>
              <button type="submit" className="consultation-save" disabled={saving}>Add batch</button>
            </form>
          )}
          <section className="mc-panel">
            <div className="consultation-section-heading"><Pill size={18}/><div><h3>Medicine Directory</h3><p>Active medicines and current stock</p></div></div>
            <div className="nursing-history">{medicines.map(medicine=><article key={medicine.id}><strong>{medicine.name}</strong><span>{medicine.code} · {medicine.category?.name ?? 'Uncategorised'} · {medicine.unit}</span><p>Stock: {medicine.currentStock ?? 0} · Selling price: {medicine.sellingPrice ?? 0}</p></article>)}{medicines.length===0&&<p className="consultation-empty">No medicines found.</p>}</div>
          </section>
        </div>
      )}

      {tab === 'movements' && (
        <div className="nursing-grid">
          {canManage && (
            <form className="mc-panel nursing-form" onSubmit={adjustStock}>
              <div className="consultation-section-heading"><PackagePlus size={18}/><div><h3>Stock Adjustment</h3><p>Record an inventory correction or expiry adjustment</p></div></div>
              <div className="nursing-fields">
                <label>Medicine<select value={adjustForm.medicineId} onChange={e=>setAdjustForm({...adjustForm,medicineId:e.target.value,batchId:''})}><option value="">Select medicine</option>{medicines.map(medicine=><option key={medicine.id} value={medicine.id}>{medicine.name}</option>)}</select></label>
                <label>Type<select value={adjustForm.type} onChange={e=>setAdjustForm({...adjustForm,type:e.target.value,batchId:''})}><option value="ADJUSTMENT">Adjustment</option><option value="RETURN">Return</option><option value="EXPIRED">Expired</option></select></label>
                <label>Quantity<input type="number" min="1" value={adjustForm.quantity} onChange={e=>setAdjustForm({...adjustForm,quantity:e.target.value})}/></label>
                <label className="full">Notes<textarea required rows={3} value={adjustForm.notes} onChange={e=>setAdjustForm({...adjustForm,notes:e.target.value})}/></label>
              </div>
              <button type="submit" className="consultation-save" disabled={saving}>Save adjustment</button>
            </form>
          )}
          <section className="mc-panel">
            <div className="consultation-section-heading"><ClipboardList size={18}/><div><h3>Stock Movement History</h3><p>Latest inventory transactions</p></div></div>
            <div className="nursing-history">{transactions.map(transaction=><article key={transaction.id}><strong>{transaction.type} · {transaction.medicine?.name}</strong><span>{transaction.createdAt?new Date(transaction.createdAt).toLocaleString(): '—'}</span><p>Quantity: {transaction.quantity} · Batch: {transaction.batch?.batchNumber ?? '—'} · {transaction.notes ?? '—'}</p></article>)}{transactions.length===0&&<p className="consultation-empty">No stock movements found.</p>}</div>
          </section>
        </div>
      )}

      {tab === 'reports' && (
        <div className="nursing-grid">
          <section className="mc-panel">
            <div className="consultation-section-heading"><ClipboardList size={18}/><div><h3>Today's Dispensing</h3><p>Daily dispensing summary</p></div></div>
            <div className="nursing-task-list"><div><span>Transactions</span><strong>{dailyReport?.totalTransactions ?? 0}</strong></div><div><span>Total quantity</span><strong>{dailyReport?.totalQuantity ?? 0}</strong></div></div>
          </section>
          <section className="mc-panel">
            <div className="consultation-section-heading"><Pill size={18}/><div><h3>Medicine Usage</h3><p>Dispensed medicine totals</p></div></div>
            <div className="nursing-history">{usage.map(item=><article key={item.medicineId}><strong>{item.name}</strong><p>{item.code} · Quantity: {item.quantity}</p></article>)}{usage.length===0&&<p className="consultation-empty">No usage records found.</p>}</div>
          </section>
        </div>
      )}

      {selected && (
        <div className="mc-modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setSelected(null)}}>
          <section className="mc-detail-modal">
            <div className="consultation-header">
              <div><p className="mc-eyebrow">PRESCRIPTION DETAILS</p><h2>RX-{selected.id}</h2><p>{selected.patient?.patientNumber ?? 'Patient'} · {selected.patient?.firstName} {selected.patient?.lastName}</p></div>
              <button type="button" className="mc-icon-button" onClick={()=>setSelected(null)} aria-label="Close"><X size={18}/></button>
            </div>
            <div className="nursing-history">
              {selected.items?.map((item:Row)=><article key={item.id}><strong>{item.medicineName}</strong><span>{item.dosage} · {item.frequency} · {item.duration ?? 'No duration'} · Quantity {item.quantity}</span>{String(selected.verificationStatus).toUpperCase()==='VERIFIED'&&<label className="mt-3 block">Dispense quantity<input type="number" min="1" max={(item.quantity??0)-(item.dispensedQuantity??0)} value={partialQuantities[String(item.id)]??''} onChange={e=>setPartialQuantities({...partialQuantities,[String(item.id)]:e.target.value})}/></label>}</article>)}
            </div>
            {String(selected.status).toUpperCase() !== 'CANCELLED' && String(selected.status).toUpperCase() !== 'COMPLETED' && canManage && (
              <div className="nursing-fields mt-4">
                {String(selected.verificationStatus).toUpperCase()==='PENDING'&&<label className="full">Verification / rejection reason<textarea rows={3} value={verifyReason} onChange={e=>setVerifyReason(e.target.value)}/></label>}
                {String(selected.verificationStatus).toUpperCase()==='REJECTED'&&<p className="doctor-error">Rejected: {selected.verificationReason ?? 'No reason provided'}</p>}
              </div>
            )}
            {canManage&&<div className="consultation-actions mt-4">
              {String(selected.verificationStatus).toUpperCase()==='PENDING'&&<><button type="button" className="consultation-save" onClick={()=>void verifyPrescription('VERIFY')} disabled={saving}><CheckCircle2 size={16}/>Verify</button><button type="button" className="consultation-complete" onClick={()=>void verifyPrescription('REJECT')} disabled={saving}>Reject</button></>}
              {String(selected.verificationStatus).toUpperCase()==='VERIFIED'&&String(selected.status).toUpperCase()!=='COMPLETED'&&<button type="button" className="consultation-save" onClick={()=>void dispensePrescription()} disabled={saving}><Pill size={16}/>Dispense</button>}
            </div>}
          </section>
        </div>
      )}
    </div>
  )
}
