import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { videosAPI } from '../services/api'
import toast from 'react-hot-toast'

const LIMIT = 24

const SORT_OPTIONS = [
  { value: 'recently-added', label: 'Recently Added' },
  { value: 'title-asc', label: 'Title (A-Z)' },
  { value: 'title-desc', label: 'Title (Z-A)' },
  { value: 'views-desc', label: 'Most Viewed' },
  { value: 'views-asc', label: 'Least Viewed' },
  { value: 'year-desc', label: 'Newest First' },
  { value: 'year-asc', label: 'Oldest First' }
]

const VIEW_MODES = { grid: 'grid', list: 'list' }

const VideoCard = ({ video, viewMode }) => {
  if (viewMode === VIEW_MODES.list) {
    return (
      <Link
        to={`/videos/${video.id}`}
        className="flex gap-4 bg-slate-800/70 border border-slate-700/50 rounded-xl overflow-hidden hover:border-indigo-500/50 hover:bg-slate-800 transition-all group"
      >
        <div className="w-40 sm:w-52 flex-shrink-0">
          {video.thumbnail ? (
            <img
              src={video.thumbnail}
              alt={video.title}
              className="w-full h-full object-cover min-h-[100px]"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full min-h-[100px] bg-slate-700 flex items-center justify-center">
              <span className="text-3xl">🎬</span>
            </div>
          )}
        </div>
        <div className="flex-1 py-3 pr-4">
          <h3 className="text-white font-semibold group-hover:text-indigo-300 transition-colors line-clamp-1">
            {video.title}
          </h3>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
            {video.year && <span>{video.year}</span>}
            {video.duration && <span>{formatDuration(video.duration)}</span>}
            {video.category && (
              <span className="px-2 py-0.5 rounded-full bg-slate-700/80 text-slate-300">{video.category}</span>
            )}
          </div>
          {video.description && (
            <p className="text-sm text-slate-400 mt-2 line-clamp-2">{video.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
            {video.views > 0 && <span>{video.views} views</span>}
            {video.hasSubtitles && <span className="text-emerald-400">CC</span>}
          </div>
        </div>
      </Link>
    )
  }

  return (
    <Link
      to={`/videos/${video.id}`}
      className="bg-slate-800/70 border border-slate-700/50 rounded-xl overflow-hidden hover:border-indigo-500/50 hover:scale-[1.02] hover:shadow-xl hover:shadow-indigo-500/10 transition-all group"
    >
      <div className="relative aspect-[2/3] overflow-hidden">
        {video.thumbnail ? (
          <img
            src={video.thumbnail}
            alt={video.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
            <span className="text-5xl opacity-40">🎬</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center">
              <svg className="w-4 h-4 text-slate-900 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
            </div>
            <span className="text-white text-sm font-medium">Watch</span>
          </div>
        </div>
        {video.year && (
          <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-0.5 rounded">
            {video.year}
          </div>
        )}
        {video.hasSubtitles && (
          <div className="absolute top-2 left-2 bg-emerald-500/80 backdrop-blur-sm text-white text-xs px-2 py-0.5 rounded font-medium">
            CC
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-white font-semibold text-sm line-clamp-2 group-hover:text-indigo-300 transition-colors">
          {video.title}
        </h3>
        <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400">
          {video.category && <span>{video.category}</span>}
          {video.views > 0 && (
            <>
              <span className="text-slate-600">·</span>
              <span>{video.views} views</span>
            </>
          )}
        </div>
      </div>
    </Link>
  )
}

const formatDuration = (seconds) => {
  if (!seconds) return null
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (hrs > 0) return `${hrs}h ${mins}m`
  return `${mins}m`
}

const Videos = () => {
  const [videos, setVideos] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, pages: 1 })
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState('recently-added')
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('iptv_video_view') || VIEW_MODES.grid)
  const searchTimer = useRef(null)

  const loadVideos = useCallback(async (opts = {}) => {
    const currentPage = opts.page || 1
    try {
      setLoading(true)
      setError('')
      const params = { limit: LIMIT, page: currentPage, sort }
      if (search.trim()) params.search = search.trim()
      if (category) params.category = category
      const response = await videosAPI.getAll(params)
      setVideos(response.data.data?.videos || [])
      setPagination(response.data.pagination || { total: 0, pages: 1 })
      if (response.data.data?.categories) {
        setCategories(response.data.data.categories)
      }
      setPage(currentPage)
    } catch (err) {
      setError('Failed to load movies')
      toast.error('Failed to load movies')
    } finally {
      setLoading(false)
    }
  }, [search, category, sort])

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      loadVideos({ page: 1 })
    }, search ? 400 : 0)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [search, category, sort])

  const handleViewMode = (mode) => {
    setViewMode(mode)
    localStorage.setItem('iptv_video_view', mode)
  }

  const hasFilters = Boolean(search || category || sort !== 'recently-added')

  const resetFilters = () => {
    setSearch('')
    setCategory('')
    setSort('recently-added')
  }

  const gridClass = viewMode === VIEW_MODES.list
    ? 'flex flex-col gap-3'
    : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4'

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Movies</h1>
          <p className="text-sm text-slate-400 mt-1">
            {pagination.total} movies available
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasFilters && (
            <button
              onClick={resetFilters}
              className="text-sm text-slate-300 hover:text-white border border-slate-600 px-3 py-2 rounded-lg"
            >
              Clear filters
            </button>
          )}
          <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 p-1">
            <button
              type="button"
              onClick={() => handleViewMode(VIEW_MODES.grid)}
              className={`px-3 py-1 text-xs rounded-md ${viewMode === VIEW_MODES.grid
                ? 'bg-slate-700 text-white' : 'text-slate-300 hover:text-white'}`}
            >
              Grid
            </button>
            <button
              type="button"
              onClick={() => handleViewMode(VIEW_MODES.list)}
              className={`px-3 py-1 text-xs rounded-md ${viewMode === VIEW_MODES.list
                ? 'bg-slate-700 text-white' : 'text-slate-300 hover:text-white'}`}
            >
              List
            </button>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/70 border border-slate-700 rounded-xl p-4 mb-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm text-slate-300 flex flex-col gap-2">
            Search
            <div className="relative">
              <input
                type="text"
                placeholder="Search movies by title..."
                className="w-full px-4 py-2 pr-16 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>
          </label>
          <label className="text-sm text-slate-300 flex flex-col gap-2">
            Category
            <select
              className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.name} value={cat.name}>
                  {cat.name} ({cat.count})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-300 flex flex-col gap-2">
            Sort By
            <select
              className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {categories.length > 0 && !category && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setCategory('')}
            className="text-xs px-3 py-1.5 rounded-full border bg-indigo-500/20 border-indigo-400 text-indigo-200"
          >
            All
          </button>
          {categories.slice(0, 12).map((cat) => (
            <button
              key={cat.name}
              onClick={() => setCategory(cat.name)}
              className="text-xs px-3 py-1.5 rounded-full border border-slate-600 text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => loadVideos({ page })}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
          >
            Retry
          </button>
        </div>
      ) : videos.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-5xl block mb-4">🎬</span>
          <p className="text-slate-400 text-lg">No movies found</p>
          {hasFilters && (
            <button
              onClick={resetFilters}
              className="mt-4 text-indigo-400 hover:text-indigo-300 text-sm"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div className={gridClass}>
          {videos.map((video) => (
            <VideoCard key={video.id} video={video} viewMode={viewMode} />
          ))}
        </div>
      )}

      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            onClick={() => loadVideos({ page: 1 })}
            disabled={page === 1}
            className="px-3 py-2 bg-slate-700 text-white rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-600 text-sm"
          >
            First
          </button>
          <button
            onClick={() => loadVideos({ page: Math.max(1, page - 1) })}
            disabled={page === 1}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-600 text-sm"
          >
            Previous
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, pagination.pages - 4))
              const p = start + i
              if (p > pagination.pages) return null
              return (
                <button
                  key={p}
                  onClick={() => loadVideos({ page: p })}
                  className={`w-9 h-9 rounded-lg text-sm font-medium ${p === page
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'}`}
                >
                  {p}
                </button>
              )
            })}
          </div>
          <button
            onClick={() => loadVideos({ page: Math.min(pagination.pages, page + 1) })}
            disabled={page === pagination.pages}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-600 text-sm"
          >
            Next
          </button>
          <button
            onClick={() => loadVideos({ page: pagination.pages })}
            disabled={page === pagination.pages}
            className="px-3 py-2 bg-slate-700 text-white rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-600 text-sm"
          >
            Last
          </button>
          <span className="text-slate-400 text-sm ml-2">
            {pagination.total} movies
          </span>
        </div>
      )}
    </div>
  )
}

export default Videos
