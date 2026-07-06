import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import api from '../../services/api'
import toast from 'react-hot-toast'

const AdminDashboard = () => {
    const { user } = useAuth()
    const navigate = useNavigate()
    const [stats, setStats] = useState(null)
    const [recentUsers, setRecentUsers] = useState([])
    const [recentSubscriptions, setRecentSubscriptions] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('overview')
    const [users, setUsers] = useState([])
    const [videos, setVideos] = useState([])
    const [channels, setChannels] = useState([])
    const [devices, setDevices] = useState([])
    const [macAddress, setMacAddress] = useState('')
    const [deviceName, setDeviceName] = useState('')
    const [selectedPlan, setSelectedPlan] = useState('admin')
    const [subscriptionDays, setSubscriptionDays] = useState(30)
    const [plans, setPlans] = useState([])
    const [planSelections, setPlanSelections] = useState({})
    const [activationResult, setActivationResult] = useState(null)
    const [activating, setActivating] = useState(false)
    const [validation, setValidation] = useState({ limit: 200, country: '', category: '' })
    const [validating, setValidating] = useState(false)
    const [validationResult, setValidationResult] = useState(null)

    useEffect(() => {
        if (user?.role !== 'ADMIN') {
            toast.error('Access denied. Admin only.')
            navigate('/')
            return
        }
        loadDashboard()
    }, [user, navigate])

    const loadDashboard = async () => {
        try {
            setLoading(true)
            const response = await api.get('/admin/stats')
            const data = response.data.data
            setStats(data.stats)
            setRecentUsers(data.recentUsers || [])
            setRecentSubscriptions(data.recentSubscriptions || [])
        } catch (error) {
            toast.error('Failed to load dashboard')
        } finally {
            setLoading(false)
        }
    }

    const loadUsers = async () => {
        try {
            const response = await api.get('/admin/users')
            setUsers(response.data.data?.users || [])
        } catch (error) {
            toast.error('Failed to load users')
        }
    }

    const loadVideos = async () => {
        try {
            const response = await api.get('/admin/videos')
            setVideos(response.data.data?.videos || [])
        } catch (error) {
            toast.error('Failed to load videos')
        }
    }

    const loadChannels = async () => {
        try {
            const response = await api.get('/channels')
            setChannels(response.data.data?.channels || [])
        } catch (error) {
            toast.error('Failed to load channels')
        }
    }

    const loadDevices = async () => {
        try {
            const response = await api.get('/admin/devices')
            setDevices(response.data.data?.devices || [])
        } catch (error) {
            toast.error('Failed to load devices')
        }
    }

    const loadPlans = async () => {
        try {
            const response = await api.get('/subscriptions/plans')
            setPlans(response.data.data?.plans?.filter(p => p.isActive) || [])
        } catch (error) {
            console.error('Failed to load plans')
        }
    }

    const activateDevice = async (e) => {
        e.preventDefault()
        if (!macAddress.trim()) {
            toast.error('Please enter a MAC address')
            return
        }
        setActivating(true)
        setActivationResult(null)
        try {
            const response = await api.post('/admin/devices/activate', {
                macAddress: macAddress.trim(),
                name: deviceName.trim() || undefined,
                planId: selectedPlan,
                subscriptionDays: selectedPlan !== 'admin' ? subscriptionDays : undefined
            })
            setActivationResult(response.data.data)
            const pushOk = response.data.data?.smartIptv?.autoPush?.success
            toast.success(pushOk
                ? 'Device activated & playlist pushed to Smart IPTV!'
                : 'Device activated (manual upload needed)'
            )
            loadDevices()
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to activate device')
        } finally {
            setActivating(false)
        }
    }

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text)
        toast.success('Copied to clipboard!')
    }

    const runValidation = async (dryRun) => {
        if (!dryRun && !window.confirm('Deactivate every dead channel found in this run?')) return
        setValidating(true)
        setValidationResult(null)
        try {
            const response = await api.post('/admin/channels/validate', {
                dryRun,
                limit: Number(validation.limit) || 200,
                country: validation.country.trim() || undefined,
                category: validation.category.trim() || undefined
            })
            setValidationResult(response.data.data)
            toast.success(response.data.message)
            if (!dryRun) loadChannels()
        } catch (error) {
            toast.error(error.response?.data?.message || 'Validation failed')
        } finally {
            setValidating(false)
        }
    }

    const deleteInactiveChannels = async () => {
        if (!window.confirm('Permanently delete ALL inactive channels? This cannot be undone.')) return
        try {
            const response = await api.delete('/admin/channels/inactive')
            toast.success(response.data.message)
            loadChannels()
        } catch (error) {
            toast.error(error.response?.data?.message || 'Delete failed')
        }
    }

    useEffect(() => {
        if (activeTab === 'users') {
            loadUsers()
            loadPlans()
        }
        if (activeTab === 'videos') loadVideos()
        if (activeTab === 'channels') loadChannels()
        if (activeTab === 'devices') {
            loadDevices()
            loadPlans()
        }
    }, [activeTab])

    const toggleUserStatus = async (userId, isActive) => {
        try {
            await api.put(`/admin/users/${userId}`, { isActive: !isActive })
            loadUsers()
            toast.success(`User ${isActive ? 'deactivated' : 'activated'}`)
        } catch (error) {
            toast.error('Failed to update user')
        }
    }

    const deleteVideo = async (videoId) => {
        if (!window.confirm('Are you sure you want to delete this video?')) return
        try {
            await api.delete(`/admin/videos/${videoId}`)
            loadVideos()
            toast.success('Video deleted')
        } catch (error) {
            toast.error('Failed to delete video')
        }
    }

    const deleteUser = async (userId, email) => {
        if (userId === user?.id) {
            toast.error('You cannot delete your own account')
            return
        }
        if (!window.confirm(`Delete user ${email}? This will remove their subscriptions and devices.`)) return
        try {
            await api.delete(`/admin/users/${userId}`)
            loadUsers()
            toast.success('User deleted')
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete user')
        }
    }

    const deleteDevice = async (deviceId, macAddress) => {
        if (!window.confirm(`Delete device ${macAddress}?`)) return
        try {
            await api.delete(`/admin/devices/${deviceId}`)
            loadDevices()
            toast.success('Device deleted')
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete device')
        }
    }

    const changeUserPlan = async (userRecord) => {
        if (userRecord.role !== 'USER') {
            toast.error('Only regular users can have subscription plans')
            return
        }
        const currentPlanId = userRecord.subscriptions?.[0]?.plan?.id || ''
        const selectedPlanId = planSelections[userRecord.id] || currentPlanId
        if (!selectedPlanId) {
            toast.error('Please select a plan')
            return
        }
        if (selectedPlanId === currentPlanId) {
            toast.success('User is already on this plan')
            return
        }
        if (!window.confirm(`Change plan for ${userRecord.email}?`)) return
        try {
            await api.post('/admin/subscriptions', {
                userId: userRecord.id,
                planId: selectedPlanId
            })
            loadUsers()
            toast.success('Plan updated')
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update plan')
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
            </div>
        )
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-3xl font-bold text-white mb-8">Admin Dashboard</h1>

            <div className="flex gap-4 mb-8 border-b border-slate-700 overflow-x-auto">
                {['overview', 'devices', 'users', 'videos', 'channels'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`pb-4 px-2 font-medium capitalize ${activeTab === tab
                            ? 'text-primary-400 border-b-2 border-primary-400'
                            : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {activeTab === 'overview' && (
                <div className="space-y-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <StatCard title="Total Users" value={stats?.totalUsers || 0} icon="👥" />
                        <StatCard title="Active Subscriptions" value={stats?.activeSubscriptions || 0} icon="💳" />
                        <StatCard title="Channels" value={stats?.totalChannels || 0} icon="📺" />
                        <StatCard title="Videos" value={stats?.totalVideos || 0} icon="🎬" />
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-slate-800 rounded-lg p-6">
                        <h2 className="text-xl font-semibold text-white mb-4">Quick Actions</h2>
                        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                            <Link
                                to="/admin/vod"
                                className="flex items-center gap-3 p-4 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                            >
                                <span className="text-2xl">🎬</span>
                                <div>
                                    <p className="text-white font-medium">VOD Manager</p>
                                    <p className="text-gray-400 text-sm">Import movies from Archive.org</p>
                                </div>
                            </Link>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="bg-slate-800 rounded-lg p-6">
                            <h2 className="text-xl font-semibold text-white mb-4">Recent Users</h2>
                            <div className="space-y-3">
                                {recentUsers.map((user) => (
                                    <div key={user.id} className="flex justify-between items-center text-gray-300">
                                        <span>{user.email}</span>
                                        <span className="text-sm text-gray-500">
                                            {new Date(user.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                ))}
                                {recentUsers.length === 0 && (
                                    <p className="text-gray-500">No recent users</p>
                                )}
                            </div>
                        </div>

                        <div className="bg-slate-800 rounded-lg p-6">
                            <h2 className="text-xl font-semibold text-white mb-4">Recent Subscriptions</h2>
                            <div className="space-y-3">
                                {recentSubscriptions.map((sub) => (
                                    <div key={sub.id} className="flex justify-between items-center text-gray-300">
                                        <span>{sub.user?.email}</span>
                                        <span className="text-sm text-primary-400">{sub.plan?.name}</span>
                                    </div>
                                ))}
                                {recentSubscriptions.length === 0 && (
                                    <p className="text-gray-500">No recent subscriptions</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'users' && (
                <div className="bg-slate-800 rounded-lg overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Email</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Username</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Role</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Plan</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {users.map((u) => (
                                <tr key={u.id}>
                                    <td className="px-6 py-4 text-gray-300">{u.email}</td>
                                    <td className="px-6 py-4 text-gray-300">{u.username}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 text-xs rounded ${u.role === 'ADMIN' ? 'bg-purple-600' : 'bg-slate-600'
                                            } text-white`}>
                                            {u.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-300">
                                        <div>
                                            {u.role === 'USER'
                                                ? (u.subscriptions?.[0]?.plan?.name || 'No Plan')
                                                : 'Admin Access'}
                                        </div>
                                        {u.role === 'USER' && (
                                            <div className="text-xs text-gray-500">
                                                {u.subscriptions?.[0]?.endDate
                                                    ? `Expires ${new Date(u.subscriptions[0].endDate).toLocaleDateString()}`
                                                    : 'No expiry'}
                                            </div>
                                        )}
                                        {u.role === 'USER' && (
                                            <div className="mt-2 flex items-center gap-2">
                                                <select
                                                    value={planSelections[u.id] ?? u.subscriptions?.[0]?.plan?.id ?? ''}
                                                    onChange={(e) => setPlanSelections((prev) => ({
                                                        ...prev,
                                                        [u.id]: e.target.value
                                                    }))}
                                                    className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white"
                                                >
                                                    <option value="">Select plan</option>
                                                    {plans.map((plan) => (
                                                        <option key={plan.id} value={plan.id}>
                                                            {plan.name}
                                                        </option>
                                                    ))}
                                                </select>
                                                <button
                                                    onClick={() => changeUserPlan(u)}
                                                    className="text-xs text-primary-400 hover:text-primary-300"
                                                >
                                                    Set
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 text-xs rounded ${u.isActive ? 'bg-green-600' : 'bg-red-600'
                                            } text-white`}>
                                            {u.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-4">
                                            <button
                                                onClick={() => toggleUserStatus(u.id, u.isActive)}
                                                className="text-sm text-primary-400 hover:text-primary-300"
                                            >
                                                {u.isActive ? 'Deactivate' : 'Activate'}
                                            </button>
                                            <button
                                                onClick={() => deleteUser(u.id, u.email)}
                                                className="text-sm text-red-400 hover:text-red-300"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'videos' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <button className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg">
                            Add Video
                        </button>
                    </div>
                    <div className="bg-slate-800 rounded-lg overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-slate-700">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Title</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Category</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Views</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {videos.map((video) => (
                                    <tr key={video.id}>
                                        <td className="px-6 py-4 text-gray-300">{video.title}</td>
                                        <td className="px-6 py-4 text-gray-300">{video.category || '-'}</td>
                                        <td className="px-6 py-4 text-gray-300">{video.views}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 text-xs rounded ${video.isActive ? 'bg-green-600' : 'bg-red-600'
                                                } text-white`}>
                                                {video.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => deleteVideo(video.id)}
                                                className="text-sm text-red-400 hover:text-red-300"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'channels' && (
                <div className="space-y-6">
                    <div className="bg-slate-800 rounded-lg p-6">
                        <h2 className="text-xl font-semibold text-white mb-1">Channel Health</h2>
                        <p className="text-gray-400 mb-4 text-sm">Probe streams and remove dead ones. A dry run reports without changing anything; disabling flips dead channels to inactive (reversible). Delete removes inactive channels for good.</p>
                        <div className="grid sm:grid-cols-3 gap-4 mb-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Limit</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="5000"
                                    value={validation.limit}
                                    onChange={(e) => setValidation((v) => ({ ...v, limit: e.target.value }))}
                                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Country (optional)</label>
                                <input
                                    type="text"
                                    value={validation.country}
                                    onChange={(e) => setValidation((v) => ({ ...v, country: e.target.value }))}
                                    placeholder="e.g. XK, AL, DE"
                                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-primary-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Category (optional)</label>
                                <input
                                    type="text"
                                    value={validation.category}
                                    onChange={(e) => setValidation((v) => ({ ...v, category: e.target.value }))}
                                    placeholder="e.g. Sports"
                                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-primary-500"
                                />
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <button
                                type="button"
                                onClick={() => runValidation(true)}
                                disabled={validating}
                                className="rounded-lg bg-slate-600 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-500 disabled:opacity-50"
                            >
                                {validating ? 'Checking...' : 'Dry run (report only)'}
                            </button>
                            <button
                                type="button"
                                onClick={() => runValidation(false)}
                                disabled={validating}
                                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
                            >
                                Validate & deactivate dead
                            </button>
                            <button
                                type="button"
                                onClick={deleteInactiveChannels}
                                disabled={validating}
                                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                            >
                                Delete inactive channels
                            </button>
                        </div>
                        {validationResult && (
                            <div className="mt-4 rounded-lg bg-slate-900/70 p-4 text-sm">
                                <p className="text-white">
                                    Checked <span className="font-semibold">{validationResult.results?.total}</span> ·
                                    <span className="text-green-400"> {validationResult.results?.valid} alive</span> ·
                                    <span className="text-red-400"> {validationResult.results?.invalid} dead</span>
                                    {validationResult.dryRun && <span className="text-gray-400"> (dry run — no changes)</span>}
                                </p>
                                {validationResult.deadChannels?.length > 0 && (
                                    <ul className="mt-2 max-h-40 overflow-y-auto text-gray-400">
                                        {validationResult.deadChannels.map((c) => (
                                            <li key={c.id} className="truncate">✗ [{c.country || '??'}] {c.name} — {c.category || 'No category'}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                    {channels.map((channel) => (
                        <div key={channel.id} className="bg-slate-800 rounded-lg overflow-hidden">
                            {channel.logo ? (
                                <img src={channel.logo} alt={channel.name} className="w-full h-32 object-cover" />
                            ) : (
                                <div className="w-full h-32 bg-slate-700 flex items-center justify-center">
                                    <span className="text-4xl">📺</span>
                                </div>
                            )}
                            <div className="p-4">
                                <h3 className="text-white font-semibold truncate">{channel.name}</h3>
                                <p className="text-sm text-gray-400">{channel.category || 'No category'}</p>
                            </div>
                        </div>
                    ))}
                    </div>
                </div>
            )}

            {activeTab === 'devices' && (
                <div className="space-y-6">
                    {/* Quick Activation Form */}
                    <div className="bg-slate-800 rounded-lg p-6">
                        <h2 className="text-xl font-semibold text-white mb-4">Smart IPTV Device Activation</h2>
                        <p className="text-gray-400 mb-4">Enter the client's TV MAC address to activate their device and get playlist URLs.</p>

                        <form onSubmit={activateDevice} className="space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">MAC Address *</label>
                                    <input
                                        type="text"
                                        value={macAddress}
                                        onChange={(e) => setMacAddress(e.target.value)}
                                        placeholder="aa:bb:cc:dd:ee:ff"
                                        className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-primary-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Device Name (optional)</label>
                                    <input
                                        type="text"
                                        value={deviceName}
                                        onChange={(e) => setDeviceName(e.target.value)}
                                        placeholder="Client's TV"
                                        className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-primary-500"
                                    />
                                </div>
                            </div>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Access Plan *</label>
                                    <select
                                        value={selectedPlan}
                                        onChange={(e) => setSelectedPlan(e.target.value)}
                                        className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary-500"
                                    >
                                        <option value="admin">Admin Access (Full - No Expiry)</option>
                                        {plans.map((plan) => (
                                            <option key={plan.id} value={plan.id}>
                                                {plan.name} - ${plan.price}/month ({plan.channelAccess?.length || 0} channels)
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {selectedPlan !== 'admin' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">Subscription Duration (days)</label>
                                        <input
                                            type="number"
                                            value={subscriptionDays}
                                            onChange={(e) => setSubscriptionDays(parseInt(e.target.value) || 30)}
                                            min="1"
                                            max="365"
                                            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary-500"
                                        />
                                    </div>
                                )}
                            </div>
                            {selectedPlan === 'admin' && (
                                <p className="text-sm text-yellow-400">Admin access gives full access to all channels with no expiration.</p>
                            )}
                            {selectedPlan !== 'admin' && (
                                <p className="text-sm text-blue-400">A user account will be auto-created for this device with the selected subscription plan.</p>
                            )}
                            <button
                                type="submit"
                                disabled={activating}
                                className="bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 text-white px-6 py-2 rounded-lg font-medium"
                            >
                                {activating ? 'Activating...' : 'Activate Device'}
                            </button>
                        </form>

                        {/* Activation Result */}
                        {activationResult && (
                            <div className="mt-6 p-4 bg-slate-700 rounded-lg">
                                <h3 className="text-lg font-semibold text-green-400 mb-3">Device Activated!</h3>
                                <div className="space-y-3">
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-sm text-gray-400">MAC Address:</p>
                                            <p className="text-white font-mono">{activationResult.device.macAddress}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-400">Access Type:</p>
                                            <p className="text-white">{activationResult.accessType}</p>
                                        </div>
                                    </div>
                                    {activationResult.subscription && (
                                        <div className="p-3 bg-slate-600 rounded">
                                            <p className="text-sm text-gray-400">Subscription Details:</p>
                                            <p className="text-white">Plan: {activationResult.subscription.planName}</p>
                                            <p className="text-white">Expires: {new Date(activationResult.subscription.endDate).toLocaleDateString()}</p>
                                        </div>
                                    )}
                                    {activationResult.user?.isNew && (
                                        <div className="p-3 bg-blue-900/50 rounded">
                                            <p className="text-sm text-blue-300">New user account created:</p>
                                            <p className="text-white font-mono">{activationResult.user.email}</p>
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-sm text-gray-400">Playlist URL (for Smart IPTV):</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <input
                                                type="text"
                                                readOnly
                                                value={activationResult.urls.siptv || activationResult.urls.playlist}
                                                className="flex-1 px-3 py-2 bg-slate-600 rounded text-white font-mono text-sm"
                                            />
                                            <button
                                                onClick={() => copyToClipboard(activationResult.urls.siptv || activationResult.urls.playlist)}
                                                className="px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded"
                                            >
                                                Copy
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-400">EPG URL:</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <input
                                                type="text"
                                                readOnly
                                                value={activationResult.urls.siptvEpg || activationResult.urls.epg}
                                                className="flex-1 px-3 py-2 bg-slate-600 rounded text-white font-mono text-sm"
                                            />
                                            <button
                                                onClick={() => copyToClipboard(activationResult.urls.siptvEpg || activationResult.urls.epg)}
                                                className="px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded"
                                            >
                                                Copy
                                            </button>
                                        </div>
                                    </div>
                                    <div className="pt-3 border-t border-slate-600">
                                        {activationResult.smartIptv?.autoPush?.success ? (
                                            <div className="flex items-center gap-2 p-3 bg-green-900/50 border border-green-600 rounded-lg">
                                                <span className="text-green-400 text-lg">&#10003;</span>
                                                <div>
                                                    <p className="text-sm text-green-400 font-medium">Playlist automatically pushed to Smart IPTV!</p>
                                                    <p className="text-xs text-gray-300 mt-1">Tell the client to restart the Smart IPTV app on their TV.</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <p className="text-sm text-gray-300 mb-3">Upload the playlist to Smart IPTV:</p>
                                                <div className="flex flex-wrap gap-2">
                                                    <button
                                                        onClick={() => {
                                                            const mac = activationResult.device.macAddress
                                                            const url = activationResult.urls.siptv || activationResult.urls.playlist
                                                            navigator.clipboard.writeText(url)
                                                            toast.success(`Playlist URL copied! MAC: ${mac}`)
                                                            window.open('https://siptv.app/mylist/', '_blank')
                                                        }}
                                                        className="inline-block px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium"
                                                    >
                                                        Copy URL &amp; Open siptv.app
                                                    </button>
                                                </div>
                                                <p className="text-xs text-gray-500 mt-2">Opens siptv.app/mylist and copies the playlist URL. Enter MAC <span className="font-mono text-gray-400">{activationResult.device.macAddress}</span>, paste URL, click Send.</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Registered Devices List */}
                    <div className="bg-slate-800 rounded-lg overflow-hidden">
                        <div className="p-4 border-b border-slate-700">
                            <h2 className="text-xl font-semibold text-white">Registered Devices</h2>
                        </div>
                        <table className="w-full">
                            <thead className="bg-slate-700">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">MAC Address</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">User</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Created</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {devices.map((device) => (
                                    <tr key={device.id}>
                                        <td className="px-6 py-4 text-gray-300 font-mono">{device.macAddress}</td>
                                        <td className="px-6 py-4 text-gray-300">{device.name || '-'}</td>
                                        <td className="px-6 py-4 text-gray-300">{device.user?.email || '-'}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 text-xs rounded ${device.status === 'ACTIVE' ? 'bg-green-600' :
                                                device.status === 'PENDING' ? 'bg-yellow-600' : 'bg-red-600'
                                                } text-white`}>
                                                {device.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-300 text-sm">
                                            {new Date(device.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => deleteDevice(device.id, device.macAddress)}
                                                className="text-sm text-red-400 hover:text-red-300"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {devices.length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-8 text-center text-gray-400">
                                            No devices registered yet
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}

const StatCard = ({ title, value, icon }) => (
    <div className="bg-slate-800 rounded-lg p-6">
        <div className="flex items-center justify-between">
            <div>
                <p className="text-gray-400 text-sm">{title}</p>
                <p className="text-3xl font-bold text-white mt-1">{value}</p>
            </div>
            <span className="text-3xl">{icon}</span>
        </div>
    </div>
)

export default AdminDashboard
