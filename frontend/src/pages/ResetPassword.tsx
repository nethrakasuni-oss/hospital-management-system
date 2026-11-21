
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  HeartPulse,
  LockKeyhole,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react'
import api from '../lib/api'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')

    if (!token) {
      setError('The password reset link is missing its token.')
      return
    }

    if (password.length < 8) {
      setError('Password must contain at least 8 characters.')
      return
    }

    if (password.length > 72) {
      setError('Password cannot exceed 72 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      await api.post('/auth/reset-password', {
        token,
        newPassword: password,
      })

      setSuccess(true)
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const message = err.response?.data?.message
        setError(
          Array.isArray(message)
            ? message.join(', ')
            : message || 'Invalid or expired password reset link.',
        )
      } else {
        setError('Unable to connect to the server. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center bg-blue-950 text-white p-4 rounded-2xl mb-4">
            <HeartPulse size={32} />
          </div>

          <h1 className="text-2xl font-bold text-slate-900">
            MediCore HMS
          </h1>

          <p className="text-sm text-slate-500 mt-1">
            Hospital Management System
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">

          {!success ? (
            <>
              <div className="mb-7">
                <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center mb-5">
                  <LockKeyhole size={24} />
                </div>

                <h2 className="text-2xl font-bold text-slate-900">
                  Create a new password
                </h2>

                <p className="text-sm text-slate-500 mt-3">
                  Choose a secure password for your MediCore account.
                </p>
              </div>

              {!token && (
                <div className="mb-5 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  The reset token is missing. Please request a new password reset link.
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label
                    htmlFor="new-password"
                    className="block text-sm font-semibold text-slate-700 mb-2"
                  >
                    New Password
                  </label>

                  <div className="relative">
                    <input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      maxLength={72}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="w-full px-4 pr-12 py-3.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 transition"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                    >
                      {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                    </button>
                  </div>

                  <p className="text-xs text-slate-400 mt-2">
                    Use at least 8 characters. Maximum 72 characters.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="confirm-password"
                    className="block text-sm font-semibold text-slate-700 mb-2"
                  >
                    Confirm New Password
                  </label>

                  <div className="relative">
                    <input
                      id="confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      maxLength={72}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="w-full px-4 pr-12 py-3.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 transition"
                    />

                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                    >
                      {showConfirmPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700"
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !token}
                  className="w-full bg-blue-950 hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-2 transition"
                >
                  {loading ? 'Resetting password...' : 'Reset Password'}
                  {!loading && <ArrowRight size={18} />}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 size={34} />
              </div>

              <h2 className="text-2xl font-bold text-slate-900">
                Password reset successful
              </h2>

              <p className="text-sm text-slate-500 mt-4 leading-6">
                Your MediCore account password has been updated.
                You can now sign in using your new password.
              </p>

              <button
                type="button"
                onClick={() => navigate('/login', { replace: true })}
                className="w-full mt-7 bg-blue-950 hover:bg-teal-700 text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-2 transition"
              >
                Continue to Login
                <ArrowRight size={18} />
              </button>
            </div>
          )}

          {!success && (
            <div className="border-t border-slate-100 mt-7 pt-6">
              <Link
                to="/login"
                className="flex items-center justify-center gap-2 text-sm font-semibold text-teal-700 hover:text-teal-900"
              >
                <ArrowLeft size={17} />
                Back to Login
              </Link>
            </div>
          )}
        </div>

        <div className="mt-7 flex items-center justify-center gap-2 text-xs text-slate-400">
          <ShieldCheck size={16} />
          Secure Hospital Management Access
        </div>

        <p className="text-center text-xs text-slate-400 mt-5">
          MediCore HMS · Version 1.0
        </p>
      </div>
    </div>
  )
}
