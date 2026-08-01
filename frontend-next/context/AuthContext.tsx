'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { api } from '@/lib/api'

interface UsuarioSession {
  id: number
  usuario: string
  nombre: string
  es_admin: boolean
  cargo_id: number
  grupo_id: number | null
}

interface AuthContextValue {
  usuario: UsuarioSession | null
  isAuthenticated: boolean
  login: (usuario: string, contrasena: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function loadSession(): UsuarioSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('usuario')
    return raw ? (JSON.parse(raw) as UsuarioSession) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioSession | null>(loadSession)

  const login = useCallback(async (usuarioStr: string, contrasena: string) => {
    const { data } = await api.post<{ access_token: string; usuario: UsuarioSession }>(
      '/auth/login',
      { usuario: usuarioStr, contrasena },
    )
    localStorage.setItem('token', data.access_token)
    localStorage.setItem('usuario', JSON.stringify(data.usuario))
    setUsuario(data.usuario)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('usuario')
    setUsuario(null)
  }, [])

  return (
    <AuthContext.Provider value={{ usuario, isAuthenticated: !!usuario, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
