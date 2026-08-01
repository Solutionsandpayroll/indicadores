'use client'

import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: number | string
  icon: LucideIcon
  accent?: boolean
  delay?: number
  loading?: boolean
}

export default function StatCard({ label, value, icon: Icon, accent, delay = 0, loading }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1], delay }}
      className="rounded-2xl p-6 flex items-start gap-4"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{
          backgroundColor: accent ? 'var(--color-accent-muted)' : 'oklch(28% 0.07 255 / 8%)',
          color: accent ? 'var(--color-accent)' : 'var(--color-primary)',
        }}
      >
        <Icon size={20} />
      </div>
      <div className="flex flex-col gap-1 min-w-0">
        <span className="text-sm" style={{ color: 'var(--color-ink-muted)' }}>{label}</span>
        {loading ? (
          <div
            className="h-8 w-16 rounded-md animate-pulse"
            style={{ backgroundColor: 'var(--color-border)' }}
          />
        ) : (
          <span
            className="text-3xl font-bold tracking-tight leading-none"
            style={{
              color: 'var(--color-ink)',
              fontFamily: 'var(--font-display)',
            }}
          >
            {value}
          </span>
        )}
      </div>
    </motion.div>
  )
}
