import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { channelsAPI } from '../services/api'
import VideoPlayer from '../components/VideoPlayer'
import toast from 'react-hot-toast'

const readFavoriteIds = () => {
  try {
    return JSON.parse(localStorage.getItem('iptv_favorite_channel_ids') || '[]')
  } catch (error) {
    return []
  }
}

const updateRecentChannels = (channel) => {
  try {
    const existing = JSON.parse(localStorage.getItem('iptv_recent_channels') || '[]')
    const filtered = existing.filter((item) => item.id !== channel.id)
    const next = [channel, ...filtered].slice(0, 8)
    localStorage.setItem('iptv_recent_channels', JSON.stringify(next))
  } catch (error) {
    return
  }
}

const ChannelPlayer = () => {
  const { id } = useParams()
  const [channel, setChannel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [favoriteIds, setFavoriteIds] = useState([])
  const [playerError, setPlayerError] = useState('')
  const [playerKey, setPlayerKey] = useState(0)
  const [playerVisible, setPlayerVisible] = useState(true)

  useEffect(() => {
    loadChannel()
    setFavoriteIds(readFavoriteIds())
  }, [id])

  useEffect(() => {
    let lastScrollY = window.scrollY
    const handleScroll = () => {
      const current = window.scrollY
      if (current > lastScrollY && current > 120) {
        setPlayerVisible(false)
      } else {
        setPlayerVisible(true)
      }
      lastScrollY = current
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const loadChannel = async () => {
    try {
      setLoading(true)
      setPlayerError('')
      const response = await channelsAPI.getById(id)
      const channelData = response.data.data?.channel || null
      setChannel(channelData)
      if (channelData) {
        updateRecentChannels({
          id: channelData.id,
          name: channelData.name,
          logo: channelData.logo,
          category: channelData.category,
          language: channelData.language,
          country: channelData.country
        })
        localStorage.setItem('iptv_last_opened_channel', JSON.stringify(channelData))
      }
    } catch (error) {
      toast.error('Failed to load channel')
    } finally {
      setLoading(false)
    }
  }

  const metadataChips = useMemo(() => {
    if (!channel) return []
    const chips = []
    if (channel.category) chips.push(`📰 ${channel.category}`)
    if (channel.language) chips.push(`💼 ${channel.language}`)
    if (channel.country) chips.push(`🌍 ${channel.country}`)
    return chips
  }, [channel])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  if (!channel) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-white">Channel not found</p>
      </div>
    )
  }

  const isFavorite = favoriteIds.includes(channel.id)

  const description =
    channel.description && channel.description.toLowerCase() !== 'undefined'
      ? channel.description
      : 'No description available'

  const handleToggleFavorite = () => {
    setFavoriteIds((prev) => {
      const next = prev.includes(channel.id)
        ? prev.filter((item) => item !== channel.id)
        : [...prev, channel.id]
      localStorage.setItem('iptv_favorite_channel_ids', JSON.stringify(next))
      toast.success(next.includes(channel.id) ? 'Added to favorites' : 'Removed from favorites')
      return next
    })
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className={`transition-all duration-300 ${playerVisible ? 'opacity-100' : 'opacity-0 pointer-events-none h-0 overflow-hidden'}`}>
        <VideoPlayer
          key={playerKey}
          streamUrl={channel.streamUrl}
          streamType={channel.streamType}
          title={channel.name}
          showMeta={false}
          onToggleFavorite={handleToggleFavorite}
          isFavorite={isFavorite}
          onStreamError={(message) => setPlayerError(message)}
        />
        {playerError && (
          <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{playerError}</span>
              <button
                onClick={() => {
                  setPlayerError('')
                  setPlayerKey((prev) => prev + 1)
                }}
                className="text-xs text-white bg-red-500/80 hover:bg-red-500 px-3 py-2 rounded-lg"
              >
                Retry stream
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="mt-6 bg-slate-800 rounded-lg p-6">
        <h2 className="text-3xl font-bold text-white mb-2">{channel.name}</h2>
        <p className="text-gray-300 mb-4 text-sm">{description}</p>
        <div className="flex flex-wrap gap-2 text-xs text-slate-300">
          {metadataChips.map((chip) => (
            <span key={chip} className="rounded-full bg-slate-700/60 px-3 py-1">
              {chip}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ChannelPlayer
