import { cn } from '@/lib/cn'

const VARIANTS = {
  default: { bg: 'oklch(28% 0.07 255 / 8%)',  color: 'var(--color-primary)' },
  success: { bg: 'oklch(55% 0.18 145 / 10%)', color: 'oklch(40% 0.18 145)' },
  warning: { bg: 'oklch(75% 0.15 60 / 12%)',  color: 'oklch(50% 0.15 60)' },
  danger:  { bg: 'var(--color-accent-muted)',  color: 'var(--color-accent)' },
  muted:   { bg: 'var(--color-border)',        color: 'var(--color-ink-muted)' },
}

interface BadgeProps {
  children: React.ReactNode
  variant?: keyof typeof VARIANTS
  className?: string
}

export default function Badge({ children, variant = 'default', className }: BadgeProps) {
  const v = VARIANTS[variant]
  return (
    <span
      className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium', className)}
      style={{ backgroundColor: v.bg, color: v.color }}
    >
      {children}
    </span>
  )
}
