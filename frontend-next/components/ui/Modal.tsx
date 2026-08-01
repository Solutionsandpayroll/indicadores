'use client'

import { useEffect, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { easeOut } from '@/lib/easing'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

const SIZE = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl' }

export default function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/25"
            style={{ zIndex: 'var(--z-modal-bg)' }}
          />
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.22, ease: easeOut }}
            className={`fixed inset-x-0 top-1/2 -translate-y-1/2 mx-auto w-[calc(100%-2rem)] ${SIZE[size]}`}
            style={{ zIndex: 'var(--z-modal)', transformOrigin: 'center' }}
          >
            <div
              className="rounded-2xl shadow-xl overflow-hidden"
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
              }}
            >
              <div
                className="flex items-center justify-between px-6 py-4"
                style={{ borderBottom: '1px solid var(--color-border)' }}
              >
                <h2
                  className="text-[15px] font-semibold"
                  style={{ color: 'var(--color-ink)' }}
                >
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg transition-[background-color,color] duration-150 cursor-pointer"
                  style={{ color: 'var(--color-ink-subtle)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--color-ink)'
                    e.currentTarget.style.backgroundColor = 'var(--color-border)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--color-ink-subtle)'
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  <X size={16} />
                </button>
              </div>
              <div className="px-6 py-5">{children}</div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
