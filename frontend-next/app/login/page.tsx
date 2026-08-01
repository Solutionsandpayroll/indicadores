'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/cn'

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()
  const [usuario, setUsuario] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(usuario, contrasena)
      router.replace('/dashboard')
    } catch {
      setError('Usuario o contraseña incorrectos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      {/* Fondo sutil con gradiente posicionado */}
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden"
        aria-hidden
      >
        <div
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, oklch(28% 0.07 255 / 40%), transparent 70%)' }}
        />
        <div
          className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, oklch(52% 0.22 22 / 35%), transparent 70%)' }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.32, ease: [0.23, 1, 0.32, 1] }}
        className="w-full max-w-sm relative"
      >
        {/* Marca */}
        <div className="mb-10 text-center">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-5 shadow-lg"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="7" height="7" rx="1.5" fill="white" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" fill="white" opacity="0.7" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" fill="white" opacity="0.7" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" fill="var(--color-accent)" />
            </svg>
          </div>
          <h1
            className="text-2xl tracking-tight"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--color-ink)',
            }}
          >
            Sistema de Indicadores
          </h1>
          <p className="text-sm mt-1.5" style={{ color: 'var(--color-ink-muted)', maxWidth: 'unset' }}>
            Inicia sesión para continuar
          </p>
        </div>

        {/* Formulario */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl p-8 flex flex-col gap-5 shadow-sm"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="usuario"
              className="text-sm font-medium"
              style={{ color: 'var(--color-ink)' }}
            >
              Usuario
            </label>
            <input
              id="usuario"
              type="text"
              autoComplete="username"
              autoFocus
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              required
              placeholder="tu_usuario"
              className={cn(
                'h-10 px-3 rounded-lg text-sm outline-none',
                'transition-[border-color,box-shadow] duration-150',
              )}
              style={{
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg)',
                color: 'var(--color-ink)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-primary)'
                e.currentTarget.style.boxShadow = '0 0 0 3px oklch(28% 0.07 255 / 12%)'
                e.currentTarget.style.backgroundColor = 'var(--color-surface)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border)'
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.backgroundColor = 'var(--color-bg)'
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="contrasena"
              className="text-sm font-medium"
              style={{ color: 'var(--color-ink)' }}
            >
              Contraseña
            </label>
            <input
              id="contrasena"
              type="password"
              autoComplete="current-password"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              required
              placeholder="••••••••"
              className={cn(
                'h-10 px-3 rounded-lg text-sm outline-none',
                'transition-[border-color,box-shadow] duration-150',
              )}
              style={{
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg)',
                color: 'var(--color-ink)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-primary)'
                e.currentTarget.style.boxShadow = '0 0 0 3px oklch(28% 0.07 255 / 12%)'
                e.currentTarget.style.backgroundColor = 'var(--color-surface)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border)'
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.backgroundColor = 'var(--color-bg)'
              }}
            />
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
              className="text-sm rounded-lg px-3 py-2.5"
              style={{
                color: 'var(--color-accent)',
                backgroundColor: 'var(--color-accent-muted)',
                border: '1px solid oklch(52% 0.22 22 / 20%)',
              }}
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="h-10 rounded-lg text-white text-sm font-medium mt-1 transition-[transform,opacity] duration-150 ease-out active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
            style={{ backgroundColor: 'var(--color-primary)' }}
            onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-primary)')}
          >
            {loading ? 'Iniciando sesión…' : 'Iniciar sesión'}
          </button>
        </form>
      </motion.div>
    </div>
  )
}
