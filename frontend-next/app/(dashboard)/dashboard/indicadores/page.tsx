'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { easeOut } from '@/lib/easing'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  ResponsiveContainer,
} from 'recharts'
import { BarChart2, CalendarCheck, Calculator } from 'lucide-react'
import { api } from '@/lib/api'
import DataTable, { type Column } from '@/components/ui/DataTable'
import Modal from '@/components/ui/Modal'
import FormField from '@/components/ui/FormField'
import ModalActions from '@/components/ui/ModalActions'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/context/AuthContext'

interface Indicador { id: number; nombre: string; mostrar: boolean; es_sistema: boolean }
interface Entregable {
  id: number; indicador_id: number; pct_avance: number | null
  mes: number; anio: number; es_nuevo_modelo: boolean
  clientes?: { cliente: string } | null
}

const COLS: Column<Indicador>[] = [
  { key: 'id', label: 'ID' },
  { key: 'nombre', label: 'Nombre' },
  {
    key: 'es_sistema', label: 'Tipo',
    render: (r) => r.es_sistema
      ? <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold text-white" style={{ backgroundColor: 'oklch(48% 0.13 240)' }}>Sistema</span>
      : <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold" style={{ backgroundColor: 'oklch(100% 0 0 / 8%)', color: 'var(--color-ink-muted)' }}>Histórico</span>,
  },
]

const COLORS = [
  'oklch(27% 0.09 252)', 'oklch(48% 0.13 240)', 'oklch(52% 0.22 15)',
  'oklch(56% 0.18 145)', 'oklch(70% 0.16 65)', 'oklch(60% 0.14 300)',
]

function ResumenIndicador({
  titulo, descripcion, icon: Icon, entregables,
}: {
  titulo: string; descripcion: string; icon: React.ElementType
  entregables: Entregable[]
}) {
  const total = entregables.length
  const conAvance = entregables.filter((e) => e.pct_avance != null)
  const avanceProm = conAvance.length
    ? Math.round(conAvance.reduce((s, e) => s + (e.pct_avance ?? 0), 0) / conAvance.length)
    : null

  // Distribución por cliente (top 8)
  const porCliente = Object.entries(
    entregables.reduce<Record<string, number>>((acc, e) => {
      const nombre = e.clientes?.cliente ?? 'Sin cliente'
      acc[nombre] = (acc[nombre] ?? 0) + 1
      return acc
    }, {}),
  )
    .map(([name, value]) => ({ name: name.length > 16 ? name.slice(0, 16) + '…' : name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: easeOut }}
      className="rounded-2xl p-5"
      style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary-muted)', color: 'var(--color-primary)' }}>
          <Icon size={14} />
        </div>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-ink)', letterSpacing: '-0.03em' }}>{titulo}</h3>
      </div>
      <p className="text-[11px] mb-4" style={{ color: 'var(--color-ink-muted)' }}>{descripcion}</p>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl px-3 py-2" style={{ backgroundColor: 'oklch(100% 0 0 / 3%)' }}>
          <span className="text-[9px] uppercase font-semibold tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>Registros</span>
          <p className="text-lg font-bold" style={{ color: 'var(--color-ink)' }}>{total}</p>
        </div>
        <div className="rounded-xl px-3 py-2" style={{ backgroundColor: 'oklch(100% 0 0 / 3%)' }}>
          <span className="text-[9px] uppercase font-semibold tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>Avance promedio</span>
          <p className="text-lg font-bold" style={{ color: 'var(--color-ink)' }}>{avanceProm != null ? `${avanceProm}%` : '—'}</p>
        </div>
      </div>

      {/* Distribución por cliente */}
      {porCliente.length > 0 ? (
        <ResponsiveContainer width="100%" height={Math.max(120, porCliente.length * 28)}>
          <BarChart data={porCliente} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(100% 0 0 / 8%)" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--color-ink-muted)' }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10, fill: 'var(--color-ink-muted)' }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: 'oklch(100% 0 0 / 4%)' }}
              contentStyle={{ backgroundColor: 'var(--color-primary)', border: 'none', borderRadius: 8, fontSize: 11, color: 'white' }}
            />
            <Bar dataKey="value" name="Entregables" radius={[0, 6, 6, 0]} maxBarSize={16}>
              {porCliente.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-24 flex items-center justify-center text-xs" style={{ color: 'var(--color-ink-subtle)' }}>
          Sin registros todavía
        </div>
      )}
    </motion.div>
  )
}

export default function IndicadoresPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const { usuario: currentUser } = useAuth()
  const isAdmin = currentUser?.rol === 'Admin'
  const [modal, setModal] = useState<{ open: boolean; row: Indicador | null }>({ open: false, row: null })
  const [form, setForm] = useState({ nombre: '' })

  const { data: indicadores = [], isLoading } = useQuery<Indicador[]>({
    queryKey: ['indicadores'],
    queryFn: async () => { const { data } = await api.get<Indicador[]>('/indicadores'); return data },
  })
  const { data: entregables = [] } = useQuery<Entregable[]>({
    queryKey: ['entregables'],
    queryFn: async () => { const { data } = await api.get<Entregable[]>('/entregables'); return data },
  })

  const plan = indicadores.find((i) => i.nombre.trim().toUpperCase() === 'PLAN DE ENTREGABLES')
  const exactitud = indicadores.find((i) => i.nombre.trim().toUpperCase() === 'EXACTITUD DE CÁLCULOS')

  const entregablesPlan = plan ? entregables.filter((e) => e.indicador_id === plan.id) : []
  const entregablesExactitud = exactitud ? entregables.filter((e) => e.indicador_id === exactitud.id) : []

  const save = useMutation({
    mutationFn: async () => {
      if (modal.row) await api.patch(`/indicadores/${modal.row.id}`, { nombre: form.nombre })
      else await api.post('/indicadores', { nombre: form.nombre })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['indicadores'] })
      setModal({ open: false, row: null })
      toast.success(modal.row ? 'Indicador actualizado' : 'Indicador creado')
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e?.response?.data?.message ?? 'Error al guardar')
    },
  })

  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/indicadores/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['indicadores'] }); toast.success('Indicador eliminado') },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e?.response?.data?.message ?? 'Error al eliminar')
    },
  })

  function open(row?: Indicador) {
    setModal({ open: true, row: row ?? null })
    setForm({ nombre: row?.nombre ?? '' })
  }

  return (
    <div className="max-w-6xl">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: easeOut }} className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <BarChart2 size={14} style={{ color: 'var(--color-accent)' }} />
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-accent)', letterSpacing: '0.1em' }}>Indicadores</span>
        </div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-ink)', letterSpacing: '-0.05em' }}>Indicadores del sistema</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-ink-muted)' }}>
          Dos indicadores base miden el cumplimiento: por fechas (Plan de Entregables) y por cantidades (Exactitud de Cálculos).
        </p>
      </motion.div>

      {/* Resúmenes separados */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ResumenIndicador
          titulo="Plan de Entregables"
          descripcion="Cumplimiento por fecha: compromiso vs entrega real."
          icon={CalendarCheck}
          entregables={entregablesPlan}
        />
        <ResumenIndicador
          titulo="Exactitud de Cálculos"
          descripcion="Cumplimiento por cantidad: compromiso vs resultados correctos."
          icon={Calculator}
          entregables={entregablesExactitud}
        />
      </div>

      {/* Catálogo de indicadores */}
      <DataTable
        data={indicadores} columns={COLS} loading={isLoading} searchKeys={['nombre']}
        onAdd={isAdmin ? () => open() : undefined}
        onEdit={isAdmin ? open : undefined}
        onDelete={isAdmin ? (row) => del.mutate(row.id) : undefined}
        addLabel="Nuevo indicador"
      />

      <Modal open={modal.open} onClose={() => setModal({ open: false, row: null })} title={modal.row ? 'Editar indicador' : 'Nuevo indicador'}>
        <div className="flex flex-col gap-4">
          <FormField label="Nombre" required value={form.nombre} onChange={(e) => setForm({ nombre: e.target.value })} />
          <ModalActions
            onClose={() => setModal({ open: false, row: null })}
            onSave={() => save.mutate()} isPending={save.isPending}
            disabled={!form.nombre.trim()}
          />
        </div>
      </Modal>
    </div>
  )
}
