import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { channelsAPI } from '../services/api'

const REGION_SHORTCUTS = [
  { code: 'XK', label: 'Kosovo', flag: '🇽🇰' },
  { code: 'AL', label: 'Albania', flag: '🇦🇱' },
  { code: 'MK', label: 'North Macedonia', flag: '🇲🇰' },
  { code: 'ME', label: 'Montenegro', flag: '🇲🇪' },
  { code: 'RS', label: 'Serbia', flag: '🇷🇸' },
  { code: 'BA', label: 'Bosnia', flag: '🇧🇦' },
  { code: 'HR', label: 'Croatia', flag: '🇭🇷' },
  { code: 'SI', label: 'Slovenia', flag: '🇸🇮' }
]

const BALKAN_SPOTLIGHT = [
  { code: 'XK', label: 'Kosovo', flag: '🇽🇰' },
  { code: 'AL', label: 'Albania', flag: '🇦🇱' }
]

const CATEGORY_CARDS = [
  { category: 'News', icon: '📰', color: 'bg-red-50 text-red-600 border-red-100' },
  { category: 'Sports', icon: '⚽', color: 'bg-green-50 text-green-600 border-green-100' },
  { category: 'Movies', icon: '🎬', color: 'bg-purple-50 text-purple-600 border-purple-100' },
  { category: 'Kids', icon: '🧸', color: 'bg-yellow-50 text-yellow-600 border-yellow-100' },
  { category: 'Entertainment', icon: '🎭', color: 'bg-pink-50 text-pink-600 border-pink-100' },
  { category: 'Music', icon: '🎵', color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
  { category: 'Documentary', icon: '🌍', color: 'bg-teal-50 text-teal-600 border-teal-100' },
  { category: 'Religious', icon: '🕊️', color: 'bg-amber-50 text-amber-600 border-amber-100' }
]

const readRecentChannels = () => {
  try {
    return JSON.parse(localStorage.getItem('iptv_recent_channels') || '[]')
  } catch (error) {
    return []
  }
}

const readLastChannel = () => {
  try {
    return JSON.parse(localStorage.getItem('iptv_last_opened_channel') || 'null')
  } catch (error) {
    return null
  }
}

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

const Home = () => {
  const [recentChannels, setRecentChannels] = useState([])
  const [lastChannel, setLastChannel] = useState(null)
  const [featuredChannels, setFeaturedChannels] = useState([])
  const [featuredLoading, setFeaturedLoading] = useState(true)
  const [featuredError, setFeaturedError] = useState('')
  const [needsPlan, setNeedsPlan] = useState(false)
  const featuredRequest = useRef(null)

  useEffect(() => {
    setRecentChannels(readRecentChannels())
    setLastChannel(readLastChannel())
  }, [])

  const loadFeaturedChannels = async () => {
    if (featuredRequest.current) {
      featuredRequest.current.abort()
    }
    const controller = new AbortController()
    featuredRequest.current = controller

    setFeaturedLoading(true)
    setFeaturedError('')
    setNeedsPlan(false)

    try {
      const [kosovo, albania] = await Promise.all([
        channelsAPI.getAll({ country: 'XK', limit: 12, sort: 'name-asc' }, controller.signal),
        channelsAPI.getAll({ country: 'AL', limit: 12, sort: 'name-asc' }, controller.signal)
      ])

      const kosovoChannels = kosovo.data.data?.channels || []
      const albaniaChannels = albania.data.data?.channels || []
      const merged = mergeUniqueChannels(kosovoChannels, albaniaChannels)
      setFeaturedChannels(merged.slice(0, 12))
    } catch (error) {
      if (error.name === 'CanceledError') {
        return
      }
      const status = error.response?.status
      if (status === 403) {
        setNeedsPlan(true)
        setFeaturedError('Activate a plan to unlock featured channels.')
      } else {
        setFeaturedError('Unable to load featured channels right now.')
      }
      setFeaturedChannels([])
    } finally {
      setFeaturedLoading(false)
    }
  }

  useEffect(() => {
    loadFeaturedChannels()
    return () => {
      if (featuredRequest.current) {
        featuredRequest.current.abort()
      }
    }
  }, [])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {/* Hero Section */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_320px] items-start">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 leading-tight">
              Welcome back 👋
            </h1>
            <p className="text-slate-500 mt-2 max-w-lg">
              Stream live TV, catch up on movies, or browse channels from the Balkans and beyond.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/channels"
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
              >
                <span>📺</span> Live TV
              </Link>
              <Link
                to="/videos"
                className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2.5 rounded-lg font-medium transition-colors"
              >
                <span>🎬</span> Movies
              </Link>
            </div>

            {/* Quick Region Picks */}
            <div className="mt-6 pt-6 border-t border-slate-100">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-3">
                Browse by region
              </p>
              <div className="flex flex-wrap gap-2">
                {REGION_SHORTCUTS.map((region) => (
                  <Link
                    key={region.code}
                    to="/channels"
                    state={{ presetFilters: { country: region.code } }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-sm text-slate-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-colors"
                  >
                    <span>{region.flag}</span>
                    {region.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Continue Watching Card */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-3">
              Continue watching
            </p>
            {lastChannel ? (
              <Link
                to={`/channels/${lastChannel.id}`}
                className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 hover:border-indigo-300 hover:shadow-sm transition-all card-hover"
              >
                <div className="h-12 w-16 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center shrink-0">
                  {lastChannel.logo ? (
                    <img
                      src={lastChannel.logo}
                      alt={lastChannel.name}
                      className="h-full w-full object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-lg">📺</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{lastChannel.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {lastChannel.category || 'Live channel'}
                  </p>
                </div>
                <span className="ml-auto text-indigo-500">▶</span>
              </Link>
            ) : (
              <div className="p-4 bg-white rounded-lg border border-dashed border-slate-200 text-sm text-slate-400 text-center">
                Start watching to see your history here
              </div>
            )}

            {/* Balkan Spotlight */}
            <div className="mt-4 pt-4 border-t border-slate-200">
              <p className="text-xs font-medium text-slate-500 mb-2">
                🌟 Balkan spotlight
              </p>
              <div className="flex gap-2">
                {BALKAN_SPOTLIGHT.map((region) => (
                  <Link
                    key={region.code}
                    to="/channels"
                    state={{ presetFilters: { country: region.code } }}
                    className="flex-1 text-center px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-colors"
                  >
                    {region.flag} {region.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Channels */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Recently Watched</h2>
            <p className="text-sm text-slate-500">Pick up where you left off</p>
          </div>
          <Link to="/history" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
            View all →
          </Link>
        </div>
        {recentChannels.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4">
            {recentChannels.map((channel) => (
              <Link
                key={channel.id}
                to={`/channels/${channel.id}`}
                className="group w-44 shrink-0 bg-white rounded-xl border border-slate-200 p-3 hover:shadow-md hover:border-indigo-200 transition-all card-hover"
              >
                <div className="h-24 rounded-lg bg-slate-50 overflow-hidden flex items-center justify-center">
                  {channel.logo ? (
                    <img
                      src={channel.logo}
                      alt={channel.name}
                      className="h-full w-full object-contain p-2"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-2xl">📺</span>
                  )}
                </div>
                <div className="mt-2">
                  <h3 className="text-sm font-medium text-slate-800 truncate">{channel.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">
                    {channel.category || 'Live'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
            <p className="text-slate-400 text-sm">Watch channels to build your history</p>
            <Link to="/channels" className="inline-block mt-3 text-indigo-600 text-sm font-medium hover:text-indigo-700">
              Browse channels →
            </Link>
          </div>
        )}
      </section>

      {/* Featured Balkan Channels */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">🌟 Balkan Channels</h2>
            <p className="text-sm text-slate-500">Featured channels from Kosovo & Albania</p>
          </div>
          <div className="flex gap-2">
            {BALKAN_SPOTLIGHT.map((region) => (
              <Link
                key={region.code}
                to="/channels"
                state={{ presetFilters: { country: region.code } }}
                className="px-3 py-1.5 rounded-full bg-slate-100 text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
              >
                {region.flag} {region.label}
              </Link>
            ))}
          </div>
        </div>

        {featuredLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`featured-skeleton-${index}`}
                className="bg-white rounded-xl border border-slate-200 p-3 animate-pulse"
              >
                <div className="h-20 rounded-lg bg-slate-100" />
                <div className="mt-2 space-y-2">
                  <div className="h-3 bg-slate-100 rounded" />
                  <div className="h-2 bg-slate-100 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!featuredLoading && featuredError && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
            <p className="text-slate-500 text-sm">{featuredError}</p>
            <div className="mt-4 flex justify-center gap-3">
              {needsPlan ? (
                <Link
                  to="/plans"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  View plans
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={loadFeaturedChannels}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        )}

        {!featuredLoading && !featuredError && featuredChannels.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
            <p className="text-slate-400 text-sm">Balkan channels will appear here once available</p>
          </div>
        )}

        {!featuredLoading && !featuredError && featuredChannels.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {featuredChannels.map((channel) => (
              <Link
                key={channel.id}
                to={`/channels/${channel.id}`}
                className="group bg-white rounded-xl border border-slate-200 p-3 hover:shadow-md hover:border-indigo-200 transition-all card-hover"
              >
                <div className="h-20 rounded-lg bg-slate-50 overflow-hidden flex items-center justify-center">
                  {channel.logo ? (
                    <img
                      src={channel.logo}
                      alt={channel.name}
                      className="h-full w-full object-contain p-2"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-2xl">📺</span>
                  )}
                </div>
                <div className="mt-2">
                  <h3 className="text-sm font-medium text-slate-800 truncate">{channel.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">
                    {channel.category || 'Live'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Categories */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Browse by Category</h2>
          <p className="text-sm text-slate-500">Find channels by what you're in the mood for</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {CATEGORY_CARDS.map((cat) => (
            <Link
              key={cat.category}
              to="/channels"
              state={{ presetFilters: { category: cat.category } }}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border ${cat.color} hover:shadow-md transition-all card-hover`}
            >
              <span className="text-2xl">{cat.icon}</span>
              <span className="text-sm font-medium">{cat.category}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Quick Stats */}
      <section className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <p className="text-2xl font-bold text-indigo-600">29K+</p>
            <p className="text-sm text-slate-500 mt-1">Live Channels</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-purple-600">140+</p>
            <p className="text-sm text-slate-500 mt-1">Movies</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">50+</p>
            <p className="text-sm text-slate-500 mt-1">Countries</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-600">24/7</p>
            <p className="text-sm text-slate-500 mt-1">Streaming</p>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Home
