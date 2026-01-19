import { createContext, useState, useContext, useEffect, useCallback } from 'react'
import { authAPI } from '../services/api'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const storedUser = localStorage.getItem('user')
  const [user, setUser] = useState(storedUser ? JSON.parse(storedUser) : null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(localStorage.getItem('token'))

  const checkAuth = useCallback(async () => {
    try {
      const response = await authAPI.getMe()
      const userData = response.data.data?.user || response.data.user
      setUser(userData)
      localStorage.setItem('user', JSON.stringify(userData))
    } catch (error) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      setToken(null)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (token) {
      checkAuth()
    } else {
      setLoading(false)
    }
  }, [token, checkAuth])

  const login = async (email, password) => {
    const response = await authAPI.login(email, password)
    const { user: userData, token: newToken } = response.data.data
    localStorage.setItem('token', newToken)
    localStorage.setItem('user', JSON.stringify(userData))
    setToken(newToken)
    setUser(userData)
    setLoading(false)
    return response
  }

  const register = async (userData) => {
    const response = await authAPI.register(userData)
    const { user: newUser, token: newToken } = response.data.data
    localStorage.setItem('token', newToken)
    localStorage.setItem('user', JSON.stringify(newUser))
    setToken(newToken)
    setUser(newUser)
    setLoading(false)
    return response
  }

  const logout = async () => {
    try {
      await authAPI.logout()
    } catch (error) {
      // Continue with logout even if API call fails
    }
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    checkAuth
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
