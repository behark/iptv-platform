import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import api from '../services/api'
import toast from 'react-hot-toast'

const History = () => {
    const [history, setHistory] = useState([])
    const [loading, setLoading] = useState(true)
    const [pagination, setPagination] = useState({ page: 1, pages: 1 })

    useEffect(() => {
        loadHistory()
    }, [pagination.page])

    const loadHistory = async () => {
        try {
            setLoading(true)
            const response = await api.get('/history', {
                params: { page: pagination.page, limit: 20 }
            })
            setHistory(response.data.data?.history || [])
            if (response.data.pagination) {
                setPagination(prev => ({
                    ...prev,
                    pages: response.data.pagination.pages
                }))
            }
        } catch (error) {
            toast.error('Failed to load watch history')
        } finally {
            setLoading(false)
        }
    }

    const clearHistory = async () => {
        if (!window.confirm('Are you sure you want to clear all watch history?')) {
            return
        }

        try {
            await api.delete('/history')
            setHistory([])
            toast.success('Watch history cleared')
        } catch (error) {
            toast.error('Failed to clear history')
        }
    }

    const removeItem = async (id) => {
        try {
            await api.delete(`/history/${id}`)
            setHistory(history.filter(h => h.id !== id))
            toast.success('Removed from history')
        } catch (error) {
            toast.error('Failed to remove item')
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
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-white">Watch History</h1>
                {history.length > 0 && (
                    <button
                        onClick={clearHistory}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm"
                    >
                        Clear All
                    </button>
                )}
            </div>

            {history.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-gray-400 mb-4">Your watch history is empty</p>
                    <div className="flex justify-center gap-4">
                        <Link
                            to="/channels"
                            className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-lg"
                        >
                            Browse Channels
                        </Link>
                        <Link
                            to="/videos"
                            className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-lg"
                        >
                            Browse Videos
                        </Link>
                    </div>
                </div>
            ) : (
                <>
                    <div className="space-y-4">
                        {history.map((item) => (
                            <div
                                key={item.id}
                                className="bg-slate-800 rounded-lg p-4 flex items-center gap-4 group"
                            >
                                <Link
                                    to={item.channel ? `/channels/${item.channel.id}` : `/videos/${item.video.id}`}
                                    className="flex items-center gap-4 flex-1"
                                >
                                    {item.channel ? (
                                        <>
                                            {item.channel.logo ? (
                                                <img
                                                    src={item.channel.logo}
                                                    alt={item.channel.name}
                                                    className="w-20 h-14 object-cover rounded"
                                                />
                                            ) : (
                                                <div className="w-20 h-14 bg-slate-700 flex items-center justify-center rounded">
                                                    <span className="text-2xl">📺</span>
                                                </div>
                                            )}
                                            <div>
                                                <h3 className="text-white font-semibold">{item.channel.name}</h3>
                                                <p className="text-sm text-gray-400">
                                                    Watched {format(new Date(item.watchedAt), 'MMM d, yyyy h:mm a')}
                                                </p>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            {item.video.thumbnail ? (
                                                <img
                                                    src={item.video.thumbnail}
                                                    alt={item.video.title}
                                                    className="w-20 h-14 object-cover rounded"
                                                />
                                            ) : (
                                                <div className="w-20 h-14 bg-slate-700 flex items-center justify-center rounded">
                                                    <span className="text-2xl">🎬</span>
                                                </div>
                                            )}
                                            <div>
                                                <h3 className="text-white font-semibold">{item.video.title}</h3>
                                                <p className="text-sm text-gray-400">
                                                    Watched {format(new Date(item.watchedAt), 'MMM d, yyyy h:mm a')}
                                                    {item.completed && ' • Completed'}
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </Link>
                                <button
                                    onClick={() => removeItem(item.id)}
                                    className="text-gray-400 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>

                    {pagination.pages > 1 && (
                        <div className="flex justify-center gap-2 mt-8">
                            <button
                                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                                disabled={pagination.page === 1}
                                className="px-4 py-2 bg-slate-700 text-white rounded-lg disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <span className="px-4 py-2 text-gray-400">
                                Page {pagination.page} of {pagination.pages}
                            </span>
                            <button
                                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                                disabled={pagination.page === pagination.pages}
                                className="px-4 py-2 bg-slate-700 text-white rounded-lg disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

export default History
