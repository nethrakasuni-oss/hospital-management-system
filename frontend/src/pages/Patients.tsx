
import { useEffect, useMemo, useState } from 'react'
import {
  Users,
  Search,
  Plus,
  Eye,
  Pencil,
  Trash2,
  RefreshCw,
  UserRound,
  AlertTriangle,
} from 'lucide-react'
import { X, Save } from 'lucide-react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'


import api from '../lib/api'
import { useAuth } from '../context/AuthContext'

interface Patient {
  id: number
  patientNumber: string
  firstName: string
  lastName: string
  dateOfBirth?: string | null
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | null
  phone?: string | null
  email?: string | null
  address?: string | null
  bloodGroup?: string | null
  emergencyName?: string | null
  emergencyPhone?: string | null
  createdAt?: string
}

function Patients() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [patients, setPatients] = useState<Patient[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
    const [page, setPage] = useState(1)
    
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
    const [showForm, setShowForm] = useState(false)
const [saving, setSaving] = useState(false)
const [formError, setFormError] = useState('')

const [editingPatient, setEditingPatient] = useState<Patient | null>(null)
const [editSaving, setEditSaving] = useState(false)
const [editError, setEditError] = useState('')
const [deletingPatient, setDeletingPatient] = useState<Patient | null>(null)
const [deleteLoading, setDeleteLoading] = useState(false)
const [deleteError, setDeleteError] = useState('')
const [editFormData, setEditFormData] = useState({
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  gender: '',
  phone: '',
  email: '',
  address: '',
  bloodGroup: '',
  emergencyName: '',
  emergencyPhone: '',
})

const [formData, setFormData] = useState({
  patientNumber: '',
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  gender: '',
  phone: '',
  email: '',
  address: '',
  bloodGroup: '',
  emergencyName: '',
  emergencyPhone: '',
})
  
    

  const pageSize = 10

  const canManage =
    user?.role === 'ADMIN' ||
    user?.role === 'RECEPTIONIST'

  const canDelete = user?.role === 'ADMIN'

  const fetchPatients = async (query = '') => {
    setLoading(true)
    setError('')

    try {
      const response = query.trim()
        ? await api.get<Patient[]>('/patients/search', {
            params: { q: query.trim() },
          })
        : await api.get<Patient[]>('/patients')

      setPatients(response.data)
      setPage(1)
    } catch (err: unknown) {
      console.error('Patient loading error:', err)
      setError('Unable to load patients. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPatients()
  }, [])
    
  const handleViewPatient = (id: number) => {
    navigate(`/patients/${id}`)
  }

  // Search patients
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPatients(search)
    }, 400)

    return () => clearTimeout(timer)
  }, [search])

  // Client-side pagination
  const totalPages = Math.max(
    1,
    Math.ceil(patients.length / pageSize),
  )

  const paginatedPatients = useMemo(() => {
    const start = (page - 1) * pageSize

    return patients.slice(start, start + pageSize)
  }, [patients, page])

  const totalPatients = patients.length

    const handleCreatePatient = async (
  e: React.FormEvent<HTMLFormElement>,
) => {
  e.preventDefault()

  setSaving(true)
  setFormError('')

  try {
    const payload = {
      ...formData,
      dateOfBirth: formData.dateOfBirth || undefined,
      gender: formData.gender || undefined,
      phone: formData.phone || undefined,
      email: formData.email || undefined,
      address: formData.address || undefined,
      bloodGroup: formData.bloodGroup || undefined,
      emergencyName: formData.emergencyName || undefined,
      emergencyPhone: formData.emergencyPhone || undefined,
    }

    await api.post('/patients', payload)

    setShowForm(false)

    setFormData({
      patientNumber: '',
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      gender: '',
      phone: '',
      email: '',
      address: '',
      bloodGroup: '',
      emergencyName: '',
      emergencyPhone: '',
    })

    setSearch('')
    await fetchPatients()

  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const message = err.response?.data?.message

      setFormError(
        Array.isArray(message)
          ? message.join(', ')
          : message || 'Unable to register patient.',
      )
    } else {
      setFormError('Something went wrong.')
    }
  } finally {
    setSaving(false)
  }
}
  const handleOpenEditPatient = async (id: number) => {
    setEditError('')
    try {
      const response = await api.get<Patient>(`/patients/${id}`)
      const patient = response.data

      setEditingPatient(patient)
      setEditFormData({
        firstName: patient.firstName ?? '',
        lastName: patient.lastName ?? '',
        dateOfBirth: patient.dateOfBirth
          ? new Date(patient.dateOfBirth).toISOString().slice(0, 10)
          : '',
        gender: patient.gender ?? '',
        phone: patient.phone ?? '',
        email: patient.email ?? '',
        address: patient.address ?? '',
        bloodGroup: patient.bloodGroup ?? '',
        emergencyName: patient.emergencyName ?? '',
        emergencyPhone: patient.emergencyPhone ?? '',
      })
    } catch (err) {
      console.error('Unable to load patient for editing:', err)
      setEditError('Unable to load this patient. Please try again.')
    }
  }

  const handleDeletePatient = async () => {
    if (!deletingPatient) return

    setDeleteLoading(true)
    setDeleteError('')

    try {
      await api.delete(`/patients/${deletingPatient.id}`)
      setDeletingPatient(null)
      await fetchPatients(search)
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const message = err.response?.data?.message
        setDeleteError(
          Array.isArray(message)
            ? message.join(', ')
            : message || 'Unable to delete this patient.',
        )
      } else {
        setDeleteError('Something went wrong while deleting the patient.')
      }
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleUpdatePatient = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editingPatient) return

    setEditSaving(true)
    setEditError('')

    try {
      const payload = {
        ...editFormData,
        dateOfBirth: editFormData.dateOfBirth || undefined,
        gender: editFormData.gender || undefined,
        phone: editFormData.phone.trim() || undefined,
        email: editFormData.email.trim() || undefined,
        address: editFormData.address.trim() || undefined,
        bloodGroup: editFormData.bloodGroup || undefined,
        emergencyName: editFormData.emergencyName.trim() || undefined,
        emergencyPhone: editFormData.emergencyPhone.trim() || undefined,
      }

      await api.patch(`/patients/${editingPatient.id}`, payload)
      setEditingPatient(null)
      await fetchPatients(search)
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const message = err.response?.data?.message
        setEditError(
          Array.isArray(message)
            ? message.join(', ')
            : message || 'Unable to update patient.',
        )
      } else {
        setEditError('Something went wrong while updating the patient.')
      }
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6 md:p-8">

      {/* Page heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">

        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Patient Management
          </h1>

          <p className="text-slate-500 mt-2">
            Manage and monitor hospital patient records.
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => {
  setFormError('')
  setShowForm(true)
}}
            className="flex items-center justify-center gap-2 bg-blue-950 text-white px-5 py-3 rounded-xl hover:bg-teal-700 transition"
          >
            <Plus size={19} />
            Register Patient
          </button>
        )}

      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-7">

        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">

          <div className="flex justify-between items-center">

            <div>
              <p className="text-sm text-slate-500">
                Total Patients
              </p>

              <h2 className="text-3xl font-bold text-slate-900 mt-2">
                {loading ? '...' : totalPatients}
              </h2>
            </div>

            <div className="bg-blue-100 text-blue-700 p-4 rounded-xl">
              <Users size={27} />
            </div>

          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">

          <div className="flex justify-between items-center">

            <div>
              <p className="text-sm text-slate-500">
                Records on this page
              </p>

              <h2 className="text-3xl font-bold text-slate-900 mt-2">
                {loading ? '...' : paginatedPatients.length}
              </h2>
            </div>

            <div className="bg-teal-100 text-teal-700 p-4 rounded-xl">
              <UserRound size={27} />
            </div>

          </div>
        </div>

      </div>

      {/* Patient table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        {/* Search */}
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row gap-4 justify-between">

          <div>
            <h2 className="font-bold text-lg text-slate-900">
              All Patients
            </h2>

            <p className="text-sm text-slate-500 mt-1">
              View and search registered patients.
            </p>
          </div>

          <div className="flex gap-2">

            <div className="relative flex-1 sm:w-80">
              <Search
                size={19}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, patient ID, phone..."
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <button
              onClick={() => fetchPatients(search)}
              title="Refresh patients"
              className="p-3 border border-slate-200 rounded-xl hover:bg-slate-50"
            >
              <RefreshCw size={19} />
            </button>

          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="m-5 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl">
            {error}
            <button
              onClick={() => fetchPatients(search)}
              className="ml-3 font-semibold underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">

          <table className="w-full text-left">

            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-6 py-4">Patient</th>
                <th className="px-6 py-4">Patient ID</th>
                <th className="px-6 py-4">Gender</th>
                <th className="px-6 py-4">Phone</th>
                <th className="px-6 py-4">Blood Group</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">

              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    Loading patients...
                  </td>
                </tr>
              ) : paginatedPatients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    No patients found.
                  </td>
                </tr>
              ) : (
                paginatedPatients.map((patient) => (
                  <tr
                    key={patient.id}
                    className="hover:bg-slate-50 transition"
                  >

                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">
                        {patient.firstName} {patient.lastName}
                      </div>

                      <div className="text-xs text-slate-500 mt-1">
                        {patient.email || 'No email'}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600">
                      {patient.patientNumber}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600">
                      {patient.gender || '—'}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600">
                      {patient.phone || '—'}
                    </td>

                    <td className="px-6 py-4">
                      {patient.bloodGroup ? (
                        <span className="bg-red-50 text-red-700 px-3 py-1 rounded-full text-xs font-semibold">
                          {patient.bloodGroup}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">

                        <button
  type="button"
  onClick={() => handleViewPatient(patient.id)}
  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer disabled:opacity-50"
  title="View Patient Details"
>
  <Eye size={20} />
</button>

                        {canManage && (
                          <button
                            title="Edit patient"
                            type="button"
                            onClick={() => handleOpenEditPatient(patient.id)}
                            className="p-2 text-teal-600 hover:bg-teal-50 rounded-lg"
                          >
                            <Pencil size={18} />
                          </button>
                        )}

                        {canDelete && (
                          <button
                            type="button"
                            title="Delete patient"
                            onClick={() => {
                              setDeleteError('')
                              setDeletingPatient(patient)
                            }}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}

                      </div>
                    </td>

                  </tr>
                ))
              )}

            </tbody>

          </table>
              </div>
        
{showForm && (
  <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">

    <div className="bg-white w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl">

      <div className="flex items-center justify-between p-6 border-b">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Register New Patient
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Enter the patient's information below.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowForm(false)}
          className="p-2 hover:bg-slate-100 rounded-lg"
        >
          <X size={22} />
        </button>
      </div>

      <form onSubmit={handleCreatePatient} className="p-6 space-y-6">

        <div>
          <h3 className="font-semibold text-slate-800 mb-4">
            Personal Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <input
              required
              placeholder="Patient Number *"
              value={formData.patientNumber}
              onChange={e => setFormData({
                ...formData,
                patientNumber: e.target.value,
              })}
              className="border rounded-xl p-3 outline-none focus:ring-2 focus:ring-teal-500"
            />

            <input
              required
              placeholder="First Name *"
              value={formData.firstName}
              onChange={e => setFormData({
                ...formData,
                firstName: e.target.value,
              })}
              className="border rounded-xl p-3 outline-none focus:ring-2 focus:ring-teal-500"
            />

            <input
              required
              placeholder="Last Name *"
              value={formData.lastName}
              onChange={e => setFormData({
                ...formData,
                lastName: e.target.value,
              })}
              className="border rounded-xl p-3 outline-none focus:ring-2 focus:ring-teal-500"
            />

            <input
              type="date"
              value={formData.dateOfBirth}
              onChange={e => setFormData({
                ...formData,
                dateOfBirth: e.target.value,
              })}
              className="border rounded-xl p-3 outline-none focus:ring-2 focus:ring-teal-500"
            />

            <select
              value={formData.gender}
              onChange={e => setFormData({
                ...formData,
                gender: e.target.value,
              })}
              className="border rounded-xl p-3 outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Select Gender</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>

            <select
              value={formData.bloodGroup}
              onChange={e => setFormData({
                ...formData,
                bloodGroup: e.target.value,
              })}
              className="border rounded-xl p-3 outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Select Blood Group</option>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(group => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>

          </div>
                              </div>
        



        <div>
          <h3 className="font-semibold text-slate-800 mb-4">
            Contact Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <input
              type="tel"
              placeholder="Phone Number"
              value={formData.phone}
              onChange={e => setFormData({
                ...formData,
                phone: e.target.value,
              })}
              className="border rounded-xl p-3 outline-none focus:ring-2 focus:ring-teal-500"
            />

            <input
              type="email"
              placeholder="Email Address"
              value={formData.email}
              onChange={e => setFormData({
                ...formData,
                email: e.target.value,
              })}
              className="border rounded-xl p-3 outline-none focus:ring-2 focus:ring-teal-500"
            />

            <textarea
              placeholder="Residential Address"
              value={formData.address}
              onChange={e => setFormData({
                ...formData,
                address: e.target.value,
              })}
              rows={3}
              className="md:col-span-2 border rounded-xl p-3 outline-none focus:ring-2 focus:ring-teal-500"
            />

          </div>
        </div>

        <div>
          <h3 className="font-semibold text-slate-800 mb-4">
            Emergency Contact
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <input
              placeholder="Emergency Contact Name"
              value={formData.emergencyName}
              onChange={e => setFormData({
                ...formData,
                emergencyName: e.target.value,
              })}
              className="border rounded-xl p-3 outline-none focus:ring-2 focus:ring-teal-500"
            />

            <input
              type="tel"
              placeholder="Emergency Contact Phone"
              value={formData.emergencyPhone}
              onChange={e => setFormData({
                ...formData,
                emergencyPhone: e.target.value,
              })}
              className="border rounded-xl p-3 outline-none focus:ring-2 focus:ring-teal-500"
            />

          </div>
        </div>

        {formError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
            {formError}
          </div>
        )}

        <div className="flex justify-end gap-3 border-t pt-5">

          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="px-5 py-3 border rounded-xl hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-blue-950 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50"
          >
            <Save size={18} />
            {saving ? 'Registering...' : 'Register Patient'}
          </button>

        </div>

      </form>
    </div>
  </div>
              )}

        {/* Patient Details Modal (separate from registration form) */}
        {selectedPatient && (
  <div className="fixed inset-0 z-[60] bg-slate-950/50 flex items-center justify-center p-4">

    <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl">

      <div className="flex items-center justify-between p-6 border-b">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Patient Details
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Complete patient information
          </p>
        </div>

        <button
          type="button"
          onClick={() => setSelectedPatient(null)}
          className="p-2 hover:bg-slate-100 rounded-lg"
        >
          <X size={22} />
        </button>
      </div>

      <div className="p-6">

        <div className="flex items-center gap-4 mb-7">
          <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-800 flex items-center justify-center">
            <UserRound size={32} />
          </div>

          <div>
            <h3 className="text-xl font-bold text-slate-900">
              {selectedPatient.firstName} {selectedPatient.lastName}
            </h3>
            <p className="text-sm text-slate-500">
              Patient ID: {selectedPatient.patientNumber}
            </p>
          </div>
        </div>

        <h3 className="font-semibold text-slate-800 mb-4">
          Personal Information
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

          {[
            ['First Name', selectedPatient.firstName],
            ['Last Name', selectedPatient.lastName],
            [
              'Date of Birth',
              selectedPatient.dateOfBirth
                ? new Date(selectedPatient.dateOfBirth).toLocaleDateString()
                : 'Not provided',
            ],
            ['Gender', selectedPatient.gender || 'Not provided'],
            ['Blood Group', selectedPatient.bloodGroup || 'Not provided'],
            ['Phone', selectedPatient.phone || 'Not provided'],
            ['Email', selectedPatient.email || 'Not provided'],
            ['Address', selectedPatient.address || 'Not provided'],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-slate-500 mb-1">{label}</p>
              <p className="text-sm font-semibold text-slate-800 break-words">
                {value}
              </p>
            </div>
          ))}

        </div>

        <div className="border-t my-6" />

        <h3 className="font-semibold text-slate-800 mb-4">
          Emergency Contact
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

          <div>
            <p className="text-xs text-slate-500 mb-1">
              Contact Name
            </p>
            <p className="text-sm font-semibold text-slate-800">
              {selectedPatient.emergencyName || 'Not provided'}
            </p>
          </div>

          <div>
            <p className="text-xs text-slate-500 mb-1">
              Contact Phone
            </p>
            <p className="text-sm font-semibold text-slate-800">
              {selectedPatient.emergencyPhone || 'Not provided'}
            </p>
          </div>

        </div>

        <div className="flex justify-end mt-8">
          <button
            type="button"
            onClick={() => setSelectedPatient(null)}
            className="bg-blue-950 text-white px-6 py-3 rounded-xl hover:bg-teal-700"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  </div>
)}

        {/* Edit Patient Modal */}
        {editingPatient && (
          <div className="fixed inset-0 z-[70] bg-slate-950/50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl">
              <div className="flex items-center justify-between p-6 border-b">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Edit Patient</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Patient ID: {editingPatient.patientNumber}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingPatient(null)}
                  className="p-2 hover:bg-slate-100 rounded-lg"
                  aria-label="Close edit patient form"
                >
                  <X size={22} />
                </button>
              </div>

              <form onSubmit={handleUpdatePatient} className="p-6 space-y-6">
                <div>
                  <h3 className="font-semibold text-slate-800 mb-4">Personal Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      required
                      placeholder="First Name *"
                      value={editFormData.firstName}
                      onChange={e => setEditFormData({ ...editFormData, firstName: e.target.value })}
                      className="border rounded-xl p-3 outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <input
                      required
                      placeholder="Last Name *"
                      value={editFormData.lastName}
                      onChange={e => setEditFormData({ ...editFormData, lastName: e.target.value })}
                      className="border rounded-xl p-3 outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <input
                      type="date"
                      value={editFormData.dateOfBirth}
                      onChange={e => setEditFormData({ ...editFormData, dateOfBirth: e.target.value })}
                      className="border rounded-xl p-3 outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <select
                      value={editFormData.gender}
                      onChange={e => setEditFormData({ ...editFormData, gender: e.target.value })}
                      className="border rounded-xl p-3 outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="">Select Gender</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                    <select
                      value={editFormData.bloodGroup}
                      onChange={e => setEditFormData({ ...editFormData, bloodGroup: e.target.value })}
                      className="border rounded-xl p-3 outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="">Select Blood Group</option>
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(group => (
                        <option key={group} value={group}>{group}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-slate-800 mb-4">Contact Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      type="tel"
                      placeholder="Phone Number"
                      value={editFormData.phone}
                      onChange={e => setEditFormData({ ...editFormData, phone: e.target.value })}
                      className="border rounded-xl p-3 outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <input
                      type="email"
                      placeholder="Email Address"
                      value={editFormData.email}
                      onChange={e => setEditFormData({ ...editFormData, email: e.target.value })}
                      className="border rounded-xl p-3 outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <textarea
                      placeholder="Residential Address"
                      rows={3}
                      value={editFormData.address}
                      onChange={e => setEditFormData({ ...editFormData, address: e.target.value })}
                      className="md:col-span-2 border rounded-xl p-3 outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-slate-800 mb-4">Emergency Contact</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      placeholder="Emergency Contact Name"
                      value={editFormData.emergencyName}
                      onChange={e => setEditFormData({ ...editFormData, emergencyName: e.target.value })}
                      className="border rounded-xl p-3 outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <input
                      type="tel"
                      placeholder="Emergency Contact Phone"
                      value={editFormData.emergencyPhone}
                      onChange={e => setEditFormData({ ...editFormData, emergencyPhone: e.target.value })}
                      className="border rounded-xl p-3 outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                {editError && (
                  <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
                    {editError}
                  </div>
                )}

                <div className="flex justify-end gap-3 border-t pt-5">
                  <button
                    type="button"
                    onClick={() => setEditingPatient(null)}
                    className="px-5 py-3 border rounded-xl hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editSaving}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-950 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50"
                  >
                    <Save size={18} />
                    {editSaving ? 'Saving Changes...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Patient Confirmation Modal */}
        {deletingPatient && (
          <div className="fixed inset-0 z-[80] bg-slate-950/50 flex items-center justify-center p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-patient-title"
              className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-red-100 text-red-600">
                  <AlertTriangle size={25} />
                </div>
                <div className="flex-1">
                  <h2 id="delete-patient-title" className="text-xl font-bold text-slate-900">
                    Delete Patient?
                  </h2>
                  <p className="text-sm text-slate-600 mt-2 leading-6">
                    Are you sure you want to delete{' '}
                    <strong>{deletingPatient.firstName} {deletingPatient.lastName}</strong>
                    {' '}({deletingPatient.patientNumber})? This action cannot be undone.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDeletingPatient(null)}
                  disabled={deleteLoading}
                  className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg disabled:opacity-50"
                  aria-label="Close delete confirmation"
                >
                  <X size={20} />
                </button>
              </div>

              {deleteError && (
                <div role="alert" className="mt-5 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
                  {deleteError}
                </div>
              )}

              <div className="flex justify-end gap-3 mt-7">
                <button
                  type="button"
                  onClick={() => setDeletingPatient(null)}
                  disabled={deleteLoading}
                  className="px-5 py-3 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeletePatient}
                  disabled={deleteLoading}
                  className="px-5 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteLoading ? 'Deleting...' : 'Delete Patient'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pagination */}
        <div className="p-5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">

          <p className="text-sm text-slate-500">
            Showing {patients.length === 0 ? 0 : (page - 1) * pageSize + 1}
            {' '}to{' '}
            {Math.min(page * pageSize, patients.length)}
            {' '}of {patients.length} patients
          </p>

          <div className="flex items-center gap-3">

            <button
              disabled={page === 1}
              onClick={() => setPage((current) => current - 1)}
              className="px-4 py-2 border rounded-lg text-sm disabled:opacity-40 hover:bg-slate-50"
            >
              Previous
            </button>

            <span className="text-sm text-slate-600">
              Page {page} of {totalPages}
            </span>

            <button
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
              className="px-4 py-2 border rounded-lg text-sm disabled:opacity-40 hover:bg-slate-50"
            >
              Next
            </button>

          </div>

        </div>

      </div>

    </div>
  )
}

export default Patients
