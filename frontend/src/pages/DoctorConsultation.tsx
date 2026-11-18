import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import { ArrowLeft, CalendarPlus, CheckCircle2, ClipboardList, History, Pill, Save, Stethoscope } from 'lucide-react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'

type Row = Record<string, any>

interface ConsultationForm {
  chiefComplaint: string
  historyPresentIllness: string
  previousMedicalHistory: string
  currentMedications: string
  allergies: string
  bloodPressure: string
  pulse: string
  temperature: string
  respiratoryRate: string
  oxygenSaturation: string
  weight: string
  height: string
  physicalExamination: string
  diagnosis: string
  treatment: string
  notes: string
  followUpRecommendations: string
}

const emptyForm: ConsultationForm = {
  chiefComplaint: '', historyPresentIllness: '', previousMedicalHistory: '', currentMedications: '',
  allergies: '', bloodPressure: '', pulse: '', temperature: '', respiratoryRate: '',
  oxygenSaturation: '', weight: '', height: '', physicalExamination: '', diagnosis: '',
  treatment: '', notes: '', followUpRecommendations: '',
}

function todayLocal(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function unwrapRows(payload: unknown): Row[] {
  if (Array.isArray(payload)) return payload
  if (payload && typeof payload === 'object') {
    const value = payload as Row
    for (const key of ['data', 'items', 'records', 'appointments']) {
      if (Array.isArray(value[key])) return value[key] as Row[]
    }
  }
  return []
}

function errorText(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message
    return Array.isArray(message) ? message.join(', ') : String(message ?? 'Unable to complete the request.')
  }
  return error instanceof Error ? error.message : 'Unable to complete the request.'
}

function patientAge(dateOfBirth?: string): string {
  if (!dateOfBirth) return '—'
  const birth = new Date(dateOfBirth)
  if (Number.isNaN(birth.getTime())) return '—'
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  if (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate())) age -= 1
  return `${age} years`
}

export default function DoctorConsultation() {
  const { appointmentId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [appointment, setAppointment] = useState<Row | null>(null)
  const [patient, setPatient] = useState<Row | null>(null)
  const [history, setHistory] = useState<Row[]>([])
  const [recordId, setRecordId] = useState<number | null>(null)
  const [form, setForm] = useState<ConsultationForm>(emptyForm)
  const [tab, setTab] = useState<'consultation' | 'history' | 'prescription' | 'followup'>('consultation')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [medicines, setMedicines] = useState<Row[]>([])
  const [prescriptions, setPrescriptions] = useState<Row[]>([])
  const [prescriptionSaving, setPrescriptionSaving] = useState(false)
  const [prescription, setPrescription] = useState({ medicineId: '', medicineName: '', dosage: '', frequency: '', duration: '', quantity: '', instructions: '' })

  const [doctors, setDoctors] = useState<Row[]>([])
  const [selectedDoctor, setSelectedDoctor] = useState('')
  const [followUpDate, setFollowUpDate] = useState(todayLocal())
  const [slots, setSlots] = useState<Row[]>([])
  const [selectedSlot, setSelectedSlot] = useState('')
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [followUpSaving, setFollowUpSaving] = useState(false)
  const [followUps, setFollowUps] = useState<Row[]>([])

  const load = async () => {
    if (!appointmentId) return
    setLoading(true); setError('')
    try {
      const appointmentResponse = await api.get(`/appointments/${appointmentId}`)
      const loadedAppointment = appointmentResponse.data as Row
      setAppointment(loadedAppointment)
      const status = String(loadedAppointment.status ?? '').toUpperCase()
      const patientId = loadedAppointment.patientId ?? loadedAppointment.patient?.id
      if (patientId) {
        const [patientResponse, historyResponse] = await Promise.all([
          api.get(`/patients/${patientId}`),
          api.get(`/medical-records/patient/${patientId}/history`),
        ])
        setPatient(patientResponse.data as Row)
        const historyPayload = historyResponse.data as Row
        const records = Array.isArray(historyPayload) ? historyPayload : unwrapRows(historyPayload.records)
        setHistory(records)
        const existing = records.find(record => Number(record.appointmentId) === Number(appointmentId))
        if (existing) {
          setRecordId(Number(existing.id))
          setForm({
            chiefComplaint: existing.chiefComplaint ?? existing.symptoms ?? '',
            historyPresentIllness: existing.historyPresentIllness ?? '',
            previousMedicalHistory: existing.previousMedicalHistory ?? '',
            currentMedications: existing.currentMedications ?? '',
            allergies: existing.allergies ?? '',
            bloodPressure: existing.bloodPressure ?? '',
            pulse: existing.pulse ?? '',
            temperature: existing.temperature ?? '',
            respiratoryRate: existing.respiratoryRate ?? '',
            oxygenSaturation: existing.oxygenSaturation ?? '',
            weight: existing.weight ?? '',
            height: existing.height ?? '',
            physicalExamination: existing.physicalExamination ?? '',
            diagnosis: existing.diagnosis ?? '',
            treatment: existing.treatment ?? '',
            notes: existing.notes ?? '',
            followUpRecommendations: existing.followUpRecommendations ?? '',
          })
        } else if (['SCHEDULED', 'CONFIRMED'].includes(status)) {
          await api.post(`/appointments/${appointmentId}/start-consultation`)
          loadedAppointment.status = status === 'SCHEDULED' ? 'CONFIRMED' : status
          setAppointment({ ...loadedAppointment })
        }
        const [medicineResponse, prescriptionResponse, doctorResponse, followUpResponse] = await Promise.all([
          api.get('/pharmacy/medicines'),
          api.get('/pharmacy/prescriptions', { params: { patientId } }),
          api.get('/doctors'),
          api.get('/appointments/search', { params: { patientId, limit: 100 } }),
        ])
        setMedicines(unwrapRows(medicineResponse.data))
        setPrescriptions(unwrapRows(prescriptionResponse.data))
        setDoctors(unwrapRows(doctorResponse.data).filter((doctor: Row) => doctor.active !== false))
        setFollowUps(unwrapRows(followUpResponse.data))
      }
    } catch (requestError: unknown) {
      setError(errorText(requestError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [appointmentId])

  useEffect(() => {
    if (!selectedDoctor || !followUpDate) { setSlots([]); setSelectedSlot(''); return }
    let cancelled = false
    setSlotsLoading(true)
    api.get('/appointments/availability', { params: { doctorId: Number(selectedDoctor), date: followUpDate, duration: 30 } })
      .then(response => { if (!cancelled) setSlots(unwrapRows(response.data)) })
      .catch(requestError => { if (!cancelled) { setSlots([]); setError(errorText(requestError)) } })
      .finally(() => { if (!cancelled) setSlotsLoading(false) })
    return () => { cancelled = true }
  }, [selectedDoctor, followUpDate])

  const patientName = useMemo(() => patient ? `${patient.firstName ?? ''} ${patient.lastName ?? ''}`.trim() : 'Patient', [patient])
  const status = String(appointment?.status ?? '').toUpperCase()
  const completed = status === 'COMPLETED'

  const saveConsultation = async (event: FormEvent) => {
    event.preventDefault()
    if (!appointment || !patient) return
    if (!form.chiefComplaint.trim()) { setError('Chief complaint is required.'); return }
    if (!form.diagnosis.trim()) { setError('Diagnosis is required.'); return }
    setSaving(true); setError(''); setSuccess('')
    const payload = {
      patientId: Number(patient.id),
      doctorId: Number(appointment.doctorId),
      appointmentId: Number(appointmentId),
      chiefComplaint: form.chiefComplaint,
      historyPresentIllness: form.historyPresentIllness,
      previousMedicalHistory: form.previousMedicalHistory,
      currentMedications: form.currentMedications,
      allergies: form.allergies,
      bloodPressure: form.bloodPressure,
      pulse: form.pulse,
      temperature: form.temperature,
      respiratoryRate: form.respiratoryRate,
      oxygenSaturation: form.oxygenSaturation,
      weight: form.weight,
      height: form.height,
      physicalExamination: form.physicalExamination,
      diagnosis: form.diagnosis,
      symptoms: form.chiefComplaint,
      treatment: form.treatment,
      notes: form.notes,
      followUpRecommendations: form.followUpRecommendations,
    }
    try {
      const response = recordId
        ? await api.patch(`/medical-records/${recordId}`, payload)
        : await api.post('/medical-records', payload)
      setRecordId(Number(response.data.id))
      setSuccess('Consultation findings saved successfully.')
    } catch (requestError: unknown) {
      setError(errorText(requestError))
    } finally {
      setSaving(false)
    }
  }

  const completeConsultation = async () => {
    if (!appointmentId || !recordId) { setError('Save consultation findings before completing the consultation.'); return }
    if (!window.confirm('Complete this consultation? This action cannot be undone.')) return
    setCompleting(true); setError(''); setSuccess('')
    try {
      const response = await api.patch(`/appointments/${appointmentId}/complete-consultation`)
      setAppointment(response.data)
      setSuccess('Consultation completed successfully.')
    } catch (requestError: unknown) {
      setError(errorText(requestError))
    } finally {
      setCompleting(false)
    }
  }

  const savePrescription = async (event: FormEvent) => {
    event.preventDefault()
    if (!appointment || !patient) return
    if (!prescription.medicineName.trim() || !prescription.dosage.trim() || !prescription.frequency.trim()) {
      setError('Medicine, dosage, and frequency are required.'); return
    }
    setPrescriptionSaving(true); setError(''); setSuccess('')
    try {
      await api.post('/pharmacy/prescriptions', {
        patientId: Number(patient.id),
        doctorId: Number(appointment.doctorId),
        medicalRecordId: recordId ?? undefined,
        items: [{
          medicineId: prescription.medicineId ? Number(prescription.medicineId) : undefined,
          medicineName: prescription.medicineName,
          dosage: prescription.dosage,
          frequency: prescription.frequency,
          duration: prescription.duration || undefined,
          quantity: prescription.quantity ? Number(prescription.quantity) : undefined,
          instructions: prescription.instructions || undefined,
        }],
      })
      setPrescription({ medicineId: '', medicineName: '', dosage: '', frequency: '', duration: '', quantity: '', instructions: '' })
      setSuccess('Prescription saved. Inventory will not be deducted.')
      const response = await api.get('/pharmacy/prescriptions', { params: { patientId: patient.id } })
      setPrescriptions(unwrapRows(response.data))
    } catch (requestError: unknown) {
      setError(errorText(requestError))
    } finally {
      setPrescriptionSaving(false)
    }
  }

  const bookFollowUp = async (event: FormEvent) => {
    event.preventDefault()
    if (!patient || !selectedDoctor || !selectedSlot) { setError('Select a doctor and available time slot.'); return }
    setFollowUpSaving(true); setError(''); setSuccess('')
    try {
      await api.post('/appointments', {
        patientId: Number(patient.id),
        doctorId: Number(selectedDoctor),
        scheduledAt: selectedSlot,
        duration: 30,
        appointmentType: 'IN_PERSON',
        reason: 'Follow-up appointment',
      })
      setSuccess('Follow-up appointment booked successfully.')
      setSelectedSlot('')
      const response = await api.get('/appointments/search', { params: { patientId: patient.id, limit: 100 } })
      setFollowUps(unwrapRows(response.data))
    } catch (requestError: unknown) {
      setError(errorText(requestError))
    } finally {
      setFollowUpSaving(false)
    }
  }

  if (loading) return <div className="mc-panel p-8 text-sm text-slate-500">Loading consultation workspace...</div>

  return (
    <div className="consultation-page mc-dashboard">
      <section className="consultation-header">
        <button type="button" className="mc-icon-button" onClick={() => navigate('/patient-queue')} aria-label="Back to patient queue"><ArrowLeft size={18}/></button>
        <div>
          <p className="mc-eyebrow">CONSULTATION WORKSPACE</p>
          <h2>{patientName}</h2>
          <p>{patient?.patientNumber ? `Patient ID: ${patient.patientNumber}` : `Patient ID: PT-${patient?.id ?? '—'}`}</p>
        </div>
        <span className={`doctor-status ${completed ? 'completed' : 'confirmed'}`}>{completed ? 'Completed' : status || 'In consultation'}</span>
      </section>

      {patient && (
        <section className="consultation-patient-card mc-panel">
          <div><span>Patient</span><strong>{patientName}</strong></div>
          <div><span>Age</span><strong>{patientAge(patient.dateOfBirth)}</strong></div>
          <div><span>Gender</span><strong>{String(patient.gender ?? '—').replace('_', ' ')}</strong></div>
          <div><span>Contact</span><strong>{patient.phone ?? '—'}</strong></div>
          <div><span>Email</span><strong>{patient.email ?? '—'}</strong></div>
        </section>
      )}

      {error && <div role="alert" className="doctor-error">{error}</div>}
      {success && <div role="status" className="consultation-success">{success}</div>}

      <nav className="consultation-tabs" aria-label="Consultation sections">
        {[
          ['consultation', 'Consultation', ClipboardList],
          ['history', 'Clinical History', History],
          ['prescription', 'Prescription', Pill],
          ['followup', 'Follow-up', CalendarPlus],
        ].map(([id, label, Icon]) => (
          <button type="button" key={String(id)} className={tab === id ? 'active' : ''} onClick={() => setTab(id as typeof tab)}>
            <Icon size={16}/>{String(label)}
          </button>
        ))}
      </nav>

      {tab === 'consultation' && (
        <form className="consultation-grid" onSubmit={saveConsultation}>
          <section className="mc-panel consultation-section">
            <div className="consultation-section-heading"><Stethoscope size={18}/><div><h3>Clinical Information</h3><p>Record the patient's current clinical presentation</p></div></div>
            <div className="consultation-fields">
              <label className="full">Chief complaint *<textarea required disabled={completed} value={form.chiefComplaint} onChange={e => setForm({...form, chiefComplaint: e.target.value})} rows={3}/></label>
              <label className="full">History of present illness<textarea disabled={completed} value={form.historyPresentIllness} onChange={e => setForm({...form, historyPresentIllness: e.target.value})} rows={3}/></label>
              <label className="full">Previous medical history<textarea disabled={completed} value={form.previousMedicalHistory} onChange={e => setForm({...form, previousMedicalHistory: e.target.value})} rows={3}/></label>
              <label>Current medications<textarea disabled={completed} value={form.currentMedications} onChange={e => setForm({...form, currentMedications: e.target.value})} rows={3}/></label>
              <label>Allergies<textarea disabled={completed} value={form.allergies} onChange={e => setForm({...form, allergies: e.target.value})} rows={3}/></label>
            </div>
          </section>

          <section className="mc-panel consultation-section">
            <div className="consultation-section-heading"><ActivityIcon/><div><h3>Vital Signs</h3><p>Enter observed measurements</p></div></div>
            <div className="vital-grid">
              {[
                ['bloodPressure','Blood pressure'], ['pulse','Pulse'], ['temperature','Temperature'],
                ['respiratoryRate','Respiratory rate'], ['oxygenSaturation','Oxygen saturation'], ['weight','Weight'], ['height','Height'],
              ].map(([key, label]) => (
                <label key={key}>{label}<input disabled={completed} value={form[key as keyof ConsultationForm]} onChange={e => setForm({...form, [key]: e.target.value})}/></label>
              ))}
            </div>
          </section>

          <section className="mc-panel consultation-section full">
            <div className="consultation-section-heading"><CheckCircle2 size={18}/><div><h3>Clinical Assessment</h3><p>Document examination, diagnosis and care plan</p></div></div>
            <div className="consultation-fields">
              <label className="full">Physical examination<textarea disabled={completed} value={form.physicalExamination} onChange={e => setForm({...form, physicalExamination: e.target.value})} rows={3}/></label>
              <label className="full">Diagnosis *<textarea required disabled={completed} value={form.diagnosis} onChange={e => setForm({...form, diagnosis: e.target.value})} rows={3}/></label>
              <label>Treatment plan<textarea disabled={completed} value={form.treatment} onChange={e => setForm({...form, treatment: e.target.value})} rows={3}/></label>
              <label>Follow-up recommendations<textarea disabled={completed} value={form.followUpRecommendations} onChange={e => setForm({...form, followUpRecommendations: e.target.value})} rows={3}/></label>
              <label className="full">Clinical notes<textarea disabled={completed} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={3}/></label>
            </div>
          </section>

          {!completed && (
            <div className="consultation-actions full">
              <button type="submit" className="consultation-save" disabled={saving}><Save size={16}/>{saving ? 'Saving...' : recordId ? 'Update consultation' : 'Save consultation'}</button>
              <button type="button" className="consultation-complete" onClick={() => void completeConsultation()} disabled={completing || !recordId}><CheckCircle2 size={16}/>{completing ? 'Completing...' : 'Complete consultation'}</button>
            </div>
          )}
        </form>
      )}

      {tab === 'history' && (
        <section className="mc-panel consultation-table-section">
          <div className="consultation-section-heading"><History size={18}/><div><h3>Previous Consultations</h3><p>Consultation records assigned to this doctor</p></div></div>
          {history.length === 0 ? <p className="consultation-empty">No previous consultations found.</p> : (
            <div className="consultation-history-list">{history.map(record => (
              <article key={record.id}>
                <div><strong>{record.diagnosis ?? 'Consultation'}</strong><span>{record.createdAt ? new Date(record.createdAt).toLocaleString() : 'Date unavailable'}</span></div>
                <p><b>Symptoms:</b> {record.chiefComplaint ?? record.symptoms ?? '—'}</p>
                <p><b>Treatment:</b> {record.treatment ?? '—'}</p>
                <p><b>Notes:</b> {record.notes ?? '—'}</p>
              </article>
            ))}</div>
          )}
        </section>
      )}

      {tab === 'prescription' && (
        <div className="consultation-grid">
          <form className="mc-panel consultation-section" onSubmit={savePrescription}>
            <div className="consultation-section-heading"><Pill size={18}/><div><h3>New Prescription</h3><p>Saving a prescription does not deduct inventory</p></div></div>
            <div className="consultation-fields">
              <label className="full">Medicine<select value={prescription.medicineId} onChange={e => {
                const medicine = medicines.find(item => String(item.id) === e.target.value)
                setPrescription({...prescription, medicineId: e.target.value, medicineName: medicine?.name ?? ''})
              }}><option value="">Custom / select medicine</option>{medicines.map(medicine => <option key={medicine.id} value={medicine.id}>{medicine.name}</option>)}</select></label>
              <label className="full">Medicine name *<input required value={prescription.medicineName} onChange={e => setPrescription({...prescription, medicineName: e.target.value})}/></label>
              <label>Dosage *<input required value={prescription.dosage} onChange={e => setPrescription({...prescription, dosage: e.target.value})}/></label>
              <label>Frequency *<input required value={prescription.frequency} onChange={e => setPrescription({...prescription, frequency: e.target.value})}/></label>
              <label>Duration<input value={prescription.duration} onChange={e => setPrescription({...prescription, duration: e.target.value})}/></label>
              <label>Quantity<input type="number" min="1" value={prescription.quantity} onChange={e => setPrescription({...prescription, quantity: e.target.value})}/></label>
              <label className="full">Instructions<textarea value={prescription.instructions} onChange={e => setPrescription({...prescription, instructions: e.target.value})} rows={3}/></label>
            </div>
            <button type="submit" className="consultation-save mt-4" disabled={prescriptionSaving}><Save size={16}/>{prescriptionSaving ? 'Saving...' : 'Save prescription'}</button>
          </form>
          <section className="mc-panel consultation-section">
            <div className="consultation-section-heading"><History size={18}/><div><h3>Prescription History</h3><p>Existing prescriptions for this patient</p></div></div>
            {prescriptions.length === 0 ? <p className="consultation-empty">No prescriptions found.</p> : <div className="consultation-history-list">{prescriptions.map(item => <article key={item.id}><div><strong>Prescription #{item.id}</strong><span>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}</span></div>{unwrapRows(item.items).map((med: Row) => <p key={med.id}><b>{med.medicineName}</b> — {med.dosage}, {med.frequency}{med.duration ? `, ${med.duration}` : ''}</p>)}</article>)}</div>}
          </section>
        </div>
      )}

      {tab === 'followup' && (
        <div className="consultation-grid">
          <form className="mc-panel consultation-section" onSubmit={bookFollowUp}>
            <div className="consultation-section-heading"><CalendarPlus size={18}/><div><h3>Schedule Follow-up</h3><p>Use available doctor schedules and time slots</p></div></div>
            <div className="consultation-fields">
              <label>Doctor<select value={selectedDoctor} onChange={e => { setSelectedDoctor(e.target.value); setSelectedSlot('') }}><option value="">Select doctor</option>{doctors.map(doctor => <option key={doctor.id} value={doctor.id}>Dr. {[doctor.user?.firstName, doctor.user?.lastName].filter(Boolean).join(' ') || `#${doctor.id}`}</option>)}</select></label>
              <label>Follow-up date<input type="date" min={todayLocal()} value={followUpDate} onChange={e => { setFollowUpDate(e.target.value); setSelectedSlot('') }}/></label>
              <label className="full">Available time slot<select value={selectedSlot} onChange={e => setSelectedSlot(e.target.value)} disabled={!selectedDoctor || slotsLoading || slots.length === 0}><option value="">{slotsLoading ? 'Loading slots...' : slots.length ? 'Select a slot' : 'No available slots'}</option>{slots.map(slot => <option key={String(slot.scheduledAt)} value={String(slot.scheduledAt)}>{slot.time}</option>)}</select></label>
            </div>
            <button type="submit" className="consultation-save mt-4" disabled={followUpSaving || !selectedSlot}><CalendarPlus size={16}/>{followUpSaving ? 'Booking...' : 'Book follow-up'}</button>
          </form>
          <section className="mc-panel consultation-section">
            <div className="consultation-section-heading"><History size={18}/><div><h3>Follow-up History</h3><p>Recent appointments for this patient</p></div></div>
            {followUps.length === 0 ? <p className="consultation-empty">No follow-up appointments found.</p> : <div className="consultation-history-list">{followUps.sort((a,b) => new Date(b.scheduledAt ?? 0).getTime() - new Date(a.scheduledAt ?? 0).getTime()).map(item => <article key={item.id}><div><strong>{item.appointmentNo ?? `APT-${item.id}`}</strong><span>{item.status ?? 'SCHEDULED'}</span></div><p>{item.scheduledAt ? new Date(item.scheduledAt).toLocaleString() : 'Date unavailable'} · {item.appointmentType?.replace('_',' ') ?? 'In person'}</p></article>)}</div>}
          </section>
        </div>
      )}

      {user && <span className="sr-only">Dr. {user.firstName} {user.lastName}</span>}
    </div>
  )
}

function ActivityIcon() {
  return <Stethoscope size={18}/>
}
