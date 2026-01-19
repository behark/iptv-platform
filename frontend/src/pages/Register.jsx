import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Input, { PasswordStrengthIndicator } from '../components/ui/Input'
import Button from '../components/ui/Button'
import toast from 'react-hot-toast'

const Register = () => {
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: ''
  })
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  const validateField = (name, value) => {
    switch (name) {
      case 'email':
        if (!value) return 'Email is required'
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please enter a valid email'
        return ''
      case 'username':
        if (!value) return 'Username is required'
        if (value.length < 3) return 'Username must be at least 3 characters'
        if (value.length > 20) return 'Username must be at most 20 characters'
        if (!/^[a-zA-Z0-9_]+$/.test(value)) return 'Username can only contain letters, numbers, and underscores'
        return ''
      case 'password':
        if (!value) return 'Password is required'
        if (value.length < 8) return 'Password must be at least 8 characters'
        if (!/[a-z]/.test(value)) return 'Password must contain a lowercase letter'
        if (!/[A-Z]/.test(value)) return 'Password must contain an uppercase letter'
        if (!/[0-9]/.test(value)) return 'Password must contain a number'
        return ''
      case 'confirmPassword':
        if (!value) return 'Please confirm your password'
        if (value !== formData.password) return 'Passwords do not match'
        return ''
      default:
        return ''
    }
  }

  const validateForm = () => {
    const newErrors = {}
    Object.keys(formData).forEach(key => {
      if (['email', 'username', 'password', 'confirmPassword'].includes(key)) {
        const error = validateField(key, formData[key])
        if (error) newErrors[key] = error
      }
    })
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  useEffect(() => {
    if (touched.confirmPassword && formData.confirmPassword) {
      const error = validateField('confirmPassword', formData.confirmPassword)
      setErrors(prev => ({ ...prev, confirmPassword: error }))
    }
  }, [formData.password, formData.confirmPassword, touched.confirmPassword])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))

    if (touched[name]) {
      const error = validateField(name, value)
      setErrors(prev => ({ ...prev, [name]: error }))
    }
  }

  const handleBlur = (e) => {
    const { name, value } = e.target
    setTouched(prev => ({ ...prev, [name]: true }))
    const error = validateField(name, value)
    setErrors(prev => ({ ...prev, [name]: error }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    setTouched({
      email: true,
      username: true,
      password: true,
      confirmPassword: true
    })

    if (!validateForm()) {
      return
    }

    setLoading(true)

    try {
      const { confirmPassword, ...registerData } = formData
      await register(registerData)
      toast.success('Registration successful!')
      navigate('/')
    } catch (error) {
      const message = error.response?.data?.message || 'Registration failed'
      const fieldErrors = error.response?.data?.errors

      if (fieldErrors && Array.isArray(fieldErrors)) {
        const newErrors = {}
        fieldErrors.forEach(err => {
          if (err.path) newErrors[err.path] = err.msg
        })
        setErrors(newErrors)
      } else {
        toast.error(message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="mt-6 text-center text-3xl font-extrabold text-white">
            Create your account
          </h1>
          <p className="mt-2 text-center text-sm text-slate-400">
            Join us to access thousands of channels and videos
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit} noValidate>
          <div className="space-y-4">
            <Input
              label="Email address"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              onBlur={handleBlur}
              error={touched.email ? errors.email : undefined}
            />

            <Input
              label="Username"
              name="username"
              type="text"
              autoComplete="username"
              required
              placeholder="johndoe"
              value={formData.username}
              onChange={handleChange}
              onBlur={handleBlur}
              error={touched.username ? errors.username : undefined}
              helperText={!errors.username && !touched.username ? '3-20 characters, letters, numbers, and underscores only' : undefined}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="First name"
                name="firstName"
                type="text"
                autoComplete="given-name"
                placeholder="John"
                value={formData.firstName}
                onChange={handleChange}
              />
              <Input
                label="Last name"
                name="lastName"
                type="text"
                autoComplete="family-name"
                placeholder="Doe"
                value={formData.lastName}
                onChange={handleChange}
              />
            </div>

            <div>
              <Input
                label="Password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                placeholder="Create a strong password"
                value={formData.password}
                onChange={handleChange}
                onBlur={handleBlur}
                error={touched.password ? errors.password : undefined}
              />
              <PasswordStrengthIndicator password={formData.password} />
            </div>

            <Input
              label="Confirm password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              placeholder="Confirm your password"
              value={formData.confirmPassword}
              onChange={handleChange}
              onBlur={handleBlur}
              error={touched.confirmPassword ? errors.confirmPassword : undefined}
            />
          </div>

          <div>
            <Button
              type="submit"
              loading={loading}
              fullWidth
              size="lg"
            >
              Create account
            </Button>
          </div>

          <p className="text-center text-sm text-slate-400">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-medium text-primary-400 hover:text-primary-300 focus:outline-none focus-visible:underline"
            >
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}

export default Register
