import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002/api'

// Request timeout (30 seconds)
const REQUEST_TIMEOUT = 30000

// Retry configuration
const MAX_RETRIES = 3
const RETRY_DELAY_BASE = 1000 // 1 second base delay

const api = axios.create({
  baseURL: API_URL,
  timeout: REQUEST_TIMEOUT,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Retry logic with exponential backoff
const retryRequest = async (error, retryCount = 0) => {
  const config = error.config

  // Don't retry if we've exceeded max retries
  if (retryCount >= MAX_RETRIES) {
    return Promise.reject(error)
  }

  // Only retry on network errors or 5xx server errors
  const isNetworkError = !error.response
  const isServerError = error.response?.status >= 500

  if (!isNetworkError && !isServerError) {
    return Promise.reject(error)
  }

  // Don't retry POST/PUT/DELETE for safety (except on network errors)
  const safeMethod = ['get', 'head', 'options'].includes(config.method?.toLowerCase())
  if (!safeMethod && !isNetworkError) {
    return Promise.reject(error)
  }

  // Exponential backoff delay
  const delay = RETRY_DELAY_BASE * Math.pow(2, retryCount)
  await new Promise(resolve => setTimeout(resolve, delay))

  // Retry the request
  config._retryCount = retryCount + 1
  return api.request(config)
}

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Handle errors with retry logic
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Handle 401 errors - unauthorized
    if (error.response?.status === 401 && !originalRequest._isRetry) {
      originalRequest._isRetry = true
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
      return Promise.reject(error)
    }

    // Retry logic for network/server errors
    const retryCount = originalRequest._retryCount || 0
    if (retryCount < MAX_RETRIES) {
      try {
        return await retryRequest(error, retryCount)
      } catch (retryError) {
        return Promise.reject(retryError)
      }
    }

    // Enhance error message for better UX
    if (!error.response) {
      error.userMessage = 'Network error. Please check your internet connection.'
    } else if (error.response.status >= 500) {
      error.userMessage = 'Server error. Please try again later.'
    } else if (error.response.status === 403) {
      error.userMessage = 'Access denied. You do not have permission to perform this action.'
    } else if (error.response.status === 404) {
      error.userMessage = 'The requested resource was not found.'
    } else {
      error.userMessage = error.response.data?.message || 'An error occurred. Please try again.'
    }

    return Promise.reject(error)
  }
)

// Create request cancellation helper
export const createCancelToken = () => {
  const controller = new AbortController()
  return {
    signal: controller.signal,
    cancel: () => controller.abort()
  }
}

export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }),
  refreshToken: () => api.post('/auth/refresh')
}

export const channelsAPI = {
  getAll: (params, signal) => api.get('/channels', { params, signal }),
  getById: (id) => api.get(`/channels/${id}`),
  search: (query, params) => api.get('/search', { params: { q: query, type: 'channels', ...params } })
}

export const videosAPI = {
  getAll: (params, signal) => api.get('/videos', { params, signal }),
  getById: (id) => api.get(`/videos/${id}`),
  search: (query, params) => api.get('/search', { params: { q: query, type: 'videos', ...params } })
}

export const searchAPI = {
  search: (query, params) => api.get('/search', { params: { q: query, ...params } })
}

export const subscriptionsAPI = {
  getPlans: () => api.get('/subscriptions/plans'),
  getMySubscription: () => api.get('/subscriptions/my-subscription')
}

export const paymentsAPI = {
  createCheckout: (planId) => api.post('/payments/create-checkout', { planId })
}

export const usersAPI = {
  updateProfile: (data) => api.put('/users/profile', data),
  changePassword: (data) => api.put('/users/password', data),
  deleteAccount: () => api.delete('/users/account'),
  getActivity: () => api.get('/users/activity')
}

export const favoritesAPI = {
  getAll: () => api.get('/favorites'),
  add: (data) => api.post('/favorites', data),
  remove: (id) => api.delete(`/favorites/${id}`)
}

export const historyAPI = {
  getAll: (params) => api.get('/history', { params }),
  add: (data) => api.post('/history', data),
  clear: () => api.delete('/history')
}

export const adminAPI = {
  getStats: () => api.get('/admin/stats'),
  getUsers: (params) => api.get('/admin/users', { params }),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  getVideos: (params) => api.get('/admin/videos', { params }),
  createVideo: (data) => api.post('/admin/videos', data),
  updateVideo: (id, data) => api.put(`/admin/videos/${id}`, data),
  deleteVideo: (id) => api.delete(`/admin/videos/${id}`),
  getPlans: () => api.get('/subscriptions/plans'),
  createPlan: (data) => api.post('/admin/plans', data),
  updatePlan: (id, data) => api.put(`/admin/plans/${id}`, data),
  deletePlan: (id) => api.delete(`/admin/plans/${id}`),
  createSubscription: (data) => api.post('/admin/subscriptions', data),
  updateSubscription: (id, data) => api.put(`/admin/subscriptions/${id}`, data)
}

export const vodAPI = {
  getStats: () => api.get('/vod/stats'),
  getCollections: () => api.get('/vod/collections'),
  getCollectionStats: () => api.get('/vod/collections/stats'),
  browseCollection: (id, params) => api.get(`/vod/collections/${id}/browse`, { params }),
  search: (params) => api.get('/vod/search', { params }),
  preview: (identifier) => api.get(`/vod/preview/${identifier}`),
  importSingle: (data) => api.post('/vod/import/single', data),
  importBatch: (data) => api.post('/vod/import/batch', data),
  importCollection: (data) => api.post('/vod/import/collection', data),
  getJobs: () => api.get('/vod/import/jobs'),
  getJob: (id) => api.get(`/vod/import/jobs/${id}`),
  deleteVideo: (id) => api.delete(`/vod/videos/${id}`),
  toggleVideo: (id) => api.put(`/vod/videos/${id}/toggle`)
}

export default api
