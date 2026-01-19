import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import toast from 'react-hot-toast'

const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const { login, user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.from || '/'

  useEffect(() => {
    if (user && !authLoading) {
      navigate(redirectTo, { replace: true })
    }
  }, [user, authLoading, navigate, redirectTo])

  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail')
    if (savedEmail) {
      setEmail(savedEmail)
      setRememberMe(true)
    }
  }, [])

  const validateField = (name, value) => {
    switch (name) {
      case 'email':
        if (!value) return 'Email is required'
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please enter a valid email'
        return ''
      case 'password':
        if (!value) return 'Password is required'
        return ''
      default:
        return ''
    }
  }

  const handleEmailChange = (e) => {
    const value = e.target.value
    setEmail(value)
    if (touched.email) {
      setErrors(prev => ({ ...prev, email: validateField('email', value) }))
    }
  }

  const handlePasswordChange = (e) => {
    const value = e.target.value
    setPassword(value)
    if (touched.password) {
      setErrors(prev => ({ ...prev, password: validateField('password', value) }))
    }
  }

  const handleBlur = (field) => (e) => {
    setTouched(prev => ({ ...prev, [field]: true }))
    setErrors(prev => ({ ...prev, [field]: validateField(field, e.target.value) }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    setTouched({ email: true, password: true })

    const emailError = validateField('email', email)
    const passwordError = validateField('password', password)

    setErrors({ email: emailError, password: passwordError })

    if (emailError || passwordError) {
      return
    }

    setSubmitting(true)

    try {
      await login(email, password)

      if (rememberMe) {
        localStorage.setItem('rememberedEmail', email)
      } else {
        localStorage.removeItem('rememberedEmail')
      }

      toast.success('Login successful!')
      navigate(redirectTo, { replace: true })
    } catch (error) {
      const message = error.response?.data?.message || error.userMessage || 'Login failed'
      setErrors({ form: message })
      toast.error(message)
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="mt-6 text-center text-3xl font-extrabold text-white">
            Sign in to your account
          </h1>
          <p className="mt-2 text-center text-sm text-slate-400">
            Access your channels, videos, and playlists
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
            <Input
              label="Email address"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={handleEmailChange}
              onBlur={handleBlur('email')}
              error={touched.email ? errors.email : undefined}
            />

            <Input
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="Enter your password"
              value={password}
              onChange={handlePasswordChange}
              onBlur={handleBlur('password')}
              error={touched.password ? errors.password : undefined}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 text-primary-600 bg-slate-700 border-slate-600 rounded focus:ring-primary-500 focus:ring-offset-slate-900"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-300">
                Remember me
              </label>
            </div>

            <div className="text-sm">
              <Link
                to="/forgot-password"
                className="font-medium text-primary-400 hover:text-primary-300 focus:outline-none focus-visible:underline"
              >
                Forgot your password?
              </Link>
            </div>
          </div>

          <div>
            <Button
              type="submit"
              loading={submitting}
              fullWidth
              size="lg"
            >
              Sign in
            </Button>
          </div>

          <p className="text-center text-sm text-slate-400">
            Don't have an account?{' '}
            <Link
              to="/register"
              className="font-medium text-primary-400 hover:text-primary-300 focus:outline-none focus-visible:underline"
            >
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}

export default Login
