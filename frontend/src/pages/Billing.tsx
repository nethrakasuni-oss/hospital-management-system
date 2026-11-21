import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import axios from 'axios'
import { CreditCard, Plus, Printer, ReceiptText, RefreshCw, Search, Wallet, X } from 'lucide-react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'

type Row = Record<string, any>
type InvoiceItem = { description:string; quantity:string; unitPrice:string; sourceType?:string; sourceId?:string }

const unwrap = (value: unknown): Row[] => {
  if (Array.isArray(value)) return value as Row[]
  if (value && typeof value === 'object') {
    const row = value as Row
    if (Array.isArray(row.data)) return row.data as Row[]
  }
  return []
}

const errorText = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message
    return Array.isArray(message) ? message.join(', ') : String(message ?? 'Unable to complete the billing request.')
  }
  return error instanceof Error ? error.message : 'Unable to complete the billing request.'
}

const money = (value: unknown) => `LKR ${Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits:2, maximumFractionDigits:2 })}`

export default function Billing() {
  const { user } = useAuth()
  const role = user?.role?.trim().toUpperCase()
  const canManage = ['ADMIN','RECEPTIONIST','ACCOUNTANT'].includes(role ?? '')
  const canCreate = ['ADMIN','RECEPTIONIST'].includes(role ?? '')
  const canPay = ['ADMIN','ACCOUNTANT','RECEPTIONIST'].includes(role ?? '')
  const canRefund = ['ADMIN','ACCOUNTANT'].includes(role ?? '')
  const [invoices, setInvoices] = useState<Row[]>([])
  const [patients, setPatients] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [outstandingOnly, setOutstandingOnly] = useState(false)
  const [selected, setSelected] = useState<Row | null>(null)
  const [payments, setPayments] = useState<Row[]>([])
  const [invoiceModal, setInvoiceModal] = useState(false)
  const [paymentModal, setPaymentModal] = useState(false)
  const [refundModal, setRefundModal] = useState(false)
  const [refundPayment, setRefundPayment] = useState<Row | null>(null)
  const [invoiceForm, setInvoiceForm] = useState({ patientId:'', dueDate:'', notes:'', discountAmount:'0', taxAmount:'0' })
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([{ description:'', quantity:'1', unitPrice:'' }])
  const [paymentForm, setPaymentForm] = useState({ amount:'', method:'CASH', reference:'' })
  const [refundForm, setRefundForm] = useState({ amount:'', reason:'' })
  const [chargePreview, setChargePreview] = useState<Record<string, Row[]>>({})
  const [dailyCollections, setDailyCollections] = useState<Row | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [invoiceResponse, patientResponse] = await Promise.all([
        api.get('/billing/invoices', { params: outstandingOnly ? { outstandingOnly:'true' } : {} }),
        canManage ? api.get('/patients') : Promise.resolve({ data: [] }),
      ])
      setInvoices(unwrap(invoiceResponse.data))
      setPatients(unwrap(patientResponse.data))
      try {
        const collectionsResponse = await api.get('/billing/collections/daily')
        setDailyCollections(collectionsResponse.data)
      } catch {
        setDailyCollections(null)
      }
    } catch (requestError) { setError(errorText(requestError)); setInvoices([]) }
    finally { setLoading(false) }
  }, [canManage, outstandingOnly])

  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return invoices.filter(invoice => `${invoice.invoiceNumber ?? ''} ${invoice.patient?.firstName ?? ''} ${invoice.patient?.lastName ?? ''} ${invoice.patient?.patientNumber ?? ''} ${invoice.status ?? ''}`.toLowerCase().includes(query))
  }, [invoices, search])

  const totals = useMemo(() => invoices.reduce((result, invoice) => {
    result.invoiced += Number(invoice.totalAmount ?? 0)
    result.paid += Number(invoice.paidAmount ?? 0)
    result.outstanding += Number(invoice.balance ?? Math.max(0, Number(invoice.totalAmount ?? 0) - Number(invoice.paidAmount ?? 0)))
    return result
  }, { invoiced:0, paid:0, outstanding:0 }), [invoices])

  const openInvoiceDetails = async (invoice: Row) => {
    setError('')
    setSelected(invoice)
    try {
      const [detailResponse, paymentResponse] = await Promise.all([
        api.get(`/billing/invoices/${invoice.id}`),
        api.get(`/billing/invoices/${invoice.id}/payments`),
      ])
      setSelected(detailResponse.data)
      setPayments(unwrap(paymentResponse.data))
    } catch (requestError) { setError(errorText(requestError)); setPayments([]) }
  }

  const loadChargePreview = async (patientId: string) => {
    if (!patientId) { setChargePreview({}); return }
    try {
      const response = await api.get(`/billing/charge-preview/${patientId}`)
      setChargePreview({
        consultation: unwrap(response.data.consultation),
        pharmacy: unwrap(response.data.pharmacy),
        laboratory: unwrap(response.data.laboratory),
        inpatient: unwrap(response.data.inpatient),
      })
    } catch (requestError) { setError(errorText(requestError)); setChargePreview({}) }
  }

  const addChargePreviewItems = () => {
    const charges = Object.values(chargePreview).flat()
    if (charges.length === 0) { setError('No uncharged supported services remain for this patient.'); return }
    setInvoiceItems(current => [
      ...current.filter(item => item.description.trim() || item.unitPrice),
      ...charges.map(charge => ({
        description:String(charge.description),
        quantity:String(charge.quantity),
        unitPrice:String(charge.unitPrice),
        sourceType:String(charge.sourceType),
        sourceId:String(charge.sourceId),
      })),
    ])
  }

  const submitInvoice = async (event: FormEvent) => {
    event.preventDefault()
    if (!invoiceForm.patientId) { setError('Select a patient.'); return }
    if (invoiceItems.some(item => !item.description.trim() || !item.quantity || !item.unitPrice)) {
      setError('Complete every invoice item description, quantity and unit price.')
      return
    }
    setSaving(true); setError(''); setSuccess('')
    try {
      await api.post('/billing/invoices', {
        patientId:Number(invoiceForm.patientId),
        dueDate:invoiceForm.dueDate || undefined,
        notes:invoiceForm.notes || undefined,
        discountAmount:Number(invoiceForm.discountAmount || 0),
        taxAmount:Number(invoiceForm.taxAmount || 0),
        items:invoiceItems.map(item=>({
          description:item.description.trim(),
          quantity:Number(item.quantity),
          unitPrice:Number(item.unitPrice),
          sourceType:item.sourceType,
          sourceId:item.sourceId ? Number(item.sourceId) : undefined,
        })),
      })
      setSuccess('Invoice saved as draft. Submit it for accountant verification when ready.')
      setInvoiceModal(false)
      setInvoiceForm({ patientId:'', dueDate:'', notes:'', discountAmount:'0', taxAmount:'0' })
      setInvoiceItems([{ description:'', quantity:'1', unitPrice:'' }])
      await load()
    } catch (requestError) { setError(errorText(requestError)) }
    finally { setSaving(false) }
  }

  const submitForVerification = async (invoice: Row) => {
    try { await api.post(`/billing/invoices/${invoice.id}/submit`); setSuccess('Invoice submitted to accountant for verification.'); await load() }
    catch (e) { setError(errorText(e)) }
  }
  const verifyInvoice = async (invoice: Row) => {
    try { await api.post(`/billing/invoices/${invoice.id}/verify`); setSuccess('Invoice verified successfully.'); await load(); if (selected?.id === invoice.id) await openInvoiceDetails(invoice) }
    catch (e) { setError(errorText(e)) }
  }
  const rejectInvoice = async (invoice: Row) => {
    const reason = window.prompt('Enter the reason for rejecting this invoice:')
    if (!reason?.trim()) return
    try { await api.post(`/billing/invoices/${invoice.id}/reject`, { reason }); setSuccess('Invoice rejected and returned for correction.'); await load() }
    catch (e) { setError(errorText(e)) }
  }

  const submitPayment = async (event: FormEvent) => {
    event.preventDefault()
    if (!selected) return
    setSaving(true); setError(''); setSuccess('')
    try {
      await api.post(`/billing/invoices/${selected.id}/payments`, {
        amount:Number(paymentForm.amount),
        method:paymentForm.method,
        reference:paymentForm.reference || undefined,
      })
      setSuccess('Payment recorded successfully.')
      setPaymentModal(false)
      setPaymentForm({ amount:'', method:'CASH', reference:'' })
      await load()
      await openInvoiceDetails(selected)
    } catch (requestError) { setError(errorText(requestError)) }
    finally { setSaving(false) }
  }

  const openRefundModal = (payment: Row) => {
    const refundable = Math.max(0, Number(payment.amount ?? 0) - Number(payment.refundedAmount ?? 0))
    if (refundable <= 0) return
    setRefundPayment(payment)
    setRefundForm({ amount:refundable.toFixed(2), reason:'' })
    setError('')
    setRefundModal(true)
  }

  const submitRefund = async (event: FormEvent) => {
    event.preventDefault()
    if (!selected || !refundPayment) return

    const amount = Number(refundForm.amount)
    const refundable = Math.max(0, Number(refundPayment.amount ?? 0) - Number(refundPayment.refundedAmount ?? 0))

    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a valid refund amount greater than zero.')
      return
    }
    if (amount > refundable) {
      setError(`Refund cannot exceed the remaining refundable amount of ${money(refundable)}.`)
      return
    }

    setSaving(true); setError(''); setSuccess('')
    try {
      await api.post(`/billing/invoices/${selected.id}/payments/${refundPayment.id}/refunds`, {
        amount,
        reason:refundForm.reason.trim() || undefined,
      })
      setRefundModal(false)
      setRefundPayment(null)
      setRefundForm({ amount:'', reason:'' })
      setSuccess('Refund recorded successfully.')
      await load()
      await openInvoiceDetails(selected)
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mc-dashboard billing-page">
      <section className="mc-welcome-row"><div><p className="mc-eyebrow">FINANCE WORKSPACE</p><h2>Billing & Payments</h2><p>Receptionists prepare and submit invoices; accountants verify or reject them before payment.</p></div><div className="flex gap-2">{canCreate&&<button type="button" className="consultation-save" onClick={()=>setInvoiceModal(true)}><Plus size={16}/> Create invoice</button>}<button type="button" className="mc-secondary-button" onClick={()=>void load()} disabled={loading}><RefreshCw size={15} className={loading?'mc-spin':''}/> Refresh</button></div></section>
      {error&&<div role="alert" className="doctor-error">{error}</div>}
      {success&&<div role="status" className="consultation-success">{success}</div>}
      <section className="nursing-cards">
        <article><span><ReceiptText size={20}/></span><div><strong>{money(totals.invoiced)}</strong><p>Total invoiced</p></div></article>
        <article><span><CreditCard size={20}/></span><div><strong>{money(totals.paid)}</strong><p>Payments recorded</p></div></article>
        <article><span><Wallet size={20}/></span><div><strong>{money(totals.outstanding)}</strong><p>Outstanding balance</p></div></article>
      </section>
      {dailyCollections&&(
        <section className="mc-panel">
          <div className="consultation-section-heading"><ReceiptText size={18}/><div><h3>Daily Collection Summary</h3><p>{dailyCollections.date}</p></div></div>
          <div className="nursing-monitoring">
            <div><span>Payments</span><strong>{dailyCollections.paymentCount}</strong></div>
            <div><span>Total collected</span><strong>{money(dailyCollections.totalCollected)}</strong></div>
            {dailyCollections.byMethod?.map((entry:Row)=><div key={entry.method}><span>{entry.method}</span><strong>{money(entry.amount)}</strong></div>)}
          </div>
        </section>
      )}
      <section className="mc-panel pharmacy-table-panel">
        <div className="pharmacy-toolbar"><label><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search invoice or patient"/></label><label className="nursing-check"><input type="checkbox" checked={outstandingOnly} onChange={e=>setOutstandingOnly(e.target.checked)}/> Outstanding only</label></div>
        <div className="doctor-table-wrap"><table className="doctor-table"><thead><tr><th>Invoice</th><th>Patient</th><th>Date</th><th>Due date</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th>Action</th></tr></thead><tbody>
          {loading?<tr><td colSpan={9} className="doctor-empty">Loading invoices...</td></tr>:filtered.length===0?<tr><td colSpan={9} className="doctor-empty">No invoices found.</td></tr>:filtered.map(invoice=><tr key={invoice.id}><td className="doctor-appointment-no">{invoice.invoiceNumber??`INV-${invoice.id}`}</td><td>{invoice.patient?.firstName} {invoice.patient?.lastName}</td><td>{invoice.createdAt?new Date(invoice.createdAt).toLocaleDateString(): '—'}</td><td>{invoice.dueDate?new Date(invoice.dueDate).toLocaleDateString(): '—'}</td><td>{money(invoice.totalAmount)}</td><td>{money(invoice.paidAmount)}</td><td>{money(invoice.balance)}</td><td><div className="flex flex-col gap-1"><span className="doctor-status confirmed">{invoice.paymentStatus??invoice.status}</span><span className="text-xs text-slate-500">{invoice.verificationStatus ?? 'LEGACY'}</span></div></td><td><div className="flex flex-wrap gap-1"><button type="button" className="doctor-view-button" onClick={()=>void openInvoiceDetails(invoice)}>View</button>{['ADMIN','RECEPTIONIST'].includes(role ?? '') && ['DRAFT','REJECTED'].includes(invoice.verificationStatus) && <button type="button" className="doctor-view-button" onClick={()=>void submitForVerification(invoice)}>Submit</button>}{['ADMIN','ACCOUNTANT'].includes(role ?? '') && invoice.verificationStatus === 'PENDING_REVIEW' && <><button type="button" className="doctor-view-button" onClick={()=>void verifyInvoice(invoice)}>Verify</button><button type="button" className="doctor-view-button" onClick={()=>void rejectInvoice(invoice)}>Reject</button></>}</div></td></tr>)}
        </tbody></table></div>
      </section>

      {selected && (
        <div className="mc-modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setSelected(null)}}>
          <section className="mc-detail-modal">
            <div className="consultation-header"><div><p className="mc-eyebrow">INVOICE DETAILS</p><h2>{selected.invoiceNumber ?? `INV-${selected.id}`}</h2><p>{selected.patient?.firstName} {selected.patient?.lastName}</p></div><button type="button" className="mc-icon-button" onClick={()=>setSelected(null)}><X size={18}/></button></div>
            <button type="button" className="mc-secondary-button mb-3" onClick={()=>window.print()}><Printer size={16}/> Print invoice</button>
            <div className="nursing-monitoring"><div><span>Total</span><strong>{money(selected.totalAmount)}</strong></div><div><span>Paid</span><strong>{money(selected.paidAmount)}</strong></div><div><span>Balance</span><strong>{money(selected.balance)}</strong></div><div><span>Status</span><strong>{selected.paymentStatus ?? selected.status}</strong></div></div>
            {selected.items?.length>0&&<div className="nursing-history"><h3>Invoice items</h3>{selected.items.map((item:Row)=><article key={item.id}><strong>{item.description}</strong><p>Quantity {item.quantity} · Unit price {money(item.unitPrice)} · Total {money(item.total)}</p></article>)}</div>}
            {payments.length>0&&<div className="nursing-history"><h3>Payment history</h3>{payments.map(payment=>{
              const refunded = Number(payment.refundedAmount ?? 0)
              const refundable = Math.max(0, Number(payment.amount ?? 0) - refunded)
              return <article key={payment.id}>
                <strong>{money(payment.amount)} · {payment.method}</strong>
                <p>{payment.createdAt?new Date(payment.createdAt).toLocaleString(): '—'} · {payment.reference ?? 'No reference'}</p>
                <p>Refunded: {money(refunded)} · Remaining refundable: {money(refundable)}</p>
                <div className="flex gap-2 mt-2">
                  <button type="button" className="doctor-view-button" onClick={()=>window.print()}><Printer size={14}/> Print receipt</button>
                  {canRefund&&refundable>0&&<button type="button" className="doctor-view-button" onClick={()=>openRefundModal(payment)}>Refund</button>}
                </div>
              </article>
            })}</div>}
            {canPay&&Number(selected.balance ?? Math.max(0,Number(selected.totalAmount??0)-Number(selected.paidAmount??0)))>0&&<button type="button" className="consultation-save mt-4" onClick={()=>setPaymentModal(true)}><CreditCard size={16}/> Record payment</button>}
          </section>
        </div>
      )}

      {paymentModal&&selected&&(
        <div className="mc-modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setPaymentModal(false)}}><form className="mc-detail-modal" onSubmit={submitPayment}><div className="consultation-header"><div><p className="mc-eyebrow">RECORD PAYMENT</p><h2>{selected.invoiceNumber}</h2></div><button type="button" className="mc-icon-button" onClick={()=>setPaymentModal(false)}><X size={18}/></button></div><div className="nursing-fields mt-4"><label>Amount *<input required type="number" min="0.01" step="0.01" max={Number(selected.balance)} value={paymentForm.amount} onChange={e=>setPaymentForm({...paymentForm,amount:e.target.value})}/></label><label>Payment method<select value={paymentForm.method} onChange={e=>setPaymentForm({...paymentForm,method:e.target.value})}><option>CASH</option><option>CARD</option><option>BANK_TRANSFER</option><option>CHEQUE</option><option>INSURANCE</option><option>OTHER</option></select></label><label className="full">Reference<input value={paymentForm.reference} onChange={e=>setPaymentForm({...paymentForm,reference:e.target.value})}/></label></div><button type="submit" className="consultation-save mt-4" disabled={saving}>Save payment</button></form></div>
      )}

      {refundModal&&selected&&refundPayment&&(
        <div className="mc-modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!saving)setRefundModal(false)}}>
          <form className="mc-detail-modal" onSubmit={submitRefund}>
            <div className="consultation-header">
              <div>
                <p className="mc-eyebrow">PROCESS REFUND</p>
                <h2>{selected.invoiceNumber ?? `INV-${selected.id}`}</h2>
                <p>{refundPayment.method} · Original payment {money(refundPayment.amount)}</p>
              </div>
              <button type="button" className="mc-icon-button" onClick={()=>setRefundModal(false)} disabled={saving}><X size={18}/></button>
            </div>
            <div className="nursing-monitoring mt-3">
              <div><span>Already refunded</span><strong>{money(refundPayment.refundedAmount ?? 0)}</strong></div>
              <div><span>Available to refund</span><strong>{money(Math.max(0,Number(refundPayment.amount ?? 0)-Number(refundPayment.refundedAmount ?? 0)))}</strong></div>
            </div>
            <div className="nursing-fields mt-4">
              <label>Refund amount *
                <input required type="number" min="0.01" step="0.01"
                  max={Math.max(0,Number(refundPayment.amount ?? 0)-Number(refundPayment.refundedAmount ?? 0))}
                  value={refundForm.amount}
                  onChange={e=>setRefundForm({...refundForm,amount:e.target.value})}/>
              </label>
              <label className="full">Reason
                <textarea rows={3} maxLength={500} value={refundForm.reason}
                  onChange={e=>setRefundForm({...refundForm,reason:e.target.value})}
                  placeholder="Enter the reason for this refund"/>
              </label>
            </div>
            <p className="mt-3">Only authorised Admin and Accountant users can process refunds. The refund will be recorded in the payment and audit history.</p>
            <div className="flex gap-2 mt-4">
              <button type="button" className="mc-secondary-button" onClick={()=>setRefundModal(false)} disabled={saving}>Cancel</button>
              <button type="submit" className="consultation-save" disabled={saving}>{saving?'Processing...':'Confirm refund'}</button>
            </div>
          </form>
        </div>
      )}

      {invoiceModal&&(
        <div className="mc-modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setInvoiceModal(false)}}><form className="mc-detail-modal" onSubmit={submitInvoice}><div className="consultation-header"><div><p className="mc-eyebrow">NEW INVOICE</p><h2>Create invoice</h2></div><button type="button" className="mc-icon-button" onClick={()=>setInvoiceModal(false)}><X size={18}/></button></div>        <div className="nursing-fields mt-4"><label className="full">Patient *<select required value={invoiceForm.patientId} onChange={e=>{setInvoiceForm({...invoiceForm,patientId:e.target.value});void loadChargePreview(e.target.value)}}><option value="">Select patient</option>{patients.map(patient=><option key={patient.id} value={patient.id}>{patient.firstName} {patient.lastName} · {patient.patientNumber}</option>)}</select></label><label>Due date<input type="date" value={invoiceForm.dueDate} onChange={e=>setInvoiceForm({...invoiceForm,dueDate:e.target.value})}/></label><label>Discount amount<input type="number" min="0" step="0.01" value={invoiceForm.discountAmount} onChange={e=>setInvoiceForm({...invoiceForm,discountAmount:e.target.value})}/></label><label>Tax amount<input type="number" min="0" step="0.01" value={invoiceForm.taxAmount} onChange={e=>setInvoiceForm({...invoiceForm,taxAmount:e.target.value})}/></label><label className="full">Notes<textarea rows={2} value={invoiceForm.notes} onChange={e=>setInvoiceForm({...invoiceForm,notes:e.target.value})}/></label></div>
          <div className="nursing-history"><h3>Invoice items</h3>{invoiceItems.map((item,index)=><article key={index}><div className="nursing-fields"><label className="full">Description *<input required value={item.description} onChange={e=>setInvoiceItems(current=>current.map((row,rowIndex)=>rowIndex===index?{...row,description:e.target.value}:row))}/></label><label>Quantity *<input required type="number" min="1" value={item.quantity} onChange={e=>setInvoiceItems(current=>current.map((row,rowIndex)=>rowIndex===index?{...row,quantity:e.target.value}:row))}/></label><label>Unit price *<input required type="number" min="0" step="0.01" value={item.unitPrice} onChange={e=>setInvoiceItems(current=>current.map((row,rowIndex)=>rowIndex===index?{...row,unitPrice:e.target.value}:row))}/></label></div>{invoiceItems.length>1&&<button type="button" className="doctor-view-button mt-2" onClick={()=>setInvoiceItems(current=>current.filter((_,rowIndex)=>rowIndex!==index))}>Remove</button>}</article>)}</div>
          <button type="button" className="doctor-view-button mt-3" onClick={()=>setInvoiceItems(current=>[...current,{description:'',quantity:'1',unitPrice:''}])}>Add item</button>
          {invoiceForm.patientId&&<button type="button" className="doctor-view-button mt-3 ml-2" onClick={addChargePreviewItems}>Add supported service charges</button>}
          <button type="submit" className="consultation-save mt-4" disabled={saving}>Create invoice</button>
        </form></div>
      )}
    </div>
  )
}
