'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { easeOut } from '@/lib/easing'
import { CheckCircle2, XCircle, AlertTriangle, X } from 'lucide-react'

type ToastVariant = 'success' | 'error' | 'warning'

interface Toast {
  id: number
  message: string
  variant: ToastVariant
}

interface ToastContextValue {
  success: (msg: string) => void
  error: (msg: string) => void
  warning: (msg: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const add = useCallback((message: string, variant: ToastVariant) => {
    const id = nextId++
    setToasts((prev) => [...prev, { id, message, variant }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const success = useCallback((msg: string) => add(msg, 'success'), [add])
  const error   = useCallback((msg: string) => add(msg, 'error'),   [add])
  const warning = useCallback((msg: string) => add(msg, 'warning'), [add])

  const iconMap: Record<ToastVariant, React.ElementType> = {
    success: CheckCircle2,
    error:   XCircle,
    warning: AlertTriangle,
  }

  const colorMap: Record<ToastVariant, { bg: string; border: string; icon: string }> = {
    success: { bg: 'oklch(56% 0.18 145 / 10%)', border: 'oklch(56% 0.18 145 / 25%)', icon: 'var(--color-success)' },
    error:   { bg: 'oklch(52% 0.22 15 / 10%)',  border: 'oklch(52% 0.22 15 / 25%)',  icon: 'var(--color-accent)' },
    warning: { bg: 'oklch(70% 0.16 65 / 10%)',  border: 'oklch(70% 0.16 65 / 25%)',  icon: 'var(--color-warning)' },
  }

  return (
    <ToastContext.Provider value={{ success, error, warning }}>
      {children}

      <div
        className="fixed bottom-6 right-6 z-[999] flex flex-col-reverse gap-3 pointer-events-none"
        aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const Icon = iconMap[t.variant]
            const c = colorMap[t.variant]
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.22, ease: easeOut }}
                className="pointer-events-auto flex items-start gap-3 pl-4 pr-2 py-3 rounded-2xl shadow-lg backdrop-blur-sm max-w-sm"
                style={{
                  backgroundColor: c.bg,
                  border: `1px solid ${c.border}`,
                  boxShadow: '0 8px 32px oklch(0% 0 0 / 15%)',
                }}
              >
                <Icon size={16} className="shrink-0 mt-0.5" style={{ color: c.icon }} />
                <p className="text-sm flex-1" style={{ color: 'var(--color-ink)', letterSpacing: '-0.02em' }}>
                  {t.message}
                </p>
                <button
                  onClick={() => remove(t.id)}
                  className="p-1 rounded-lg shrink-0 cursor-pointer transition-colors duration-150"
                  style={{ color: 'var(--color-ink-subtle)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-ink)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-ink-subtle)')}
                >
                  <X size={14} />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
