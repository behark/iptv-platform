import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api, { subscriptionsAPI } from '../services/api'
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

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

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

  const handleProfileUpdate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.put('/users/profile', profileData)
      await checkAuth()
      toast.success('Profile updated successfully')
      setEditMode(false)
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Passwords do not match')
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
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to change password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-white mb-6">Profile</h1>

      <div className="bg-slate-800 rounded-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">Account Information</h2>
          {!editMode && (
            <button
              onClick={() => setEditMode(true)}
              className="text-primary-400 hover:text-primary-300 text-sm"
            >
              Edit Profile
            </button>
          )}
        </div>

        {editMode ? (
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Username</label>
              <input
                type="text"
                value={profileData.username}
                onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">First Name</label>
                <input
                  type="text"
                  value={profileData.firstName}
                  onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Last Name</label>
                <input
                  type="text"
                  value={profileData.lastName}
                  onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={() => setEditMode(false)}
                className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-2">
            <p className="text-gray-300">
              <span className="font-medium">Email:</span> {user?.email}
            </p>
            <p className="text-gray-300">
              <span className="font-medium">Username:</span> {user?.username}
            </p>
            {(user?.firstName || user?.lastName) && (
              <p className="text-gray-300">
                <span className="font-medium">Name:</span> {user?.firstName} {user?.lastName}
              </p>
            )}
            {user?.role === 'ADMIN' && (
              <p className="text-gray-300">
                <span className="font-medium">Role:</span>{' '}
                <span className="text-purple-400">{user.role}</span>
              </p>
            )}
          </div>
        )}
      </div>

      <div className="bg-slate-800 rounded-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">Security</h2>
          {!passwordMode && (
            <button
              onClick={() => setPasswordMode(true)}
              className="text-primary-400 hover:text-primary-300 text-sm"
            >
              Change Password
            </button>
          )}
        </div>

        {passwordMode ? (
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Current Password</label>
              <input
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">New Password</label>
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Confirm New Password</label>
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
              >
                {saving ? 'Changing...' : 'Change Password'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPasswordMode(false)
                  setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
                }}
                className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <p className="text-gray-400">••••••••</p>
        )}
      </div>

      <div className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Subscription</h2>
        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : subscription ? (
          <div>
            <p className="text-gray-300 mb-2">
              <span className="font-medium">Plan:</span> {subscription.plan.name}
            </p>
            <p className="text-gray-300 mb-2">
              <span className="font-medium">Status:</span>{' '}
              <span className={`${subscription.status === 'ACTIVE' ? 'text-green-400' : 'text-red-400'}`}>
                {subscription.status}
              </span>
            </p>
            {subscription.endDate && (
              <p className="text-gray-300">
                <span className="font-medium">Expires:</span>{' '}
                {new Date(subscription.endDate).toLocaleDateString()}
              </p>
            )}
          </div>
        ) : (
          <div>
            <p className="text-gray-400 mb-4">No active subscription</p>
            <Link
              to="/plans"
              className="text-primary-400 hover:text-primary-300"
            >
              View Plans →
            </Link>
          </div>
        )}
      </div>

      {user?.role === 'ADMIN' && (
        <div className="mt-6">
          <Link
            to="/admin"
            className="inline-block bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium"
          >
            Open Admin Dashboard
          </Link>
        </div>
      )}
    </div>
  )
}

export default Profile
