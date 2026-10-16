'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { easeOut } from '@/lib/easing'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts'
import {
  Package, PieChart as PieIcon, BarChart2, ClipboardCheck, History,
  CalendarClock, TrendingUp, AlertTriangle, CheckCircle2,
} from 'lucide-react'
import { api } from '@/lib/api'
import DataTable, { type Column } from '@/components/ui/DataTable'
import FilterBar, { type FilterDef } from '@/components/ui/FilterBar'
import Modal from '@/components/ui/Modal'
import FormField from '@/components/ui/FormField'
import Badge from '@/components/ui/Badge'
import ModalActions from '@/components/ui/ModalActions'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/context/AuthContext'

interface Cliente { id: number; cliente: string; fecha: string | null; pct_exactitud: number | null }
interface Estatus { id: number; descripcion: string }
interface Indicador { id: number; nombre: string; es_sistema: boolean }
interface EntregableTipo { id: number; nombre: string; indicador_id: number; orden: number; cliente_id: number | null; mostrar: boolean; activo: boolean }
interface Usuario { id: number; nombre: string; usuario: string; rol: string }

interface EntregableError {
  id: number; tipo: 'interno' | 'cliente'; descripcion: string
  correccion: string | null; entregable_id: number
  autor?: { id: number; nombre: string } | null
}

interface Entregable {
  id: number; mes: number; anio: number; cliente_id: number
  lider_id: number | null; estatus_id: number; usuario_id: number | null
  comentarios: string | null
  indicador_id: number; tipo: string | null
  entregable_tipo_id: number
  fecha_compromiso: string | null
  cantidad_compromiso: number | null
  resultado_cantidad: number | null
  // Seguimiento
  resultado: string | null; error_interno: number | null; error_cliente: number | null
  aprobado: boolean; terminado_en: string | null; aprobado_en: string | null
  es_nuevo_modelo: boolean
  // Cumplimiento (calculado por el backend)
  diferencia: number | null; puntualidad: number | null; exactitud: number | null
  pct_cumple: number | null; cumple_meta: boolean | null
  impacto_variable: 'sin_afectacion' | 'afecta' | 'pendiente' | null
  clientes?: { cliente: string } | null
  responsable?: { nombre: string; rol?: string } | null
}

interface Resumen {
  total: number; terminados: number; aprobados: number; pendientes: number
  a_tiempo: number; con_retraso: number
  error_interno_total: number; error_cliente_total: number
  pct_cumple_promedio: number | null; puntualidad_promedio: number | null
  exactitud_promedio: number | null; diferencia_promedio: number | null
}

interface HistorialRow {
  id: number; creado_en: string
  anterior: { descripcion: string } | null
  nuevo: { descripcion: string } | null
}

const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const AHORA = new Date()

/** Último día del mes/año dados, en formato YYYY-MM-DD. Sugerencia por defecto. */
function finDeMes(mes: number, anio: number) {
  return new Date(Date.UTC(anio, mes, 0)).toISOString().slice(0, 10)
}

const empty = {
  mes: String(AHORA.getMonth() + 1), anio: String(AHORA.getFullYear()),
  cliente_id: '', lider_id: '', usuario_id: '',
  comentarios: '', indicador_id: '', entregable_tipo_id: '',
  fecha_compromiso: '',
  cantidad_compromiso: '',
}

const emptySeguimiento = {
  resultado: '', fecha_compromiso: '',
  aprobado: false, comentarios: '', cantidad_compromiso: '', resultado_cantidad: '',
}

const PIE_COLORS = ['oklch(27% 0.09 252)','oklch(48% 0.13 240)','oklch(52% 0.22 15)','oklch(56% 0.18 145)','oklch(70% 0.16 65)','oklch(60% 0.14 300)']

/** Color semántico según qué tan bueno es un % de cumplimiento. */
function colorCumple(v: number) {
  if (v >= 90) return 'var(--color-success)'
  if (v >= 70) return 'var(--color-warning)'
  return 'var(--color-accent)'
}

function ChartCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: easeOut }}
      className="rounded-2xl p-5"
      style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary-muted)', color: 'var(--color-primary)' }}>
          <Icon size={14} />
        </div>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-ink)', letterSpacing: '-0.03em' }}>{title}</h3>
      </div>
      {children}
    </motion.div>
  )
}

/** Métrica compacta de la fila de cumplimiento. */
function Metric({ icon: Icon, label, value, hint, tone }: {
  icon: React.ElementType; label: string; value: string
  hint?: string; tone?: string
}) {
  return (
    <div
      className="rounded-xl px-4 py-3 flex flex-col gap-1"
      style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--color-ink-muted)' }}>
        <Icon size={12} style={{ color: tone ?? 'var(--color-ink-subtle)' }} />
        {label}
      </div>
      <div className="text-xl font-bold tabular-nums" style={{ color: tone ?? 'var(--color-ink)', letterSpacing: '-0.04em' }}>
        {value}
      </div>
      {hint && <div className="text-xs" style={{ color: 'var(--color-ink-subtle)' }}>{hint}</div>}
    </div>
  )
}

const CustomPieLabel = (props: {
  cx?: number; cy?: number; midAngle?: number
  innerRadius?: number; outerRadius?: number; percent?: number
}) => {
  const { cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0 } = props
  if (percent < 0.05) return null
  const RADIAN = Math.PI / 180
  const r = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + r * Math.cos(-midAngle * RADIAN)
  const y = cy + r * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

export default function EntregablesPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const { usuario: currentUser } = useAuth()
  const isAnalista = currentUser?.rol === 'Analista'
  const [modal, setModal] = useState<{ open: boolean; row: Entregable | null }>({ open: false, row: null })
  const [form, setForm] = useState(empty)
  const [error, setError] = useState('')

  // Seguimiento
  const [segModal, setSegModal] = useState<{ open: boolean; row: Entregable | null }>({ open: false, row: null })
  const [segForm, setSegForm] = useState(emptySeguimiento)
  const [segError, setSegError] = useState('')

  // Errores del entregable (tabla hija)
  const [newError, setNewError] = useState<{ tipo: 'interno' | 'cliente'; descripcion: string; correccion: string }>({ tipo: 'interno', descripcion: '', correccion: '' })
  const [editErrorId, setEditErrorId] = useState<number | null>(null)

  // Historial
  const [histId, setHistId] = useState<number | null>(null)

  // ── Filtros dinámicos ──
  const [filtros, setFiltros] = useState<Record<string, string>>({})

  // Filtros iniciales desde la URL (redirecciones desde "Mis Clientes" u otros módulos)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const claves = ['cliente_id', 'indicador_id', 'estatus_id', 'entregable_tipo_id', 'lider_id', 'usuario_id', 'aprobado', 'anio', 'mes', 'anio_desde', 'mes_desde', 'anio_hasta', 'mes_hasta', 'q']
    const iniciales: Record<string, string> = {}
    claves.forEach((k) => { const v = params.get(k); if (v) iniciales[k] = v })
    if (Object.keys(iniciales).length) setFiltros((f) => ({ ...f, ...iniciales }))
  }, [])

  // Se envían al backend solo los filtros con valor.
  const queryString = useMemo(() => {
    const p = new URLSearchParams()
    Object.entries(filtros).forEach(([k, v]) => { if (v) p.set(k, v) })
    return p.toString()
  }, [filtros])

  const { data: entregables = [], isLoading } = useQuery<Entregable[]>({
    queryKey: ['entregables', queryString],
    queryFn: async () => {
      const { data } = await api.get<Entregable[]>(`/entregables/buscar?${queryString}`)
      return data
    },
  })

  const { data: resumen } = useQuery<Resumen>({
    queryKey: ['entregables-resumen', queryString],
    queryFn: async () => {
      const { data } = await api.get<Resumen>(`/entregables/resumen?${queryString}`)
      return data
    },
  })

  const { data: clientes = [] } = useQuery<Cliente[]>({ queryKey: ['clientes'], queryFn: async () => { const { data } = await api.get<Cliente[]>('/clientes'); return data } })
  const { data: estatusList = [] } = useQuery<Estatus[]>({ queryKey: ['estatus'], queryFn: async () => { const { data } = await api.get<Estatus[]>('/estatus'); return data } })
  const { data: indicadores = [] } = useQuery<Indicador[]>({ queryKey: ['indicadores'], queryFn: async () => { const { data } = await api.get<Indicador[]>('/indicadores'); return data } })
  const { data: usuarios = [] } = useQuery<Usuario[]>({ queryKey: ['usuarios-dropdown'], queryFn: async () => { const { data } = await api.get<Usuario[]>('/entregables/usuarios-dropdown'); return data } })

  const { data: historial = [] } = useQuery<HistorialRow[]>({
    queryKey: ['entregable-historial', histId],
    enabled: histId !== null,
    queryFn: async () => { const { data } = await api.get<HistorialRow[]>(`/entregables/${histId}/historial`); return data },
  })

  const { data: errores = [], refetch: refetchErrores } = useQuery<EntregableError[]>({
    queryKey: ['entregable-errores', segModal.row?.id],
    enabled: !!segModal.row,
    queryFn: async () => { const { data } = await api.get<EntregableError[]>(`/entregables/${segModal.row!.id}/errores`); return data },
  })

  const crearError = useMutation({
    mutationFn: async () => api.post(`/entregables/${segModal.row!.id}/errores`, {
      tipo: newError.tipo, descripcion: newError.descripcion.trim(), correccion: newError.correccion.trim() || null,
    }),
    onSuccess: () => { setNewError({ tipo: 'interno', descripcion: '', correccion: '' }); refetchErrores(); invalidar(); toast.success('Error registrado') },
    onError: () => toast.error('No se pudo registrar el error'),
  })

  const actualizarError = useMutation({
    mutationFn: async (payload: { id: number; tipo: 'interno' | 'cliente'; descripcion: string; correccion: string | null }) =>
      api.patch(`/entregables/errores/${payload.id}`, { tipo: payload.tipo, descripcion: payload.descripcion, correccion: payload.correccion }),
    onSuccess: () => { setEditErrorId(null); refetchErrores(); invalidar(); toast.success('Error actualizado') },
    onError: () => toast.error('No se pudo actualizar el error'),
  })

  const eliminarError = useMutation({
    mutationFn: (id: number) => api.delete(`/entregables/errores/${id}`),
    onSuccess: () => { refetchErrores(); invalidar(); toast.success('Error eliminado') },
    onError: () => toast.error('Solo el administrador puede eliminar errores'),
  })

  // Catálogo completo de tipos: alimenta el filtro y el select del modal.
  const { data: tipos = [] } = useQuery<EntregableTipo[]>({
    queryKey: ['entregable-tipos'],
    queryFn: async () => { const { data } = await api.get<EntregableTipo[]>('/entregable-tipos'); return data },
  })

  const clienteMap = Object.fromEntries(clientes.map((c) => [c.id, c.cliente]))
  const estatusMap = Object.fromEntries(estatusList.map((e) => [e.id, e.descripcion]))
  const indicadorMap = Object.fromEntries(indicadores.map((i) => [i.id, i.nombre]))
  const tipoMap = Object.fromEntries(tipos.map((t) => [t.id, t.nombre]))

  // ── Nuevo modelo ──
  // Crear un entregable nuevo siempre usa el nuevo flujo: indicadores del
  // sistema con conceptos configurados para el cliente elegido.
  const esEdicionLegacy = !!modal.row && !modal.row.es_nuevo_modelo
  const sistemaIndicadores = indicadores.filter((i) => i.es_sistema)
  const indicadoresDisponibles = esEdicionLegacy
    ? indicadores
    : sistemaIndicadores.filter((i) =>
        tipos.some((t) => t.cliente_id === Number(form.cliente_id) && t.indicador_id === i.id && t.mostrar && t.activo),
      )

  // Modo de captura según el indicador seleccionado.
  const nombreIndicadorSel = indicadorMap[Number(form.indicador_id)] ?? ''
  const modoPlan = nombreIndicadorSel.trim().toUpperCase() === 'PLAN DE ENTREGABLES'
  const modoExactitud = nombreIndicadorSel.trim().toUpperCase() === 'EXACTITUD DE CÁLCULOS'
  const esNuevoFlujo = !esEdicionLegacy && (modoPlan || modoExactitud)

  // Los tipos disponibles dependen del indicador (y cliente en el nuevo flujo).
  const tiposPorIndicador = esNuevoFlujo
    ? tipos
        .filter((t) => t.cliente_id === Number(form.cliente_id)
          && t.indicador_id === Number(form.indicador_id)
          && t.mostrar && t.activo)
        .sort((a, b) => a.orden - b.orden)
    : tipos
        .filter((t) => t.indicador_id === Number(form.indicador_id))
        .sort((a, b) => a.orden - b.orden)

  const anios = Array.from(
    new Set([AHORA.getFullYear(), AHORA.getFullYear() - 1, ...entregables.map((e) => e.anio)]),
  ).sort((a, b) => b - a)

  const FILTROS: FilterDef[] = [
    { key: 'cliente_id', label: 'Cliente', options: clientes.map((c) => ({ value: String(c.id), label: c.cliente })) },
    { key: 'indicador_id', label: 'Indicador', options: indicadores.map((i) => ({ value: String(i.id), label: i.nombre })) },
    { key: 'estatus_id', label: 'Estatus', options: estatusList.map((e) => ({ value: String(e.id), label: e.descripcion })) },
    {
      key: 'entregable_tipo_id', label: 'Tipo',
      // Si ya se filtró por indicador, solo se ofrecen los tipos de ese indicador.
      options: tipos
        .filter((t) => !filtros.indicador_id || t.indicador_id === Number(filtros.indicador_id))
        .map((t) => ({
          value: String(t.id),
          label: filtros.indicador_id ? t.nombre : `${t.nombre} · ${indicadorMap[t.indicador_id] ?? ''}`,
        })),
    },
    { key: 'anio_desde', label: 'Año desde', options: anios.map((a) => ({ value: String(a), label: String(a) })) },
    { key: 'mes_desde', label: 'Mes desde', options: MESES_CORTO.map((m, i) => ({ value: String(i + 1), label: m })) },
    { key: 'anio_hasta', label: 'Año hasta', options: anios.map((a) => ({ value: String(a), label: String(a) })) },
    { key: 'mes_hasta', label: 'Mes hasta', options: MESES_CORTO.map((m, i) => ({ value: String(i + 1), label: m })) },
    { key: 'lider_id', label: 'Líder', options: usuarios.map((u) => ({ value: String(u.id), label: u.nombre })) },
    { key: 'usuario_id', label: 'Responsable', options: usuarios.map((u) => ({ value: String(u.id), label: u.nombre })) },
    { key: 'aprobado', label: 'Aprobación', options: [{ value: 'true', label: 'Aprobados' }, { value: 'false', label: 'No aprobados' }] },
    { key: 'q', label: 'Buscar en comentarios', placeholder: 'Texto libre…' },
  ]

  const setFiltro = (k: string, v: string) => setFiltros((f) => ({ ...f, [k]: v }))

  // Pie: distribución por estatus
  const porEstatus = estatusList.map((e) => ({
    name: e.descripcion,
    value: entregables.filter((en) => en.estatus_id === e.id).length,
  })).filter((e) => e.value > 0)

  // Cumplimiento promedio por mes
  const cumplimientoPorMes = MESES_CORTO.map((m, i) => {
    const del = entregables.filter((e) => e.mes === i + 1)
    const evaluados = del.filter((e) => e.pct_cumple !== null)
    const cumple = evaluados.length
      ? evaluados.reduce((s, e) => s + (e.pct_cumple ?? 0), 0) / evaluados.length
      : null
    return {
      mes: m,
      cumple: cumple !== null ? Math.round(cumple) : null,
      total: del.length,
    }
  }).filter((m) => m.total > 0)

  const COLS: Column<Entregable>[] = [
    { key: 'id', label: 'ID' },
    { key: 'mes', label: 'Período', render: (r) => `${MESES_CORTO[r.mes - 1]} ${r.anio}` },
    { key: 'cliente_id', label: 'Cliente', render: (r) => clienteMap[r.cliente_id] ?? r.cliente_id },
    { key: 'indicador_id', label: 'Indicador', render: (r) => indicadorMap[r.indicador_id] ?? r.indicador_id },
    {
      key: 'entregable_tipo_id', label: 'Tipo',
      render: (r) => (
        <span className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>
          {tipoMap[r.entregable_tipo_id] ?? r.tipo ?? '—'}
        </span>
      ),
    },
    {
      key: 'estatus_id', label: 'Estatus',
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <Badge variant={r.aprobado ? 'success' : 'default'}>{estatusMap[r.estatus_id] ?? r.estatus_id}</Badge>
          {r.aprobado && <CheckCircle2 size={13} style={{ color: 'var(--color-success)' }} />}
        </div>
      ),
    },
    {
      key: 'fecha_compromiso', label: 'Compromiso',
      render: (r) => {
        const fecha = r.fecha_compromiso
          ? <span className="text-xs tabular-nums" style={{ color: 'var(--color-ink-muted)' }}>{r.fecha_compromiso}</span>
          : null
        const cant = r.cantidad_compromiso != null
          ? <span className="text-xs tabular-nums" style={{ color: 'var(--color-ink-muted)' }}>{r.cantidad_compromiso}</span>
          : null
        if (!fecha && !cant) return <span className="text-xs" style={{ color: 'var(--color-ink-subtle)' }}>—</span>
        return <div className="flex items-center gap-1.5">{fecha}{fecha && cant && <span style={{ color: 'var(--color-border-strong)' }}>·</span>}{cant}</div>
      },
    },
    {
      key: 'resultado', label: 'Resultado',
      render: (r) => {
        const valor = r.resultado ?? (r.resultado_cantidad != null ? String(r.resultado_cantidad) : null)
        return valor
          ? <span className="text-xs tabular-nums" style={{ color: 'var(--color-ink)' }}>{valor}</span>
          : <span className="text-xs" style={{ color: 'var(--color-ink-subtle)' }}>—</span>
      },
    },
    {
      key: 'diferencia', label: 'Diferencia',
      render: (r) => {
        if (r.diferencia === null) return <span className="text-xs" style={{ color: 'var(--color-ink-subtle)' }}>—</span>
        const tarde = r.diferencia > 0
        const esCantidad = r.cantidad_compromiso != null
        return (
          <Badge variant={tarde ? 'danger' : 'success'}>
            {tarde ? `+${r.diferencia}` : r.diferencia}{esCantidad ? '' : ' d'}
          </Badge>
        )
      },
    },
    {
      key: 'error_interno', label: 'Errores',
      render: (r) => {
        const ei = r.error_interno ?? 0
        const ec = r.error_cliente ?? 0
        if (!r.resultado && r.resultado_cantidad == null) return <span className="text-xs" style={{ color: 'var(--color-ink-subtle)' }}>—</span>
        return (
          <div className="flex items-center gap-1.5 text-xs tabular-nums">
            <span title="Errores internos" style={{ color: ei ? 'var(--color-warning)' : 'var(--color-ink-subtle)' }}>Int {ei}</span>
            <span style={{ color: 'var(--color-border-strong)' }}>·</span>
            <span title="Errores de cliente" style={{ color: ec ? 'var(--color-accent)' : 'var(--color-ink-subtle)' }}>Cli {ec}</span>
          </div>
        )
      },
    },
    {
      key: 'pct_cumple', label: '% Cumple',
      render: (r) => {
        if (r.pct_cumple === null) {
          return <span className="text-xs" style={{ color: 'var(--color-ink-subtle)' }}>Sin evaluar</span>
        }
        const color = colorCumple(r.pct_cumple)
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-border)', minWidth: 52 }}>
              <div className="h-1.5 rounded-full transition-[width] duration-500" style={{ width: `${r.pct_cumple}%`, backgroundColor: color }} />
            </div>
            <span className="text-xs font-semibold tabular-nums" style={{ color }}>{r.pct_cumple}%</span>
          </div>
        )
      },
    },
    {
      key: 'impacto_variable', label: 'Impacto variable',
      render: (r) => {
        const persp = currentUser?.rol === 'Admin'
          ? `Perspectiva: ${r.responsable?.rol === 'Lider' ? 'líder' : 'analista'} (responsable)`
          : currentUser?.rol === 'Lider' ? 'Perspectiva: líder' : 'Perspectiva: analista'
        if (r.impacto_variable === null) {
          return <span className="text-xs" style={{ color: 'var(--color-ink-subtle)' }}>—</span>
        }
        if (r.impacto_variable === 'pendiente') {
          return <Badge variant="muted">— Pendiente</Badge>
        }
        if (r.impacto_variable === 'afecta') {
          return (
            <span title={`Está reduciendo tu consolidado para el variable. ${persp}`}>
              <Badge variant="danger" className="gap-1">
                <AlertTriangle size={11} /> Afecta
              </Badge>
            </span>
          )
        }
        return (
          <span title={`No está perjudicando tu cálculo del variable. ${persp}`}>
            <Badge variant="success" className="gap-1">
              <CheckCircle2 size={11} /> Sin afectación
            </Badge>
          </span>
        )
      },
    },
    {
      key: 'acciones_seg', label: 'Seguimiento',
      render: (r) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => openSeguimiento(r)}
            className="inline-flex items-center gap-1 h-7 px-2 rounded-lg text-xs font-medium cursor-pointer transition-[background-color,color] duration-150"
            style={{ color: 'var(--color-primary)', backgroundColor: 'var(--color-primary-muted)' }}
          >
            <ClipboardCheck size={12} /> Seguir
          </button>
          <button
            onClick={() => setHistId(r.id)}
            title="Ver historial"
            className="p-1.5 rounded-lg cursor-pointer transition-[background-color,color] duration-150"
            style={{ color: 'var(--color-ink-subtle)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-ink)'; e.currentTarget.style.backgroundColor = 'var(--color-border)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-ink-subtle)'; e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            <History size={13} />
          </button>
        </div>
      ),
    },
  ]

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['entregables'] })
    qc.invalidateQueries({ queryKey: ['entregables-resumen'] })
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        mes: Number(form.mes), anio: Number(form.anio), cliente_id: Number(form.cliente_id),
        lider_id: form.lider_id ? Number(form.lider_id) : null,
        usuario_id: form.usuario_id ? Number(form.usuario_id) : null,
        comentarios: form.comentarios || null,
        indicador_id: Number(form.indicador_id),
        entregable_tipo_id: Number(form.entregable_tipo_id),
        fecha_compromiso: form.fecha_compromiso || null,
        cantidad_compromiso: form.cantidad_compromiso ? Number(form.cantidad_compromiso) : null,
      }
      if (modal.row) await api.patch(`/entregables/${modal.row.id}`, payload)
      else await api.post('/entregables', payload)
    },
    onSuccess: () => { invalidar(); close(); toast.success(modal.row ? 'Entregable actualizado' : 'Entregable creado') },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      const msg = e?.response?.data?.message ?? 'Error al guardar'
      setError(msg); toast.error(msg)
    },
  })

  const guardarSeguimiento = useMutation({
    mutationFn: async () => {
      if (!segModal.row) return
      const payload: Record<string, unknown> = {}
      // Los analistas no envían el campo de aprobación (backend lo bloquea).
      if (!isAnalista) payload.aprobado = segForm.aprobado
      if (segForm.resultado) payload.resultado = segForm.resultado
      if (segForm.fecha_compromiso) payload.fecha_compromiso = segForm.fecha_compromiso
      if (segForm.cantidad_compromiso) payload.cantidad_compromiso = Number(segForm.cantidad_compromiso)
      if (segForm.resultado_cantidad) payload.resultado_cantidad = Number(segForm.resultado_cantidad)
      if (segForm.comentarios) payload.comentarios = segForm.comentarios
      await api.patch(`/entregables/${segModal.row.id}/seguimiento`, payload)
    },
    onSuccess: () => {
      invalidar()
      qc.invalidateQueries({ queryKey: ['entregable-historial'] })
      setSegModal({ open: false, row: null })
      toast.success('Seguimiento guardado')
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      const msg = e?.response?.data?.message ?? 'Error al guardar el seguimiento'
      setSegError(msg); toast.error(msg)
    },
  })

  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/entregables/${id}`),
    onSuccess: () => { invalidar(); toast.success('Entregable eliminado') },
    onError: () => toast.error('Error al eliminar el entregable'),
  })

  function open(row?: Entregable) {
    setModal({ open: true, row: row ?? null })
    setForm(row ? {
      mes: String(row.mes), anio: String(row.anio), cliente_id: String(row.cliente_id),
      lider_id: row.lider_id ? String(row.lider_id) : '',
      usuario_id: row.usuario_id ? String(row.usuario_id) : '',
      comentarios: row.comentarios ?? '', indicador_id: String(row.indicador_id),
      entregable_tipo_id: row.entregable_tipo_id ? String(row.entregable_tipo_id) : '',
      fecha_compromiso: row.fecha_compromiso ?? '',
      cantidad_compromiso: row.cantidad_compromiso != null ? String(row.cantidad_compromiso) : '',
    } : empty)
    setError('')
  }
  function close() { setModal({ open: false, row: null }) }

  function openSeguimiento(row: Entregable) {
    setSegModal({ open: true, row })
    const esCantidad = row.cantidad_compromiso != null
    setSegForm({
      resultado: esCantidad ? '' : (row.resultado ?? new Date().toISOString().slice(0, 10)),
      fecha_compromiso: esCantidad ? '' : (row.fecha_compromiso ?? finDeMes(row.mes, row.anio)),
      aprobado: row.aprobado ?? false,
      comentarios: row.comentarios ?? '',
      cantidad_compromiso: row.cantidad_compromiso != null ? String(row.cantidad_compromiso) : '',
      resultado_cantidad: row.resultado_cantidad != null ? String(row.resultado_cantidad) : '',
    })
    setSegError('')
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const setSeg = (k: keyof typeof segForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setSegForm((f) => ({ ...f, [k]: e.target.value }))
  // Cambiar de indicador invalida el tipo elegido: los tipos son por indicador.
  // En el nuevo flujo también limpia el compromiso del modo contrario.
  const handleIndicadorChange = (value: string) =>
    setForm((f) => {
      const next = { ...f, indicador_id: value, entregable_tipo_id: '' }
      const nombre = indicadorMap[Number(value)] ?? ''
      const n = nombre.trim().toUpperCase()
      if (n === 'PLAN DE ENTREGABLES') next.cantidad_compromiso = ''
      if (n === 'EXACTITUD DE CÁLCULOS') next.fecha_compromiso = ''
      return next
    })

  // Cambiar de cliente invalida indicador y tipo en el nuevo flujo:
  // los conceptos dependen del cliente.
  const handleClienteChange = (value: string) =>
    setForm((f) => (esEdicionLegacy
      ? { ...f, cliente_id: value }
      : { ...f, cliente_id: value, indicador_id: '', entregable_tipo_id: '' }))

  /**
   * Al mover mes o año, re-sugiere la fecha de compromiso al fin del nuevo
   * período — pero solo si la actual seguía siendo la sugerencia automática,
   * para no pisar una fecha que el usuario escribió a mano.
   */
  const setPeriodo = (k: 'mes' | 'anio') => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => {
      const next = { ...f, [k]: e.target.value }
      const eraSugerencia = f.fecha_compromiso === '' || f.fecha_compromiso === finDeMes(Number(f.mes), Number(f.anio))
      const mes = Number(next.mes)
      const anio = Number(next.anio)
      // Solo sugiere fecha si el usuario no está trabajando con cantidad.
      if (eraSugerencia && !f.cantidad_compromiso && mes >= 1 && mes <= 12 && anio >= 2000) {
        next.fecha_compromiso = finDeMes(mes, anio)
      }
      return next
    })

  const canSave = form.mes && form.anio && form.cliente_id
    && form.indicador_id && form.entregable_tipo_id
    && (form.fecha_compromiso || form.cantidad_compromiso)

  // Vista previa del cumplimiento dentro del modal de seguimiento
  const previewCumple = useMemo(() => {
    if (!segModal.row) return null
    const esCantidad = segModal.row.cantidad_compromiso != null
    const nuevoModelo = !!segModal.row.es_nuevo_modelo

    let dif = 0
    let difLabel = ''

    if (esCantidad && segForm.resultado_cantidad && segForm.cantidad_compromiso) {
      dif = Number(segForm.cantidad_compromiso) - Number(segForm.resultado_cantidad)
      difLabel = `${dif > 0 ? '+' : ''}${dif}`
      if (dif === 0) difLabel = '0'
    } else if (!esCantidad && segForm.resultado && segForm.fecha_compromiso) {
      dif = Math.round(
        (new Date(`${segForm.resultado}T00:00:00Z`).getTime()
          - new Date(`${segForm.fecha_compromiso}T00:00:00Z`).getTime()) / 86400000,
      )
      difLabel = `${dif > 0 ? '+' : ''}${dif} d`
      if (dif === 0) difLabel = '0 d'
    } else {
      return null
    }

    // Nuevo modelo: cada indicador mide una sola cosa.
    if (nuevoModelo) {
      if (esCantidad) {
        // Exactitud: correctos = procesados - errores_internos - errores_cliente (analista).
        const procesados = Number(segForm.resultado_cantidad) || 0
        const ei = segModal.row?.error_interno ?? 0
        const ec = segModal.row?.error_cliente ?? 0
        const correctos = Math.max(0, procesados - ei - ec)
        const exactitud = Math.max(0, Math.min(100, (correctos / Number(segForm.cantidad_compromiso)) * 100))
        return {
          difLabel, exactitud: Math.round(exactitud * 100) / 100,
          puntualidad: null as number | null,
          cumple: Math.round(exactitud * 100) / 100,
        }
      }
      // Plan de Entregables: solo puntualidad.
      const puntualidad = Math.max(0, Math.min(100, 100 - Math.max(0, dif) * 10))
      return {
        difLabel, exactitud: null as number | null,
        puntualidad, cumple: puntualidad,
      }
    }

    // Modelo histórico: puntualidad y exactitud simples (sin penalizaciones fijas).
    const puntualidad = Math.max(0, Math.min(100, 100 - Math.max(0, dif) * 10))
    const exactitud = esCantidad
      ? Math.max(0, Math.min(100, ((Number(segForm.resultado_cantidad) || 0) / (Number(segForm.cantidad_compromiso) || 1)) * 100))
      : 100
    return { difLabel, exactitud, puntualidad, cumple: esCantidad ? exactitud : puntualidad }
  }, [segModal.row, segForm.resultado, segForm.fecha_compromiso, segForm.cantidad_compromiso, segForm.resultado_cantidad])

  return (
    <div className="max-w-7xl space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: easeOut }}>
        <div className="flex items-center gap-2 mb-1">
          <Package size={14} style={{ color: 'var(--color-accent)' }} />
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-accent)', letterSpacing: '0.1em' }}>Entregables</span>
        </div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-ink)', letterSpacing: '-0.05em' }}>Gestión y seguimiento de entregables</h1>
      </motion.div>

      <FilterBar
        filters={FILTROS}
        values={filtros}
        onChange={setFiltro}
        onReset={() => setFiltros({})}
        summary={
          <span className="text-xs tabular-nums" style={{ color: 'var(--color-ink-muted)' }}>
            {entregables.length} entregable{entregables.length === 1 ? '' : 's'}
          </span>
        }
      />

      {/* Cumplimiento del conjunto filtrado */}
      {resumen && resumen.total > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <Metric
            icon={TrendingUp} label="% Cumple promedio"
            value={resumen.pct_cumple_promedio !== null ? `${resumen.pct_cumple_promedio}%` : '—'}
            tone={resumen.pct_cumple_promedio !== null ? colorCumple(resumen.pct_cumple_promedio) : undefined}
            hint={`${resumen.terminados} evaluado${resumen.terminados === 1 ? '' : 's'}`}
          />
          <Metric
            icon={CalendarClock} label="Diferencia promedio"
            value={resumen.diferencia_promedio !== null ? `${resumen.diferencia_promedio} d` : '—'}
            hint={`${resumen.a_tiempo} a tiempo · ${resumen.con_retraso} tarde`}
          />
          <Metric
            icon={CheckCircle2} label="Aprobados"
            value={`${resumen.aprobados}/${resumen.total}`}
            tone="var(--color-success)"
            hint={`${resumen.pendientes} sin entregar`}
          />
          <Metric
            icon={AlertTriangle} label="Errores internos"
            value={String(resumen.error_interno_total)}
            tone={resumen.error_interno_total ? 'var(--color-warning)' : undefined}
          />
          <Metric
            icon={AlertTriangle} label="Errores cliente"
            value={String(resumen.error_cliente_total)}
            tone={resumen.error_cliente_total ? 'var(--color-accent)' : undefined}
          />
        </div>
      )}

      {entregables.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-2">
            <ChartCard title="Distribución por estatus" icon={PieIcon}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={porEstatus} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    innerRadius={55} outerRadius={85} paddingAngle={3}
                    labelLine={false} label={CustomPieLabel}
                    isAnimationActive animationDuration={700} animationEasing="ease-out"
                  >
                    {porEstatus.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--color-primary)', border: 'none', borderRadius: 12, color: 'white', fontSize: 12 }}
                    formatter={(v, n) => [v, n]}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8, color: 'var(--color-ink-muted)' }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="lg:col-span-3">
            <ChartCard title="Cumplimiento promedio por mes" icon={BarChart2}>
              {cumplimientoPorMes.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={cumplimientoPorMes} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      
                      <linearGradient id="cumple-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="oklch(56% 0.18 145)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="oklch(56% 0.18 145)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--color-ink-subtle)' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--color-ink-subtle)' }} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--color-primary)', border: 'none', borderRadius: 12, color: 'white', fontSize: 12 }}
                      formatter={(v) => [`${v}%`, '% Cumple promedio']}
                    />
                    
                    <Area type="monotone" dataKey="cumple" stroke="oklch(56% 0.18 145)" strokeWidth={2.5} fill="url(#cumple-grad)" dot={{ fill: 'oklch(56% 0.18 145)', r: 3.5, strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0 }} isAnimationActive animationDuration={800} animationEasing="ease-out" connectNulls />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-sm" style={{ color: 'var(--color-ink-subtle)' }}>Sin datos por mes</div>
              )}
            </ChartCard>
          </div>
        </div>
      )}

      <DataTable data={entregables} columns={COLS} loading={isLoading} searchKeys={['tipo', 'comentarios']}
        onAdd={isAnalista ? undefined : () => open()} onEdit={isAnalista ? undefined : open} onDelete={isAnalista ? undefined : (row) => del.mutate(row.id)} addLabel="Nuevo entregable"
 />

      {/* ── Modal: crear / editar ── */}
      <Modal open={modal.open} onClose={close} title={modal.row ? 'Editar entregable' : 'Nuevo entregable'} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <FormField as="select" label="Mes" required value={form.mes} onChange={setPeriodo('mes')}>
            {MESES_CORTO.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </FormField>
          <FormField label="Año" required type="number" min="2000" value={form.anio} onChange={setPeriodo('anio')} />
          <FormField as="select" label="Cliente" required value={form.cliente_id} onChange={(e) => handleClienteChange(e.target.value)}>
            <option value="">Selecciona…</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.cliente}</option>)}
          </FormField>
          <FormField as="select" label="Indicador" required value={form.indicador_id} onChange={(e) => handleIndicadorChange(e.target.value)}
            disabled={!esEdicionLegacy && !form.cliente_id}>
            <option value="">
              {esEdicionLegacy
                ? 'Selecciona…'
                : !form.cliente_id
                  ? 'Elige un cliente primero…'
                  : indicadoresDisponibles.length === 0
                    ? 'Sin conceptos para este cliente'
                    : 'Selecciona…'}
            </option>
            {indicadoresDisponibles.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
          </FormField>
          <div className="col-span-2">
            <div className="grid grid-cols-2 gap-4">
              {esNuevoFlujo && modoExactitud ? (
                <FormField
                  label="Cantidad de compromiso" type="number" min="1" placeholder="Ej: 100 procesos"
                  value={form.cantidad_compromiso} onChange={set('cantidad_compromiso')}
                />
              ) : esNuevoFlujo && modoPlan ? (
                <FormField
                  label="Fecha de compromiso" type="date"
                  value={form.fecha_compromiso} onChange={set('fecha_compromiso')}
                />
              ) : (
                <>
                  <FormField
                    label="Fecha de compromiso" type="date"
                    value={form.fecha_compromiso} onChange={set('fecha_compromiso')}
                  />
                  <FormField
                    label="Cantidad de compromiso" type="number" min="1" placeholder="Ej: 3"
                    value={form.cantidad_compromiso} onChange={set('cantidad_compromiso')}
                  />
                </>
              )}
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--color-ink-subtle)' }}>
              {esNuevoFlujo && modoPlan
                ? 'Plan de Entregables: el cumplimiento se mide por fecha de entrega.'
                : esNuevoFlujo && modoExactitud
                  ? 'Exactitud de Cálculos: el cumplimiento se mide por cantidad de resultados correctos.'
                  : 'Llena al menos uno de los dos. La fecha es para puntualidad; la cantidad es para compromisos numéricos.'}
            </p>
          </div>
          <FormField as="select" label="Líder" value={form.lider_id} onChange={set('lider_id')}>
            <option value="">Sin líder</option>
            {usuarios.filter((u) => u.rol === 'Lider').map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </FormField>
          <FormField as="select" label="Usuario asignado" value={form.usuario_id} onChange={set('usuario_id')}>
            <option value="">Sin asignar</option>
            {usuarios.filter((u) => u.rol === 'Analista').map((u) => <option key={u.id} value={u.id}>{u.usuario}</option>)}
          </FormField>
          <FormField
            as="select" label="Tipo" required
            value={form.entregable_tipo_id} onChange={set('entregable_tipo_id')}
            disabled={!form.indicador_id}
          >
            <option value="">
              {!form.indicador_id
                ? 'Elige un indicador primero…'
                : tiposPorIndicador.length === 0
                  ? esNuevoFlujo
                    ? 'Sin conceptos para este cliente e indicador'
                    : 'Este indicador no tiene tipos'
                  : 'Selecciona…'}
            </option>
            {tiposPorIndicador.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </FormField>
          <div className="col-span-2"><FormField as="textarea" label="Comentarios" value={form.comentarios} onChange={set('comentarios')} /></div>
          {error && <p className="col-span-2 text-xs" style={{ color: 'var(--color-accent)' }}>{error}</p>}
          <ModalActions colSpan onClose={close} onSave={() => save.mutate()} isPending={save.isPending} disabled={!canSave} />
        </div>
      </Modal>

      {/* ── Modal: seguimiento / cierre ── */}
      <Modal
        open={segModal.open}
        onClose={() => setSegModal({ open: false, row: null })}
        title={segModal.row ? `Seguimiento · Entregable #${segModal.row.id}` : 'Seguimiento'}
        size="lg"
      >
        <div className="grid grid-cols-2 gap-4">
          {segModal.row && (
            <div className="col-span-2 rounded-xl px-4 py-3 text-xs flex flex-wrap gap-x-5 gap-y-1"
              style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-ink-muted)' }}>
              <span><strong style={{ color: 'var(--color-ink)' }}>Cliente:</strong> {clienteMap[segModal.row.cliente_id]}</span>
              <span><strong style={{ color: 'var(--color-ink)' }}>Período:</strong> {MESES_CORTO[segModal.row.mes - 1]} {segModal.row.anio}</span>
              <span><strong style={{ color: 'var(--color-ink)' }}>Indicador:</strong> {indicadorMap[segModal.row.indicador_id]}</span>
              <span><strong style={{ color: 'var(--color-ink)' }}>Tipo:</strong> {segModal.row.tipo ?? '—'}</span>
            </div>
          )}

          {(() => {
            const esCantidad = segModal.row && segModal.row.cantidad_compromiso != null
            const nuevoModelo = !!segModal.row?.es_nuevo_modelo
            return esCantidad ? (
              <>
                <FormField label="Cantidad de compromiso" type="number" min="1" value={segForm.cantidad_compromiso} onChange={setSeg('cantidad_compromiso')} />
                <FormField label={nuevoModelo ? 'Cantidad de resultados correctos' : 'Resultado (cantidad)'} type="number" min="0" value={segForm.resultado_cantidad} onChange={setSeg('resultado_cantidad')} />
              </>
            ) : (
              <>
                <FormField label="Fecha de compromiso" type="date" value={segForm.fecha_compromiso} onChange={setSeg('fecha_compromiso')} />
                <FormField label="Resultado (fecha de entrega)" type="date" value={segForm.resultado} onChange={setSeg('resultado')} />
              </>
            )
          })()}
          {!isAnalista && (
            <FormField as="select" label="Aprobado"
              value={segForm.aprobado ? 'true' : 'false'}
              onChange={(e) => setSegForm((f) => ({ ...f, aprobado: e.target.value === 'true' }))}
            >
              <option value="false">No aprobado</option>
              <option value="true">Aprobado</option>
            </FormField>
          )}
          {/* Errores del entregable (tabla hija). Plan marca Impacto; Exactitud además penaliza %. */}
          {(() => {
            const nombreInd = segModal.row ? (indicadorMap[segModal.row.indicador_id] ?? '') : ''
            const esSistema = ['PLAN DE ENTREGABLES', 'EXACTITUD DE CÁLCULOS'].includes(nombreInd.trim().toUpperCase())
            if (!esSistema) return null
            const puedeGestionar = !isAnalista
            return (
              <div className="col-span-2 rounded-xl p-4" style={{ backgroundColor: 'oklch(100% 0 0 / 3%)' }}>
                <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-ink)' }}>
                  Errores registrados ({errores.length})
                </p>

                {errores.length === 0 && (
                  <p className="text-[11px] mb-2" style={{ color: 'var(--color-ink-muted)' }}>Sin errores registrados.</p>
                )}

                <div className="space-y-2 mb-3">
                  {errores.map((er) => {
                    const editing = editErrorId === er.id
                    return (
                      <div key={er.id} className="rounded-lg p-2.5" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                        {editing ? (
                          <div className="space-y-2">
                            <select value={newError.tipo} onChange={(e) => setNewError((f) => ({ ...f, tipo: e.target.value as 'interno' | 'cliente' }))}
                              className="w-full px-2 py-1.5 rounded-md text-xs outline-none" style={{ backgroundColor: 'oklch(100% 0 0 / 5%)', border: '1px solid var(--color-border)', color: 'var(--color-ink)' }}>
                              <option value="interno">Interno (corregido antes del cliente)</option>
                              <option value="cliente">Cliente (llegó al cliente)</option>
                            </select>
                            <textarea rows={2} value={newError.descripcion} onChange={(e) => setNewError((f) => ({ ...f, descripcion: e.target.value }))}
                              placeholder="Error identificado" className="w-full px-2 py-1.5 rounded-md text-xs outline-none resize-none" style={{ backgroundColor: 'oklch(100% 0 0 / 5%)', border: '1px solid var(--color-border)', color: 'var(--color-ink)' }} />
                            <textarea rows={2} value={newError.correccion} onChange={(e) => setNewError((f) => ({ ...f, correccion: e.target.value }))}
                              placeholder="Corrección / acción tomada" className="w-full px-2 py-1.5 rounded-md text-xs outline-none resize-none" style={{ backgroundColor: 'oklch(100% 0 0 / 5%)', border: '1px solid var(--color-border)', color: 'var(--color-ink)' }} />
                            <div className="flex gap-2">
                              <button onClick={() => actualizarError.mutate({ id: er.id, tipo: newError.tipo, descripcion: newError.descripcion.trim(), correccion: newError.correccion.trim() || null })}
                                disabled={!newError.descripcion.trim()} className="px-2 py-1 rounded-md text-[10px] font-medium text-white cursor-pointer disabled:opacity-50" style={{ backgroundColor: 'var(--color-accent)' }}>Guardar</button>
                              <button onClick={() => setEditErrorId(null)} className="px-2 py-1 rounded-md text-[10px] cursor-pointer" style={{ color: 'var(--color-ink-muted)' }}>Cancelar</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold text-white"
                                  style={{ backgroundColor: er.tipo === 'interno' ? 'oklch(70% 0.16 65)' : 'oklch(52% 0.22 15)' }}>
                                  {er.tipo === 'interno' ? 'Interno' : 'Cliente'}
                                </span>
                                <span className="text-xs font-medium truncate" style={{ color: 'var(--color-ink)' }}>{er.descripcion}</span>
                              </div>
                              {er.correccion
                                ? <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>Corrección: {er.correccion}</p>
                                : <p className="text-[10px] mt-0.5 italic" style={{ color: 'oklch(70% 0.16 65)' }}>Sin corrección registrada</p>}
                              {er.autor?.nombre && <p className="text-[9px]" style={{ color: 'var(--color-ink-subtle)' }}>Registrado por {er.autor.nombre}</p>}
                            </div>
                            {puedeGestionar && (
                              <div className="flex gap-1 shrink-0">
                                <button onClick={() => { setEditErrorId(er.id); setNewError({ tipo: er.tipo, descripcion: er.descripcion, correccion: er.correccion ?? '' }) }}
                                  className="p-1 rounded cursor-pointer hover:bg-white/10" style={{ color: 'var(--color-ink-muted)' }}><ClipboardCheck size={11} /></button>
                                {currentUser?.rol === 'Admin' && (
                                  <button onClick={() => eliminarError.mutate(er.id)} className="p-1 rounded cursor-pointer hover:bg-white/10" style={{ color: 'var(--color-accent)' }}><AlertTriangle size={11} /></button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {puedeGestionar && editErrorId === null && (
                  <div className="space-y-2 pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
                    <div className="flex gap-2">
                      <select value={newError.tipo} onChange={(e) => setNewError((f) => ({ ...f, tipo: e.target.value as 'interno' | 'cliente' }))}
                        className="flex-1 px-2 py-1.5 rounded-md text-xs outline-none" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-ink)' }}>
                        <option value="interno">Interno (corregido antes del cliente)</option>
                        <option value="cliente">Cliente (llegó al cliente)</option>
                      </select>
                    </div>
                    <input value={newError.descripcion} onChange={(e) => setNewError((f) => ({ ...f, descripcion: e.target.value }))}
                      placeholder="Error identificado" className="w-full px-2 py-1.5 rounded-md text-xs outline-none" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-ink)' }} />
                    <input value={newError.correccion} onChange={(e) => setNewError((f) => ({ ...f, correccion: e.target.value }))}
                      placeholder="Corrección / acción tomada (opcional)" className="w-full px-2 py-1.5 rounded-md text-xs outline-none" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-ink)' }} />
                    <button onClick={() => crearError.mutate()} disabled={!newError.descripcion.trim() || crearError.isPending}
                      className="px-2.5 py-1.5 rounded-md text-[11px] font-medium text-white cursor-pointer disabled:opacity-50" style={{ backgroundColor: 'var(--color-primary)' }}>
                      + Agregar error
                    </button>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Vista previa del cálculo antes de guardar */}
          {previewCumple && (
            <div className="col-span-2 rounded-xl px-4 py-3 grid grid-cols-4 gap-3"
              style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
              {[
                { l: 'Diferencia', v: previewCumple.difLabel, c: previewCumple.difLabel.startsWith('+') ? 'var(--color-accent)' : 'var(--color-success)' },
                { l: 'Puntualidad', v: previewCumple.puntualidad != null ? `${previewCumple.puntualidad}%` : '—', c: previewCumple.puntualidad != null ? colorCumple(previewCumple.puntualidad) : 'var(--color-ink-subtle)' },
                { l: 'Exactitud', v: previewCumple.exactitud != null ? `${previewCumple.exactitud}%` : '—', c: previewCumple.exactitud != null ? colorCumple(previewCumple.exactitud) : 'var(--color-ink-subtle)' },
                { l: '% Cumple', v: `${previewCumple.cumple}%`, c: colorCumple(previewCumple.cumple) },
              ].map((m) => (
                <div key={m.l} className="flex flex-col">
                  <span className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>{m.l}</span>
                  <span className="text-base font-bold tabular-nums" style={{ color: m.c, letterSpacing: '-0.03em' }}>{m.v}</span>
                </div>
              ))}
            </div>
          )}

          <div className="col-span-2">
            <FormField as="textarea" label="Comentarios" value={segForm.comentarios} onChange={setSeg('comentarios')} />
          </div>

          {segError && <p className="col-span-2 text-xs" style={{ color: 'var(--color-accent)' }}>{segError}</p>}
          <ModalActions colSpan
            onClose={() => setSegModal({ open: false, row: null })}
            onSave={() => guardarSeguimiento.mutate()}
            isPending={guardarSeguimiento.isPending}
            label="Guardar seguimiento"
          />
        </div>
      </Modal>

      {/* ── Modal: historial (trazabilidad) ── */}
      <Modal open={histId !== null} onClose={() => setHistId(null)} title={`Historial · Entregable #${histId}`} size="md">
        {historial.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--color-ink-subtle)' }}>
            Sin cambios de estatus registrados todavía.
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {historial.map((h) => (
              <li key={h.id} className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: 'var(--color-primary)' }} />
                <div className="flex flex-col">
                  <span className="text-sm" style={{ color: 'var(--color-ink)' }}>
                    {h.anterior?.descripcion ?? 'Creado'} → <strong>{h.nuevo?.descripcion}</strong>
                  </span>
                  <span className="text-xs tabular-nums" style={{ color: 'var(--color-ink-subtle)' }}>
                    {new Date(h.creado_en).toLocaleString('es-CO')}
                    
                  </span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Modal>
    </div>
  )
}
