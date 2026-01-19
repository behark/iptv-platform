import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { channelsAPI } from '../services/api'

const REGION_SHORTCUTS = [
  { code: 'XK', label: 'Kosovo' },
  { code: 'AL', label: 'Albania' },
  { code: 'MK', label: 'North Macedonia' },
  { code: 'ME', label: 'Montenegro' },
  { code: 'RS', label: 'Serbia' },
  { code: 'BA', label: 'Bosnia and Herzegovina' },
  { code: 'HR', label: 'Croatia' },
  { code: 'SI', label: 'Slovenia' }
]

const BALKAN_SPOTLIGHT = [
  { code: 'XK', label: 'Kosovo' },
  { code: 'AL', label: 'Albania' }
]

const CATEGORY_SPOTLIGHTS = [
  {
    category: 'News',
    title: 'Newsroom',
    description: 'Live headlines and nonstop coverage around the clock.',
    tag: 'Breaking',
    accent: 'from-slate-900 via-slate-900 to-slate-800'
  },
  {
    category: 'Sports',
    title: 'Match Day',
    description: 'Live games, highlights, and studio talk shows.',
    tag: 'Live',
    accent: 'from-slate-900 via-slate-800 to-slate-700'
  },
  {
    category: 'Movies',
    title: 'Cinema Desk',
    description: 'Feature films, classics, and late-night marathons.',
    tag: 'Featured',
    accent: 'from-slate-900 via-slate-900 to-slate-700'
  },
  {
    category: 'Kids',
    title: 'Kids Zone',
    description: 'Family-friendly shows and safe picks for all ages.',
    tag: 'Family',
    accent: 'from-slate-900 via-slate-800 to-primary-900/30'
  },
  {
    category: 'Entertainment',
    title: 'Pop Culture',
    description: 'Reality, lifestyle, and feel-good entertainment.',
    tag: 'New',
    accent: 'from-slate-900 via-slate-800 to-primary-900/20'
  },
  {
    category: 'Music',
    title: 'Live Sessions',
    description: 'Music videos, concerts, and nonstop playlists.',
    tag: '24/7',
    accent: 'from-slate-900 via-slate-900 to-slate-800'
  }
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
      <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900/70 p-8 md:p-12">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-primary-500/20 blur-3xl" />
        <div className="absolute left-10 bottom-0 h-32 w-72 rounded-full bg-slate-800/60 blur-3xl" />
        <div className="relative grid gap-10 lg:grid-cols-[1.2fr_0.8fr] items-center">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-primary-200/80 mb-4">
              Home Base
            </p>
            <h1 className="text-4xl md:text-5xl font-semibold text-white leading-tight">
              Stream live channels tailored to your region and routine.
            </h1>
            <p className="text-lg text-slate-300 mt-4 max-w-xl">
              Jump into the Balkan spotlight, catch up on your latest picks, or browse the full lineup in seconds.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                to="/channels"
                className="bg-primary-600 hover:bg-primary-500 text-white px-6 py-3 rounded-xl font-medium"
              >
                Browse Channels
              </Link>
              <Link
                to="/videos"
                className="border border-slate-600 hover:border-primary-400 text-white px-6 py-3 rounded-xl font-medium"
              >
                Watch Videos
              </Link>
            </div>
            <div className="mt-8">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-3">
                Quick region picks
              </p>
              <div className="flex flex-wrap gap-2">
                {REGION_SHORTCUTS.map((region) => (
                  <Link
                    key={region.code}
                    to="/channels"
                    state={{ presetFilters: { country: region.code } }}
                    className="px-3 py-1.5 rounded-full border border-slate-700 text-sm text-slate-200 hover:border-primary-400 hover:text-white"
                  >
                    {region.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Continue watching</p>
              {lastChannel ? (
                <Link
                  to={`/channels/${lastChannel.id}`}
                  className="mt-4 flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900/60 p-3 hover:border-primary-400 transition"
                >
                  <div className="h-12 w-20 rounded-lg bg-slate-800 overflow-hidden flex items-center justify-center">
                    {lastChannel.logo ? (
                      <img
                        src={lastChannel.logo}
                        alt={lastChannel.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-xs text-slate-400">No logo</span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{lastChannel.name || 'Last opened channel'}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {lastChannel.category || 'Jump back in with one click.'}
                    </p>
                  </div>
                </Link>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-4 text-sm text-slate-400">
                  Start a channel to build your continue watching queue.
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Balkan spotlight</p>
              <p className="text-sm text-slate-300 mt-2">
                Kosovo and Albania channels are now pinned to the top of the lineup.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {BALKAN_SPOTLIGHT.map((region) => (
                  <Link
                    key={region.code}
                    to="/channels"
                    state={{ presetFilters: { country: region.code } }}
                    className="px-3 py-1.5 rounded-full border border-slate-700 text-sm text-slate-200 hover:border-primary-400 hover:text-white"
                  >
                    {region.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">Continue watching</h2>
            <p className="text-sm text-slate-400">Pick up right where you left off.</p>
          </div>
          <Link to="/history" className="text-sm text-slate-300 hover:text-white">
            View history
          </Link>
        </div>
        {recentChannels.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-3">
            {recentChannels.map((channel) => (
              <Link
                key={channel.id}
                to={`/channels/${channel.id}`}
                className="group w-56 shrink-0 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 hover:border-primary-400 transition"
              >
                <div className="h-32 rounded-xl bg-slate-800 overflow-hidden flex items-center justify-center">
                  {channel.logo ? (
                    <img
                      src={channel.logo}
                      alt={channel.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-xs text-slate-400">No logo</span>
                  )}
                </div>
                <div className="mt-3">
                  <h3 className="text-sm font-semibold text-white truncate">{channel.name}</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    {channel.category || 'Live channel'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
            Keep watching channels to build your personal shelf.
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">Balkan spotlight</h2>
            <p className="text-sm text-slate-400">
              Curated channels from Kosovo and Albania, ready to go.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {BALKAN_SPOTLIGHT.map((region) => (
              <Link
                key={region.code}
                to="/channels"
                state={{ presetFilters: { country: region.code } }}
                className="px-3 py-1.5 rounded-full border border-slate-700 text-sm text-slate-200 hover:border-primary-400 hover:text-white"
              >
                {region.label}
              </Link>
            ))}
          </div>
        </div>

        {featuredLoading && (
          <div className="flex gap-4 overflow-x-auto pb-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`featured-skeleton-${index}`}
                className="w-56 shrink-0 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 animate-pulse"
              >
                <div className="h-32 rounded-xl bg-slate-800" />
                <div className="mt-3 space-y-2">
                  <div className="h-4 bg-slate-800 rounded" />
                  <div className="h-3 bg-slate-800 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!featuredLoading && featuredError && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-300">
            <p>{featuredError}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {needsPlan ? (
                <Link
                  to="/plans"
                  className="bg-primary-600 hover:bg-primary-500 text-white px-4 py-2 rounded-lg text-sm"
                >
                  View plans
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={loadFeaturedChannels}
                  className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm"
                >
                  Retry
                </button>
              )}
              <Link
                to="/channels"
                className="border border-slate-600 hover:border-primary-400 text-white px-4 py-2 rounded-lg text-sm"
              >
                Browse all channels
              </Link>
            </div>
          </div>
        )}

        {!featuredLoading && !featuredError && featuredChannels.length === 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
            Balkan channels will appear here once they are available in your plan.
          </div>
        )}

        {!featuredLoading && !featuredError && featuredChannels.length > 0 && (
          <div className="flex gap-4 overflow-x-auto pb-3">
            {featuredChannels.map((channel) => (
              <Link
                key={channel.id}
                to={`/channels/${channel.id}`}
                className="group w-56 shrink-0 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 hover:border-primary-400 transition"
              >
                <div className="h-32 rounded-xl bg-slate-800 overflow-hidden flex items-center justify-center">
                  {channel.logo ? (
                    <img
                      src={channel.logo}
                      alt={channel.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-xs text-slate-400">No logo</span>
                  )}
                </div>
                <div className="mt-3">
                  <h3 className="text-sm font-semibold text-white truncate">{channel.name}</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    {channel.category || 'Live channel'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold text-white">Pick a category</h2>
          <p className="text-sm text-slate-400">Set the tone for what you want to watch next.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {CATEGORY_SPOTLIGHTS.map((category) => (
            <Link
              key={category.category}
              to="/channels"
              state={{ presetFilters: { category: category.category } }}
              className={`group relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br ${category.accent} p-5`}
            >
              <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-primary-500/10 blur-2xl" />
              <div className="relative">
                <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
                  <span>{category.category}</span>
                  <span className="px-2 py-1 rounded-full border border-slate-700 text-[10px] text-slate-300">
                    {category.tag}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">{category.title}</h3>
                <p className="mt-2 text-sm text-slate-300">{category.description}</p>
                <p className="mt-6 text-sm text-primary-200">Explore category</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

export default Home
