import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authAPI } from '../services/api'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import toast from 'react-hot-toast'

const ForgotPassword = () => {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const validateEmail = (value) => {
    if (!value) return 'Email is required'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please enter a valid email'
    return ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const validationError = validateEmail(email)
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    setError('')

    try {
      await authAPI.forgotPassword(email)
      setSubmitted(true)
      toast.success('Reset link sent! Check your email.')
    } catch (err) {
      // Don't reveal if email exists or not
      setSubmitted(true)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-green-500/10">
            <svg
              className="h-8 w-8 text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold text-white">Check your email</h1>
          <p className="text-slate-400">
            If an account exists for <span className="text-white">{email}</span>, we've sent a password reset link.
          </p>
          <p className="text-sm text-slate-500">
            Didn't receive the email? Check your spam folder or{' '}
            <button
              onClick={() => setSubmitted(false)}
              className="text-primary-400 hover:text-primary-300"
            >
              try again
            </button>
          </p>
          <Link
            to="/login"
            className="inline-block mt-4 text-primary-400 hover:text-primary-300"
          >
            Back to login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="mt-6 text-center text-3xl font-extrabold text-white">
            Reset your password
          </h1>
          <p className="mt-2 text-center text-sm text-slate-400">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit} noValidate>
          <Input
            label="Email address"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (error) setError('')
            }}
            error={error}
          />

          <Button
            type="submit"
            loading={loading}
            fullWidth
            size="lg"
          >
            Send reset link
          </Button>

          <p className="text-center text-sm text-slate-400">
            Remember your password?{' '}
            <Link
              to="/login"
              className="font-medium text-primary-400 hover:text-primary-300"
            >
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}

export default ForgotPassword
