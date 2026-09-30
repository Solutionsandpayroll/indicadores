'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Building2, ArrowLeft, Package, CheckCircle2, Clock, Plus,
  ClipboardList, Users, BarChart2, ChevronRight,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { easeOut } from '@/lib/easing'

interface ClienteCard {
  id: number; cliente: string; grupo_id: number
  pct_puntualidad: number | null; pct_exactitud: number | null
  puntualidad_actual: number | null; exactitud_actual: number | null
  pendientes: number; total: number
  grupos?: { nombre: string } | null
}

interface EntregableRow {
  id: number; mes: number; anio: number; pct_avance: number | null
  pct_cumple: number | null; resultado: string | null
  resultado_cantidad: number | null; aprobado: boolean
  estatus?: { id: number; descripcion: string } | null
  indicadores?: { id: number; nombre: string } | null
  entregable_tipos?: { id: number; nombre: string } | null
  responsable?: { id: number; nombre: string; usuario: string } | null
}

interface ResumenCliente {
  resumen: {
    total: number; terminados: number; pendientes: number
    aprobados: number; pct_cumple_promedio: number | null
    meta_puntualidad: number | null; meta_exactitud: number | null
    puntualidad_promedio: number | null; exactitud_promedio: number | null
  }
  analistas: { id: number; nombre: string; usuario: string }[]
  indicadores: { id: number; nombre: string }[]
  entregables: EntregableRow[]
}

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function Bar({ pct }: { pct: number | null }) {
  const v = pct ?? 0
  const color = v >= 80 ? 'oklch(56% 0.18 145)' : v >= 50 ? 'oklch(48% 0.13 240)' : 'oklch(52% 0.22 15)'
  return (
    <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'oklch(100% 0 0 / 10%)' }}>
      <div className="h-full rounded-full" style={{ width: `${v}%`, backgroundColor: color }} />
    </div>
  )
}

function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' }) {
  const colors: Record<string, string> = {
    default: 'oklch(60% 0.02 252)', success: 'oklch(56% 0.18 145)',
    warning: 'oklch(70% 0.16 65)', danger: 'oklch(52% 0.22 15)', info: 'oklch(48% 0.13 240)',
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold text-white whitespace-nowrap" style={{ backgroundColor: colors[variant] }}>
      {children}
    </span>
  )
}

export default function MisClientesPage() {
  const { usuario } = useAuth()
  const router = useRouter()
  const [selected, setSelected] = useState<ClienteCard | null>(null)
  const [entPage, setEntPage] = useState(1)
  const ENT_PAGE_SIZE = 30

  const isLider = usuario?.rol === 'Lider'
  const isAnalista = usuario?.rol === 'Analista'

  const { data: clientes = [], isLoading } = useQuery<ClienteCard[]>({
    queryKey: ['mis-clientes', usuario?.id],
    queryFn: async () => { const { data } = await api.get<ClienteCard[]>('/clientes/mis-clientes'); return data },
    enabled: !!usuario,
  })

  const { data: detalle, isLoading: loadingDetalle } = useQuery<ResumenCliente>({
    queryKey: ['mis-clientes-detalle', selected?.id, usuario?.id],
    queryFn: async () => { const { data } = await api.get<ResumenCliente>(`/clientes/mis-clientes/resumen?cliente_id=${selected!.id}`); return data },
    enabled: !!selected,
  })

  if (!usuario || (!isLider && !isAnalista)) return null

  // ============ VISTA LISTA DE CLIENTES ============
  if (!selected) {
    return (
      <div className="max-w-6xl">
        <div className="mb-6">
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-ink)', letterSpacing: '-0.03em' }}>Mis Clientes</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--color-ink-muted)' }}>
            {isLider ? 'Clientes bajo tu responsabilidad' : 'Clientes con los que trabajas'}
          </p>
        </div>

        {isLoading ? (
          <p className="text-xs text-center py-12" style={{ color: 'var(--color-ink-muted)' }}>Cargando...</p>
        ) : clientes.length === 0 ? (
          <div className="text-center py-16 rounded-xl" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <Building2 size={28} className="mx-auto mb-3" style={{ color: 'var(--color-ink-muted)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>No tienes clientes asignados</p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-ink-muted)' }}>
              Cuando te asignen entregables, los clientes aparecerán aquí
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {clientes.map((c, i) => (
              <motion.button
                key={c.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.04, ease: easeOut }}
                onClick={() => { setSelected(c); setEntPage(1) }}
                className="text-left rounded-xl p-4 cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
                style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
              >
                <div className="flex items-start justify-between">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: 'var(--color-primary-muted)', color: 'var(--color-primary)' }}>
                    <Building2 size={16} />
                  </div>
                  <ChevronRight size={14} style={{ color: 'var(--color-ink-muted)' }} />
                </div>
                <p className="text-xs font-semibold mt-3 leading-snug" style={{ color: 'var(--color-ink)' }}>{c.cliente}</p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>{c.grupos?.nombre ?? '—'}</p>

                {/* Métricas resumidas */}
                <div className="mt-3 space-y-1.5 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
                  <div className="flex items-center justify-between text-[10px]">
                    <span style={{ color: 'var(--color-ink-muted)' }}>Puntualidad</span>
                    <span className="font-semibold" style={{ color: c.puntualidad_actual != null && c.pct_puntualidad != null && c.puntualidad_actual >= c.pct_puntualidad ? 'oklch(56% 0.18 145)' : 'var(--color-ink)' }}>
                      {c.puntualidad_actual != null ? `${c.puntualidad_actual}%` : '—'}
                      <span className="font-normal" style={{ color: 'var(--color-ink-muted)' }}> / {c.pct_puntualidad ?? '—'}%</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span style={{ color: 'var(--color-ink-muted)' }}>Exactitud</span>
                    <span className="font-semibold" style={{ color: c.exactitud_actual != null && c.pct_exactitud != null && c.exactitud_actual >= c.pct_exactitud ? 'oklch(56% 0.18 145)' : 'var(--color-ink)' }}>
                      {c.exactitud_actual != null ? `${c.exactitud_actual}%` : '—'}
                      <span className="font-normal" style={{ color: 'var(--color-ink-muted)' }}> / {c.pct_exactitud ?? '—'}%</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span style={{ color: 'var(--color-ink-muted)' }}>Pendientes</span>
                    <span className="font-semibold" style={{ color: c.pendientes > 0 ? 'oklch(70% 0.16 65)' : 'var(--color-ink)' }}>{c.pendientes}</span>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ============ VISTA DETALLE DE CLIENTE ============
  const r = detalle?.resumen
  const irAEntregables = (extra: Record<string, string> = {}) => {
    const p = new URLSearchParams({ cliente_id: String(selected.id), ...extra })
    router.push(`/dashboard/entregables?${p.toString()}`)
  }

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setSelected(null)}
          className="p-2 rounded-lg cursor-pointer transition-colors"
          style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-ink-muted)' }}>
          <ArrowLeft size={14} />
        </button>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-ink)', letterSpacing: '-0.03em' }}>{selected.cliente}</h1>
          <p className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>{selected.grupos?.nombre ?? ''}</p>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Entregables', value: r?.total ?? '—', icon: Package },
          { label: 'Pendientes', value: r?.pendientes ?? '—', icon: Clock },
          { label: 'Aprobados', value: r?.aprobados ?? '—', icon: CheckCircle2 },
          { label: '% Cumple prom.', value: r?.pct_cumple_promedio != null ? `${r.pct_cumple_promedio}%` : '—', icon: BarChart2 },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center gap-1.5 mb-1">
              <Icon size={11} style={{ color: 'var(--color-ink-muted)' }} />
              <span className="text-[9px] uppercase font-semibold tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>{label}</span>
            </div>
            <p className="text-lg font-bold" style={{ color: 'var(--color-ink)' }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Metas del cliente vs actual */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          { label: 'Puntualidad', actual: r?.puntualidad_promedio ?? null, meta: r?.meta_puntualidad ?? null },
          { label: 'Exactitud', actual: r?.exactitud_promedio ?? null, meta: r?.meta_exactitud ?? null },
        ].map(({ label, actual, meta }) => {
          const cumple = actual != null && meta != null && actual >= meta
          return (
            <div key={label} className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>{label}</span>
                {meta != null && actual != null && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold text-white"
                    style={{ backgroundColor: cumple ? 'oklch(56% 0.18 145)' : 'oklch(52% 0.22 15)' }}>
                    {cumple ? 'Cumple meta' : 'Bajo meta'}
                  </span>
                )}
              </div>
              <div className="flex items-end gap-3">
                <div>
                  <p className="text-[9px]" style={{ color: 'var(--color-ink-muted)' }}>Actual</p>
                  <p className="text-xl font-bold" style={{ color: 'var(--color-ink)' }}>{actual != null ? `${actual}%` : '—'}</p>
                </div>
                <div>
                  <p className="text-[9px]" style={{ color: 'var(--color-ink-muted)' }}>Meta</p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-ink-muted)' }}>{meta != null ? `${meta}%` : '—'}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Líder: analistas e indicadores */}
      {isLider && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Users size={12} style={{ color: 'var(--color-ink-muted)' }} />
              <h3 className="text-xs font-semibold" style={{ color: 'var(--color-ink)' }}>Analistas asociados</h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {detalle?.analistas.length ? detalle.analistas.map((a) => (
                <span key={a.id} className="px-2 py-1 rounded-md text-[10px] font-medium"
                  style={{ backgroundColor: 'var(--color-primary-muted)', color: 'var(--color-primary)' }}>
                  {a.nombre}
                </span>
              )) : <p className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>Sin analistas</p>}
            </div>
          </div>
          <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center gap-2 mb-3">
              <BarChart2 size={12} style={{ color: 'var(--color-ink-muted)' }} />
              <h3 className="text-xs font-semibold" style={{ color: 'var(--color-ink)' }}>Indicadores</h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {detalle?.indicadores.length ? detalle.indicadores.map((i) => (
                <span key={i.id} className="px-2 py-1 rounded-md text-[10px] font-medium"
                  style={{ backgroundColor: 'oklch(48% 0.13 240 / 12%)', color: 'oklch(48% 0.13 240)' }}>
                  {i.nombre}
                </span>
              )) : <p className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>Sin indicadores</p>}
            </div>
          </div>
        </div>
      )}

      {/* Entregables */}
      <div className="rounded-xl overflow-hidden mb-6" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div className="px-4 py-3 flex items-center justify-between gap-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-2">
            <Package size={12} style={{ color: 'var(--color-ink-muted)' }} />
            <h3 className="text-xs font-semibold" style={{ color: 'var(--color-ink)' }}>
              {isAnalista ? 'Mis entregables' : 'Entregables del cliente'}
            </h3>
          </div>
          {isLider && (
            <div className="flex items-center gap-2">
              <button onClick={() => irAEntregables()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white cursor-pointer transition-colors hover:opacity-90"
                style={{ backgroundColor: 'var(--color-accent)' }}>
                <Plus size={12} /> Crear entregable
              </button>
              <button onClick={() => irAEntregables()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                style={{ backgroundColor: 'oklch(100% 0 0 / 5%)', border: '1px solid var(--color-border)', color: 'var(--color-ink)' }}>
                <Package size={12} /> Gestionar
              </button>
            </div>
          )}
        </div>
        {loadingDetalle ? (
          <p className="text-xs text-center py-8" style={{ color: 'var(--color-ink-muted)' }}>Cargando...</p>
        ) : !detalle?.entregables.length ? (
          <p className="text-xs text-center py-8" style={{ color: 'var(--color-ink-muted)' }}>Sin entregables</p>
        ) : (() => {
          const total = detalle.entregables.length
          const totalPages = Math.max(1, Math.ceil(total / ENT_PAGE_SIZE))
          const page = Math.min(entPage, totalPages)
          const filas = detalle.entregables.slice((page - 1) * ENT_PAGE_SIZE, page * ENT_PAGE_SIZE)
          return (
            <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ backgroundColor: 'oklch(100% 0 0 / 3%)' }}>
                  <th className="text-left px-4 py-2.5 font-semibold text-[10px] uppercase" style={{ color: 'var(--color-ink-muted)' }}>Período</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-[10px] uppercase" style={{ color: 'var(--color-ink-muted)' }}>Tipo</th>
                  {isLider && <th className="text-left px-4 py-2.5 font-semibold text-[10px] uppercase" style={{ color: 'var(--color-ink-muted)' }}>Responsable</th>}
                  <th className="text-left px-4 py-2.5 font-semibold text-[10px] uppercase" style={{ color: 'var(--color-ink-muted)' }}>Estatus</th>
                  <th className="text-center px-4 py-2.5 font-semibold text-[10px] uppercase" style={{ color: 'var(--color-ink-muted)' }}>Avance</th>
                  <th className="text-center px-4 py-2.5 font-semibold text-[10px] uppercase" style={{ color: 'var(--color-ink-muted)' }}>% Cumple</th>
                  <th className="text-center px-4 py-2.5 font-semibold text-[10px] uppercase" style={{ color: 'var(--color-ink-muted)' }}>Aprobado</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((e) => (
                  <tr key={e.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="px-4 py-2.5 font-medium whitespace-nowrap" style={{ color: 'var(--color-ink)' }}>
                      {MESES[e.mes - 1]} {e.anio}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--color-ink-muted)' }}>
                      <p className="font-medium" style={{ color: 'var(--color-ink)' }}>{e.entregable_tipos?.nombre ?? '—'}</p>
                      <p className="text-[10px]">{e.indicadores?.nombre ?? ''}</p>
                    </td>
                    {isLider && <td className="px-4 py-2.5" style={{ color: 'var(--color-ink-muted)' }}>{e.responsable?.nombre ?? '—'}</td>}
                    <td className="px-4 py-2.5"><Badge variant={e.aprobado ? 'success' : 'info'}>{e.estatus?.descripcion ?? '—'}</Badge></td>
                    <td className="px-4 py-2.5"><div className="flex items-center justify-center gap-2"><Bar pct={e.pct_avance} /><span style={{ color: 'var(--color-ink-muted)' }}>{e.pct_avance ?? 0}%</span></div></td>
                    <td className="px-4 py-2.5 text-center" style={{ color: 'var(--color-ink)' }}>{e.pct_cumple != null ? `${e.pct_cumple}%` : '—'}</td>
                    <td className="px-4 py-2.5 text-center">
                      {e.aprobado ? <CheckCircle2 size={13} style={{ color: 'oklch(56% 0.18 145)' }} className="mx-auto" /> : <span style={{ color: 'var(--color-ink-muted)' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > ENT_PAGE_SIZE && (
            <div className="flex items-center justify-between px-4 py-2.5" style={{ borderTop: '1px solid var(--color-border)' }}>
              <span className="text-xs tabular-nums" style={{ color: 'var(--color-ink-muted)' }}>
                {(page - 1) * ENT_PAGE_SIZE + 1}–{Math.min(page * ENT_PAGE_SIZE, total)} de {total}
              </span>
              <div className="flex items-center gap-2">
                <button onClick={() => setEntPage(page - 1)} disabled={page <= 1}
                  className="px-2 py-1 rounded-md text-xs cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ color: 'var(--color-ink-muted)' }}>‹ Anterior</button>
                <span className="text-xs tabular-nums" style={{ color: 'var(--color-ink)' }}>{page} / {totalPages}</span>
                <button onClick={() => setEntPage(page + 1)} disabled={page >= totalPages}
                  className="px-2 py-1 rounded-md text-xs cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ color: 'var(--color-ink-muted)' }}>Siguiente ›</button>
              </div>
            </div>
          )}
            </>
          )
        })()}
      </div>

      {/* Acciones */}
      {isAnalista && (
        <div className="flex gap-2">
          <button onClick={() => irAEntregables({ usuario_id: String(usuario.id) })}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium text-white cursor-pointer transition-colors hover:opacity-90"
            style={{ backgroundColor: 'var(--color-accent)' }}>
            <ClipboardList size={13} /> Registrar avances
          </button>
        </div>
      )}
    </div>
  )
}
