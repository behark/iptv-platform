import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { searchAPI } from '../services/api'

const SearchBar = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState({ channels: [], videos: [] })
  const [loading, setLoading] = useState(false)
  const [recentSearches, setRecentSearches] = useState([])
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const saved = localStorage.getItem('recentSearches')
    if (saved) {
      setRecentSearches(JSON.parse(saved))
    }
  }, [])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        if (isOpen) {
          onClose()
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const debounce = (func, wait) => {
    let timeout
    return (...args) => {
      clearTimeout(timeout)
      timeout = setTimeout(() => func(...args), wait)
    }
  }

  const performSearch = useCallback(
    debounce(async (searchQuery) => {
      if (!searchQuery.trim()) {
        setResults({ channels: [], videos: [] })
        return
      }

      setLoading(true)
      try {
        const response = await searchAPI.search(searchQuery, { limit: 10 })
        setResults(response.data.data)
      } catch (error) {
        console.error('Search error:', error)
        setResults({ channels: [], videos: [] })
      } finally {
        setLoading(false)
      }
    }, 300),
    []
  )

  const handleInputChange = (e) => {
    const value = e.target.value
    setQuery(value)
    setSelectedIndex(-1)
    performSearch(value)
  }

  const saveRecentSearch = (searchTerm) => {
    const updated = [searchTerm, ...recentSearches.filter(s => s !== searchTerm)].slice(0, 5)
    setRecentSearches(updated)
    localStorage.setItem('recentSearches', JSON.stringify(updated))
  }

  const handleSelect = (type, item) => {
    if (query.trim()) {
      saveRecentSearch(query.trim())
    }
    onClose()
    setQuery('')
    setResults({ channels: [], videos: [] })

    if (type === 'channel') {
      navigate(`/channels/${item.id}`)
    } else if (type === 'video') {
      navigate(`/videos/${item.id}`)
    }
  }

  const handleRecentSearch = (search) => {
    setQuery(search)
    performSearch(search)
  }

  const clearRecentSearches = () => {
    setRecentSearches([])
    localStorage.removeItem('recentSearches')
  }

  const allResults = [
    ...results.channels.map(c => ({ ...c, type: 'channel' })),
    ...results.videos.map(v => ({ ...v, type: 'video' }))
  ]

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, allResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, -1))
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault()
      const selected = allResults[selectedIndex]
      handleSelect(selected.type, selected)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Search">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed inset-x-0 top-20 mx-auto max-w-2xl px-4">
        <div className="bg-slate-800 rounded-xl shadow-2xl overflow-hidden">
          {/* Search Input */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Search channels and videos..."
              className="w-full pl-12 pr-12 py-4 bg-transparent text-white placeholder-slate-400 text-lg focus:outline-none"
              aria-label="Search query"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery('')
                  setResults({ channels: [], videos: [] })
                  inputRef.current?.focus()
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                aria-label="Clear search"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Loading indicator */}
          {loading && (
            <div className="border-t border-slate-700 px-4 py-3">
              <div className="flex items-center gap-2 text-slate-400">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Searching...
              </div>
            </div>
          )}

          {/* Results */}
          {!loading && query && (results.channels.length > 0 || results.videos.length > 0) && (
            <div className="border-t border-slate-700 max-h-96 overflow-y-auto">
              {results.channels.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-medium text-slate-400 uppercase tracking-wide bg-slate-800/50">
                    Channels
                  </div>
                  {results.channels.map((channel, idx) => (
                    <button
                      key={channel.id}
                      onClick={() => handleSelect('channel', channel)}
                      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700 transition-colors text-left ${
                        selectedIndex === idx ? 'bg-slate-700' : ''
                      }`}
                    >
                      {channel.logo ? (
                        <img src={channel.logo} alt="" className="w-10 h-10 rounded object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-slate-600 flex items-center justify-center text-slate-400">
                          TV
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium truncate">{channel.name}</div>
                        <div className="text-sm text-slate-400 truncate">
                          {channel.category} {channel.country && `- ${channel.country}`}
                        </div>
                      </div>
                      {channel.isLive && (
                        <span className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded">LIVE</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {results.videos.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-medium text-slate-400 uppercase tracking-wide bg-slate-800/50">
                    Videos
                  </div>
                  {results.videos.map((video, idx) => (
                    <button
                      key={video.id}
                      onClick={() => handleSelect('video', video)}
                      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700 transition-colors text-left ${
                        selectedIndex === results.channels.length + idx ? 'bg-slate-700' : ''
                      }`}
                    >
                      {video.thumbnail ? (
                        <img src={video.thumbnail} alt="" className="w-16 h-10 rounded object-cover" />
                      ) : (
                        <div className="w-16 h-10 rounded bg-slate-600 flex items-center justify-center text-slate-400">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium truncate">{video.title}</div>
                        <div className="text-sm text-slate-400 truncate">
                          {video.category} {video.duration && `- ${Math.floor(video.duration / 60)}min`}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* No results */}
          {!loading && query && results.channels.length === 0 && results.videos.length === 0 && (
            <div className="border-t border-slate-700 px-4 py-8 text-center text-slate-400">
              No results found for "{query}"
            </div>
          )}

          {/* Recent searches */}
          {!query && recentSearches.length > 0 && (
            <div className="border-t border-slate-700">
              <div className="flex items-center justify-between px-4 py-2">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                  Recent Searches
                </span>
                <button
                  onClick={clearRecentSearches}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Clear
                </button>
              </div>
              {recentSearches.map((search, idx) => (
                <button
                  key={idx}
                  onClick={() => handleRecentSearch(search)}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-700 transition-colors text-left text-slate-300"
                >
                  <MagnifyingGlassIcon className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  {search}
                </button>
              ))}
            </div>
          )}

          {/* Keyboard shortcuts hint */}
          <div className="border-t border-slate-700 px-4 py-3 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-4">
              <span><kbd className="px-1.5 py-0.5 bg-slate-700 rounded">↑↓</kbd> to navigate</span>
              <span><kbd className="px-1.5 py-0.5 bg-slate-700 rounded">↵</kbd> to select</span>
            </div>
            <span><kbd className="px-1.5 py-0.5 bg-slate-700 rounded">esc</kbd> to close</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SearchBar
