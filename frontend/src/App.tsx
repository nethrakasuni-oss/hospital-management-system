
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import axios from 'axios'
import {
  Activity,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  HeartPulse,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react'

import api from './lib/api'
import { useAuth, type AuthUser } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Dashboard from './pages/Dashboard'
import Unauthorized from './pages/Unauthorized'
import Patients from './pages/Patients'
import PatientProfile from './pages/PatientProfile'
import MainLayout from './components/layout/MainLayout'
import ModuleWorkspace from './pages/ModuleWorkspace'
import Emergency from './pages/Emergency'
import SurgeryTheatre from './pages/SurgeryTheatre'
import Administration from './pages/Administration'
import Notifications from './pages/Notifications'
import MedicalRecords from './pages/MedicalRecords'
import AdmissionsBeds from './pages/AdmissionsBeds'
import Discharges from './pages/Discharges'
import Appointments from './pages/Appointments'
import ReceptionDashboard from './pages/ReceptionDashboard'
import Doctors from './pages/Doctors'
import DoctorSchedules from './pages/DoctorSchedules'
import DoctorDashboard from './pages/DoctorDashboard'
import DoctorPatientQueue from './pages/DoctorPatientQueue'
import DoctorConsultation from './pages/DoctorConsultation'
import NursingOperations from './pages/NursingOperations'
import PharmacyManagement from './pages/PharmacyManagement'
import LaboratoryManagement from './pages/LaboratoryManagement'
import Billing from './pages/Billing'
import Procurement from './pages/Procurement'
import Insurance from './pages/Insurance'
import AccountantDashboard from './pages/AccountantDashboard'
import ReportsAnalytics from './pages/ReportsAnalytics'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'

interface LoginResponse {
  accessToken: string
  user: AuthUser
}

// LOGIN PAGE
function LoginPage() {
  const navigate = useNavigate()
  const { login, isAuthenticated } = useAuth()

  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')



  // Redirect already authenticated users
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    setError('')
    setLoading(true)

    try {
      const response = await api.post<LoginResponse>(
        '/auth/login',
        {
          email: email.trim(),
          password,
        },
      )

      const { accessToken, user } = response.data

      if (!accessToken || !user) {
        throw new Error('Invalid login response from server.')
      }

      // Store JWT and user through AuthContext
      login(accessToken, user)

      // Navigate to hospital dashboard
      navigate('/dashboard', { replace: true })

    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const message = err.response?.data?.message

        if (err.response?.status === 401) {
          setError('Invalid email or password. Please try again.')
        } else {
          setError(
            Array.isArray(message)
              ? message.join(', ')
              : message || 'Unable to connect to the server.',
          )
        }
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">

      {/* Left branding section */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-950 via-blue-900 to-teal-800 text-white flex-col justify-between p-12 relative overflow-hidden">

        <div className="absolute w-96 h-96 bg-teal-400/10 rounded-full -top-20 -right-20" />
        <div className="absolute w-80 h-80 bg-blue-400/10 rounded-full -bottom-20 -left-20" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="bg-white/15 p-3 rounded-2xl">
            <HeartPulse size={30} />
          </div>

          <div>
            <h1 className="text-2xl font-bold">MediCore HMS</h1>
            <p className="text-blue-200 text-sm">
              Hospital Management System
            </p>
          </div>
        </div>

        <div className="relative z-10 max-w-lg">

          <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 text-sm mb-7">
            <Activity size={16} className="text-teal-300" />
            Smart Healthcare Management
          </div>

          <h2 className="text-5xl font-bold leading-tight mb-6">
            Better Care.
            <br />
            Smarter Management.
          </h2>

          <p className="text-blue-100 text-lg leading-8">
            Manage patients, healthcare professionals, appointments and
            hospital operations through one connected platform.
          </p>

          <div className="grid grid-cols-2 gap-4 mt-10">

            <div className="bg-white/10 border border-white/10 rounded-2xl p-5">
              <ShieldCheck className="text-teal-300 mb-3" size={25} />
              <h3 className="font-semibold">Secure Access</h3>
              <p className="text-blue-200 text-sm mt-1">
                Protected healthcare information
              </p>
            </div>

            <div className="bg-white/10 border border-white/10 rounded-2xl p-5">
              <HeartPulse className="text-teal-300 mb-3" size={25} />
              <h3 className="font-semibold">Connected Care</h3>
              <p className="text-blue-200 text-sm mt-1">
                Integrated hospital operations
              </p>
            </div>

          </div>
        </div>

        <p className="relative z-10 text-blue-200 text-sm">
          © 2026 MediCore HMS. All rights reserved.
        </p>
      </div>

      {/* Login section */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">

        <div className="w-full max-w-md">

          {/* Mobile branding */}
          <div className="lg:hidden flex items-center gap-3 mb-12">

            <div className="bg-blue-900 text-white p-3 rounded-xl">
              <HeartPulse size={26} />
            </div>

            <div>
              <h1 className="font-bold text-xl text-slate-900">
                MediCore HMS
              </h1>
              <p className="text-slate-500 text-sm">
                Hospital Management System
              </p>
            </div>

          </div>

          {/* Heading */}
          <div className="mb-9">
            <p className="text-teal-700 font-semibold text-sm mb-3">
              WELCOME BACK
            </p>

            <h2 className="text-3xl font-bold text-slate-900">
              Sign in to your account
            </h2>

            <p className="text-slate-500 mt-3">
              Enter your credentials to access the hospital dashboard.
            </p>
          </div>

          {/* Login form */}
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Email Address
              </label>

              <div className="relative">
                <Mail
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  size={19}
                />

                <input
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@hospital.com"
                  className="w-full pl-12 pr-4 py-4 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Password
              </label>

              <div className="relative">
                <LockKeyhole
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  size={19}
                />

                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-12 pr-12 py-4 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  {showPassword
                    ? <EyeOff size={20} />
                    : <Eye size={20} />
                  }
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div className="flex items-center justify-between">

              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="accent-teal-600 w-4 h-4"
                />
                Remember me
              </label>

              <button
  type="button"
  onClick={() => navigate('/forgot-password')}
  className="text-sm text-teal-700 font-semibold hover:text-teal-900"
>
  Forgot password?
</button>

            </div>

            {/* Error message */}
            {error && (
              <div
                role="alert"
                className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-950 hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-2 transition duration-300 shadow-lg shadow-blue-950/10"
            >
              {loading ? 'Signing in...' : 'Sign In'}

              {!loading && <ArrowRight size={19} />}
            </button>

          </form>

          {/* Security information */}
          <div className="mt-9 flex items-center justify-center gap-2 text-sm text-slate-400">
            <ShieldCheck size={17} />
            Secure Hospital Management Access
          </div>

          <p className="text-center text-xs text-slate-400 mt-8">
            MediCore HMS · Version 1.0
          </p>

        </div>
      </div>
    </div>
  )
}
function RoleDashboard() {
  const { user } = useAuth()

  if (user?.role?.toUpperCase() === 'RECEPTIONIST') {
    return <ReceptionDashboard />
  }

  if (user?.role?.toUpperCase() === 'DOCTOR') {
    return <DoctorDashboard />
  }

  if (user?.role?.toUpperCase() === 'NURSE') {
    return <NursingOperations />
  }

  if (user?.role?.toUpperCase() === 'PHARMACIST') {
    return <PharmacyManagement />
  }

  if (user?.role?.toUpperCase() === 'ACCOUNTANT') {
    return <AccountantDashboard />
  }

  return <Dashboard />
}


function App() {
  const { isAuthenticated} = useAuth()

  const home = isAuthenticated
    ? '/dashboard'
    : '/login'

  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to={home} replace />}
      />

      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>

          {/* Dashboard: role determines dashboard content */}
          <Route
            path="/dashboard"
            element={<RoleDashboard />}
          />

          {/* Receptionist and Admin */}
          <Route element={
            <ProtectedRoute allowedRoles={['ADMIN', 'RECEPTIONIST']} />
          }>
            <Route path="/patients" element={<Patients />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/emergency" element={<Emergency />} />
          </Route>

          {/* Patient profiles may be viewed by their assigned clinical staff */}
          <Route element={
            <ProtectedRoute allowedRoles={['ADMIN', 'RECEPTIONIST', 'DOCTOR']} />
          }>
            <Route path="/patients/:id" element={<PatientProfile />} />
          </Route>

          {/* Doctor management and schedules */}
<Route element={
  <ProtectedRoute allowedRoles={['ADMIN', 'HR_MANAGER']} />
}>
  <Route path="/doctors" element={<Doctors />} />
  <Route path="/doctors/:id/schedules" element={<DoctorSchedules />} />
</Route>

          {/* Doctor patient queue and consultation workspace */}
          <Route element={
            <ProtectedRoute allowedRoles={['DOCTOR']} />
          }>
            <Route path="/patient-queue" element={<DoctorPatientQueue />} />
            <Route path="/patient-queue/:appointmentId" element={<DoctorConsultation />} />
          </Route>

          {/* Nurse inpatient care workspace */}
          <Route element={
            <ProtectedRoute allowedRoles={['NURSE', 'ADMIN']} />
          }>
            <Route path="/nursing" element={<NursingOperations />} />
          </Route>

          {/* Pharmacist and administrator pharmacy workspace */}
          <Route element={
            <ProtectedRoute allowedRoles={['ADMIN', 'PHARMACIST', 'DOCTOR', 'NURSE']} />
          }>
            <Route path="/pharmacy" element={<PharmacyManagement />} />
          </Route>

          {/* Billing and payments workspace */}
          <Route element={
            <ProtectedRoute allowedRoles={['ADMIN','RECEPTIONIST','ACCOUNTANT']} />
          }>
            <Route path="/billing" element={<Billing/>} />
          </Route>

          {/* Pharmacy procurement workspace */}
          <Route element={
            <ProtectedRoute allowedRoles={['ADMIN','PHARMACIST','ACCOUNTANT']} />
          }>
            <Route path="/procurement" element={<Procurement/>} />
          </Route>

          {/* Laboratory and diagnostics workspace */}
          <Route element={
            <ProtectedRoute allowedRoles={['ADMIN', 'DOCTOR', 'NURSE', 'LAB_TECHNICIAN', 'LAB_MANAGER', 'PATHOLOGIST', 'RECEPTIONIST']} />
          }>
            <Route path="/laboratory" element={<LaboratoryManagement />} />
          </Route>


          {/* Insurance: operational entry by Receptionist, review by Accountant, full access Admin */}
          <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'RECEPTIONIST', 'ACCOUNTANT']} />}>
            <Route path="/insurance" element={<Insurance />} />
          </Route>

          {/* Reports are filtered by role in the page and enforced by API permissions */}
          <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'ACCOUNTANT']} />}>
            <Route path="/reports" element={<ReportsAnalytics />} />
          </Route>

          {/* Administrator only */}
          <Route element={
            <ProtectedRoute allowedRoles={['ADMIN']} />
          }>
            <Route path="/doctors" element={<ModuleWorkspace moduleKey="doctors" />} />
            <Route path="/departments" element={<ModuleWorkspace moduleKey="departments" />} />
            <Route path="/admissions" element={<AdmissionsBeds />} />
            <Route path="/surgeries" element={<SurgeryTheatre />} />
            <Route path="/transfers" element={<ModuleWorkspace moduleKey="transfers" />} />
            <Route path="/employees" element={<ModuleWorkspace moduleKey="employees" />} />
            <Route path="/administration" element={<Administration />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/medical-records" element={<MedicalRecords />} />
            <Route path="/discharges" element={<Discharges />} />
          </Route>

        </Route>
      </Route>

      <Route path="/unauthorized" element={<Unauthorized />} />

      <Route
        path="*"
        element={<Navigate to={home} replace />}
      />
    </Routes>
  )
}

export default App


