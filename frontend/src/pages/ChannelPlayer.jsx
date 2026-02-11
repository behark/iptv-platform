import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { channelsAPI, favoritesAPI, historyAPI } from '../services/api'
import VideoPlayer from '../components/VideoPlayer'
import toast from 'react-hot-toast'

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
  const [favoriteId, setFavoriteId] = useState(null)
  const [favoriteLoading, setFavoriteLoading] = useState(false)
  const [playerError, setPlayerError] = useState('')
  const [playerKey, setPlayerKey] = useState(0)
  const [playerVisible, setPlayerVisible] = useState(true)
  const watchStartTime = useRef(null)
  const currentChannelId = useRef(null)

  useEffect(() => {
    loadChannel()
    watchStartTime.current = Date.now()

    return () => {
      if (currentChannelId.current && watchStartTime.current) {
        const duration = Math.floor((Date.now() - watchStartTime.current) / 1000)
        if (duration > 5) {
          historyAPI.addChannel(currentChannelId.current, duration).catch(() => { })
        }
      }
    }
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
      currentChannelId.current = channelData?.id || null
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
        await loadFavoriteStatus(channelData.id)
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

  const description =
    channel?.description && channel.description.toLowerCase() !== 'undefined'
      ? channel.description
      : 'No description available'

  const loadFavoriteStatus = async (channelId) => {
    try {
      const response = await favoritesAPI.check('channel', channelId)
      setFavoriteId(response.data.data?.favoriteId || null)
    } catch {
      setFavoriteId(null)
    }
  }

  const handleToggleFavorite = async () => {
    if (!channel || favoriteLoading) return

    try {
      setFavoriteLoading(true)
      if (favoriteId) {
        await favoritesAPI.remove(favoriteId)
        setFavoriteId(null)
        toast.success('Removed from favorites')
      } else {
        const response = await favoritesAPI.addChannel(channel.id)
        const newFavoriteId = response.data.data?.favorite?.id || null
        setFavoriteId(newFavoriteId)
        toast.success('Added to favorites')
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to update favorites'
      toast.error(message)
    } finally {
      setFavoriteLoading(false)
    }
  }

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className={`transition-all duration-300 ${playerVisible ? 'opacity-100' : 'opacity-0 pointer-events-none h-0 overflow-hidden'}`}>
        <VideoPlayer
          key={playerKey}
          streamUrl={channel.streamUrl}
          streamType={channel.streamType}
          fileExt={channel.fileExt}
          title={channel.name}
          showMeta={false}
          onToggleFavorite={handleToggleFavorite}
          isFavorite={Boolean(favoriteId)}
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
