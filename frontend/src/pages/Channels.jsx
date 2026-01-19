import { useEffect, useMemo, useState } from 'react'
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

const Channels = () => {
  const location = useLocation()
  const [channels, setChannels] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState(() => ({
    category: location.state?.presetFilters?.category || '',
    language: location.state?.presetFilters?.language || '',
    country: location.state?.presetFilters?.country || '',
    search: location.state?.presetFilters?.search || '',
    sort: 'name-asc'
  }))

  useEffect(() => {
    loadChannels()
  }, [])

  const loadChannels = async () => {
    try {
      setLoading(true)
      const response = await channelsAPI.getAll()
      setChannels(response.data.data?.channels || [])
    } catch (error) {
      toast.error('Failed to load channels')
    } finally {
      setLoading(false)
    }
  }

  const availableCategories = useMemo(() => {
    const categories = new Set(DEFAULT_CATEGORIES)
    channels.forEach((channel) => {
      if (channel.category) {
        categories.add(channel.category)
      }
    })
    return Array.from(categories).sort((a, b) => a.localeCompare(b))
  }, [channels])

  const availableLanguages = useMemo(() => {
    const languages = new Set(DEFAULT_LANGUAGES)
    channels.forEach((channel) => {
      if (channel.language) {
        languages.add(channel.language)
      }
    })
    return Array.from(languages).sort((a, b) => a.localeCompare(b))
  }, [channels])

  const availableCountries = useMemo(() => {
    const countries = new Set(DEFAULT_COUNTRIES)
    channels.forEach((channel) => {
      if (channel.country) {
        countries.add(channel.country)
      }
    })
    return Array.from(countries).sort((a, b) => a.localeCompare(b))
  }, [channels])

  const filteredChannels = useMemo(() => {
    const searchValue = filters.search.trim().toLowerCase()
    let result = channels.filter((channel) => {
      if (filters.category && channel.category !== filters.category) {
        return false
      }
      if (filters.language && channel.language !== filters.language) {
        return false
      }
      if (filters.country && channel.country !== filters.country) {
        return false
      }
      if (searchValue) {
        const haystack = `${channel.name ?? ''} ${channel.category ?? ''} ${channel.language ?? ''} ${channel.country ?? ''}`.toLowerCase()
        if (!haystack.includes(searchValue)) {
          return false
        }
      }
      return true
    })

    result = [...result].sort((a, b) => {
      const nameA = a.name ?? ''
      const nameB = b.name ?? ''
      return filters.sort === 'name-desc'
        ? nameB.localeCompare(nameA)
        : nameA.localeCompare(nameB)
    })

    return result
  }, [channels, filters])

  const hasFilters = Boolean(
    filters.search || filters.category || filters.language || filters.country || filters.sort !== 'name-asc'
  )

  const resetFilters = () => {
    setFilters({
      category: '',
      language: '',
      country: '',
      search: '',
      sort: 'name-asc'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" role="status" aria-live="polite">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
        <span className="sr-only">Loading channels...</span>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Channels</h1>
          <p className="text-sm text-slate-400 mt-1">
            Showing {filteredChannels.length} of {channels.length} channels
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
            onClick={loadChannels}
            className="text-sm text-white bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg"
          >
            Refresh
          </button>
        </div>
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

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {filteredChannels.map((channel) => (
          <Link
            key={channel.id}
            to={`/channels/${channel.id}`}
            className="bg-slate-800 rounded-lg overflow-hidden hover:bg-slate-700 transition-colors"
          >
            {channel.logo ? (
              <img
                src={channel.logo}
                alt={channel.name}
                className="w-full h-32 object-cover"
              />
            ) : (
              <div className="w-full h-32 bg-slate-700 flex items-center justify-center">
                <span className="text-4xl">📺</span>
              </div>
            )}
            <div className="p-4">
              <h3 className="text-white font-semibold truncate">{channel.name}</h3>
              {channel.category && (
                <p className="text-sm text-gray-400 mt-1">{channel.category}</p>
              )}
            </div>
          </Link>
        ))}
      </div>

      {filteredChannels.length === 0 && (
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
    </div>
  )
}

export default Channels
