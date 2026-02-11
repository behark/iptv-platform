import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { channelsAPI, favoritesAPI } from '../services/api'
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

const DEFAULT_COUNTRY_CODES = [
  'XK',
  'AL',
  'MK',
  'ME',
  'RS',
  'BA',
  'HR',
  'SI',
  'BG',
  'GR',
  'RO',
  'US',
  'UK',
  'CA',
  'FR',
  'DE',
  'ES',
  'IT',
  'AE',
  'IN',
  'BR',
  'TR',
  'JP',
  'KR',
  'AU',
  'ZA',
  'INT'
]

const POPULAR_COUNTRY_CODES = ['XK', 'AL', 'US', 'UK', 'DE', 'FR', 'TR', 'GR']

const COUNTRY_LABELS = {
  XK: { name: 'Kosovo', flag: '🇽🇰' },
  AL: { name: 'Albania', flag: '🇦🇱' },
  MK: { name: 'North Macedonia', flag: '🇲🇰' },
  ME: { name: 'Montenegro', flag: '🇲🇪' },
  RS: { name: 'Serbia', flag: '🇷🇸' },
  BA: { name: 'Bosnia and Herzegovina', flag: '🇧🇦' },
  HR: { name: 'Croatia', flag: '🇭🇷' },
  SI: { name: 'Slovenia', flag: '🇸🇮' },
  BG: { name: 'Bulgaria', flag: '🇧🇬' },
  GR: { name: 'Greece', flag: '🇬🇷' },
  RO: { name: 'Romania', flag: '🇷🇴' },
  US: { name: 'United States', flag: '🇺🇸' },
  UK: { name: 'United Kingdom', flag: '🇬🇧' },
  CA: { name: 'Canada', flag: '🇨🇦' },
  FR: { name: 'France', flag: '🇫🇷' },
  DE: { name: 'Germany', flag: '🇩🇪' },
  ES: { name: 'Spain', flag: '🇪🇸' },
  IT: { name: 'Italy', flag: '🇮🇹' },
  AE: { name: 'United Arab Emirates', flag: '🇦🇪' },
  IN: { name: 'India', flag: '🇮🇳' },
  BR: { name: 'Brazil', flag: '🇧🇷' },
  TR: { name: 'Turkey', flag: '🇹🇷' },
  JP: { name: 'Japan', flag: '🇯🇵' },
  KR: { name: 'South Korea', flag: '🇰🇷' },
  AU: { name: 'Australia', flag: '🇦🇺' },
  ZA: { name: 'South Africa', flag: '🇿🇦' },
  INT: { name: 'International', flag: '🌍' }
}

const LANGUAGE_LABELS = {
  en: { label: 'English', short: 'EN', flag: '🇬🇧' },
  eng: { label: 'English', short: 'EN', flag: '🇬🇧' },
  english: { label: 'English', short: 'EN', flag: '🇬🇧' },
  es: { label: 'Spanish', short: 'ES', flag: '🇪🇸' },
  spa: { label: 'Spanish', short: 'ES', flag: '🇪🇸' },
  spanish: { label: 'Spanish', short: 'ES', flag: '🇪🇸' },
  fr: { label: 'French', short: 'FR', flag: '🇫🇷' },
  fre: { label: 'French', short: 'FR', flag: '🇫🇷' },
  french: { label: 'French', short: 'FR', flag: '🇫🇷' },
  ar: { label: 'Arabic', short: 'AR', flag: '🇦🇪' },
  arabic: { label: 'Arabic', short: 'AR', flag: '🇦🇪' },
  hi: { label: 'Hindi', short: 'HI', flag: '🇮🇳' },
  hindi: { label: 'Hindi', short: 'HI', flag: '🇮🇳' },
  pt: { label: 'Portuguese', short: 'PT', flag: '🇵🇹' },
  por: { label: 'Portuguese', short: 'PT', flag: '🇵🇹' },
  portuguese: { label: 'Portuguese', short: 'PT', flag: '🇵🇹' },
  de: { label: 'German', short: 'DE', flag: '🇩🇪' },
  ger: { label: 'German', short: 'DE', flag: '🇩🇪' },
  german: { label: 'German', short: 'DE', flag: '🇩🇪' },
  it: { label: 'Italian', short: 'IT', flag: '🇮🇹' },
  ita: { label: 'Italian', short: 'IT', flag: '🇮🇹' },
  italian: { label: 'Italian', short: 'IT', flag: '🇮🇹' },
  tr: { label: 'Turkish', short: 'TR', flag: '🇹🇷' },
  tur: { label: 'Turkish', short: 'TR', flag: '🇹🇷' },
  turkish: { label: 'Turkish', short: 'TR', flag: '🇹🇷' },
  ja: { label: 'Japanese', short: 'JA', flag: '🇯🇵' },
  jpn: { label: 'Japanese', short: 'JA', flag: '🇯🇵' },
  japanese: { label: 'Japanese', short: 'JA', flag: '🇯🇵' },
  sq: { label: 'Albanian', short: 'SQ', flag: '🇦🇱' },
  albanian: { label: 'Albanian', short: 'SQ', flag: '🇦🇱' },
  sr: { label: 'Serbian', short: 'SR', flag: '🇷🇸' },
  serbian: { label: 'Serbian', short: 'SR', flag: '🇷🇸' },
  bs: { label: 'Bosnian', short: 'BS', flag: '🇧🇦' },
  bosnian: { label: 'Bosnian', short: 'BS', flag: '🇧🇦' },
  hr: { label: 'Croatian', short: 'HR', flag: '🇭🇷' },
  croatian: { label: 'Croatian', short: 'HR', flag: '🇭🇷' },
  mk: { label: 'Macedonian', short: 'MK', flag: '🇲🇰' },
  macedonian: { label: 'Macedonian', short: 'MK', flag: '🇲🇰' },
  sl: { label: 'Slovenian', short: 'SL', flag: '🇸🇮' },
  slovenian: { label: 'Slovenian', short: 'SL', flag: '🇸🇮' },
  el: { label: 'Greek', short: 'EL', flag: '🇬🇷' },
  greek: { label: 'Greek', short: 'EL', flag: '🇬🇷' },
  ro: { label: 'Romanian', short: 'RO', flag: '🇷🇴' },
  romanian: { label: 'Romanian', short: 'RO', flag: '🇷🇴' }
}

const PAGE_SIZE = 200
const PRIORITY_COUNTRIES = ['XK', 'AL']
const CLIENT_SORTS = new Set(['favorites-first', 'recently-watched'])

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

const formatCountryLabel = (country) => {
  if (!country) return ''
  const key = country.toUpperCase()
  const entry = COUNTRY_LABELS[key]
  if (!entry) return country
  return `${entry.flag} ${entry.name}`
}

const formatCountryValue = (country) => {
  if (!country) return ''
  const key = country.toUpperCase()
  const entry = COUNTRY_LABELS[key]
  return entry ? entry.name : country
}

const formatLanguageBadge = (language) => {
  const normalized = (language || '').toLowerCase().trim()
  if (!normalized) return ''
  const entry = LANGUAGE_LABELS[normalized]
  if (entry) return `${entry.flag} ${entry.short}`
  return normalized.toUpperCase()
}

const normalizeCategoryFilterValue = (value) => (value || '').trim()

const normalizeCountryFilterValue = (value) => (value || '').trim().toUpperCase()

const normalizeLanguageFilterValue = (value) => {
  const normalized = (value || '').toLowerCase().trim()
  if (!normalized) return ''
  if (LANGUAGE_LABELS[normalized]) return normalized

  let selectedKey = ''
  for (const [key, details] of Object.entries(LANGUAGE_LABELS)) {
    if ((details.label || '').toLowerCase() !== normalized) continue
    if (!selectedKey || key.length < selectedKey.length) {
      selectedKey = key
    }
  }
  return selectedKey || normalized
}

const parseChannelName = (rawName) => {
  const original = rawName || ''
  let displayName = original.trim()
  let resolution = ''
  const tags = []

  const tagPattern = /[\[(]([^\])]+)[\])]/g
  displayName = displayName.replace(tagPattern, (match, inner) => {
    const cleaned = inner.trim()
    if (/not\s*24\/7/i.test(cleaned)) {
      tags.push('Not 24/7')
      return ''
    }
    const resMatch = cleaned.match(/(\d{3,4}p|4k|uhd)/i)
    if (resMatch) {
      resolution = resolution || resMatch[1].toUpperCase()
      return ''
    }
    if (/^(hd|sd|fhd)$/i.test(cleaned)) {
      resolution = resolution || cleaned.toUpperCase()
      return ''
    }
    return match
  })

  if (/not\s*24\/7/i.test(displayName)) {
    tags.push('Not 24/7')
    displayName = displayName.replace(/not\s*24\/7/gi, '').trim()
  }

  displayName = displayName.replace(/\s{2,}/g, ' ').trim()

  return {
    displayName: displayName || original || 'Unknown',
    resolution,
    tags
  }
}

const Channels = () => {
  const location = useLocation()
  const [channels, setChannels] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [favoriteIds, setFavoriteIds] = useState([])
  const [favoriteRecordIds, setFavoriteRecordIds] = useState({})
  const [favoriteActionChannelId, setFavoriteActionChannelId] = useState(null)
  const [recentChannels, setRecentChannels] = useState([])
  const [priorityChannels, setPriorityChannels] = useState([])
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [actionChannelId, setActionChannelId] = useState(null)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const longPressTimer = useRef(null)
  const requestController = useRef(null)
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('iptv_channel_view') || 'grid')
  const [filters, setFilters] = useState(() => ({
    category: location.state?.presetFilters?.category || '',
    language: location.state?.presetFilters?.language || '',
    country: location.state?.presetFilters?.country || '',
    search: location.state?.presetFilters?.search || '',
    sort: 'name-asc',
    tab: location.state?.presetFilters?.tab || 'All',
    hasLogo: Boolean(location.state?.presetFilters?.hasLogo),
    streamType: location.state?.presetFilters?.streamType || ''
  }))
  const [countryQuery, setCountryQuery] = useState(() => {
    const preset = location.state?.presetFilters?.country || ''
    return preset ? formatCountryValue(preset) : ''
  })

  const applyFavoriteSnapshot = (favorites) => {
    const channelFavorites = favorites.filter((favorite) => favorite.channelId)
    const ids = channelFavorites.map((favorite) => favorite.channelId)
    const idMap = {}
    channelFavorites.forEach((favorite) => {
      idMap[favorite.channelId] = favorite.id
    })
    setFavoriteIds(ids)
    setFavoriteRecordIds(idMap)
    localStorage.setItem('iptv_favorite_channel_ids', JSON.stringify(ids))
    return { ids, idMap }
  }

  const fetchAndSyncChannelFavorites = async () => {
    const response = await favoritesAPI.getAll()
    const favorites = response.data.data?.favorites || []
    return applyFavoriteSnapshot(favorites)
  }

  const loadChannelFavorites = async () => {
    try {
      await fetchAndSyncChannelFavorites()
    } catch {
      const localIds = readFavoriteIds()
      setFavoriteIds(localIds)
      const fallbackMap = {}
      localIds.forEach((id) => { fallbackMap[id] = null })
      setFavoriteRecordIds(fallbackMap)
    }
  }

  useEffect(() => {
    loadChannelFavorites()
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

  useEffect(() => {
    if (!filters.country) return
    setCountryQuery(formatCountryValue(filters.country))
  }, [filters.country])

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
        !filters.search &&
        !filters.hasLogo &&
        !filters.streamType &&
        filters.sort === 'name-asc'

      const tabCategory = filters.tab !== 'All' && filters.tab !== 'Favorites' ? filters.tab : ''
      const resolvedCategory = tabCategory || filters.category

      const params = {
        page: nextPage,
        limit: PAGE_SIZE,
        sort: CLIENT_SORTS.has(filters.sort) ? 'name-asc' : filters.sort
      }

      const normalizedCategory = normalizeCategoryFilterValue(resolvedCategory)
      const normalizedLanguage = normalizeLanguageFilterValue(filters.language)
      const normalizedCountry = normalizeCountryFilterValue(filters.country)

      if (normalizedCategory) params.category = normalizedCategory
      if (normalizedLanguage) params.language = normalizedLanguage
      if (normalizedCountry) params.country = normalizedCountry
      if (filters.search) params.search = filters.search
      if (filters.hasLogo) params.hasLogo = 'true'
      if (filters.streamType) params.streamType = filters.streamType
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
    const countries = new Set(DEFAULT_COUNTRY_CODES)
    const maxSample = Math.min(dedupedChannels.length, 1000)
    for (let i = 0; i < maxSample; i++) {
      const channel = dedupedChannels[i]
      if (channel?.country) {
        countries.add(channel.country)
      }
    }
    return Array.from(countries).sort((a, b) => {
      return formatCountryLabel(a).localeCompare(formatCountryLabel(b))
    })
  }, [dedupedChannels])

  const countryLookup = useMemo(() => {
    const map = new Map()
    availableCountries.forEach((code) => {
      const entry = COUNTRY_LABELS[code.toUpperCase()]
      if (entry?.name) {
        map.set(entry.name.toLowerCase(), code)
      }
      map.set(code.toLowerCase(), code)
    })
    return map
  }, [availableCountries])

  const visibleChannels = useMemo(() => {
    if (!CLIENT_SORTS.has(filters.sort)) {
      return dedupedChannels
    }

    const sorted = [...dedupedChannels]
    const favoriteSet = new Set(favoriteIds)
    const recentIndex = new Map(recentChannels.map((channel, index) => [channel.id, index]))

    if (filters.sort === 'favorites-first') {
      sorted.sort((a, b) => {
        const aFav = favoriteSet.has(a.id) ? 1 : 0
        const bFav = favoriteSet.has(b.id) ? 1 : 0
        if (aFav !== bFav) return bFav - aFav
        return (a.name || '').localeCompare(b.name || '')
      })
      return sorted
    }

    if (filters.sort === 'recently-watched') {
      sorted.sort((a, b) => {
        const aRecent = recentIndex.has(a.id)
        const bRecent = recentIndex.has(b.id)
        if (aRecent && bRecent) return recentIndex.get(a.id) - recentIndex.get(b.id)
        if (aRecent) return -1
        if (bRecent) return 1
        return (a.name || '').localeCompare(b.name || '')
      })
      return sorted
    }

    return sorted
  }, [dedupedChannels, filters.sort, favoriteIds, recentChannels])

  const hasFilters = Boolean(
    filters.search || filters.category || filters.language || filters.country || filters.sort !== 'name-asc' || filters.tab !== 'All' || filters.hasLogo || filters.streamType
  )

  const isDefaultView =
    filters.tab === 'All' &&
    !filters.category &&
    !filters.language &&
    !filters.country &&
    !filters.search

  const handleViewModeChange = (mode) => {
    setViewMode(mode)
    localStorage.setItem('iptv_channel_view', mode)
  }

  const handleCountryInput = (value) => {
    setCountryQuery(value)
    const normalized = value.toLowerCase().trim()
    if (!normalized) {
      setFilters((prev) => (prev.country ? { ...prev, country: '' } : prev))
      return
    }
    const match = countryLookup.get(normalized)
    if (!match) {
      setFilters((prev) => (prev.country ? { ...prev, country: '' } : prev))
      return
    }
    setFilters((prev) => {
      if (prev.country === match) return prev
      return { ...prev, country: match }
    })
  }

  const favoritesKey = filters.tab === 'Favorites' ? favoriteIds.join(',') : ''

  useEffect(() => {
    const delay = filters.search ? 350 : 0
    const timer = setTimeout(() => {
      loadChannels({ nextPage: 1, append: false })
    }, delay)
    return () => clearTimeout(timer)
  }, [filters.category, filters.language, filters.country, filters.search, filters.sort, filters.tab, filters.hasLogo, filters.streamType, favoritesKey])

  const resetFilters = () => {
    setFilters({
      category: '',
      language: '',
      country: '',
      search: '',
      sort: 'name-asc',
      tab: 'All',
      hasLogo: false,
      streamType: ''
    })
    setCountryQuery('')
  }

  const SORT_LABELS = {
    'name-asc': 'Name (A-Z)',
    'name-desc': 'Name (Z-A)',
    'country-asc': 'Country (A-Z)',
    'country-desc': 'Country (Z-A)',
    'category-asc': 'Category (A-Z)',
    'category-desc': 'Category (Z-A)',
    'recently-added': 'Recently Added',
    'favorites-first': 'Favorites First',
    'recently-watched': 'Recently Watched'
  }

  const filterChips = useMemo(() => {
    const chips = []
    if (filters.tab !== 'All') {
      chips.push({ key: 'tab', label: `Tab: ${filters.tab}` })
    }
    if (filters.category) {
      chips.push({ key: 'category', label: `Category: ${filters.category}` })
    }
    if (filters.language) {
      chips.push({ key: 'language', label: `Language: ${filters.language}` })
    }
    if (filters.country) {
      chips.push({ key: 'country', label: `Country: ${formatCountryLabel(filters.country)}` })
    }
    if (filters.search) {
      chips.push({ key: 'search', label: `Search: ${filters.search}` })
    }
    if (filters.hasLogo) {
      chips.push({ key: 'hasLogo', label: 'Has Logo' })
    }
    if (filters.streamType) {
      chips.push({ key: 'streamType', label: `Type: ${filters.streamType}` })
    }
    if (filters.sort !== 'name-asc') {
      chips.push({ key: 'sort', label: `Sort: ${SORT_LABELS[filters.sort] || filters.sort}` })
    }
    return chips
  }, [filters])

  const clearFilter = (key) => {
    setFilters((prev) => {
      switch (key) {
        case 'tab':
          return { ...prev, tab: 'All' }
        case 'category':
          return { ...prev, category: '' }
        case 'language':
          return { ...prev, language: '' }
        case 'country':
          setCountryQuery('')
          return { ...prev, country: '' }
        case 'search':
          return { ...prev, search: '' }
        case 'sort':
          return { ...prev, sort: 'name-asc' }
        case 'hasLogo':
          return { ...prev, hasLogo: false }
        case 'streamType':
          return { ...prev, streamType: '' }
        default:
          return prev
      }
    })
  }

  const tabs = ['All', 'News', 'Movies', 'Sports', 'Entertainment', 'Music', 'Documentary', 'Kids', 'Favorites']

  const resolutionLabel = (channel) => channel.resolution || channel.quality || ''

  const languageBadge = (channel) => {
    const badge = formatLanguageBadge(channel.language)
    return badge || null
  }

  const toggleFavorite = async (channelId) => {
    if (favoriteActionChannelId === channelId) return

    setFavoriteActionChannelId(channelId)
    try {
      const isFavorite = favoriteIds.includes(channelId)
      if (isFavorite) {
        let favoriteId = favoriteRecordIds[channelId]
        if (!favoriteId) {
          try {
            const refreshed = await fetchAndSyncChannelFavorites()
            favoriteId = refreshed.idMap[channelId]
          } catch {
            favoriteId = null
          }
        }

        if (!favoriteId) {
          setFavoriteIds((prev) => {
            const next = prev.filter((id) => id !== channelId)
            localStorage.setItem('iptv_favorite_channel_ids', JSON.stringify(next))
            return next
          })
          setFavoriteRecordIds((prev) => {
            const next = { ...prev }
            delete next[channelId]
            return next
          })
          return
        }

        await favoritesAPI.remove(favoriteId)
        setFavoriteIds((prev) => {
          const next = prev.filter((id) => id !== channelId)
          localStorage.setItem('iptv_favorite_channel_ids', JSON.stringify(next))
          return next
        })
        setFavoriteRecordIds((prev) => {
          const next = { ...prev }
          delete next[channelId]
          return next
        })
      } else {
        const response = await favoritesAPI.addChannel(channelId)
        const newFavoriteId = response.data.data?.favorite?.id
        if (!newFavoriteId) {
          throw new Error('Missing favorite id')
        }
        setFavoriteIds((prev) => {
          const next = prev.includes(channelId) ? prev : [...prev, channelId]
          localStorage.setItem('iptv_favorite_channel_ids', JSON.stringify(next))
          return next
        })
        setFavoriteRecordIds((prev) => ({
          ...prev,
          [channelId]: newFavoriteId
        }))
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to update favorite'
      if (error.response?.status === 400 && /already/i.test(message)) {
        await loadChannelFavorites()
        return
      }
      toast.error(message)
    } finally {
      setFavoriteActionChannelId(null)
    }
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
          <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 p-1">
            <button
              type="button"
              onClick={() => handleViewModeChange('grid')}
              className={`px-3 py-1 text-xs rounded-md ${viewMode === 'grid'
                ? 'bg-slate-700 text-white'
                : 'text-slate-300 hover:text-white'
                }`}
            >
              Grid
            </button>
            <button
              type="button"
              onClick={() => handleViewModeChange('list')}
              className={`px-3 py-1 text-xs rounded-md ${viewMode === 'list'
                ? 'bg-slate-700 text-white'
                : 'text-slate-300 hover:text-white'
                }`}
            >
              List
            </button>
          </div>
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
            <div className="relative">
              <input
                type="text"
                placeholder="Search channels, categories, or regions..."
                className="w-full px-4 py-2 pr-10 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              />
              {filters.search && (
                <button
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, search: '' }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                  aria-label="Clear search"
                >
                  Clear
                </button>
              )}
            </div>
          </label>
          <label className="text-sm text-slate-300 flex flex-col gap-2">
            Category
            <input
              list="channel-categories"
              placeholder="All categories"
              className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={filters.category}
              onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
            />
            <datalist id="channel-categories">
              {availableCategories.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </label>
          <label className="text-sm text-slate-300 flex flex-col gap-2">
            Language
            <input
              list="channel-languages"
              placeholder="All languages"
              className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={filters.language}
              onChange={(e) => setFilters((prev) => ({ ...prev, language: e.target.value }))}
            />
            <datalist id="channel-languages">
              {availableLanguages.map((language) => (
                <option key={language} value={language} />
              ))}
            </datalist>
          </label>
          <label className="text-sm text-slate-300 flex flex-col gap-2">
            Country
            <input
              list="channel-countries"
              placeholder="All countries"
              className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={countryQuery}
              onChange={(e) => handleCountryInput(e.target.value)}
            />
            <datalist id="channel-countries">
              {availableCountries.map((country) => {
                const entry = COUNTRY_LABELS[country.toUpperCase()]
                const value = entry?.name || country
                const label = entry ? `${entry.flag} ${entry.name}` : country
                return <option key={country} value={value} label={label} />
              })}
            </datalist>
          </label>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">
              Popular countries
            </p>
            <div className="flex flex-wrap gap-2">
              {POPULAR_COUNTRY_CODES.map((country) => (
                <button
                  key={country}
                  onClick={() => setFilters((prev) => ({ ...prev, country }))}
                  className={`text-xs px-3 py-1 rounded-full border ${filters.country === country
                    ? 'bg-primary-500/20 border-primary-400 text-primary-200'
                    : 'border-slate-600 text-slate-300 hover:text-white'
                    }`}
                >
                  {formatCountryLabel(country)}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-700/50">
          <label className="text-sm text-slate-300 flex items-center gap-2">
            Sort
            <select
              className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={filters.sort}
              onChange={(e) => setFilters((prev) => ({ ...prev, sort: e.target.value }))}
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="country-asc">Country (A-Z)</option>
              <option value="country-desc">Country (Z-A)</option>
              <option value="category-asc">Category (A-Z)</option>
              <option value="category-desc">Category (Z-A)</option>
              <option value="recently-added">Recently Added</option>
              <option value="favorites-first">Favorites First</option>
              <option value="recently-watched">Recently Watched</option>
            </select>
          </label>
          <label className="text-sm text-slate-300 flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filters.hasLogo || false}
              onChange={(e) => setFilters((prev) => ({ ...prev, hasLogo: e.target.checked }))}
              className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-primary-500 focus:ring-primary-500 focus:ring-offset-0"
            />
            Has Logo
          </label>
          <label className="text-sm text-slate-300 flex items-center gap-2">
            Type
            <select
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={filters.streamType || ''}
              onChange={(e) => setFilters((prev) => ({ ...prev, streamType: e.target.value }))}
            >
              <option value="">All Types</option>
              <option value="live">Live</option>
              <option value="vod">VOD</option>
            </select>
          </label>
        </div>
      </div>

      {filterChips.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {filterChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => clearFilter(chip.key)}
              className="text-xs text-slate-200 border border-slate-700 rounded-full px-3 py-1 hover:border-primary-400 hover:text-white"
            >
              {chip.label} ✕
            </button>
          ))}
          <button
            type="button"
            onClick={resetFilters}
            className="text-xs text-slate-400 hover:text-white"
          >
            Clear all
          </button>
        </div>
      )}

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

      {viewMode === 'grid' ? (
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
              const parsedName = parseChannelName(channel.name)
              const resolution = parsedName.resolution || resolutionLabel(channel)
              const language = languageBadge(channel)
              const countryLabel = channel.country ? formatCountryLabel(channel.country) : ''
              const isFavorite = favoriteIds.includes(channel.id)
              const isPinned = isDefaultView && PRIORITY_COUNTRIES.includes(channel.country)
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
                        alt={parsedName.displayName}
                        className="w-full h-36 object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-36 bg-slate-700 flex items-center justify-center">
                        <span className="text-5xl">📺</span>
                      </div>
                    )}
                    <div className="absolute top-2 left-2 flex flex-wrap gap-2">
                      <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-black/60 text-white">
                        {channel.isLive === false ? 'VOD' : 'Live'}
                      </span>
                      {resolution && (
                        <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-primary-500/80 text-white">
                          {resolution}
                        </span>
                      )}
                      {isPinned && (
                        <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-amber-500/80 text-white">
                          Pinned
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        toggleFavorite(channel.id)
                      }}
                      disabled={favoriteActionChannelId === channel.id}
                      className="absolute top-2 right-2 text-lg px-2 py-1 rounded-full bg-black/60 hover:bg-black/80 disabled:opacity-60"
                      aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      {isFavorite ? '⭐' : '☆'}
                    </button>
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
                        disabled={favoriteActionChannelId === channel.id}
                        className="px-4 py-2 rounded-full bg-primary-500/80 hover:bg-primary-500 min-h-[44px]"
                      >
                        {favoriteActionChannelId === channel.id
                          ? 'Updating...'
                          : (isFavorite ? 'Remove Favorite' : 'Add to Favorites')}
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
                      <h3 className="text-white font-semibold text-base truncate">{parsedName.displayName}</h3>
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
                      {countryLabel && (
                        <span className="flex items-center gap-1 rounded-full bg-slate-700/60 px-2 py-1">
                          {countryLabel}
                        </span>
                      )}
                      {parsedName.tags.map((tag) => (
                        <span key={`${channel.id}-${tag}`} className="flex items-center gap-1 rounded-full bg-slate-700/60 px-2 py-1">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </Link>
              )
            })}
        </div>
      ) : (
        <div className="space-y-4">
          {loading &&
            Array.from({ length: 6 }).map((_, index) => (
              <div key={`list-skeleton-${index}`} className="bg-slate-800 rounded-xl p-4 animate-pulse">
                <div className="flex gap-4 items-center">
                  <div className="h-16 w-28 bg-slate-700 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-700 rounded w-1/3" />
                    <div className="h-3 bg-slate-700 rounded w-2/3" />
                    <div className="flex gap-2">
                      <div className="h-6 w-16 bg-slate-700 rounded-full" />
                      <div className="h-6 w-20 bg-slate-700 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          {!loading &&
            visibleChannels.map((channel) => {
              const description =
                channel.description && channel.description.toLowerCase() !== 'undefined'
                  ? channel.description
                  : ''
              const parsedName = parseChannelName(channel.name)
              const resolution = parsedName.resolution || resolutionLabel(channel)
              const language = languageBadge(channel)
              const countryLabel = channel.country ? formatCountryLabel(channel.country) : ''
              const isFavorite = favoriteIds.includes(channel.id)
              const isPinned = isDefaultView && PRIORITY_COUNTRIES.includes(channel.country)
              return (
                <Link
                  key={channel.id}
                  to={`/channels/${channel.id}`}
                  onPointerDown={(event) => handleLongPressStart(event, channel.id)}
                  onPointerUp={handleLongPressEnd}
                  onPointerLeave={handleLongPressEnd}
                  onContextMenu={(event) => handleContextMenu(event, channel.id)}
                  className="relative flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-800/70 p-4 hover:bg-slate-700/70 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <div className="flex gap-4 items-start">
                    <div className="h-16 w-28 rounded-lg bg-slate-700 overflow-hidden flex items-center justify-center">
                      {channel.logo ? (
                        <img
                          src={channel.logo}
                          alt={parsedName.displayName}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-sm text-slate-300">No logo</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-white font-semibold text-base truncate">{parsedName.displayName}</h3>
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                            {description || 'No description available'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-black/60 text-white">
                            {channel.isLive === false ? 'VOD' : 'Live'}
                          </span>
                          {resolution && (
                            <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-primary-500/80 text-white">
                              {resolution}
                            </span>
                          )}
                          {isPinned && (
                            <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-amber-500/80 text-white">
                              Pinned
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-300">
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
                        {countryLabel && (
                          <span className="flex items-center gap-1 rounded-full bg-slate-700/60 px-2 py-1">
                            {countryLabel}
                          </span>
                        )}
                        {parsedName.tags.map((tag) => (
                          <span key={`${channel.id}-${tag}`} className="flex items-center gap-1 rounded-full bg-slate-700/60 px-2 py-1">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        toggleFavorite(channel.id)
                      }}
                      disabled={favoriteActionChannelId === channel.id}
                      className="text-lg px-2 py-1 rounded-full bg-black/40 hover:bg-black/60 disabled:opacity-60"
                      aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      {isFavorite ? '⭐' : '☆'}
                    </button>
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
                        disabled={favoriteActionChannelId === channel.id}
                        className="px-4 py-2 rounded-full bg-primary-500/80 hover:bg-primary-500 min-h-[44px]"
                      >
                        {favoriteActionChannelId === channel.id
                          ? 'Updating...'
                          : (isFavorite ? 'Remove Favorite' : 'Add to Favorites')}
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
                </Link>
              )
            })}
        </div>
      )}

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
