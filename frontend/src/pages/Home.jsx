import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const Home = () => {
  const { user } = useAuth()

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">
          Welcome to IPTV Platform
        </h1>
        <p className="text-xl text-gray-300 mb-8">
          Stream your favorite channels and videos
        </p>
        <div className="flex justify-center space-x-4">
          <Link
            to="/channels"
            className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium"
          >
            Browse Channels
          </Link>
          <Link
            to="/videos"
            className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-lg font-medium"
          >
            Watch Videos
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Home
