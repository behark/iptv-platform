import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { videosAPI } from '../services/api'
import toast from 'react-hot-toast'

const Videos = () => {
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, pages: 1 })
  const LIMIT = 50

  useEffect(() => {
    loadVideos()
  }, [page])

  const loadVideos = async () => {
    try {
      setLoading(true)
      const response = await videosAPI.getAll({ limit: LIMIT, page })
      setVideos(response.data.data?.videos || [])
      setPagination(response.data.pagination || { total: 0, pages: 1 })
    } catch (error) {
      toast.error('Failed to load videos')
    } finally {
      setLoading(false)
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
      <h1 className="text-3xl font-bold text-white mb-6">Videos</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {videos.map((video) => (
          <Link
            key={video.id}
            to={`/videos/${video.id}`}
            className="bg-slate-800 rounded-lg overflow-hidden hover:bg-slate-700 transition-colors"
          >
            {video.thumbnail ? (
              <img
                src={video.thumbnail}
                alt={video.title}
                className="w-full h-48 object-cover"
              />
            ) : (
              <div className="w-full h-48 bg-slate-700 flex items-center justify-center">
                <span className="text-4xl">🎬</span>
              </div>
            )}
            <div className="p-4">
              <h3 className="text-white font-semibold line-clamp-2">{video.title}</h3>
              {video.views && (
                <p className="text-sm text-gray-400 mt-1">{video.views} views</p>
              )}
            </div>
          </Link>
        ))}
      </div>

      {videos.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400">No videos found</p>
        </div>
      )}

      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-8">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-600"
          >
            Previous
          </button>
          <span className="text-white">
            Page {page} of {pagination.pages} ({pagination.total} videos)
          </span>
          <button
            onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
            disabled={page === pagination.pages}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-600"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

export default Videos
