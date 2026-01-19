import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import toast from 'react-hot-toast'

const Favorites = () => {
    const [favorites, setFavorites] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadFavorites()
    }, [])

    const loadFavorites = async () => {
        try {
            setLoading(true)
            const response = await api.get('/favorites')
            setFavorites(response.data.data?.favorites || [])
        } catch (error) {
            toast.error('Failed to load favorites')
        } finally {
            setLoading(false)
        }
    }

    const removeFavorite = async (id) => {
        try {
            await api.delete(`/favorites/${id}`)
            setFavorites(favorites.filter(f => f.id !== id))
            toast.success('Removed from favorites')
        } catch (error) {
            toast.error('Failed to remove from favorites')
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
            </div>
        )
    }

    const channelFavorites = favorites.filter(f => f.channel)
    const videoFavorites = favorites.filter(f => f.video)

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-3xl font-bold text-white mb-8">My Favorites</h1>

            {favorites.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-gray-400 mb-4">You haven't added any favorites yet</p>
                    <div className="flex justify-center gap-4">
                        <Link
                            to="/channels"
                            className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-lg"
                        >
                            Browse Channels
                        </Link>
                        <Link
                            to="/videos"
                            className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-lg"
                        >
                            Browse Videos
                        </Link>
                    </div>
                </div>
            ) : (
                <div className="space-y-8">
                    {channelFavorites.length > 0 && (
                        <section>
                            <h2 className="text-xl font-semibold text-white mb-4">Channels</h2>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                                {channelFavorites.map((favorite) => (
                                    <div
                                        key={favorite.id}
                                        className="bg-slate-800 rounded-lg overflow-hidden group relative"
                                    >
                                        <Link to={`/channels/${favorite.channel.id}`}>
                                            {favorite.channel.logo ? (
                                                <img
                                                    src={favorite.channel.logo}
                                                    alt={favorite.channel.name}
                                                    className="w-full h-32 object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-32 bg-slate-700 flex items-center justify-center">
                                                    <span className="text-4xl">📺</span>
                                                </div>
                                            )}
                                            <div className="p-4">
                                                <h3 className="text-white font-semibold truncate">
                                                    {favorite.channel.name}
                                                </h3>
                                            </div>
                                        </Link>
                                        <button
                                            onClick={() => removeFavorite(favorite.id)}
                                            className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {videoFavorites.length > 0 && (
                        <section>
                            <h2 className="text-xl font-semibold text-white mb-4">Videos</h2>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                                {videoFavorites.map((favorite) => (
                                    <div
                                        key={favorite.id}
                                        className="bg-slate-800 rounded-lg overflow-hidden group relative"
                                    >
                                        <Link to={`/videos/${favorite.video.id}`}>
                                            {favorite.video.thumbnail ? (
                                                <img
                                                    src={favorite.video.thumbnail}
                                                    alt={favorite.video.title}
                                                    className="w-full h-48 object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-48 bg-slate-700 flex items-center justify-center">
                                                    <span className="text-4xl">🎬</span>
                                                </div>
                                            )}
                                            <div className="p-4">
                                                <h3 className="text-white font-semibold line-clamp-2">
                                                    {favorite.video.title}
                                                </h3>
                                            </div>
                                        </Link>
                                        <button
                                            onClick={() => removeFavorite(favorite.id)}
                                            className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            )}
        </div>
    )
}

export default Favorites
