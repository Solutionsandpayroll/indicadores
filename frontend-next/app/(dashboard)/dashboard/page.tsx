'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ClipboardList, Clock, CheckCircle2, Package, ChevronRight, AlertTriangle,
} from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { api } from '@/lib/api'
import { easeOut } from '@/lib/easing'
import { useAuth } from '@/context/AuthContext'

interface Resumen {
  total: number; terminados: number; aprobados: number; pendientes: number
  a_tiempo: number; con_retraso: number
  pct_cumple_promedio: number | null
  puntualidad_promedio: number | null
  exactitud_promedio: number | null
}

interface ResumenCliente {
  cliente_id: number; cliente: string
  total: number; pendientes: number; terminados: number; aprobados: number
}

interface ResumenResponsable {
  usuario_id: number; responsable: string
  total: number; pendientes: number; aprobados: number
}

interface Pendiente {
  id: number; cliente_id: number; fecha_compromiso: string | null
  clientes?: { cliente: string } | null
  entregable_tipos?: { id: number; nombre: string } | null
}

interface Estatus { id: number; descripcion: string }

const AHORA = new Date()
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const ANIOS = Array.from({ length: AHORA.getFullYear() - 2021 + 1 }, (_, i) => AHORA.getFullYear() - i)

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } }
const cardAnim = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: easeOut } },
}

function StatCard({
  label, value, sub, icon: Icon, color, onClick, loading,
}: {
  label: string; value: number; sub: string; icon: React.ElementType
  color: string; onClick: () => void; loading: boolean
}) {
  return (
    <motion.button
      variants={cardAnim}
      onClick={onClick}
      className="text-left rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
      style={{
        backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
        boxShadow: '0 1px 3px oklch(0% 0 0 / 6%)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}22`, color }}>
          <Icon size={16} />
        </div>
        <ChevronRight size={14} style={{ color: 'var(--color-ink-subtle)' }} />
      </div>
      {loading ? (
        <div className="h-9 w-16 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--color-border)' }} />
      ) : (
        <p className="text-3xl font-bold tracking-tight" style={{ color: 'var(--color-ink)', letterSpacing: '-0.05em' }}>{value}</p>
      )}
      <p className="text-xs font-medium mt-1" style={{ color: 'var(--color-ink-muted)' }}>{label}</p>
      <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-ink-subtle)' }}>{sub}</p>
    </motion.button>
  )
}

export default function HomePage() {
  const { usuario } = useAuth()
  const router = useRouter()
  const isAnalista = usuario?.rol === 'Analista'

  const [anio, setAnio] = useState(AHORA.getFullYear())
  const [mes, setMes] = useState('')

  const qs = mes ? `anio=${anio}&mes=${mes}` : `anio=${anio}`
  const periodoLabel = mes ? `${MESES[Number(mes) - 1]} ${anio}` : `Año ${anio}`

  const { data: resumen, isLoading } = useQuery<Resumen>({
    queryKey: ['home-resumen', qs],
    queryFn: async () => { const { data } = await api.get<Resumen>(`/entregables/resumen?${qs}`); return data },
  })

  const { data: porCliente = [] } = useQuery<ResumenCliente[]>({
    queryKey: ['home-resumen-cliente', qs],
    queryFn: async () => { const { data } = await api.get<ResumenCliente[]>(`/entregables/resumen-por-cliente?${qs}`); return data },
  })

  const { data: estatusList = [] } = useQuery<Estatus[]>({
    queryKey: ['estatus'],
    queryFn: async () => { const { data } = await api.get<Estatus[]>('/estatus'); return data },
  })
  const idEstatus = (nombre: string) =>
    estatusList.find((e) => e.descripcion.trim().toUpperCase() === nombre)?.id

  const isLider = usuario?.rol === 'Lider'
  const idAsignado = idEstatus('ASIGNADO')

  const { data: pendientesRaw = [] } = useQuery<Pendiente[]>({
    queryKey: ['home-pendientes', qs, idAsignado],
    enabled: !!idAsignado,
    queryFn: async () => { const { data } = await api.get<Pendiente[]>(`/entregables/buscar?${qs}&estatus_id=${idAsignado}`); return data },
  })

  const { data: porResponsable = [] } = useQuery<ResumenResponsable[]>({
    queryKey: ['home-resumen-responsable', qs],
    enabled: isLider,
    queryFn: async () => { const { data } = await api.get<ResumenResponsable[]>(`/entregables/resumen-por-responsable?${qs}`); return data },
  })

  const r = resumen ?? { total: 0, terminados: 0, aprobados: 0, pendientes: 0, a_tiempo: 0, con_retraso: 0, pct_cumple_promedio: null, puntualidad_promedio: null, exactitud_promedio: null }
  const terminadosSinAprobar = Math.max(0, r.terminados - r.aprobados)
  const pctAvance = r.total > 0 ? Math.round((r.aprobados / r.total) * 100) : 0

  const HOY = new Date().toISOString().slice(0, 10)
  const listaPendientes = [...pendientesRaw].sort((a, b) => {
    if (!a.fecha_compromiso && !b.fecha_compromiso) return 0
    if (!a.fecha_compromiso) return 1
    if (!b.fecha_compromiso) return -1
    return a.fecha_compromiso.localeCompare(b.fecha_compromiso)
  }).slice(0, 8)

  const irA = (extra: Record<string, string> = {}) => {
    const p = new URLSearchParams({ anio: String(anio), ...(mes ? { mes } : {}), ...extra })
    router.push(`/dashboard/entregables?${p.toString()}`)
  }

  const cards: {
    label: string; value: number; sub: string; icon: React.ElementType
    color: string; extra: Record<string, string>
  }[] = [
    { label: 'Pendientes', value: r.pendientes, sub: 'sin resultado registrado', icon: Clock, color: 'oklch(70% 0.16 65)', extra: idEstatus('ASIGNADO') ? { estatus_id: String(idEstatus('ASIGNADO')) } : {} },
    { label: 'Terminados', value: r.terminados, sub: `a tiempo: ${r.a_tiempo} · con retraso: ${r.con_retraso}`, icon: CheckCircle2, color: 'oklch(48% 0.13 240)', extra: idEstatus('TERMINADO') ? { estatus_id: String(idEstatus('TERMINADO')) } : {} },
    { label: 'Aprobados', value: r.aprobados, sub: 'verificados por el líder', icon: ClipboardList, color: 'oklch(56% 0.18 145)', extra: { aprobado: 'true' } },
    { label: 'Total del período', value: r.total, sub: periodoLabel, icon: Package, color: 'var(--color-primary)', extra: {} },
  ]
  const ordenCards = isAnalista
    ? [cards[0], cards[1], cards[2], cards[3]]
    : [cards[3], cards[0], cards[1], cards[2]]

  const donutData = [
    { name: 'Pendientes', value: r.pendientes, fill: 'oklch(70% 0.16 65)' },
    { name: 'Terminados', value: terminadosSinAprobar, fill: 'oklch(48% 0.13 240)' },
    { name: 'Aprobados', value: r.aprobados, fill: 'oklch(56% 0.18 145)' },
  ].filter((d) => d.value > 0)

  const topClientes = porCliente.slice(0, 10)
  const maxTotal = Math.max(1, ...topClientes.map((c) => c.total))

  const firstName = usuario?.nombre?.split(' ')[0] ?? 'Usuario'

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header + selector de período */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-ink)', letterSpacing: '-0.05em' }}>{firstName}</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--color-ink-muted)' }}>
            Resumen de entregables · {periodoLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={anio} onChange={(e) => setAnio(Number(e.target.value))}
            className="px-3 py-1.5 rounded-lg text-xs outline-none cursor-pointer"
            style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-ink)' }}>
            {ANIOS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={mes} onChange={(e) => setMes(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs outline-none cursor-pointer"
            style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-ink)' }}>
            <option value="">Todos los meses</option>
            {MESES.map((m, i) => <option key={i} value={String(i + 1)}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* KPI cards */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {ordenCards.map((c) => (
          <StatCard key={c.label} label={c.label} value={c.value} sub={c.sub} icon={c.icon} color={c.color} loading={isLoading}
            onClick={() => irA(c.extra)} />
        ))}
      </motion.div>

      {/* Barra de avance del período */}
      <div className="rounded-2xl px-5 py-4 flex items-center gap-4" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <span className="text-sm font-bold" style={{ color: 'var(--color-ink)' }}>{pctAvance}%</span>
        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
          <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${pctAvance}%` }}
            transition={{ duration: 0.6, ease: easeOut }} style={{ backgroundColor: 'oklch(56% 0.18 145)' }} />
        </div>
        <span className="text-[11px] whitespace-nowrap" style={{ color: 'var(--color-ink-muted)' }}>
          aprobados ({r.aprobados}/{r.total}) · {periodoLabel}
        </span>
      </div>

      {/* Pendientes + equipo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: easeOut }}
          className={`rounded-2xl p-5 ${isLider ? 'lg:col-span-2' : 'lg:col-span-3'}`}
          style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-ink-muted)' }}>
            {isAnalista || isLider ? 'Tus pendientes' : 'Pendientes del período'} · ordenados por fecha límite
          </h3>
          {listaPendientes.length === 0 ? (
            <p className="text-xs py-6 text-center" style={{ color: 'var(--color-ink-subtle)' }}>Sin pendientes en este período ✓</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {listaPendientes.map((p) => {
                const vencida = !!p.fecha_compromiso && p.fecha_compromiso < HOY
                const fecha = p.fecha_compromiso ? `${p.fecha_compromiso.slice(8, 10)}/${p.fecha_compromiso.slice(5, 7)}` : 'sin fecha'
                return (
                  <button key={p.id} onClick={() => irA({ cliente_id: String(p.cliente_id) })}
                    className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left cursor-pointer hover:bg-white/5 transition-colors">
                    <span className="min-w-0">
                      <span className="block text-[11px] font-medium truncate" style={{ color: 'var(--color-ink)' }}>
                        {p.entregable_tipos?.nombre ?? 'Entregable'}
                      </span>
                      <span className="block text-[10px] truncate" style={{ color: 'var(--color-ink-subtle)' }}>{p.clientes?.cliente ?? ''}</span>
                    </span>
                    <span className="text-[10px] font-semibold whitespace-nowrap"
                      style={{ color: vencida ? 'oklch(52% 0.22 15)' : 'var(--color-ink-muted)' }}>
                      {vencida ? `Vencido · ${fecha}` : fecha}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </motion.div>

        {isLider && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.08, ease: easeOut }}
            className="rounded-2xl p-5" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-ink-muted)' }}>
              Pendientes por analista
            </h3>
            {porResponsable.filter((x) => x.pendientes > 0).length === 0 ? (
              <p className="text-xs py-6 text-center" style={{ color: 'var(--color-ink-subtle)' }}>El equipo está al día ✓</p>
            ) : (
              <div className="space-y-1.5">
                {porResponsable.filter((x) => x.pendientes > 0).slice(0, 8).map((x) => (
                  <button key={x.usuario_id} onClick={() => irA({ usuario_id: String(x.usuario_id) })}
                    className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-left cursor-pointer hover:bg-white/5 transition-colors">
                    <span className="text-[11px] font-medium truncate" style={{ color: 'var(--color-ink)' }}>{x.responsable}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
                      style={{ backgroundColor: 'oklch(70% 0.16 65 / 15%)', color: 'oklch(70% 0.16 65)' }}>
                      {x.pendientes} pend.
                    </span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>

      {r.total === 0 && !isLoading && (
        <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <AlertTriangle size={24} className="mx-auto mb-2" style={{ color: 'var(--color-ink-muted)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>No hay entregables en este período</p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-ink-muted)' }}>
            Probá con otro año/mes o <button className="underline cursor-pointer" onClick={() => { setAnio(AHORA.getFullYear()); setMes('') }}>ver todo el año {AHORA.getFullYear()}</button>
          </p>
        </div>
      )}

      {/* Donut + promedios | clientes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: easeOut }}
          className="rounded-2xl p-5" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-ink-muted)' }}>Distribución del período</h3>
          <div className="flex items-center gap-4">
            <div className="w-40 h-40 shrink-0">
              {donutData.length > 0 && (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2} strokeWidth={0}>
                      {donutData.map((d) => <Cell key={d.name} fill={d.fill} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="space-y-2 flex-1">
              {donutData.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2" style={{ color: 'var(--color-ink-muted)' }}>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.fill }} />{d.name}
                  </span>
                  <span className="font-semibold" style={{ color: 'var(--color-ink)' }}>{d.value}</span>
                </div>
              ))}
              <div className="pt-2 mt-2 space-y-1" style={{ borderTop: '1px solid var(--color-border)' }}>
                {([['Cumplimiento', r.pct_cumple_promedio], ['Puntualidad', r.puntualidad_promedio], ['Exactitud', r.exactitud_promedio]] as const).map(([label, v]) => (
                  <div key={label} className="flex items-center justify-between text-[11px]">
                    <span style={{ color: 'var(--color-ink-subtle)' }}>{label} promedio</span>
                    <span className="font-semibold" style={{ color: 'var(--color-ink)' }}>{v != null ? `${v}%` : '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.08, ease: easeOut }}
          className="rounded-2xl p-5" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-ink-muted)' }}>
            Entregables por cliente {isAnalista ? '(los tuyos)' : '(top 10)'}
          </h3>
          {topClientes.length === 0 ? (
            <p className="text-xs py-8 text-center" style={{ color: 'var(--color-ink-subtle)' }}>Sin datos en este período</p>
          ) : (
            <div className="space-y-2.5">
              {topClientes.map((c) => (
                <button key={c.cliente_id} onClick={() => irA({ cliente_id: String(c.cliente_id) })}
                  className="w-full text-left group">
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-medium truncate group-hover:underline" style={{ color: 'var(--color-ink)' }}>{c.cliente}</span>
                    <span style={{ color: 'var(--color-ink-muted)' }}>
                      {c.total}
                      {c.pendientes > 0 && <span className="ml-2 font-semibold" style={{ color: 'oklch(70% 0.16 65)' }}>{c.pendientes} pend.</span>}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden flex" style={{ backgroundColor: 'var(--color-border)' }}>
                    <div className="h-full" style={{ width: `${(c.aprobados / maxTotal) * 100}%`, backgroundColor: 'oklch(56% 0.18 145)' }} />
                    <div className="h-full" style={{ width: `${(Math.max(0, c.terminados - c.aprobados) / maxTotal) * 100}%`, backgroundColor: 'oklch(48% 0.13 240)' }} />
                    <div className="h-full" style={{ width: `${(c.pendientes / maxTotal) * 100}%`, backgroundColor: 'oklch(70% 0.16 65)' }} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
