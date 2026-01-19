import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { authAPI } from '../services/api'
import Input, { PasswordStrengthIndicator } from '../components/ui/Input'
import Button from '../components/ui/Button'
import toast from 'react-hot-toast'

const ResetPassword = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const validatePassword = (value) => {
    if (!value) return 'Password is required'
    if (value.length < 8) return 'Password must be at least 8 characters'
    if (!/[a-z]/.test(value)) return 'Password must contain a lowercase letter'
    if (!/[A-Z]/.test(value)) return 'Password must contain an uppercase letter'
    if (!/[0-9]/.test(value)) return 'Password must contain a number'
    return ''
  }

  const validateConfirmPassword = (value) => {
    if (!value) return 'Please confirm your password'
    if (value !== password) return 'Passwords do not match'
    return ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const passwordError = validatePassword(password)
    const confirmError = validateConfirmPassword(confirmPassword)

    setErrors({
      password: passwordError,
      confirmPassword: confirmError
    })

    if (passwordError || confirmError) {
      return
    }

    if (!token) {
      toast.error('Invalid or expired reset link')
      return
    }

    setLoading(true)

    try {
      await authAPI.resetPassword(token, password)
      setSuccess(true)
      toast.success('Password reset successfully!')
      setTimeout(() => navigate('/login'), 3000)
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to reset password'
      toast.error(message)
      setErrors({ form: message })
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-red-500/10">
            <svg
              className="h-8 w-8 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold text-white">Invalid Link</h1>
          <p className="text-slate-400">
            This password reset link is invalid or has expired.
          </p>
          <Link
            to="/forgot-password"
            className="inline-block mt-4 text-primary-400 hover:text-primary-300"
          >
            Request a new reset link
          </Link>
        </div>
      </div>
    )
  }

  if (success) {
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
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold text-white">Password Reset!</h1>
          <p className="text-slate-400">
            Your password has been successfully reset. Redirecting to login...
          </p>
          <Link
            to="/login"
            className="inline-block mt-4 text-primary-400 hover:text-primary-300"
          >
            Go to login
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
            Create new password
          </h1>
          <p className="mt-2 text-center text-sm text-slate-400">
            Enter your new password below.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit} noValidate>
          {errors.form && (
            <div
              className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm"
              role="alert"
            >
              {errors.form}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Input
                label="New password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                placeholder="Enter your new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
              />
              <PasswordStrengthIndicator password={password} />
            </div>

            <Input
              label="Confirm new password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              placeholder="Confirm your new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={errors.confirmPassword}
            />
          </div>

          <Button
            type="submit"
            loading={loading}
            fullWidth
            size="lg"
          >
            Reset password
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

export default ResetPassword
