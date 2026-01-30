import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const Navbar = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
    setMobileMenuOpen(false)
  }

  const isActive = (path) => location.pathname === path

  const navLinks = [
    { to: '/', label: 'Home', icon: '🏠' },
    { to: '/channels', label: 'Live TV', icon: '📺' },
    { to: '/videos', label: 'Movies', icon: '🎬' },
    { to: '/favorites', label: 'Favorites', icon: '⭐' },
    { to: '/history', label: 'History', icon: '🕐' }
  ]

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14">
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">TV</span>
              </div>
              <span className="text-lg font-semibold text-slate-800 hidden sm:block">StreamHub</span>
            </Link>
            {user && (
              <div className="hidden md:ml-8 md:flex md:space-x-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive(link.to)
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                  >
                    <span className="text-base">{link.icon}</span>
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="hidden md:flex md:items-center md:gap-3">
            {user ? (
              <>
                {user.role === 'ADMIN' && (
                  <Link
                    to="/admin"
                    className="text-purple-600 hover:bg-purple-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Admin
                  </Link>
                )}
                <Link
                  to="/plans"
                  className="text-slate-600 hover:bg-slate-100 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Plans
                </Link>
                <div className="w-px h-6 bg-slate-200" />
                <Link
                  to="/profile"
                  className="flex items-center gap-2 text-slate-700 hover:bg-slate-100 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center">
                    <span className="text-indigo-600 text-xs font-semibold">
                      {user.username?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="hidden lg:block">{user.username}</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-slate-500 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-slate-600 hover:text-slate-900 px-4 py-2 text-sm font-medium transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-slate-500 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-lg transition-colors"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-slate-100">
          <div className="px-3 py-3 space-y-1">
            {user ? (
              <>
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium transition-colors ${isActive(link.to)
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-50'
                      }`}
                  >
                    <span>{link.icon}</span>
                    {link.label}
                  </Link>
                ))}
                <div className="border-t border-slate-100 pt-2 mt-2 space-y-1">
                  <Link
                    to="/plans"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <span>💎</span>
                    Plans
                  </Link>
                  {user.role === 'ADMIN' && (
                    <Link
                      to="/admin"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium text-purple-600 hover:bg-purple-50"
                    >
                      <span>⚙️</span>
                      Admin Dashboard
                    </Link>
                  )}
                  <Link
                    to="/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <span>👤</span>
                    Profile
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium text-red-600 hover:bg-red-50"
                  >
                    <span>🚪</span>
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-2 pt-2">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-4 py-2.5 rounded-lg text-center text-base font-medium text-slate-600 hover:bg-slate-50 border border-slate-200"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-4 py-2.5 rounded-lg text-center text-base font-medium bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}

export default Navbar
