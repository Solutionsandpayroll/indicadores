'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { easeOut } from '@/lib/easing'
import { SlidersHorizontal, X } from 'lucide-react'

export interface FilterOption { value: string; label: string }

export interface FilterDef {
  key: string
  label: string
  /** Ausente = campo de texto libre. */
  options?: FilterOption[]
  type?: 'select' | 'number' | 'text'
  placeholder?: string
  /** Ancho en columnas del grid (por defecto 1). */
  span?: number
}

interface FilterBarProps {
  filters: FilterDef[]
  values: Record<string, string>
  onChange: (key: string, value: string) => void
  onReset: () => void
  /** Resumen a la derecha del encabezado, p. ej. "24 de 180". */
  summary?: React.ReactNode
}

const controlStyle = {
  border: '1px solid var(--color-border)',
  backgroundColor: 'var(--color-surface)',
  color: 'var(--color-ink)',
}

export default function FilterBar({
  filters, values, onChange, onReset, summary,
}: FilterBarProps) {
  const [open, setOpen] = useState(true)
  const activos = filters.filter((f) => values[f.key]).length

  return (
    <div
      className="rounded-2xl"
      style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <button
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-2 text-sm font-semibold cursor-pointer transition-colors duration-150"
          style={{ color: 'var(--color-ink)' }}
          aria-expanded={open}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'var(--color-primary-muted)', color: 'var(--color-primary)' }}
          >
            <SlidersHorizontal size={14} />
          </div>
          Filtros
          {activos > 0 && (
            <span
              className="px-1.5 py-0.5 rounded-md text-xs font-semibold tabular-nums"
              style={{ backgroundColor: 'var(--color-accent-muted)', color: 'var(--color-accent)' }}
            >
              {activos}
            </span>
          )}
        </button>

        <div className="flex items-center gap-3">
          {summary}
          {activos > 0 && (
            <button
              onClick={onReset}
              className="inline-flex items-center gap-1 text-xs font-medium rounded-lg px-2 py-1 cursor-pointer transition-colors duration-150"
              style={{ color: 'var(--color-ink-muted)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-accent)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-ink-muted)' }}
            >
              <X size={12} /> Limpiar
            </button>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: easeOut }}
            className="overflow-hidden"
          >
            <div
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 px-4 pb-4 pt-1"
              style={{ borderTop: '1px solid var(--color-border)' }}
            >
              {filters.map((f) => (
                <div
                  key={f.key}
                  className="flex flex-col gap-1"
                  style={f.span ? { gridColumn: `span ${f.span}` } : undefined}
                >
                  <label className="text-xs font-medium" style={{ color: 'var(--color-ink-muted)' }}>
                    {f.label}
                  </label>
                  {f.options ? (
                    <select
                      value={values[f.key] ?? ''}
                      onChange={(e) => onChange(f.key, e.target.value)}
                      className="w-full h-9 px-3 rounded-lg text-sm outline-none cursor-pointer transition-[border-color] duration-150"
                      style={controlStyle}
                    >
                      <option value="">Todos</option>
                      {f.options.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={f.type === 'number' ? 'number' : 'text'}
                      value={values[f.key] ?? ''}
                      placeholder={f.placeholder}
                      onChange={(e) => onChange(f.key, e.target.value)}
                      className="w-full h-9 px-3 rounded-lg text-sm outline-none transition-[border-color] duration-150"
                      style={controlStyle}
                    />
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
