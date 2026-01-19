import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api, { subscriptionsAPI } from '../services/api'
import Input, { PasswordStrengthIndicator } from '../components/ui/Input'
import Button from '../components/ui/Button'
import Skeleton from '../components/ui/Skeleton'
import toast from 'react-hot-toast'

const Profile = () => {
  const { user, checkAuth } = useAuth()
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [passwordMode, setPasswordMode] = useState(false)
  const [saving, setSaving] = useState(false)

  const [profileData, setProfileData] = useState({
    username: user?.username || '',
    firstName: user?.firstName || '',
    lastName: user?.lastName || ''
  })
  const [profileErrors, setProfileErrors] = useState({})

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [passwordErrors, setPasswordErrors] = useState({})

  useEffect(() => {
    loadSubscription()
  }, [])

  useEffect(() => {
    if (user) {
      setProfileData({
        username: user.username || '',
        firstName: user.firstName || '',
        lastName: user.lastName || ''
      })
    }
  }, [user])

  const loadSubscription = async () => {
    try {
      const response = await subscriptionsAPI.getMySubscription()
      setSubscription(response.data.data?.subscription || null)
    } catch (error) {
      setSubscription(null)
    } finally {
      setLoading(false)
    }
  }

  const validateUsername = (value) => {
    if (!value) return 'Username is required'
    if (value.length < 3) return 'Username must be at least 3 characters'
    if (value.length > 20) return 'Username must be at most 20 characters'
    if (!/^[a-zA-Z0-9_]+$/.test(value)) return 'Only letters, numbers, and underscores'
    return ''
  }

  const validatePassword = (value) => {
    if (!value) return 'Password is required'
    if (value.length < 8) return 'Password must be at least 8 characters'
    if (!/[a-z]/.test(value)) return 'Must contain a lowercase letter'
    if (!/[A-Z]/.test(value)) return 'Must contain an uppercase letter'
    if (!/[0-9]/.test(value)) return 'Must contain a number'
    return ''
  }

  const handleProfileUpdate = async (e) => {
    e.preventDefault()

    const usernameError = validateUsername(profileData.username)
    if (usernameError) {
      setProfileErrors({ username: usernameError })
      return
    }

    setSaving(true)
    try {
      await api.put('/users/profile', profileData)
      await checkAuth()
      toast.success('Profile updated successfully')
      setEditMode(false)
      setProfileErrors({})
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to update profile'
      toast.error(message)
      if (error.response?.data?.errors) {
        const errors = {}
        error.response.data.errors.forEach(err => {
          if (err.path) errors[err.path] = err.msg
        })
        setProfileErrors(errors)
      }
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()

    const errors = {}
    if (!passwordData.currentPassword) {
      errors.currentPassword = 'Current password is required'
    }
    const newPasswordError = validatePassword(passwordData.newPassword)
    if (newPasswordError) {
      errors.newPassword = newPasswordError
    }
    if (!passwordData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password'
    } else if (passwordData.newPassword !== passwordData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match'
    }

    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors)
      return
    }

    setSaving(true)
    try {
      await api.put('/users/password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      })
      toast.success('Password changed successfully')
      setPasswordMode(false)
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setPasswordErrors({})
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to change password'
      toast.error(message)
      if (message.toLowerCase().includes('current password')) {
        setPasswordErrors({ currentPassword: message })
      }
    } finally {
      setSaving(false)
    }
  }

  const cancelProfileEdit = () => {
    setEditMode(false)
    setProfileData({
      username: user?.username || '',
      firstName: user?.firstName || '',
      lastName: user?.lastName || ''
    })
    setProfileErrors({})
  }

  const cancelPasswordEdit = () => {
    setPasswordMode(false)
    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
    setPasswordErrors({})
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-white mb-6">Profile</h1>

      {/* Account Information */}
      <div className="bg-slate-800 rounded-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">Account Information</h2>
          {!editMode && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditMode(true)}
            >
              Edit Profile
            </Button>
          )}
        </div>

        {editMode ? (
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <Input
              label="Username"
              value={profileData.username}
              onChange={(e) => {
                setProfileData({ ...profileData, username: e.target.value })
                if (profileErrors.username) {
                  setProfileErrors({ ...profileErrors, username: '' })
                }
              }}
              error={profileErrors.username}
              required
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="First Name"
                value={profileData.firstName}
                onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
              />
              <Input
                label="Last Name"
                value={profileData.lastName}
                onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
              />
            </div>
            <div className="flex gap-3">
              <Button type="submit" loading={saving}>
                Save Changes
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={cancelProfileEdit}
                disabled={saving}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 w-24">Email:</span>
              <span className="text-white">{user?.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 w-24">Username:</span>
              <span className="text-white">{user?.username}</span>
            </div>
            {(user?.firstName || user?.lastName) && (
              <div className="flex items-center gap-2">
                <span className="text-slate-400 w-24">Name:</span>
                <span className="text-white">{user?.firstName} {user?.lastName}</span>
              </div>
            )}
            {user?.role === 'ADMIN' && (
              <div className="flex items-center gap-2">
                <span className="text-slate-400 w-24">Role:</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400">
                  {user.role}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Security */}
      <div className="bg-slate-800 rounded-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">Security</h2>
          {!passwordMode && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPasswordMode(true)}
            >
              Change Password
            </Button>
          )}
        </div>

        {passwordMode ? (
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <Input
              label="Current Password"
              type="password"
              value={passwordData.currentPassword}
              onChange={(e) => {
                setPasswordData({ ...passwordData, currentPassword: e.target.value })
                if (passwordErrors.currentPassword) {
                  setPasswordErrors({ ...passwordErrors, currentPassword: '' })
                }
              }}
              error={passwordErrors.currentPassword}
              required
            />
            <div>
              <Input
                label="New Password"
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => {
                  setPasswordData({ ...passwordData, newPassword: e.target.value })
                  if (passwordErrors.newPassword) {
                    setPasswordErrors({ ...passwordErrors, newPassword: '' })
                  }
                }}
                error={passwordErrors.newPassword}
                required
              />
              <PasswordStrengthIndicator password={passwordData.newPassword} />
            </div>
            <Input
              label="Confirm New Password"
              type="password"
              value={passwordData.confirmPassword}
              onChange={(e) => {
                setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                if (passwordErrors.confirmPassword) {
                  setPasswordErrors({ ...passwordErrors, confirmPassword: '' })
                }
              }}
              error={passwordErrors.confirmPassword}
              required
            />
            <p className="text-xs text-slate-400">
              Password must be at least 8 characters with uppercase, lowercase, and number.
            </p>
            <div className="flex gap-3">
              <Button type="submit" loading={saving}>
                Change Password
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={cancelPasswordEdit}
                disabled={saving}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <p className="text-slate-400">Password: ••••••••</p>
        )}
      </div>

      {/* Subscription */}
      <div className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Subscription</h2>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-48" />
          </div>
        ) : subscription ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 w-24">Plan:</span>
              <span className="text-white font-medium">{subscription.plan.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 w-24">Status:</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                subscription.status === 'ACTIVE'
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {subscription.status}
              </span>
            </div>
            {subscription.endDate && (
              <div className="flex items-center gap-2">
                <span className="text-slate-400 w-24">Expires:</span>
                <span className="text-white">
                  {new Date(subscription.endDate).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div>
            <p className="text-slate-400 mb-4">No active subscription</p>
            <Link to="/plans">
              <Button variant="primary">View Plans</Button>
            </Link>
          </div>
        )}
      </div>

      {user?.role === 'ADMIN' && (
        <div className="mt-6">
          <Link to="/admin">
            <Button
              variant="secondary"
              className="bg-purple-600 hover:bg-purple-700"
            >
              Open Admin Dashboard
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}

export default Profile
