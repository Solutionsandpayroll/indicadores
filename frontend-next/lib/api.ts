import axios from 'axios'

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL + '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const isLoginRequest = err.config?.url?.includes('/auth/login')
      if (typeof window !== 'undefined' && !isLoginRequest) {
        localStorage.removeItem('token')
        localStorage.removeItem('usuario')
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  },
)
