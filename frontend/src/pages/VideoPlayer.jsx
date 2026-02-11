import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { favoritesAPI, videosAPI } from '../services/api'
import VideoPlayer from '../components/VideoPlayer'
import toast from 'react-hot-toast'

const VideoPlayerPage = () => {
  const { id } = useParams()
  const [video, setVideo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [favoriteId, setFavoriteId] = useState(null)
  const [favoriteLoading, setFavoriteLoading] = useState(false)

  useEffect(() => {
    loadVideo()
  }, [id])

  const loadVideo = async () => {
    try {
      setLoading(true)
      const response = await videosAPI.getById(id)
      const videoData = response.data.data?.video || null
      setVideo(videoData)
      if (videoData) {
        await loadFavoriteStatus(videoData.id)
      }
    } catch (error) {
      toast.error('Failed to load video')
      setFavoriteId(null)
    } finally {
      setLoading(false)
    }
  }

  const loadFavoriteStatus = async (videoId) => {
    try {
      const response = await favoritesAPI.check('video', videoId)
      setFavoriteId(response.data.data?.favoriteId || null)
    } catch {
      setFavoriteId(null)
    }
  }

  const handleToggleFavorite = async () => {
    if (!video || favoriteLoading) return

    try {
      setFavoriteLoading(true)
      if (favoriteId) {
        await favoritesAPI.remove(favoriteId)
        setFavoriteId(null)
        toast.success('Removed from favorites')
      } else {
        const response = await favoritesAPI.addVideo(video.id)
        setFavoriteId(response.data.data?.favorite?.id || null)
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

  if (!video) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-white">Video not found</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <VideoPlayer
        streamUrl={video.videoUrl}
        title={video.title}
        onToggleFavorite={handleToggleFavorite}
        isFavorite={Boolean(favoriteId)}
      />
      <div className="mt-6 bg-slate-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-white mb-2">{video.title}</h2>
        {video.description && (
          <p className="text-gray-300 mb-4">{video.description}</p>
        )}
        <div className="flex flex-wrap gap-4 text-sm text-gray-400">
          {video.views && (
            <span>{video.views} views</span>
          )}
          {video.category && (
            <span>Category: {video.category}</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default VideoPlayerPage
