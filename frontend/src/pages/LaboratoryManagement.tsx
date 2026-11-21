import { useEffect, useMemo, useState, type FormEvent } from 'react'
import axios from 'axios'
import { Activity, AlertTriangle, FlaskConical, Printer, RefreshCw, Search, TestTube2, X } from 'lucide-react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'

type Row = Record<string, any>
type Tab = 'dashboard' | 'catalogue' | 'requests' | 'samples' | 'processing' | 'results' | 'reports'

const arr = (value: unknown): Row[] => {
  if (Array.isArray(value)) return value as Row[]
  if (value && typeof value === 'object') {
    const record = value as Row
    if (Array.isArray(record.data)) return record.data as Row[]
  }
  return []
}

const errorText = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message
    return Array.isArray(message) ? message.join(', ') : String(message ?? 'Unable to complete the laboratory request.')
  }
  return error instanceof Error ? error.message : 'Unable to complete the laboratory request.'
}

export default function LaboratoryManagement() {
  const { user } = useAuth()
  const role = user?.role?.trim().toUpperCase()
  const canManage = ['ADMIN', 'LAB_TECHNICIAN', 'LAB_MANAGER', 'PATHOLOGIST'].includes(role ?? '')
  const canVerify = ['ADMIN', 'LAB_MANAGER', 'PATHOLOGIST'].includes(role ?? '')
  const [tab, setTab] = useState<Tab>('dashboard')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [tests, setTests] = useState<Row[]>([])
  const [requests, setRequests] = useState<Row[]>([])
  const [statistics, setStatistics] = useState<Row | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('ALL')
  const [selected, setSelected] = useState<Row | null>(null)
  const [testForm, setTestForm] = useState({ code:'', name:'', category:'', sampleType:'', referenceRange:'', unit:'', price:'', description:'' })
  const [sampleForm, setSampleForm] = useState({ labRequestId:'', barcode:'', collectedAt:new Date().toISOString().slice(0,16), rejected:false, rejectionReason:'' })
  const [resultForm, setResultForm] = useState({ labRequestItemId:'', resultValue:'', referenceRange:'', unit:'', abnormalFlag:'NORMAL', critical:false, comments:'', amendmentReason:'' })

  const load = async () => {
    setLoading(true); setError('')
    try {
      const [testResponse, requestResponse, statisticsResponse] = await Promise.all([
        api.get('/laboratory/tests', { params: { includeInactive: 'true' } }),
        api.get('/laboratory/requests'),
        api.get('/laboratory/statistics/overview'),
      ])
      setTests(arr(testResponse.data))
      setRequests(arr(requestResponse.data))
      setStatistics(statisticsResponse.data)
    } catch (requestError) { setError(errorText(requestError)) }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  const filteredRequests = useMemo(() => requests.filter(request => {
    const patientName = `${request.patient?.firstName ?? ''} ${request.patient?.lastName ?? ''}`
    const doctorName = `${request.doctor?.user?.firstName ?? ''} ${request.doctor?.user?.lastName ?? ''}`
    const matchesSearch = `${request.requestNumber ?? ''} ${request.id} ${patientName} ${doctorName}`.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = status === 'ALL' || String(request.status) === status
    return matchesSearch && matchesStatus
  }), [requests, search, status])

  const saveTest = async (event: FormEvent) => {
    event.preventDefault()
    if (!testForm.code.trim() || !testForm.name.trim() || testForm.price === '') { setError('Test code, name and price are required.'); return }
    setSaving(true); setError(''); setSuccess('')
    try {
      await api.post('/laboratory/tests', {
        code:testForm.code,
        name:testForm.name,
        category:testForm.category || undefined,
        sampleType:testForm.sampleType || undefined,
        referenceRange:testForm.referenceRange || undefined,
        unit:testForm.unit || undefined,
        price:Number(testForm.price),
        description:testForm.description || undefined,
      })
      setSuccess('Laboratory test saved successfully.')
      setTestForm({ code:'', name:'', category:'', sampleType:'', referenceRange:'', unit:'', price:'', description:'' })
      await load()
    } catch (requestError) { setError(errorText(requestError)) }
    finally { setSaving(false) }
  }

  const collectSample = async (event: FormEvent) => {
    event.preventDefault()
    if (!sampleForm.labRequestId) { setError('Select a laboratory request.'); return }
    if (sampleForm.rejected && !sampleForm.rejectionReason.trim()) { setError('A rejection reason is required.'); return }
    setSaving(true); setError(''); setSuccess('')
    try {
      await api.post('/laboratory/samples/collect', {
        labRequestId:Number(sampleForm.labRequestId),
        barcode:sampleForm.barcode || undefined,
        collectedAt:sampleForm.collectedAt,
        rejected:sampleForm.rejected,
        rejectionReason:sampleForm.rejectionReason || undefined,
      })
      setSuccess(sampleForm.rejected ? 'Sample rejected and recorded.' : 'Sample collected and registered.')
      setSampleForm({ labRequestId:'', barcode:'', collectedAt:new Date().toISOString().slice(0,16), rejected:false, rejectionReason:'' })
      await load()
    } catch (requestError) { setError(errorText(requestError)) }
    finally { setSaving(false) }
  }

  const saveResult = async (event: FormEvent) => {
    event.preventDefault()
    if (!resultForm.labRequestItemId) { setError('Select a laboratory request item.'); return }
    setSaving(true); setError(''); setSuccess('')
    try {
      await api.post('/laboratory/results', {
        labRequestItemId:Number(resultForm.labRequestItemId),
        resultValue:resultForm.resultValue || undefined,
        referenceRange:resultForm.referenceRange || undefined,
        unit:resultForm.unit || undefined,
        abnormalFlag:resultForm.abnormalFlag,
        critical:resultForm.critical,
        comments:resultForm.comments || undefined,
        amendmentReason:resultForm.amendmentReason || undefined,
      })
      setSuccess('Laboratory result saved.')
      setResultForm({ labRequestItemId:'', resultValue:'', referenceRange:'', unit:'', abnormalFlag:'NORMAL', critical:false, comments:'', amendmentReason:'' })
      await load()
    } catch (requestError) { setError(errorText(requestError)) }
    finally { setSaving(false) }
  }

  const changeStatus = async (request: Row, nextStatus: string) => {
    setSaving(true); setError(''); setSuccess('')
    try {
      await api.patch(`/laboratory/requests/${request.id}/status`, { status:nextStatus })
      setSuccess(`Request status changed to ${nextStatus}.`)
      await load()
    } catch (requestError) { setError(errorText(requestError)) }
    finally { setSaving(false) }
  }

  const verifyResult = async (labRequestItemId: number, action: 'VERIFY' | 'REJECT') => {
    setSaving(true); setError(''); setSuccess('')
    try {
      await api.patch(`/laboratory/results/${labRequestItemId}/verify`, { action })
      setSuccess(action === 'VERIFY' ? 'Result verified.' : 'Result verification rejected.')
      await load()
    } catch (requestError) { setError(errorText(requestError)) }
    finally { setSaving(false) }
  }

  const tabs: {id:Tab,label:string,icon:typeof Activity}[] = [
    {id:'dashboard',label:'Dashboard',icon:Activity},{id:'catalogue',label:'Test Catalogue',icon:FlaskConical},
    {id:'requests',label:'Lab Requests',icon:TestTube2},{id:'samples',label:'Sample Collection',icon:Activity},
    {id:'processing',label:'Processing',icon:TestTube2},{id:'results',label:'Results',icon:AlertTriangle},
    {id:'reports',label:'Reports',icon:Printer},
  ]

  return (
    <div className="mc-dashboard laboratory-page">
      <section className="mc-welcome-row">
        <div><p className="mc-eyebrow">LABORATORY WORKSPACE</p><h2>Laboratory & Diagnostics</h2><p>Tests, samples, results, verification and reports.</p></div>
        <button type="button" className="mc-secondary-button" onClick={()=>void load()} disabled={loading}><RefreshCw size={15} className={loading?'mc-spin':''}/> Refresh</button>
      </section>
      {error && <div role="alert" className="doctor-error">{error}</div>}
      {success && <div role="status" className="consultation-success">{success}</div>}

      <nav className="consultation-tabs pharmacy-tabs">{tabs.map(item=><button type="button" key={item.id} className={tab===item.id?'active':''} onClick={()=>setTab(item.id)}><item.icon size={16}/>{item.label}</button>)}</nav>

      {tab==='dashboard' && (
        <section className="nursing-cards">
          <article><span><TestTube2 size={20}/></span><div><strong>{statistics?.totalRequests ?? 0}</strong><p>Total requests</p></div></article>
          <article><span><Activity size={20}/></span><div><strong>{statistics?.requestsByStatus?.requested ?? 0}</strong><p>Pending requests</p></div></article>
          <article><span><FlaskConical size={20}/></span><div><strong>{statistics?.requestsByStatus?.sampleCollected ?? 0}</strong><p>Samples collected</p></div></article>
          <article><span><AlertTriangle size={20}/></span><div><strong>{statistics?.requestsByStatus?.processing ?? 0}</strong><p>In progress</p></div></article>
        </section>
      )}

      {tab==='catalogue' && (
        <div className="nursing-grid">
          {canManage&&<form className="mc-panel nursing-form" onSubmit={saveTest}><div className="consultation-section-heading"><FlaskConical size={18}/><div><h3>Add Laboratory Test</h3><p>Create test catalogue entries</p></div></div><div className="nursing-fields">
            <label>Test code *<input required value={testForm.code} onChange={e=>setTestForm({...testForm,code:e.target.value})}/></label>
            <label>Test name *<input required value={testForm.name} onChange={e=>setTestForm({...testForm,name:e.target.value})}/></label>
            <label>Category<input value={testForm.category} onChange={e=>setTestForm({...testForm,category:e.target.value})}/></label>
            <label>Sample type<input value={testForm.sampleType} onChange={e=>setTestForm({...testForm,sampleType:e.target.value})}/></label>
            <label>Reference range<input value={testForm.referenceRange} onChange={e=>setTestForm({...testForm,referenceRange:e.target.value})}/></label>
            <label>Unit<input value={testForm.unit} onChange={e=>setTestForm({...testForm,unit:e.target.value})}/></label>
            <label className="full">Test price *<input required type="number" min="0" step="0.01" value={testForm.price} onChange={e=>setTestForm({...testForm,price:e.target.value})}/></label>
            <label className="full">Description<textarea rows={3} value={testForm.description} onChange={e=>setTestForm({...testForm,description:e.target.value})}/></label>
          </div><button type="submit" className="consultation-save" disabled={saving}>Save test</button></form>}
          <section className="mc-panel"><div className="consultation-section-heading"><TestTube2 size={18}/><div><h3>Test Catalogue</h3><p>Available laboratory tests</p></div></div><div className="nursing-history">{tests.map(test=><article key={test.id}><strong>{test.code} · {test.name}</strong><span>{test.category ?? 'General'} · {test.sampleType ?? 'Not specified'}</span><p>Reference: {test.referenceRange ?? '—'} · Unit: {test.unit ?? '—'} · Price: {test.price}</p></article>)}{tests.length===0&&<p className="consultation-empty">No laboratory tests found.</p>}</div></section>
        </div>
      )}

      {(tab==='requests'||tab==='processing'||tab==='reports')&&(
        <section className="mc-panel pharmacy-table-panel">
          <div className="pharmacy-toolbar"><label><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search request, patient or doctor"/></label><select value={status} onChange={e=>setStatus(e.target.value)}><option value="ALL">All statuses</option>{['REQUESTED','SAMPLE_PENDING','SAMPLE_COLLECTED','RECEIVED','PROCESSING','RESULT_ENTERED','VERIFIED','COMPLETED','REJECTED','CANCELLED'].map(item=><option key={item} value={item}>{item.replace('_',' ')}</option>)}</select></div>
          <div className="doctor-table-wrap"><table className="doctor-table"><thead><tr><th>Request</th><th>Patient</th><th>Doctor</th><th>Investigations</th><th>Sample</th><th>Status</th><th>Action</th></tr></thead><tbody>
            {loading?<tr><td colSpan={7} className="doctor-empty">Loading requests...</td></tr>:filteredRequests.length===0?<tr><td colSpan={7} className="doctor-empty">No laboratory requests found.</td></tr>:filteredRequests.map(request=><tr key={request.id}><td className="doctor-appointment-no">{request.requestNumber??`LAB-${request.id}`}</td><td>{request.patient?.firstName} {request.patient?.lastName}</td><td>Dr. {request.doctor?.user?.firstName??''} {request.doctor?.user?.lastName??''}</td><td>{request.items?.length??0} tests</td><td>{request.sampleIdentifier??'—'}</td><td><span className="doctor-status confirmed">{request.status?.replace('_',' ')}</span></td><td><button type="button" className="doctor-view-button" onClick={()=>setSelected(request)}>View</button>{canManage&&request.status==='REQUESTED'&&<button type="button" className="doctor-view-button ml-2" onClick={()=>void changeStatus(request,'SAMPLE_PENDING')}>Sample pending</button>}{canManage&&request.status==='SAMPLE_COLLECTED'&&<button type="button" className="doctor-view-button ml-2" onClick={()=>void changeStatus(request,'RECEIVED')}>Receive</button>}{canManage&&request.status==='RECEIVED'&&<button type="button" className="doctor-view-button ml-2" onClick={()=>void changeStatus(request,'PROCESSING')}>Process</button>}</td></tr>)}
          </tbody></table></div>
        </section>
      )}

      {tab==='samples'&&(
        <div className="nursing-grid"><form className="mc-panel nursing-form" onSubmit={collectSample}><div className="consultation-section-heading"><TestTube2 size={18}/><div><h3>Register Sample Collection</h3><p>Generate sample identification and optional barcode</p></div></div><div className="nursing-fields">
          <label className="full">Laboratory request *<select required value={sampleForm.labRequestId} onChange={e=>setSampleForm({...sampleForm,labRequestId:e.target.value})}><option value="">Select request</option>{requests.filter(request=>!['COMPLETED','CANCELLED','REJECTED'].includes(request.status)).map(request=><option key={request.id} value={request.id}>{request.requestNumber??`LAB-${request.id}`} · {request.patient?.firstName} {request.patient?.lastName}</option>)}</select></label>
          <label>Barcode<input value={sampleForm.barcode} onChange={e=>setSampleForm({...sampleForm,barcode:e.target.value})}/></label><label>Collection date & time<input type="datetime-local" value={sampleForm.collectedAt} onChange={e=>setSampleForm({...sampleForm,collectedAt:e.target.value})}/></label>
          <label className="nursing-check full"><input type="checkbox" checked={sampleForm.rejected} onChange={e=>setSampleForm({...sampleForm,rejected:e.target.checked})}/> Reject sample</label>
          {sampleForm.rejected&&<label className="full">Rejection reason *<textarea required rows={3} value={sampleForm.rejectionReason} onChange={e=>setSampleForm({...sampleForm,rejectionReason:e.target.value})}/></label>}
        </div><button type="submit" className="consultation-save" disabled={saving}>Register sample</button></form>
        <section className="mc-panel"><div className="consultation-section-heading"><Activity size={18}/><div><h3>Sample Tracking</h3><p>Unique identifiers and collection status</p></div></div><div className="nursing-history">{requests.filter(request=>request.sampleIdentifier||request.sampleRejected).map(request=><article key={request.id}><strong>{request.sampleIdentifier??'Rejected sample'}</strong><span>{request.status} · {request.collectedAt?new Date(request.collectedAt).toLocaleString(): '—'}</span><p>{request.barcode?`Barcode: ${request.barcode}`:'No barcode'}{request.rejectionReason?` · Reason: ${request.rejectionReason}`:''}</p></article>)}{requests.every(request=>!request.sampleIdentifier&&!request.sampleRejected)&&<p className="consultation-empty">No samples registered.</p>}</div></section></div>
      )}

      {tab==='results'&&(
        <div className="nursing-grid"><form className="mc-panel nursing-form" onSubmit={saveResult}><div className="consultation-section-heading"><AlertTriangle size={18}/><div><h3>Enter Laboratory Result</h3><p>Numeric or text results remain unverified until verified</p></div></div><div className="nursing-fields">
          <label className="full">Request item *<select required value={resultForm.labRequestItemId} onChange={e=>setResultForm({...resultForm,labRequestItemId:e.target.value})}><option value="">Select request item</option>{requests.flatMap(request=>request.items?.map((item:Row)=>({request,item}))??[]).map(({request,item}:any)=><option key={item.id} value={item.id}>{request.requestNumber??`LAB-${request.id}`} · {item.labTest?.name}</option>)}</select></label>
          <label className="full">Result value<textarea rows={3} value={resultForm.resultValue} onChange={e=>setResultForm({...resultForm,resultValue:e.target.value})}/></label><label>Reference range<input value={resultForm.referenceRange} onChange={e=>setResultForm({...resultForm,referenceRange:e.target.value})}/></label><label>Unit<input value={resultForm.unit} onChange={e=>setResultForm({...resultForm,unit:e.target.value})}/></label><label>Abnormal flag<select value={resultForm.abnormalFlag} onChange={e=>setResultForm({...resultForm,abnormalFlag:e.target.value})}><option>NORMAL</option><option>HIGH</option><option>LOW</option></select></label><label className="nursing-check"><input type="checkbox" checked={resultForm.critical} onChange={e=>setResultForm({...resultForm,critical:e.target.checked})}/> Critical result</label><label className="full">Comments<textarea rows={3} value={resultForm.comments} onChange={e=>setResultForm({...resultForm,comments:e.target.value})}/></label><label className="full">Amendment reason (verified results only)<input value={resultForm.amendmentReason} onChange={e=>setResultForm({...resultForm,amendmentReason:e.target.value})}/></label>
        </div><button type="submit" className="consultation-save" disabled={saving||!canManage}>Save result</button></form>
        <section className="mc-panel"><div className="consultation-section-heading"><TestTube2 size={18}/><div><h3>Result Verification</h3><p>Only authorized personnel can verify final results</p></div></div><div className="nursing-history">{requests.flatMap(request=>request.items?.filter((item:Row)=>item.result).map((item:Row)=><article key={item.id}><strong>{item.labTest?.name}</strong><span>{item.result?.verifiedAt?'Verified':'Unverified'} · {item.result?.abnormalFlag??'NORMAL'}{item.result?.critical?' · CRITICAL':''}</span><p>{item.result?.resultValue??'—'} {item.result?.unit??''}</p>{canVerify&&<div className="mt-3 flex gap-2"><button type="button" className="doctor-view-button" onClick={()=>void verifyResult(item.id,'VERIFY')}>Verify</button><button type="button" className="doctor-view-button" onClick={()=>void verifyResult(item.id,'REJECT')}>Reject</button></div>}</article>)??[])}{requests.every(request=>request.items?.every((item:Row)=>!item.result))&&<p className="consultation-empty">No results entered.</p>}</div></section></div>
      )}
      {tab==='reports'&&selected&&(
        <section className="mc-panel laboratory-report">
          <div className="consultation-header"><div><p className="mc-eyebrow">LABORATORY REPORT</p><h2>{selected.requestNumber??`LAB-${selected.id}`}</h2><p>Generated {new Date().toLocaleString()}</p></div><button type="button" className="mc-secondary-button" onClick={()=>window.print()}><Printer size={16}/> Print report</button></div>
          <div className="nursing-monitoring"><div><span>Patient</span><strong>{selected.patient?.firstName} {selected.patient?.lastName}</strong></div><div><span>Patient ID</span><strong>{selected.patient?.patientNumber??`PT-${selected.patientId}`}</strong></div><div><span>Requesting doctor</span><strong>Dr. {selected.doctor?.user?.firstName??''} {selected.doctor?.user?.lastName??''}</strong></div><div><span>Status</span><strong>{selected.status}</strong></div></div>
          <div className="doctor-table-wrap mt-4"><table className="doctor-table"><thead><tr><th>Investigation</th><th>Result</th><th>Unit</th><th>Reference range</th><th>Indicator</th><th>Verification</th></tr></thead><tbody>{selected.items?.map((item:Row)=><tr key={item.id}><td>{item.labTest?.name}</td><td>{item.result?.resultValue??'—'}</td><td>{item.result?.unit??item.labTest?.unit??'—'}</td><td>{item.result?.referenceRange??item.labTest?.referenceRange??'—'}</td><td>{item.result?.critical?'CRITICAL':item.result?.abnormalFlag??'NORMAL'}</td><td>{item.result?.verifiedAt?`Verified ${new Date(item.result.verifiedAt).toLocaleString()}`:'Unverified'}</td></tr>)}</tbody></table></div>
        </section>
      )}
      {selected&&tab!=='reports'&&tab==='requests'&&(
        <div className="mc-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null)}}><section className="mc-detail-modal"><div className="consultation-header"><div><p className="mc-eyebrow">LABORATORY REQUEST</p><h2>{selected.requestNumber??`LAB-${selected.id}`}</h2></div><button type="button" className="mc-icon-button" onClick={()=>setSelected(null)}><X size={18}/></button></div><div className="nursing-history">{selected.items?.map((item:Row)=><article key={item.id}><strong>{item.labTest?.name}</strong><p>{item.result?.verifiedAt?'Verified':'Unverified'} · {item.result?.resultValue??'No result entered'}</p></article>)}</div></section></div>
      )}
    </div>
  )
}
