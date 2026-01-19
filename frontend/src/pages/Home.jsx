import { Link } from 'react-router-dom'

const FEATURED_COUNTRIES = [
  'United States',
  'United Kingdom',
  'Canada',
  'India',
  'Brazil',
  'France',
  'Germany',
  'Japan'
]

const FEATURED_CATEGORIES = ['News', 'Sports', 'Movies', 'Kids']

const Home = () => {
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

      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <section className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-white mb-2">Explore by country</h2>
          <p className="text-sm text-slate-400 mb-4">
            Jump back into channels curated by region.
          </p>
          <div className="flex flex-wrap gap-2">
            {FEATURED_COUNTRIES.map((country) => (
              <Link
                key={country}
                to="/channels"
                state={{ presetFilters: { country } }}
                className="px-3 py-1 rounded-full border border-slate-600 text-sm text-slate-200 hover:border-primary-400 hover:text-white"
              >
                {country}
              </Link>
            ))}
          </div>
        </section>

        <section className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-white mb-2">Trending categories</h2>
          <p className="text-sm text-slate-400 mb-4">
            Discover fresh picks across popular channel types.
          </p>
          <div className="flex flex-wrap gap-2">
            {FEATURED_CATEGORIES.map((category) => (
              <Link
                key={category}
                to="/channels"
                state={{ presetFilters: { category } }}
                className="px-3 py-1 rounded-full border border-slate-600 text-sm text-slate-200 hover:border-primary-400 hover:text-white"
              >
                {category}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default Home
