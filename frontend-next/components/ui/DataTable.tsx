'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { easeOut } from '@/lib/easing'
import { Search, Plus, Pencil, Trash2, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface Column<T> {
  key: keyof T | string
  label: string
  render?: (row: T) => React.ReactNode
}

interface DataTableProps<T extends { id: number }> {
  data: T[]
  columns: Column<T>[]
  loading?: boolean
  onAdd?: () => void
  onEdit?: (row: T) => void
  onDelete?: (row: T) => void
  searchKeys?: (keyof T)[]
  addLabel?: string
  /**
   * Contenido desplegable de cada fila. Si se pasa, aparece una flecha al
   * inicio que expande un panel bajo la fila.
   */
  renderExpanded?: (row: T) => React.ReactNode
  /** Etiqueta accesible del botón de expandir. */
  expandLabel?: string
}

export default function DataTable<T extends { id: number }>({
  data,
  columns,
  loading,
  onAdd,
  onEdit,
  onDelete,
  searchKeys = [],
  addLabel = 'Nuevo',
  renderExpanded,
  expandLabel = 'Ver detalle',
}: DataTableProps<T>) {
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)

  const filtered = search.trim()
    ? data.filter((row) =>
        searchKeys.some((key) =>
          String(row[key] ?? '').toLowerCase().includes(search.toLowerCase()),
        ),
      )
    : data

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-3"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <div className="relative flex-1 max-w-xs">
          <Search
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--color-ink-subtle)' }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar…"
            className="w-full h-8 pl-8 pr-3 text-sm rounded-lg outline-none transition-[border-color,background-color] duration-150"
            style={{
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg)',
              color: 'var(--color-ink)',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-primary)'
              e.currentTarget.style.backgroundColor = 'var(--color-surface)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border)'
              e.currentTarget.style.backgroundColor = 'var(--color-bg)'
            }}
          />
        </div>
        {onAdd && (
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-white text-sm font-medium transition-[transform,background-color] duration-150 ease-out active:scale-[0.97] cursor-pointer"
            style={{ backgroundColor: 'var(--color-primary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-primary)')}
          >
            <Plus size={14} />
            {addLabel}
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
              {renderExpanded && <th className="w-8" />}
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className="text-left px-4 py-2.5 text-xs font-semibold whitespace-nowrap"
                  style={{ color: 'var(--color-ink-muted)' }}
                >
                  {col.label}
                </th>
              ))}
              {(onEdit || onDelete) && (
                <th
                  className="px-4 py-2.5 text-right text-xs font-semibold"
                  style={{ color: 'var(--color-ink-muted)' }}
                >
                  Acciones
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {renderExpanded && <td />}
                  {columns.map((col) => (
                    <td key={String(col.key)} className="px-4 py-3">
                      <div
                        className="h-4 rounded animate-pulse w-24"
                        style={{ backgroundColor: 'var(--color-border)' }}
                      />
                    </td>
                  ))}
                  {(onEdit || onDelete) && <td className="px-4 py-3" />}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (onEdit || onDelete ? 1 : 0) + (renderExpanded ? 1 : 0)}
                  className="px-4 py-10 text-center text-sm"
                  style={{ color: 'var(--color-ink-subtle)' }}
                >
                  {search ? 'Sin resultados para tu búsqueda' : 'No hay registros'}
                </td>
              </tr>
            ) : (
              filtered.flatMap((row, i) => [
                <motion.tr
                  key={row.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15, delay: i * 0.02 }}
                  className="last:border-0 transition-colors duration-100"
                  style={{
                    borderBottom: '1px solid var(--color-border)',
                    color: 'var(--color-ink)',
                    backgroundColor: expanded === row.id ? 'var(--color-bg)' : 'transparent',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = expanded === row.id ? 'var(--color-bg)' : 'transparent')}
                >
                  {renderExpanded && (
                    <td className="pl-3">
                      <button
                        onClick={() => setExpanded((id) => (id === row.id ? null : row.id))}
                        aria-expanded={expanded === row.id}
                        aria-label={expandLabel}
                        title={expandLabel}
                        className="p-1 rounded-lg cursor-pointer transition-colors duration-150 flex items-center"
                        style={{ color: expanded === row.id ? 'var(--color-primary)' : 'var(--color-ink-subtle)' }}
                      >
                        <motion.span
                          animate={{ rotate: expanded === row.id ? 90 : 0 }}
                          transition={{ duration: 0.18, ease: easeOut }}
                          className="flex"
                        >
                          <ChevronRight size={14} />
                        </motion.span>
                      </button>
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={String(col.key)} className="px-4 py-3">
                      {col.render
                        ? col.render(row)
                        : String(row[col.key as keyof T] ?? '—')}
                    </td>
                  ))}
                  {(onEdit || onDelete) && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {onEdit && (
                          <button
                            onClick={() => onEdit(row)}
                            className={cn(
                              'p-1.5 rounded-lg transition-[background-color,color] duration-150 cursor-pointer',
                            )}
                            style={{ color: 'var(--color-ink-muted)' }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = 'var(--color-ink)'
                              e.currentTarget.style.backgroundColor = 'var(--color-border)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = 'var(--color-ink-muted)'
                              e.currentTarget.style.backgroundColor = 'transparent'
                            }}
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={() => onDelete(row)}
                            className="p-1.5 rounded-lg transition-[background-color,color] duration-150 cursor-pointer"
                            style={{ color: 'var(--color-ink-muted)' }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = 'var(--color-accent)'
                              e.currentTarget.style.backgroundColor = 'var(--color-accent-muted)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = 'var(--color-ink-muted)'
                              e.currentTarget.style.backgroundColor = 'transparent'
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </motion.tr>,

                // Panel desplegable de la fila
                renderExpanded ? (
                  <AnimatePresence key={`${row.id}-exp`} initial={false}>
                    {expanded === row.id && (
                      <motion.tr
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        style={{ borderBottom: '1px solid var(--color-border)' }}
                      >
                        <td
                          colSpan={columns.length + (onEdit || onDelete ? 1 : 0) + 1}
                          className="p-0"
                          style={{ backgroundColor: 'var(--color-bg)' }}
                        >
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            transition={{ duration: 0.22, ease: easeOut }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 py-4">{renderExpanded(row)}</div>
                          </motion.div>
                        </td>
                      </motion.tr>
                    )}
                  </AnimatePresence>
                ) : null,
              ])
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
