import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { channelsAPI } from '../services/api'
import VideoPlayer from '../components/VideoPlayer'
import toast from 'react-hot-toast'

const ChannelPlayer = () => {
  const { id } = useParams()
  const [channel, setChannel] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadChannel()
  }, [id])

  const loadChannel = async () => {
    try {
      setLoading(true)
      const response = await channelsAPI.getById(id)
      setChannel(response.data.data?.channel || null)
    } catch (error) {
      toast.error('Failed to load channel')
    } finally {
      setLoading(false)
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
      <VideoPlayer
        streamUrl={channel.streamUrl}
        streamType={channel.streamType}
        title={channel.name}
      />
      <div className="mt-6 bg-slate-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-white mb-2">{channel.name}</h2>
        {channel.description && (
          <p className="text-gray-300 mb-4">{channel.description}</p>
        )}
        <div className="flex flex-wrap gap-4 text-sm text-gray-400">
          {channel.category && (
            <span>Category: {channel.category}</span>
          )}
          {channel.language && (
            <span>Language: {channel.language}</span>
          )}
          {channel.country && (
            <span>Country: {channel.country}</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default ChannelPlayer
