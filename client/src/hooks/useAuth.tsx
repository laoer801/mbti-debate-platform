import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import type { AuthState, User } from '../types'
import { API_BASE } from '../config'

const API = API_BASE + '/api'

interface AuthContextType extends AuthState {
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>
  register: (username: string, password: string, mbtiType?: string) => Promise<void>
  logout: () => void
  updateProfile: (data: Partial<User>) => Promise<void>
}

const AuthContext = createContext<AuthContextType>(null!)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, token: null, isLoggedIn: false })

  useEffect(() => {
    const token = localStorage.getItem('mbti_token') || sessionStorage.getItem('mbti_token')
    if (token) {
      fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.user) setState({ user: data.user, token, isLoggedIn: true })
        })
        .catch(() => { localStorage.removeItem('mbti_token'); sessionStorage.removeItem('mbti_token') })
    }
  }, [])

  const login = useCallback(async (username: string, password: string, rememberMe?: boolean) => {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
    const data = await res.json()
    if (rememberMe !== false) {
      localStorage.setItem('mbti_token', data.token)
    } else {
      sessionStorage.setItem('mbti_token', data.token)
    }
    setState({ user: data.user, token: data.token, isLoggedIn: true })
  }, [])

  const register = useCallback(async (username: string, password: string, mbtiType?: string) => {
    const res = await fetch(`${API}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, mbtiType }),
    })
    if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
    const data = await res.json()
    localStorage.setItem('mbti_token', data.token)
    setState({ user: data.user, token: data.token, isLoggedIn: true })
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('mbti_token')
    sessionStorage.removeItem('mbti_token')
    setState({ user: null, token: null, isLoggedIn: false })
  }, [])

  const updateProfile = useCallback(async (data: Partial<User>) => {
    if (!state.token) return
    const res = await fetch(`${API}/auth/profile`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${state.token}` },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const result = await res.json()
      setState(prev => ({ ...prev, user: result.user }))
    }
  }, [state.token])

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

/** 读取当前登录 token（localStorage 优先，sessionStorage 兜底）；未登录返回 null */
export function getToken(): string | null {
  try {
    return localStorage.getItem('mbti_token') || sessionStorage.getItem('mbti_token')
  } catch {
    return null
  }
}

export { API }
