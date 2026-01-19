import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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

    useEffect(() => {
        if (activeTab === 'users') loadUsers()
        if (activeTab === 'videos') loadVideos()
        if (activeTab === 'channels') loadChannels()
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

            <div className="flex gap-4 mb-8 border-b border-slate-700">
                {['overview', 'users', 'videos', 'channels'].map((tab) => (
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
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 text-xs rounded ${u.isActive ? 'bg-green-600' : 'bg-red-600'
                                            } text-white`}>
                                            {u.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => toggleUserStatus(u.id, u.isActive)}
                                            className="text-sm text-primary-400 hover:text-primary-300"
                                        >
                                            {u.isActive ? 'Deactivate' : 'Activate'}
                                        </button>
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
