import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { channelsAPI } from '../services/api'
import toast from 'react-hot-toast'

const DEFAULT_CATEGORIES = [
  'News',
  'Sports',
  'Movies',
  'Entertainment',
  'Kids',
  'Music',
  'Documentary',
  'Lifestyle',
  'Business',
  'International'
]

const DEFAULT_LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'Arabic',
  'Hindi',
  'Portuguese',
  'German',
  'Italian',
  'Turkish',
  'Japanese'
]

const DEFAULT_COUNTRIES = [
  'United States',
  'United Kingdom',
  'Canada',
  'France',
  'Germany',
  'Spain',
  'Italy',
  'United Arab Emirates',
  'India',
  'Brazil',
  'Turkey',
  'Japan',
  'South Korea',
  'Australia',
  'South Africa'
]

const PAGE_SIZE = 200
const PRIORITY_COUNTRIES = ['XK', 'AL']

const mergeUniqueChannels = (primary, secondary) => {
  const seen = new Set()
  const result = []

  primary.forEach((channel) => {
    if (!channel?.id || seen.has(channel.id)) return
    seen.add(channel.id)
    result.push(channel)
  })

  secondary.forEach((channel) => {
    if (!channel?.id || seen.has(channel.id)) return
    seen.add(channel.id)
    result.push(channel)
  })

  return result
}

const readFavoriteIds = () => {
  try {
    return JSON.parse(localStorage.getItem('iptv_favorite_channel_ids') || '[]')
  } catch (error) {
    return []
  }
}

const readRecentChannels = () => {
  try {
    return JSON.parse(localStorage.getItem('iptv_recent_channels') || '[]')
  } catch (error) {
    return []
  }
}

const Channels = () => {
  const location = useLocation()
  const [channels, setChannels] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [favoriteIds, setFavoriteIds] = useState([])
  const [recentChannels, setRecentChannels] = useState([])
  const [priorityChannels, setPriorityChannels] = useState([])
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [actionChannelId, setActionChannelId] = useState(null)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const longPressTimer = useRef(null)
  const requestController = useRef(null)
  const [filters, setFilters] = useState(() => ({
    category: location.state?.presetFilters?.category || '',
    language: location.state?.presetFilters?.language || '',
    country: location.state?.presetFilters?.country || '',
    search: location.state?.presetFilters?.search || '',
    sort: 'name-asc',
    tab: location.state?.presetFilters?.tab || 'All'
  }))

  useEffect(() => {
    setFavoriteIds(readFavoriteIds())
    setRecentChannels(readRecentChannels())
  }, [])

  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const loadChannels = async ({ nextPage = 1, append = false } = {}) => {
    try {
      if (requestController.current) {
        requestController.current.abort()
      }

      const controller = new AbortController()
      requestController.current = controller

      if (filters.tab === 'Favorites' && favoriteIds.length === 0) {
        setChannels([])
        setPriorityChannels([])
        setTotalCount(0)
        setHasMore(false)
        setLoading(false)
        setLoadingMore(false)
        setError('')
        return
      }

      if (append) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }
      setError('')
      const shouldPinPriority = filters.tab === 'All' &&
        !filters.category &&
        !filters.language &&
        !filters.country &&
        !filters.search

      const tabCategory = filters.tab !== 'All' && filters.tab !== 'Favorites' ? filters.tab : ''
      const resolvedCategory = tabCategory || filters.category

      const params = {
        page: nextPage,
        limit: PAGE_SIZE,
        sort: filters.sort
      }

      if (resolvedCategory) params.category = resolvedCategory
      if (filters.language) params.language = filters.language
      if (filters.country) params.country = filters.country
      if (filters.search) params.search = filters.search
      if (filters.tab === 'Favorites') params.ids = favoriteIds.join(',')

      const requests = [channelsAPI.getAll(params, controller.signal)]
      if (shouldPinPriority && nextPage === 1) {
        PRIORITY_COUNTRIES.forEach((code) => {
          requests.push(
            channelsAPI.getAll(
              { ...params, page: 1, limit: PAGE_SIZE, country: code },
              controller.signal
            )
          )
        })
      }

      const responses = await Promise.all(requests)
      const baseResponse = responses[0]
      const baseChannels = baseResponse.data.data?.channels || []
      const pagination = baseResponse.data.pagination || {}
      const total = typeof pagination.total === 'number' ? pagination.total : baseChannels.length
      const hasMoreResults = Boolean(pagination.hasMore)

      let pinnedChannels = priorityChannels
      if (shouldPinPriority && nextPage === 1) {
        pinnedChannels = responses
          .slice(1)
          .flatMap((response) => response.data.data?.channels || [])
        setPriorityChannels(pinnedChannels)
      } else if (!shouldPinPriority && nextPage === 1) {
        pinnedChannels = []
        setPriorityChannels([])
      }

      if (append) {
        setChannels((prev) => mergeUniqueChannels(pinnedChannels, [...prev, ...baseChannels]))
      } else {
        setChannels(mergeUniqueChannels(pinnedChannels, baseChannels))
      }
      setPage(nextPage)
      setTotalCount(total)
      setHasMore(hasMoreResults)
    } catch (error) {
      if (error.name !== 'CanceledError') {
        setError('Unable to load channels right now.')
        toast.error('Failed to load channels')
      }
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const dedupedChannels = useMemo(() => {
    const seen = new Set()
    return channels.filter((channel) => {
      const key = `${(channel.name || '').toLowerCase()}|${channel.streamUrl || ''}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [channels])

  const availableCategories = useMemo(() => {
    const categories = new Set(DEFAULT_CATEGORIES)
    const maxSample = Math.min(dedupedChannels.length, 1000)
    for (let i = 0; i < maxSample; i++) {
      const channel = dedupedChannels[i]
      if (channel?.category) {
        categories.add(channel.category)
      }
    }
    return Array.from(categories).sort((a, b) => a.localeCompare(b))
  }, [dedupedChannels])

  const availableLanguages = useMemo(() => {
    const languages = new Set(DEFAULT_LANGUAGES)
    const maxSample = Math.min(dedupedChannels.length, 1000)
    for (let i = 0; i < maxSample; i++) {
      const channel = dedupedChannels[i]
      if (channel?.language) {
        languages.add(channel.language)
      }
    }
    return Array.from(languages).sort((a, b) => a.localeCompare(b))
  }, [dedupedChannels])

  const availableCountries = useMemo(() => {
    const countries = new Set(DEFAULT_COUNTRIES)
    const maxSample = Math.min(dedupedChannels.length, 1000)
    for (let i = 0; i < maxSample; i++) {
      const channel = dedupedChannels[i]
      if (channel?.country) {
        countries.add(channel.country)
      }
    }
    return Array.from(countries).sort((a, b) => a.localeCompare(b))
  }, [dedupedChannels])

  const visibleChannels = useMemo(() => dedupedChannels, [dedupedChannels])

  const hasFilters = Boolean(
    filters.search || filters.category || filters.language || filters.country || filters.sort !== 'name-asc' || filters.tab !== 'All'
  )

  const favoritesKey = filters.tab === 'Favorites' ? favoriteIds.join(',') : ''

  useEffect(() => {
    const delay = filters.search ? 350 : 0
    const timer = setTimeout(() => {
      loadChannels({ nextPage: 1, append: false })
    }, delay)
    return () => clearTimeout(timer)
  }, [filters.category, filters.language, filters.country, filters.search, filters.sort, filters.tab, favoritesKey])

  const resetFilters = () => {
    setFilters({
      category: '',
      language: '',
      country: '',
      search: '',
      sort: 'name-asc',
      tab: 'All'
    })
  }

  const tabs = ['All', 'News', 'Movies', 'Sports', 'Kids', 'Favorites']

  const resolutionLabel = (channel) => channel.resolution || channel.quality || ''

  const languageBadge = (channel) => {
    const normalized = (channel.language || '').toLowerCase()
    if (!normalized) return null
    const map = {
      english: '🇬🇧 EN',
      spanish: '🇪🇸 ES',
      french: '🇫🇷 FR',
      arabic: '🇦🇪 AR',
      hindi: '🇮🇳 HI',
      portuguese: '🇵🇹 PT',
      german: '🇩🇪 DE',
      italian: '🇮🇹 IT',
      turkish: '🇹🇷 TR',
      japanese: '🇯🇵 JA'
    }
    return map[normalized] || `${channel.language}`
  }

  const toggleFavorite = (channelId) => {
    setFavoriteIds((prev) => {
      const next = prev.includes(channelId) ? prev.filter((id) => id !== channelId) : [...prev, channelId]
      localStorage.setItem('iptv_favorite_channel_ids', JSON.stringify(next))
      return next
    })
  }

  const handleLongPressStart = (event, channelId) => {
    if (event.button === 2) return
    longPressTimer.current = setTimeout(() => {
      setActionChannelId(channelId)
    }, 500)
  }

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const handleContextMenu = (event, channelId) => {
    event.preventDefault()
    setActionChannelId(channelId)
  }

  const handleInfoAction = (event, channel) => {
    event.preventDefault()
    event.stopPropagation()
    toast(
      `${channel.name} • ${channel.category || 'Category unknown'} • ${channel.language || 'Language unknown'}`,
      { duration: 3000 }
    )
    setActionChannelId(null)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Channels</h1>
          <p className="text-sm text-slate-400 mt-1">
            Showing {visibleChannels.length} of {totalCount || dedupedChannels.length} channels
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
            onClick={() => loadChannels({ nextPage: 1, append: false })}
            className="text-sm text-white bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg"
          >
            Refresh
          </button>
        </div>
      </div>

      {isOffline && (
        <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          You are offline. Some channels may be unavailable.
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setFilters((prev) => ({ ...prev, tab }))}
            className={`text-sm px-4 py-2 rounded-full border min-h-[44px] ${filters.tab === tab
              ? 'bg-primary-500/20 border-primary-400 text-primary-200'
              : 'border-slate-700 text-slate-300 hover:text-white'
              }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="bg-slate-800/70 border border-slate-700 rounded-xl p-4 mb-8 space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm text-slate-300 flex flex-col gap-2">
            Search
            <input
              type="text"
              placeholder="Search channels, categories, or regions..."
              className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </label>
          <label className="text-sm text-slate-300 flex flex-col gap-2">
            Category
            <select
              className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            >
              <option value="">All categories</option>
              {availableCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-300 flex flex-col gap-2">
            Language
            <select
              className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={filters.language}
              onChange={(e) => setFilters({ ...filters, language: e.target.value })}
            >
              <option value="">All languages</option>
              {availableLanguages.map((language) => (
                <option key={language} value={language}>
                  {language}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-300 flex flex-col gap-2">
            Country
            <select
              className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={filters.country}
              onChange={(e) => setFilters({ ...filters, country: e.target.value })}
            >
              <option value="">All countries</option>
              {availableCountries.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">
              Popular countries
            </p>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_COUNTRIES.slice(0, 8).map((country) => (
                <button
                  key={country}
                  onClick={() => setFilters({ ...filters, country })}
                  className={`text-xs px-3 py-1 rounded-full border ${filters.country === country
                    ? 'bg-primary-500/20 border-primary-400 text-primary-200'
                    : 'border-slate-600 text-slate-300 hover:text-white'
                    }`}
                >
                  {country}
                </button>
              ))}
            </div>
          </div>
          <label className="text-sm text-slate-300 flex items-center gap-2">
            Sort
            <select
              className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={filters.sort}
              onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
            </select>
          </label>
        </div>
      </div>

      {recentChannels.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white">Recently Watched</h2>
            <button
              onClick={() => {
                localStorage.removeItem('iptv_recent_channels')
                setRecentChannels([])
              }}
              className="text-xs text-slate-400 hover:text-white"
            >
              Clear
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {recentChannels.map((channel) => (
              <Link
                key={channel.id}
                to={`/channels/${channel.id}`}
                className="bg-slate-800 rounded-lg overflow-hidden hover:bg-slate-700 transition-colors"
              >
                {channel.logo ? (
                  <img
                    src={channel.logo}
                    alt={channel.name}
                    className="w-full h-24 object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-24 bg-slate-700 flex items-center justify-center">
                    <span className="text-3xl">📺</span>
                  </div>
                )}
                <div className="p-3">
                  <h3 className="text-white text-sm font-semibold truncate">{channel.name}</h3>
                  {channel.category && (
                    <p className="text-xs text-gray-400 mt-1">{channel.category}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {loading &&
          Array.from({ length: 10 }).map((_, index) => (
            <div key={`skeleton-${index}`} className="bg-slate-800 rounded-lg overflow-hidden animate-pulse">
              <div className="w-full h-36 bg-slate-700" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-slate-700 rounded" />
                <div className="h-3 bg-slate-700 rounded w-3/4" />
              </div>
            </div>
          ))}
        {!loading &&
          visibleChannels.map((channel) => {
            const description =
              channel.description && channel.description.toLowerCase() !== 'undefined'
                ? channel.description
                : ''
            const resolution = resolutionLabel(channel)
            const language = languageBadge(channel)
            const isFavorite = favoriteIds.includes(channel.id)
            return (
              <Link
                key={channel.id}
                to={`/channels/${channel.id}`}
                onPointerDown={(event) => handleLongPressStart(event, channel.id)}
                onPointerUp={handleLongPressEnd}
                onPointerLeave={handleLongPressEnd}
                onContextMenu={(event) => handleContextMenu(event, channel.id)}
                className="bg-slate-800 rounded-lg overflow-hidden hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 relative"
              >
                <div className="relative">
                  {channel.logo ? (
                    <img
                      src={channel.logo}
                      alt={channel.name}
                      className="w-full h-36 object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-36 bg-slate-700 flex items-center justify-center">
                      <span className="text-5xl">📺</span>
                    </div>
                  )}
                  <div className="absolute top-2 left-2 flex gap-2">
                    <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-black/60 text-white">
                      {channel.isLive === false ? 'VOD' : 'Live'}
                    </span>
                    {resolution && (
                      <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-primary-500/80 text-white">
                        {resolution}
                      </span>
                    )}
                  </div>
                  {isFavorite && (
                    <span className="absolute top-2 right-2 text-lg" aria-label="Favorite">
                      ⭐
                    </span>
                  )}
                </div>
                {actionChannelId === channel.id && (
                  <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center gap-3 text-sm text-white">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        toggleFavorite(channel.id)
                        setActionChannelId(null)
                      }}
                      className="px-4 py-2 rounded-full bg-primary-500/80 hover:bg-primary-500 min-h-[44px]"
                    >
                      {isFavorite ? 'Remove Favorite' : 'Add to Favorites'}
                    </button>
                    <button
                      type="button"
                      onClick={(event) => handleInfoAction(event, channel)}
                      className="px-4 py-2 rounded-full border border-slate-400 hover:border-white min-h-[44px]"
                    >
                      Channel Info
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        setActionChannelId(null)
                      }}
                      className="text-xs text-slate-300"
                    >
                      Close
                    </button>
                  </div>
                )}
                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="text-white font-semibold text-base truncate">{channel.name}</h3>
                    {description ? (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{description}</p>
                    ) : (
                      <p className="text-xs text-slate-500 mt-1">No description available</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] text-slate-300">
                    {channel.category && (
                      <span className="flex items-center gap-1 rounded-full bg-slate-700/60 px-2 py-1">
                        📰 {channel.category}
                      </span>
                    )}
                    {language && (
                      <span className="flex items-center gap-1 rounded-full bg-slate-700/60 px-2 py-1">
                        {language}
                      </span>
                    )}
                    {channel.country && (
                      <span className="flex items-center gap-1 rounded-full bg-slate-700/60 px-2 py-1">
                        🌍 {channel.country}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
      </div>

      {!loading && visibleChannels.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400">
            {hasFilters ? 'No channels match your filters yet.' : 'No channels found.'}
          </p>
          {hasFilters && (
            <button
              onClick={resetFilters}
              className="mt-4 text-sm text-white bg-primary-600 hover:bg-primary-700 px-4 py-2 rounded-lg"
            >
              Reset filters
            </button>
          )}
        </div>
      )}

      {!loading && hasMore && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => loadChannels({ nextPage: page + 1, append: true })}
            disabled={loadingMore}
            className="text-sm text-white bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg disabled:opacity-60"
          >
            {loadingMore ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  )
}

export default Channels
