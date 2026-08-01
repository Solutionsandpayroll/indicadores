'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { easeOut } from '@/lib/easing'
import { Plus, Trash2, TrendingUp } from 'lucide-react'
import { api } from '@/lib/api'

interface Avance {
  id: number
  fecha: string
  pct_avance: number
  observacion: string | null
  usuarios: { id: number; nombre: string } | null
}

const HOY = () => new Date().toISOString().slice(0, 10)

const inputStyle = {
  border: '1px solid var(--color-border)',
  backgroundColor: 'var(--color-surface)',
  color: 'var(--color-ink)',
}

/** Color de la barra según el nivel de avance. */
function colorAvance(v: number) {
  if (v >= 80) return 'var(--color-success)'
  if (v >= 50) return 'oklch(48% 0.13 240)'
  return 'var(--color-accent)'
}

export default function PanelAvances({ entregableId }: { entregableId: number }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ fecha: HOY(), pct_avance: '', observacion: '' })
  const [error, setError] = useState('')

  const { data: avances = [], isLoading } = useQuery<Avance[]>({
    queryKey: ['entregable-avances', entregableId],
    queryFn: async () => {
      const { data } = await api.get<Avance[]>(`/entregables/${entregableId}/avances`)
      return data
    },
  })

  /** Tras tocar la bitácora, el % del entregable cambia: refrescar la tabla. */
  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['entregable-avances', entregableId] })
    qc.invalidateQueries({ queryKey: ['entregables'] })
    qc.invalidateQueries({ queryKey: ['entregables-resumen'] })
  }

  const crear = useMutation({
    mutationFn: async () => {
      await api.post(`/entregables/${entregableId}/avances`, {
        fecha: form.fecha,
        pct_avance: Number(form.pct_avance),
        observacion: form.observacion || undefined,
      })
    },
    onSuccess: () => {
      invalidar()
      setForm({ fecha: HOY(), pct_avance: '', observacion: '' })
      setError('')
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      setError(e?.response?.data?.message ?? 'No se pudo guardar el avance'),
  })

  const borrar = useMutation({
    mutationFn: (avanceId: number) => api.delete(`/entregables/${entregableId}/avances/${avanceId}`),
    onSuccess: invalidar,
  })

  const pct = Number(form.pct_avance)
  const puedeGuardar = form.pct_avance !== '' && pct >= 0 && pct <= 100 && !!form.fecha

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <TrendingUp size={13} style={{ color: 'var(--color-primary)' }} />
        <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-ink-muted)', letterSpacing: '0.08em' }}>
          Avances registrados
        </h4>
      </div>

      {/* Bitácora */}
      {isLoading ? (
        <p className="text-xs py-2" style={{ color: 'var(--color-ink-subtle)' }}>Cargando avances…</p>
      ) : avances.length === 0 ? (
        <p className="text-xs py-2" style={{ color: 'var(--color-ink-subtle)' }}>
          Todavía no hay avances registrados para este entregable.
        </p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {avances.map((a) => (
            <motion.li
              key={a.id}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: easeOut }}
              className="group grid grid-cols-[auto_auto_1fr_auto] items-center gap-3 rounded-lg px-3 py-2"
              style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              <span className="text-xs tabular-nums" style={{ color: 'var(--color-ink-muted)' }}>
                {a.fecha}
              </span>

              <div className="flex items-center gap-2" style={{ minWidth: 96 }}>
                <div className="h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-border)', width: 52 }}>
                  <div className="h-1.5 rounded-full" style={{ width: `${a.pct_avance}%`, backgroundColor: colorAvance(a.pct_avance) }} />
                </div>
                <span className="text-xs font-semibold tabular-nums" style={{ color: colorAvance(a.pct_avance) }}>
                  {a.pct_avance}%
                </span>
              </div>

              <span className="text-xs truncate" style={{ color: 'var(--color-ink)' }} title={a.observacion ?? ''}>
                {a.observacion || <em style={{ color: 'var(--color-ink-subtle)' }}>Sin observación</em>}
                {a.usuarios && (
                  <span style={{ color: 'var(--color-ink-subtle)' }}> · {a.usuarios.nombre}</span>
                )}
              </span>

              <button
                onClick={() => borrar.mutate(a.id)}
                title="Eliminar avance"
                aria-label="Eliminar avance"
                className="p-1 rounded-md cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100 transition-[opacity,background-color,color] duration-150"
                style={{ color: 'var(--color-ink-subtle)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-accent)'; e.currentTarget.style.backgroundColor = 'var(--color-accent-muted)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-ink-subtle)'; e.currentTarget.style.backgroundColor = 'transparent' }}
              >
                <Trash2 size={12} />
              </button>
            </motion.li>
          ))}
        </ol>
      )}

      {/* Alta de un avance nuevo */}
      <div className="flex flex-wrap items-end gap-2 pt-1">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium" style={{ color: 'var(--color-ink-muted)' }}>Fecha</label>
          <input
            type="date" value={form.fecha}
            onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
            className="h-8 px-2 rounded-lg text-xs outline-none transition-[border-color] duration-150"
            style={inputStyle}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium" style={{ color: 'var(--color-ink-muted)' }}>% Avance</label>
          <input
            type="number" min="0" max="100" step="0.01" placeholder="0"
            value={form.pct_avance}
            onChange={(e) => setForm((f) => ({ ...f, pct_avance: e.target.value }))}
            className="h-8 px-2 rounded-lg text-xs outline-none w-20 tabular-nums transition-[border-color] duration-150"
            style={inputStyle}
          />
        </div>

        <div className="flex flex-col gap-1 flex-1" style={{ minWidth: 180 }}>
          <label className="text-[11px] font-medium" style={{ color: 'var(--color-ink-muted)' }}>Observación</label>
          <input
            type="text" placeholder="Qué se avanzó…"
            value={form.observacion}
            onChange={(e) => setForm((f) => ({ ...f, observacion: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter' && puedeGuardar) crear.mutate() }}
            className="h-8 px-2 rounded-lg text-xs outline-none w-full transition-[border-color] duration-150"
            style={inputStyle}
          />
        </div>

        <button
          onClick={() => crear.mutate()}
          disabled={!puedeGuardar || crear.isPending}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-white text-xs font-medium transition-[transform,background-color] duration-150 ease-out active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          <Plus size={13} />
          {crear.isPending ? 'Guardando…' : 'Agregar'}
        </button>
      </div>

      {error && <p className="text-xs" style={{ color: 'var(--color-accent)' }}>{error}</p>}

      <p className="text-[11px]" style={{ color: 'var(--color-ink-subtle)' }}>
        El % del entregable refleja siempre el avance más reciente por fecha.
      </p>
    </div>
  )
}
