import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { channelsAPI } from '../services/api'
import toast from 'react-hot-toast'

const Channels = () => {
  const [channels, setChannels] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    category: '',
    language: '',
    search: ''
  })

  useEffect(() => {
    loadChannels()
  }, [filters])

  const loadChannels = async () => {
    try {
      setLoading(true)
      const response = await channelsAPI.getAll(filters)
      setChannels(response.data.data?.channels || [])
    } catch (error) {
      toast.error('Failed to load channels')
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-white mb-6">Channels</h1>

      <div className="mb-6 flex flex-wrap gap-4">
        <input
          type="text"
          placeholder="Search channels..."
          className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {channels.map((channel) => (
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

      {channels.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400">No channels found</p>
        </div>
      )}
    </div>
  )
}

export default Channels
