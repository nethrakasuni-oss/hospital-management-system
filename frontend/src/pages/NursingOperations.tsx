import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import axios from 'axios'
import { Activity, AlertTriangle, BedDouble, ClipboardList, HeartPulse, History, Pill, RefreshCw, Stethoscope, UserRound } from 'lucide-react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'

type Row = Record<string, any>
type Tab = 'dashboard' | 'assignments' | 'allocations' | 'vitals' | 'notes' | 'medications' | 'monitoring' | 'handover' | 'discharge'

const arr = (value: unknown): Row[] => {
  if (Array.isArray(value)) return value as Row[]
  if (value && typeof value === 'object') {
    const record = value as Row
    if (Array.isArray(record.data)) return record.data as Row[]
  }
  return []
}
const patientName = (patient: Row | undefined) => patient ? [patient.firstName, patient.lastName].filter(Boolean).join(' ') || `Patient #${patient.id}` : '—'
const errorText = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message
    return Array.isArray(message) ? message.join(', ') : String(message ?? 'Unable to complete the request.')
  }
  return error instanceof Error ? error.message : 'Unable to complete the request.'
}
const dateText = (value: unknown) => value ? new Date(String(value)).toLocaleString() : '—'

export default function NursingOperations() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('dashboard')
  const [assignments, setAssignments] = useState<Row[]>([])
  const [nurses, setNurses] = useState<Row[]>([])
  const [admissions, setAdmissions] = useState<Row[]>([])
  const [observations, setObservations] = useState<Row[]>([])
  const [notes, setNotes] = useState<Row[]>([])
  const [medications, setMedications] = useState<Row[]>([])
  const [prescriptions, setPrescriptions] = useState<Row[]>([])
  const [handovers, setHandovers] = useState<Row[]>([])
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [assignmentForm, setAssignmentForm] = useState({
    employeeId: '',
    patientId: '',
    admissionId: '',
    shift: 'Morning',
    assignedAt: new Date().toISOString().slice(0, 16),
    notes: '',
  })

  const [vitalForm, setVitalForm] = useState({ observedAt: new Date().toISOString().slice(0,16), temperatureC:'', systolicBP:'', diastolicBP:'', pulseBpm:'', respiratoryRate:'', oxygenSaturation:'', weightKg:'', heightCm:'', painScore:'', notes:'' })
  const [noteForm, setNoteForm] = useState({ noteType:'DAILY', content:'', recordedAt:new Date().toISOString().slice(0,16) })
  const [medForm, setMedForm] = useState({ prescriptionId:'', status:'ADMINISTERED', administeredAt:new Date().toISOString().slice(0,16), reason:'', notes:'' })
  const [handoverForm, setHandoverForm] = useState({ incomingNurseUserId:'', patientSummary:'', currentCondition:'', pendingMedications:'', pendingInvestigations:'', importantObservations:'', escalationNotes:'' })
  const [clearanceForm, setClearanceForm] = useState({ nursingDischargeNotes:'', patientEducation:'', nursingClearance:false, documentationComplete:false })

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const role = user?.role?.trim().toUpperCase()
      const requests: Promise<any>[] = [
        api.get('/nursing/assignments', role === 'NURSE' ? { params: { active: 'true' } } : undefined),
        api.get('/inpatient/admissions', { params: { status: 'ADMITTED' } }),
      ]
      if (role === 'ADMIN' || role === 'HR_MANAGER') {
        requests.push(api.get('/nursing/nurses'))
      }
      const results = await Promise.all(requests)
      const assignmentResponse = results[0]
      const admissionResponse = results[1]
      setAssignments(arr(assignmentResponse.data))
      setAdmissions(arr(admissionResponse.data))
      if (results[2]) setNurses(arr(results[2].data))
    } catch (requestError) { setError(errorText(requestError)) }
    finally { setLoading(false) }
  }, [user?.role])

  useEffect(() => { void load() }, [load])

  const selectedAssignment = useMemo(() => assignments.find(item => String(item.patientId) === selectedPatientId), [assignments, selectedPatientId])
  const selectedAdmission = useMemo(() => admissions.find(item => String(item.patientId) === selectedPatientId), [admissions, selectedPatientId])

  const loadPatient = useCallback(async (patientId: string) => {
    if (!patientId) return
    setLoading(true); setError('')
    try {
      const requests = [
        ['observations', api.get(`/nursing/patients/${patientId}/observations`)] ,
        ['nursing notes', api.get(`/nursing/patients/${patientId}/notes`)],
        ['medication administrations', api.get(`/nursing/patients/${patientId}/medication-administrations`)],
        ['prescriptions', api.get('/pharmacy/prescriptions', { params: { patientId } })],
        ['shift handovers', api.get(`/nursing/patients/${patientId}/handovers`)],
      ] as const
      const results = await Promise.allSettled(requests.map(([, request]) => request))
      const errors: string[] = []
      results.forEach((result, index) => {
        const label = requests[index][0]
        if (result.status === 'fulfilled') {
          const data = arr(result.value.data)
          if (label === 'observations') setObservations(data)
          if (label === 'nursing notes') setNotes(data)
          if (label === 'medication administrations') setMedications(data)
          if (label === 'prescriptions') setPrescriptions(data.filter((prescription: Row) => prescription.status === 'ACTIVE'))
          if (label === 'shift handovers') setHandovers(data)
        } else {
          errors.push(`${label}: ${errorText(result.reason)}`)
        }
      })
      setError(errors.length ? `Unable to load: ${errors.join(' | ')}` : '')
    } catch (requestError) { setError(`Patient data: ${errorText(requestError)}`) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { if (selectedPatientId) void loadPatient(selectedPatientId) }, [selectedPatientId, loadPatient])

  const saveVital = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedPatientId) { setError('Select an assigned patient.'); return }
    setSaving(true); setError(''); setSuccess('')
    try {
      const payload: Row = { patientId:Number(selectedPatientId), assignmentId:selectedAssignment?.id, observedAt:vitalForm.observedAt }
      ;(['temperatureC','systolicBP','diastolicBP','pulseBpm','respiratoryRate','oxygenSaturation','weightKg','heightCm','painScore'] as const).forEach(key => {
        if (vitalForm[key] !== '') payload[key] = Number(vitalForm[key])
      })
      if (vitalForm.notes) payload.notes = vitalForm.notes
      await api.post('/nursing/observations', payload)
      setSuccess('Vital signs recorded.')
      setVitalForm({...vitalForm, temperatureC:'', systolicBP:'', diastolicBP:'', pulseBpm:'', respiratoryRate:'', oxygenSaturation:'', weightKg:'', heightCm:'', painScore:'', notes:''})
      await loadPatient(selectedPatientId)
    } catch (requestError) { setError(errorText(requestError)) } finally { setSaving(false) }
  }

  const saveNote = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedPatientId || !noteForm.content.trim()) { setError('Select a patient and enter nursing note content.'); return }
    setSaving(true); setError(''); setSuccess('')
    try {
      await api.post('/nursing/notes', { patientId:Number(selectedPatientId), assignmentId:selectedAssignment?.id, noteType:noteForm.noteType, content:noteForm.content, recordedAt:noteForm.recordedAt })
      setSuccess('Nursing note recorded.')
      setNoteForm({...noteForm, content:''})
      await loadPatient(selectedPatientId)
    } catch (requestError) { setError(errorText(requestError)) } finally { setSaving(false) }
  }

  const saveMedication = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedPatientId || !medForm.prescriptionId) { setError('Select an assigned patient and prescription.'); return }
    if (medForm.status !== 'ADMINISTERED' && !medForm.reason.trim()) { setError('A reason is required for missed or withheld medication.'); return }
    setSaving(true); setError(''); setSuccess('')
    try {
      await api.post('/nursing/medication-administrations', { patientId:Number(selectedPatientId), prescriptionId:Number(medForm.prescriptionId), status:medForm.status, administeredAt:medForm.administeredAt, reason:medForm.reason||undefined, notes:medForm.notes||undefined })
      setSuccess('Medication administration record saved.')
      setMedForm({...medForm, prescriptionId:'', reason:'', notes:''})
      await loadPatient(selectedPatientId)
    } catch (requestError) { setError(errorText(requestError)) } finally { setSaving(false) }
  }

  const saveHandover = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedPatientId || !handoverForm.incomingNurseUserId || !handoverForm.patientSummary.trim() || !handoverForm.currentCondition.trim()) {
      setError('Patient, incoming nurse, summary, and current condition are required.')
      return
    }
    setSaving(true); setError(''); setSuccess('')
    try {
      await api.post('/nursing/handovers', { patientId:Number(selectedPatientId), admissionId:selectedAdmission?.id, incomingNurseUserId:Number(handoverForm.incomingNurseUserId), patientSummary:handoverForm.patientSummary, currentCondition:handoverForm.currentCondition, pendingMedications:handoverForm.pendingMedications, pendingInvestigations:handoverForm.pendingInvestigations, importantObservations:handoverForm.importantObservations, escalationNotes:handoverForm.escalationNotes })
      setSuccess('Shift handover recorded.')
      setHandoverForm({ incomingNurseUserId:'', patientSummary:'', currentCondition:'', pendingMedications:'', pendingInvestigations:'', importantObservations:'', escalationNotes:'' })
      await loadPatient(selectedPatientId)
    } catch (requestError) { setError(errorText(requestError)) } finally { setSaving(false) }
  }

  const saveClearance = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedPatientId || !selectedAdmission) { setError('Select a currently admitted assigned patient.'); return }
    setSaving(true); setError(''); setSuccess('')
    try {
      await api.post('/nursing/discharge-clearance', { patientId:Number(selectedPatientId), admissionId:selectedAdmission.id, nursingDischargeNotes:clearanceForm.nursingDischargeNotes, patientEducation:clearanceForm.patientEducation, nursingClearance:clearanceForm.nursingClearance, documentationComplete:clearanceForm.documentationComplete })
      setSuccess('Nursing discharge clearance saved. Patient and bed remain unchanged.')
    } catch (requestError) { setError(errorText(requestError)) } finally { setSaving(false) }
  }

  const saveAssignment = async (event: FormEvent) => {
    event.preventDefault()
    if (!assignmentForm.employeeId || !assignmentForm.patientId || !assignmentForm.admissionId) {
      setError('Select a nurse, admitted patient, and admission.')
      return
    }
    setSaving(true); setError(''); setSuccess('')
    try {
      await api.post('/nursing/assignments', {
        employeeId: Number(assignmentForm.employeeId),
        patientId: Number(assignmentForm.patientId),
        admissionId: Number(assignmentForm.admissionId),
        assignedAt: assignmentForm.assignedAt,
        shift: assignmentForm.shift,
        notes: assignmentForm.notes || undefined,
      })
      setSuccess('Patient assigned to nurse successfully.')
      setAssignmentForm({ employeeId:'', patientId:'', admissionId:'', shift:'Morning', assignedAt:new Date().toISOString().slice(0,16), notes:'' })
      await load()
    } catch (requestError) { setError(errorText(requestError)) }
    finally { setSaving(false) }
  }

  const endAssignment = async (assignmentId: number) => {
    if (!window.confirm('End this nursing assignment? History will be preserved.')) return
    setSaving(true); setError(''); setSuccess('')
    try {
      await api.patch(`/nursing/assignments/${assignmentId}/end`)
      setSuccess('Assignment ended successfully.')
      await load()
    } catch (requestError) { setError(errorText(requestError)) }
    finally { setSaving(false) }
  }

  const updateAssignment = async (assignment: Row) => {
    const shift = window.prompt('Assignment shift (Morning, Evening, Night):', assignment.shift ?? 'Morning')
    if (shift === null) return
    const notes = window.prompt('Assignment notes:', assignment.notes ?? '')
    if (notes === null) return
    setSaving(true); setError(''); setSuccess('')
    try {
      await api.patch(`/nursing/assignments/${assignment.id}`, { shift: shift.trim() || undefined, notes: notes.trim() || null })
      setSuccess('Assignment details updated.')
      await load()
    } catch (requestError) { setError(errorText(requestError)) }
    finally { setSaving(false) }
  }

  const latestObservation = observations[0]
  const allocatedRows = assignments.map(assignment => {
    const admission = admissions.find(item => item.patientId === assignment.patientId)
    return { assignment, admission }
  })
  const alerts = useMemo(() => {
    if (!latestObservation) return []
    const alerts: string[] = []
    if (Number(latestObservation.systolicBP) >= 180 || Number(latestObservation.diastolicBP) >= 120) alerts.push('Severe blood pressure reading')
    if (latestObservation.pulseBpm && (latestObservation.pulseBpm < 50 || latestObservation.pulseBpm > 120)) alerts.push('Abnormal heart rate')
    if (latestObservation.temperatureC && (latestObservation.temperatureC < 35.0 || latestObservation.temperatureC > 38.5)) alerts.push('Temperature outside standard alert range')
    if (latestObservation.oxygenSaturation && latestObservation.oxygenSaturation < 92) alerts.push('Low oxygen saturation')
    if (latestObservation.respiratoryRate && (latestObservation.respiratoryRate < 8 || latestObservation.respiratoryRate > 30)) alerts.push('Abnormal respiratory rate')
    return alerts
  }, [latestObservation])

  const role = user?.role?.trim().toUpperCase()
  const tabs: {id:Tab,label:string,icon:typeof Activity}[] = [
    {id:'dashboard',label:'Dashboard',icon:Activity},
    ...((role === 'ADMIN' || role === 'HR_MANAGER') ? [{id:'assignments' as Tab,label:'Assign Patients',icon:UserRound}] : []),
    {id:'allocations',label:'Patient Allocation',icon:BedDouble},
    {id:'vitals',label:'Vital Signs',icon:HeartPulse},{id:'notes',label:'Nursing Notes',icon:ClipboardList},
    {id:'medications',label:'Medication',icon:Pill},{id:'monitoring',label:'Patient Monitoring',icon:Stethoscope},
    {id:'handover',label:'Shift Handover',icon:History},{id:'discharge',label:'Discharge Prep',icon:UserRound},
  ]

  return (
    <div className="nursing-page mc-dashboard">
      <section className="mc-welcome-row">
        <div><p className="mc-eyebrow">NURSING CARE WORKSPACE</p><h2>Welcome, {user?.firstName ?? 'Nurse'} {user?.lastName ?? ''}</h2><p>Assigned patient care, observations and clinical handovers.</p></div>
        <button className="mc-secondary-button" onClick={() => { void load(); if (selectedPatientId) void loadPatient(selectedPatientId) }} disabled={loading}><RefreshCw size={15} className={loading?'mc-spin':''}/> Refresh</button>
      </section>
      {error && <div role="alert" className="doctor-error">{error}</div>}
      {success && <div role="status" className="consultation-success">{success}</div>}

      <section className="nursing-tabs">{tabs.map(item => <button key={item.id} type="button" className={tab===item.id?'active':''} onClick={()=>setTab(item.id)}><item.icon size={16}/>{item.label}</button>)}</section>

      {(tab !== 'dashboard' && tab !== 'allocations') && (
        <section className="mc-panel nursing-patient-select"><label>Assigned patient<select value={selectedPatientId} onChange={event=>setSelectedPatientId(event.target.value)}><option value="">Select an assigned patient</option>{assignments.map(item => <option key={item.patientId} value={item.patientId}>{patientName(item.patient)} · #{item.patient?.patientNumber ?? item.patientId}</option>)}</select></label></section>
      )}

      {tab === 'dashboard' && (
        <>
          <section className="nursing-cards">
            <article><span><UserRound size={20}/></span><div><strong>{assignments.length}</strong><p>Assigned patients</p></div></article>
            <article><span><BedDouble size={20}/></span><div><strong>{admissions.length}</strong><p>Assigned admissions</p></div></article>
            <article><span><HeartPulse size={20}/></span><div><strong>{observations.length}</strong><p>Recorded observations</p></div></article>
            <article><span><Pill size={20}/></span><div><strong>{medications.filter(item=>item.status !== 'ADMINISTERED').length}</strong><p>Missed / withheld records</p></div></article>
          </section>
          <section className="nursing-grid">
            <article className="mc-panel"><div className="mc-panel-heading"><div><h3>Recent nursing activities</h3><p>Latest notes and observations</p></div></div><div className="nursing-activity">{notes.slice(0,4).map(note=><div key={note.id}><strong>{note.noteType}</strong><span>{dateText(note.recordedAt)}</span><p>{note.content}</p></div>)}{notes.length===0&&<p className="consultation-empty">Select a patient to load recent activities.</p>}</div></article>
            <article className="mc-panel"><div className="mc-panel-heading"><div><h3>Nursing alerts</h3><p>Configurable standard range alerts</p></div></div>{alerts.length?alerts.map(alert=><div className="nursing-alert" key={alert}><AlertTriangle size={16}/>{alert}</div>):<p className="consultation-empty">No current standard-range alerts.</p>}</article>
          </section>
        </>
      )}

      {tab === 'assignments' && (role === 'ADMIN' || role === 'HR_MANAGER') && (
        <div className="nursing-grid">
          <form className="mc-panel nursing-form" onSubmit={saveAssignment}>
            <div className="consultation-section-heading"><UserRound size={18}/><div><h3>Assign Patient to Nurse</h3><p>Select an active nurse and an admitted patient</p></div></div>
            <div className="nursing-fields">
              <label className="full">Nurse *
                <select required value={assignmentForm.employeeId} onChange={e=>setAssignmentForm({...assignmentForm,employeeId:e.target.value})}>
                  <option value="">Select active nurse</option>
                  {nurses.map(nurse=><option key={nurse.id} value={nurse.id}>{nurse.user?.firstName} {nurse.user?.lastName} · {nurse.employeeNo}</option>)}
                </select>
              </label>
              <label>Admitted patient *
                <select required value={assignmentForm.patientId} onChange={e=>{
                  const patientId=e.target.value
                  const admission=admissions.find(item=>String(item.patientId)===patientId)
                  setAssignmentForm({...assignmentForm,patientId,admissionId:admission ? String(admission.id):''})
                }}>
                  <option value="">Select admitted patient</option>
                  {[...new Map(admissions.map(admission=>[admission.patientId,admission])).values()].map(admission=><option key={admission.patientId} value={admission.patientId}>{patientName(admission.patient)} · {admission.patient?.patientNumber ?? `PT-${admission.patientId}`}</option>)}
                </select>
              </label>
              <label>Admission *
                <select required value={assignmentForm.admissionId} onChange={e=>setAssignmentForm({...assignmentForm,admissionId:e.target.value})}>
                  <option value="">Select admission</option>
                  {admissions.filter(admission=>!assignmentForm.patientId || String(admission.patientId)===assignmentForm.patientId).map(admission=><option key={admission.id} value={admission.id}>Admission #{admission.id} · {admission.bed?.room?.ward?.name ?? 'Ward'} / {admission.bed?.room?.roomNumber ?? '—'} / {admission.bed?.bedNumber ?? '—'}</option>)}
                </select>
              </label>
              <label>Shift *
                <select value={assignmentForm.shift} onChange={e=>setAssignmentForm({...assignmentForm,shift:e.target.value})}>
                  <option value="Morning">Morning</option><option value="Evening">Evening</option><option value="Night">Night</option>
                </select>
              </label>
              <label>Assignment date *
                <input required type="datetime-local" value={assignmentForm.assignedAt} onChange={e=>setAssignmentForm({...assignmentForm,assignedAt:e.target.value})}/>
              </label>
              <label className="full">Notes<textarea rows={4} value={assignmentForm.notes} onChange={e=>setAssignmentForm({...assignmentForm,notes:e.target.value})}/></label>
            </div>
            <button type="submit" className="consultation-save" disabled={saving}><UserRound size={16}/>{saving?'Assigning...':'Assign patient'}</button>
          </form>
          <section className="mc-panel doctor-schedule">
            <div className="mc-panel-heading"><div><h3>Assignment Management</h3><p>Active and historical assignments</p></div></div>
            <div className="doctor-table-wrap"><table className="doctor-table"><thead><tr><th>Nurse</th><th>Patient</th><th>Admission</th><th>Ward / Room / Bed</th><th>Shift</th><th>Assigned</th><th>Status</th><th>Action</th></tr></thead><tbody>
              {loading?<tr><td colSpan={8} className="doctor-empty">Loading assignments...</td></tr>:assignments.length===0?<tr><td colSpan={8} className="doctor-empty">No assignment history found.</td></tr>:assignments.map(assignment=>{
                const bed=assignment.admission?.bed
                return <tr key={assignment.id}><td>{assignment.employee?.user?.firstName} {assignment.employee?.user?.lastName}</td><td>{patientName(assignment.patient)}</td><td>{assignment.admissionId ?? '—'}</td><td>{bed?.room?.ward?.name ?? '—'} / {bed?.room?.roomNumber ?? '—'} / {bed?.bedNumber ?? '—'}</td><td>{assignment.shift ?? '—'}</td><td>{assignment.assignedAt?new Date(assignment.assignedAt).toLocaleString(): '—'}</td><td><span className={`doctor-status ${assignment.active?'confirmed':'cancelled'}`}>{assignment.active?'Active':'Ended'}</span></td><td>{assignment.active?<div className="doctor-queue-actions"><button type="button" className="doctor-view-button" onClick={()=>void updateAssignment(assignment)}>Edit</button><button type="button" className="doctor-view-button" onClick={()=>void endAssignment(assignment.id)}>End</button></div>:<span className="doctor-muted-action">History only</span>}</td></tr>
              })}
            </tbody></table></div>
          </section>
        </div>
      )}

      {tab === 'allocations' && (
        <section className="mc-panel doctor-schedule"><div className="mc-panel-heading"><div><h3>Patient Allocation</h3><p>Patients assigned to your active nursing assignment</p></div></div><div className="doctor-table-wrap"><table className="doctor-table"><thead><tr><th>Patient</th><th>Patient ID</th><th>Ward</th><th>Room</th><th>Bed</th><th>Admission date</th><th>Assigned doctor</th><th>Status</th></tr></thead><tbody>{loading?<tr><td colSpan={8} className="doctor-empty">Loading allocations...</td></tr>:allocatedRows.length===0?<tr><td colSpan={8} className="doctor-empty">No assigned patients found.</td></tr>:allocatedRows.map(({assignment,admission})=>{const bed=admission?.bed;const doctor=admission?.patient?.appointments?.[0]?.doctor?.user;return<tr key={assignment.id}><td className="font-semibold">{patientName(assignment.patient)}</td><td>{assignment.patient?.patientNumber ?? `PT-${assignment.patientId}`}</td><td>{bed?.room?.ward?.name ?? '—'}</td><td>{bed?.room?.roomNumber ?? '—'}</td><td>{bed?.bedNumber ?? '—'}</td><td>{admission?.admissionDate?new Date(admission.admissionDate).toLocaleDateString():'—'}</td><td>{doctor?`Dr. ${doctor.firstName ?? ''} ${doctor.lastName ?? ''}`.trim(): '—'}</td><td><span className="doctor-status confirmed">{admission?.status ?? 'ASSIGNED'}</span></td></tr>})}</tbody></table></div></section>
      )}

      {tab === 'vitals' && (
        <div className="nursing-grid">
          <form className="mc-panel nursing-form" onSubmit={saveVital}><div className="consultation-section-heading"><HeartPulse size={18}/><div><h3>Record Vital Signs</h3><p>Observation date and clinical measurements</p></div></div><div className="nursing-fields"><label>Observation date & time<input required type="datetime-local" value={vitalForm.observedAt} onChange={e=>setVitalForm({...vitalForm,observedAt:e.target.value})}/></label>{([['systolicBP','Systolic BP'],['diastolicBP','Diastolic BP'],['pulseBpm','Heart rate bpm'],['temperatureC','Temperature °C'],['respiratoryRate','Respiratory rate'],['oxygenSaturation','Oxygen saturation %'],['weightKg','Weight kg'],['heightCm','Height cm'],['painScore','Pain score 0–10']] as const).map(([key,label])=><label key={key}>{label}<input type="number" step="any" value={vitalForm[key]} onChange={e=>setVitalForm({...vitalForm,[key]:e.target.value})}/></label>)}<label className="full">Notes<textarea rows={3} value={vitalForm.notes} onChange={e=>setVitalForm({...vitalForm,notes:e.target.value})}/></label></div><button type="submit" className="consultation-save" disabled={saving||!selectedPatientId}>Save vital signs</button></form>
          <section className="mc-panel"><div className="consultation-section-heading"><History size={18}/><div><h3>Previous Observations</h3><p>Chronological latest-first history</p></div></div><div className="nursing-history">{observations.map(observation=><article key={observation.id}><strong>{dateText(observation.observedAt)}</strong><p>BP {observation.systolicBP??'—'}/{observation.diastolicBP??'—'} · HR {observation.pulseBpm??'—'} · Temp {observation.temperatureC??'—'}°C · RR {observation.respiratoryRate??'—'} · SpO₂ {observation.oxygenSaturation??'—'}% · Weight {observation.weightKg??'—'} kg</p>{observation.notes&&<small>{observation.notes}</small>}</article>)}{observations.length===0&&<p className="consultation-empty">No observations found.</p>}</div></section>
        </div>
      )}

      {tab === 'notes' && (
        <div className="nursing-grid"><form className="mc-panel nursing-form" onSubmit={saveNote}><div className="consultation-section-heading"><ClipboardList size={18}/><div><h3>Daily Nursing Note</h3><p>Observations, interventions and patient response</p></div></div><div className="nursing-fields"><label>Note type<select value={noteForm.noteType} onChange={e=>setNoteForm({...noteForm,noteType:e.target.value})}><option>DAILY</option><option>OBSERVATION</option><option>INTERVENTION</option><option>WOUND_CARE</option><option>SHIFT</option><option>FLUID_INTAKE_OUTPUT</option></select></label><label>Recorded at<input type="datetime-local" value={noteForm.recordedAt} onChange={e=>setNoteForm({...noteForm,recordedAt:e.target.value})}/></label><label className="full">Nursing note *<textarea required rows={7} value={noteForm.content} onChange={e=>setNoteForm({...noteForm,content:e.target.value})}/></label></div><button type="submit" className="consultation-save" disabled={saving||!selectedPatientId}>Save nursing note</button></form><section className="mc-panel"><div className="consultation-section-heading"><History size={18}/><div><h3>Nursing Note History</h3><p>Permanent chronological note history</p></div></div><div className="nursing-history">{notes.map(note=><article key={note.id}><strong>{note.noteType} · {dateText(note.recordedAt)}</strong><p>{note.content}</p></article>)}{notes.length===0&&<p className="consultation-empty">No nursing notes found.</p>}</div></section></div>
      )}

      {tab === 'medications' && (
        <div className="nursing-grid"><form className="mc-panel nursing-form" onSubmit={saveMedication}><div className="consultation-section-heading"><Pill size={18}/><div><h3>Medication Administration</h3><p>Record dose status without changing inventory</p></div></div><div className="nursing-fields"><label>Active prescription<select value={medForm.prescriptionId} onChange={e=>setMedForm({...medForm,prescriptionId:e.target.value})}><option value="">Select prescription</option>{prescriptions.map(prescription=><option key={prescription.id} value={prescription.id}>Prescription #{prescription.id} · {prescription.items?.map((item:Row)=>item.medicineName).join(', ')}</option>)}</select></label><label>Status<select value={medForm.status} onChange={e=>setMedForm({...medForm,status:e.target.value})}><option value="ADMINISTERED">Administered</option><option value="MISSED">Missed</option><option value="WITHHELD">Withheld</option></select></label><label className="full">Administration date & time<input required type="datetime-local" value={medForm.administeredAt} onChange={e=>setMedForm({...medForm,administeredAt:e.target.value})}/></label>{medForm.status !== 'ADMINISTERED'&&<label className="full">Reason *<textarea required rows={3} value={medForm.reason} onChange={e=>setMedForm({...medForm,reason:e.target.value})}/></label>}<label className="full">Notes<textarea rows={3} value={medForm.notes} onChange={e=>setMedForm({...medForm,notes:e.target.value})}/></label></div><button type="submit" className="consultation-save" disabled={saving||!selectedPatientId}>Save administration record</button></form><section className="mc-panel"><div className="consultation-section-heading"><History size={18}/><div><h3>Administration History</h3><p>Administered, missed and withheld doses</p></div></div><div className="nursing-history">{medications.map(item=><article key={item.id}><strong>{item.status} · {dateText(item.administeredAt)}</strong><p>{item.prescription?.items?.map((med:Row)=>`${med.medicineName} — ${med.dosage}, ${med.frequency}`).join('; ')||'Prescription medication'}</p>{item.reason&&<small>Reason: {item.reason}</small>}</article>)}{medications.length===0&&<p className="consultation-empty">No medication administration records found.</p>}</div></section></div>
      )}

      {tab === 'monitoring' && (
        <div className="nursing-grid"><section className="mc-panel"><div className="consultation-section-heading"><HeartPulse size={18}/><div><h3>Current Patient Observations</h3><p>Latest vital sign record</p></div></div>{latestObservation?<div className="nursing-monitoring"><div><span>Blood pressure</span><strong>{latestObservation.systolicBP??'—'}/{latestObservation.diastolicBP??'—'}</strong></div><div><span>Heart rate</span><strong>{latestObservation.pulseBpm??'—'} bpm</strong></div><div><span>Temperature</span><strong>{latestObservation.temperatureC??'—'} °C</strong></div><div><span>Respiratory rate</span><strong>{latestObservation.respiratoryRate??'—'} /min</strong></div><div><span>Oxygen saturation</span><strong>{latestObservation.oxygenSaturation??'—'}%</strong></div></div>:<p className="consultation-empty">No observation available.</p>}</section><section className="mc-panel"><div className="consultation-section-heading"><AlertTriangle size={18}/><div><h3>Alerts & Pending Care</h3><p>Escalate observations through handover documentation</p></div></div>{alerts.map(alert=><div className="nursing-alert" key={alert}><AlertTriangle size={16}/>{alert}</div>)}<div className="nursing-task-list"><div><span>Medication records</span><strong>{medications.length}</strong></div><div><span>Missed / withheld</span><strong>{medications.filter(item=>item.status!== 'ADMINISTERED').length}</strong></div><div><span>Nursing notes</span><strong>{notes.length}</strong></div></div></section></div>
      )}

      {tab === 'handover' && (
        <div className="nursing-grid"><form className="mc-panel nursing-form" onSubmit={saveHandover}><div className="consultation-section-heading"><History size={18}/><div><h3>Create Shift Handover</h3><p>Permanent outgoing-to-incoming nursing handover</p></div></div><div className="nursing-fields"><label>Incoming nurse user ID *<input required type="number" min="1" value={handoverForm.incomingNurseUserId} onChange={e=>setHandoverForm({...handoverForm,incomingNurseUserId:e.target.value})}/></label><label className="full">Patient summary *<textarea required rows={3} value={handoverForm.patientSummary} onChange={e=>setHandoverForm({...handoverForm,patientSummary:e.target.value})}/></label><label className="full">Current condition *<textarea required rows={3} value={handoverForm.currentCondition} onChange={e=>setHandoverForm({...handoverForm,currentCondition:e.target.value})}/></label><label>Pending medications<textarea rows={3} value={handoverForm.pendingMedications} onChange={e=>setHandoverForm({...handoverForm,pendingMedications:e.target.value})}/></label><label>Pending investigations<textarea rows={3} value={handoverForm.pendingInvestigations} onChange={e=>setHandoverForm({...handoverForm,pendingInvestigations:e.target.value})}/></label><label className="full">Important observations<textarea rows={3} value={handoverForm.importantObservations} onChange={e=>setHandoverForm({...handoverForm,importantObservations:e.target.value})}/></label><label className="full">Escalation documentation<textarea rows={3} value={handoverForm.escalationNotes} onChange={e=>setHandoverForm({...handoverForm,escalationNotes:e.target.value})}/></label></div><button type="submit" className="consultation-save" disabled={saving||!selectedPatientId}>Record handover</button></form><section className="mc-panel"><div className="consultation-section-heading"><History size={18}/><div><h3>Handover History</h3><p>Permanent shift handover history</p></div></div><div className="nursing-history">{handovers.map(handover=><article key={handover.id}><strong>{handover.outgoingNurseUser?.firstName} {handover.outgoingNurseUser?.lastName} → {handover.incomingNurseUser?.firstName} {handover.incomingNurseUser?.lastName}</strong><span>{dateText(handover.handedOverAt)}</span><p><b>Summary:</b> {handover.patientSummary}</p><p><b>Condition:</b> {handover.currentCondition}</p></article>)}{handovers.length===0&&<p className="consultation-empty">No handover history found.</p>}</div></section></div>
      )}

      {tab === 'discharge' && (
        <section className="mc-panel nursing-form"><div className="consultation-section-heading"><ClipboardList size={18}/><div><h3>Discharge Preparation</h3><p>Record nursing documentation only; authorized discharge workflow remains separate</p></div></div><form onSubmit={saveClearance}><div className="nursing-fields"><label className="full">Discharge instructions / nursing notes<textarea rows={5} value={clearanceForm.nursingDischargeNotes} onChange={e=>setClearanceForm({...clearanceForm,nursingDischargeNotes:e.target.value})}/></label><label className="full">Patient education documented<textarea rows={5} value={clearanceForm.patientEducation} onChange={e=>setClearanceForm({...clearanceForm,patientEducation:e.target.value})}/></label><label className="nursing-check"><input type="checkbox" checked={clearanceForm.nursingClearance} onChange={e=>setClearanceForm({...clearanceForm,nursingClearance:e.target.checked})}/> Nursing clearance confirmed</label><label className="nursing-check"><input type="checkbox" checked={clearanceForm.documentationComplete} onChange={e=>setClearanceForm({...clearanceForm,documentationComplete:e.target.checked})}/> Nursing documentation complete</label></div><button type="submit" className="consultation-save mt-4" disabled={saving||!selectedPatientId||!selectedAdmission}>Save nursing clearance</button></form></section>
      )}
    </div>
  )
}
