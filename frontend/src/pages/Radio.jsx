import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { channelsAPI } from '../services/api'
import toast from 'react-hot-toast'

const PAGE_SIZE = 60

const RADIO_CATEGORIES = ['Music', 'Religious', 'Entertainment', 'News', 'General']

const RadioCard = ({ channel }) => {
  const isFavorite = false

  return (
    <Link
      to={`/channels/${channel.id}`}
      className="bg-slate-800/70 border border-slate-700/50 rounded-xl overflow-hidden hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10 transition-all group"
    >
      <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-purple-900/40 to-slate-800">
        {channel.logo ? (
          <img
            src={channel.logo}
            alt={channel.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
          />
        ) : null}
        <div
          className={`w-full h-full flex flex-col items-center justify-center ${channel.logo ? 'hidden' : 'flex'}`}
        >
          <span className="text-4xl mb-1">📻</span>
          <span className="text-xs text-slate-400 text-center px-2 line-clamp-1">{channel.name}</span>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-8 h-8 rounded-full bg-purple-500/90 flex items-center justify-center">
              <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
            </div>
            <span className="text-white text-sm font-medium">Listen</span>
          </div>
        </div>
        <div className="absolute top-2 left-2 flex items-center gap-1">
          <span className="bg-purple-500/80 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider">
            Live
          </span>
        </div>
      </div>
      <div className="p-3">
        <h3 className="text-white font-semibold text-sm line-clamp-1 group-hover:text-purple-300 transition-colors">
          {channel.name}
        </h3>
        <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
          {channel.category && <span>{channel.category}</span>}
          {channel.country && (
            <>
              <span className="text-slate-600">·</span>
              <span>{channel.country}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  )
}

const Radio = () => {
  const [channels, setChannels] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [search, setSearch] = useState('')
  const [country, setCountry] = useState('')
  const [sort, setSort] = useState('name-asc')
  const searchTimer = useRef(null)

  const loadChannels = useCallback(async (opts = {}) => {
    const nextPage = opts.page || 1
    const append = opts.append || false
    try {
      if (!append) setLoading(true)
      setError('')
      const params = {
        page: nextPage,
        limit: PAGE_SIZE,
        sort,
        category: 'Music'
      }
      if (search.trim()) params.search = search.trim()
      if (country) params.country = country

      const response = await channelsAPI.getAll(params)
      const data = response.data.data?.channels || []
      const pagination = response.data.pagination || {}

      if (append) {
        setChannels(prev => [...prev, ...data])
      } else {
        setChannels(data)
      }
      setPage(nextPage)
      setTotalCount(pagination.total || data.length)
      setHasMore(Boolean(pagination.hasMore))
    } catch (err) {
      if (err.name !== 'CanceledError') {
        setError('Failed to load radio stations')
        toast.error('Failed to load radio stations')
      }
    } finally {
      setLoading(false)
    }
  }, [search, country, sort])

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      loadChannels({ page: 1 })
    }, search ? 400 : 0)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [search, country, sort])

  const hasFilters = Boolean(search || country || sort !== 'name-asc')

  const resetFilters = () => {
    setSearch('')
    setCountry('')
    setSort('name-asc')
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <span className="text-3xl">📻</span> Radio
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {totalCount} radio stations available
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
          <button
            onClick={() => loadChannels({ page: 1 })}
            className="text-sm text-white bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-slate-800/70 border border-slate-700 rounded-xl p-4 mb-6">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm text-slate-300 flex flex-col gap-2">
            Search
            <div className="relative">
              <input
                type="text"
                placeholder="Search radio stations..."
                className="w-full px-4 py-2 pr-16 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
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
            Country
            <input
              type="text"
              placeholder="Filter by country code (e.g. XK, AL)"
              className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={country}
              onChange={(e) => setCountry(e.target.value.toUpperCase())}
            />
          </label>
          <label className="text-sm text-slate-300 flex flex-col gap-2">
            Sort By
            <select
              className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="country-asc">Country (A-Z)</option>
              <option value="country-desc">Country (Z-A)</option>
              <option value="recently-added">Recently Added</option>
            </select>
          </label>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => loadChannels({ page: 1 })}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
          >
            Retry
          </button>
        </div>
      ) : channels.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-5xl block mb-4">📻</span>
          <p className="text-slate-400 text-lg">No radio stations found</p>
          {hasFilters && (
            <button
              onClick={resetFilters}
              className="mt-4 text-purple-400 hover:text-purple-300 text-sm"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {channels.map((channel) => (
              <RadioCard key={channel.id} channel={channel} />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center mt-8">
              <button
                onClick={() => loadChannels({ page: page + 1, append: true })}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
              >
                Load More
              </button>
            </div>
          )}

          <p className="text-center text-sm text-slate-500 mt-4">
            Showing {channels.length} of {totalCount} stations
          </p>
        </>
      )}
    </div>
  )
}

export default Radio
