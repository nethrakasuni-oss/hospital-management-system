
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { ArrowLeft, ArrowRight, HeartPulse, Mail, ShieldCheck, CheckCircle2 } from 'lucide-react'
import api from '../lib/api'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await api.post('/auth/forgot-password', {
        email: email.trim(),
      })

      // Always display the same response to avoid revealing accounts.
      setSuccess(true)
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const message = err.response?.data?.message
        setError(
          Array.isArray(message)
            ? message.join(', ')
            : message || 'Unable to process your request. Please try again.',
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
                  <Mail size={24} />
                </div>

                <h2 className="text-2xl font-bold text-slate-900">
                  Forgot your password?
                </h2>

                <p className="text-sm text-slate-500 mt-3 leading-6">
                  Enter your registered email address. If an account exists,
                  we will send you instructions to reset your password.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-semibold text-slate-700 mb-2"
                  >
                    Email Address
                  </label>

                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your registered email"
                    className="w-full px-4 py-3.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 transition"
                  />
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
                  disabled={loading}
                  className="w-full bg-blue-950 hover:bg-teal-700 disabled:opacity-60 text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-2 transition"
                >
                  {loading ? 'Sending request...' : 'Send Reset Link'}
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
                Check your email
              </h2>

              <p className="text-sm text-slate-500 mt-4 leading-6">
                If an account exists for <strong>{email}</strong>, password
                reset instructions will be sent to that address.
              </p>

              <p className="text-xs text-slate-400 mt-4">
                Check your spam folder if the email does not appear.
              </p>
            </div>
          )}

          <div className="border-t border-slate-100 mt-7 pt-6">
            <Link
              to="/login"
              className="flex items-center justify-center gap-2 text-sm font-semibold text-teal-700 hover:text-teal-900"
            >
              <ArrowLeft size={17} />
              Back to Login
            </Link>
          </div>
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
