
import { Link } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'

function Unauthorized() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-10 text-center">
        <ShieldAlert size={55} className="mx-auto text-red-500 mb-5" />

        <h1 className="text-2xl font-bold text-slate-900">
          Access Denied
        </h1>

        <p className="text-slate-500 mt-3">
          You do not have permission to access this page.
        </p>

        <Link
          to="/login"
          className="inline-block mt-7 bg-blue-950 text-white px-6 py-3 rounded-xl hover:bg-teal-700"
        >
          Return to Login
        </Link>
      </div>
    </div>
  )
}

export default Unauthorized
