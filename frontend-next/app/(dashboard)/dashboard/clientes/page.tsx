'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { easeOut } from '@/lib/easing'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, Legend,
} from 'recharts'
import { Building2, TrendingUp, Target, Users } from 'lucide-react'
import { api } from '@/lib/api'
import DataTable, { type Column } from '@/components/ui/DataTable'
import Modal from '@/components/ui/Modal'
import FormField from '@/components/ui/FormField'
import ModalActions from '@/components/ui/ModalActions'
import { useToast } from '@/context/ToastContext'

interface Grupo { id: number; nombre: string }
interface UsuarioRow { id: number; nombre: string; usuario: string; rol: string }
interface Cliente {
  id: number; cliente: string; grupo_id: number
  pct_puntualidad: number | null; pct_exactitud: number | null
  pct_contratacion: number | null; fecha: string | null; mostrar: boolean
}

const empty = { cliente: '', grupo_id: '', pct_puntualidad: '', pct_exactitud: '', pct_contratacion: '', fecha: '' }

const BRAND_COLORS = [
  'oklch(27% 0.09 252)', 'oklch(48% 0.13 240)', 'oklch(52% 0.22 15)',
  'oklch(56% 0.18 145)', 'oklch(70% 0.16 65)', 'oklch(60% 0.14 300)',
]

function ChartCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
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

const CustomScatterTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: Cliente }[] }) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-xl shadow-xl px-3 py-2.5 text-xs" style={{ backgroundColor: 'var(--color-primary)', color: 'white', border: 'none' }}>
      <p className="font-semibold mb-1">{d.cliente}</p>
      <p>Puntualidad: {d.pct_puntualidad ?? '—'}%</p>
      <p>Exactitud: {d.pct_exactitud ?? '—'}%</p>
    </div>
  )
}

export default function ClientesPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const [modal, setModal] = useState<{ open: boolean; row: Cliente | null }>({ open: false, row: null })
  const [form, setForm] = useState(empty)
  const [error, setError] = useState('')

  // Modal de asignaciones cliente ↔ usuario
  const [asigModal, setAsigModal] = useState<{ open: boolean; cliente: Cliente | null }>({ open: false, cliente: null })
  const [asigLider, setAsigLider] = useState('')
  const [asigAnalistas, setAsigAnalistas] = useState<number[]>([])

  const { data: clientes = [], isLoading } = useQuery<Cliente[]>({
    queryKey: ['clientes'],
    queryFn: async () => { const { data } = await api.get<Cliente[]>('/clientes'); return data },
  })
  const { data: grupos = [] } = useQuery<Grupo[]>({
    queryKey: ['grupos'],
    queryFn: async () => { const { data } = await api.get<Grupo[]>('/grupos'); return data },
  })
  const { data: usuarios = [] } = useQuery<UsuarioRow[]>({
    queryKey: ['usuarios'],
    queryFn: async () => { const { data } = await api.get<UsuarioRow[]>('/usuarios'); return data },
  })

  const grupoMap = Object.fromEntries(grupos.map((g) => [g.id, g.nombre]))
  const lideres = usuarios.filter((u) => u.rol === 'Lider')
  const analistas = usuarios.filter((u) => u.rol === 'Analista')

  // Cargar asignaciones actuales al abrir el modal
  async function openAsig(cliente: Cliente) {
    setAsigModal({ open: true, cliente })
    setAsigLider('')
    setAsigAnalistas([])
    try {
      const { data } = await api.get<{ usuario_id: number; rol: string }[]>(`/usuario-clientes?cliente_id=${cliente.id}`)
      const l = data.find((a) => a.rol === 'Lider')
      setAsigLider(l ? String(l.usuario_id) : '')
      setAsigAnalistas(data.filter((a) => a.rol === 'Analista').map((a) => a.usuario_id))
    } catch { /* sin asignaciones */ }
  }

  const saveAsig = useMutation({
    mutationFn: async () => {
      const asignaciones: { usuario_id: number; rol: string }[] = []
      if (asigLider) asignaciones.push({ usuario_id: Number(asigLider), rol: 'Lider' })
      asigAnalistas.forEach((id) => asignaciones.push({ usuario_id: id, rol: 'Analista' }))
      await api.put('/usuario-clientes/sync', { cliente_id: asigModal.cliente!.id, asignaciones })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mis-clientes'] })
      setAsigModal({ open: false, cliente: null })
      toast.success('Asignaciones guardadas')
    },
    onError: () => toast.error('Error al guardar las asignaciones'),
  })

  const COLS: Column<Cliente>[] = [
    { key: 'id', label: 'ID' },
    { key: 'cliente', label: 'Cliente' },
    { key: 'grupo_id', label: 'Grupo ID' },
    { key: 'pct_puntualidad', label: 'Puntualidad %', render: (r) => r.pct_puntualidad != null ? `${r.pct_puntualidad}%` : '—' },
    { key: 'pct_exactitud', label: 'Exactitud %', render: (r) => r.pct_exactitud != null ? `${r.pct_exactitud}%` : '—' },
    { key: 'fecha', label: 'Fecha', render: (r) => r.fecha ?? '—' },
    {
      key: 'asignaciones', label: 'Equipo',
      render: (r) => (
        <button
          onClick={() => openAsig(r)}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium cursor-pointer transition-colors"
          style={{ backgroundColor: 'var(--color-primary-muted)', color: 'var(--color-primary)' }}
        >
          <Users size={11} /> Asignar
        </button>
      ),
    },
  ]

  // Datos para scatter: puntualidad vs exactitud
  const scatterData = clientes
    .filter((c) => c.pct_puntualidad != null && c.pct_exactitud != null)
    .map((c) => ({ ...c, x: c.pct_puntualidad!, y: c.pct_exactitud! }))

  // Barras por grupo: promedio de puntualidad
  const byGrupo = grupos.map((g) => {
    const gClientes = clientes.filter((c) => c.grupo_id === g.id && c.pct_puntualidad != null)
    const avg = gClientes.length ? gClientes.reduce((s, c) => s + c.pct_puntualidad!, 0) / gClientes.length : 0
    return { name: g.nombre.length > 12 ? g.nombre.slice(0, 12) + '…' : g.nombre, puntualidad: Math.round(avg) }
  }).filter((g) => g.puntualidad > 0)

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        cliente: form.cliente, grupo_id: Number(form.grupo_id),
        pct_puntualidad: form.pct_puntualidad ? Number(form.pct_puntualidad) : null,
        pct_exactitud: form.pct_exactitud ? Number(form.pct_exactitud) : null,
        pct_contratacion: form.pct_contratacion ? Number(form.pct_contratacion) : null,
        fecha: form.fecha || null,
      }
      if (modal.row) await api.patch(`/clientes/${modal.row.id}`, payload)
      else await api.post('/clientes', payload)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clientes'] }); close(); toast.success(modal.row ? 'Cliente actualizado' : 'Cliente creado') },
    onError: () => { setError('Error al guardar'); toast.error('Error al guardar el cliente') },
  })
  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/clientes/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clientes'] }); toast.success('Cliente eliminado') },
    onError: () => toast.error('Error al eliminar el cliente'),
  })

  function open(row?: Cliente) {
    setModal({ open: true, row: row ?? null })
    setForm(row ? {
      cliente: row.cliente, grupo_id: String(row.grupo_id),
      pct_puntualidad: row.pct_puntualidad != null ? String(row.pct_puntualidad) : '',
      pct_exactitud: row.pct_exactitud != null ? String(row.pct_exactitud) : '',
      pct_contratacion: row.pct_contratacion != null ? String(row.pct_contratacion) : '',
      fecha: row.fecha ?? '',
    } : empty)
    setError('')
  }
  function close() { setModal({ open: false, row: null }) }
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: easeOut }}>
        <div className="flex items-center gap-2 mb-1">
          <Building2 size={14} style={{ color: 'var(--color-accent)' }} />
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-accent)', letterSpacing: '0.1em' }}>Clientes</span>
        </div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-ink)', letterSpacing: '-0.05em' }}>
          Gestión de Clientes
        </h1>
      </motion.div>

      {/* Gráficas — solo si hay datos */}
      {clientes.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <ChartCard title="Puntualidad vs Exactitud" icon={Target}>
            {scatterData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <ScatterChart margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis
                    dataKey="x" name="Puntualidad" unit="%" type="number" domain={[0, 100]}
                    tick={{ fontSize: 11, fill: 'var(--color-ink-subtle)' }}
                    tickLine={false} axisLine={{ stroke: 'var(--color-border)' }}
                    label={{ value: 'Puntualidad %', position: 'insideBottom', offset: -2, fontSize: 10, fill: 'var(--color-ink-subtle)' }}
                  />
                  <YAxis
                    dataKey="y" name="Exactitud" unit="%" type="number" domain={[0, 100]}
                    tick={{ fontSize: 11, fill: 'var(--color-ink-subtle)' }}
                    tickLine={false} axisLine={false}
                    label={{ value: 'Exactitud %', angle: -90, position: 'insideLeft', fontSize: 10, fill: 'var(--color-ink-subtle)' }}
                  />
                  <Tooltip content={<CustomScatterTooltip />} cursor={{ strokeDasharray: '4 4', stroke: 'var(--color-border-strong)' }} />
                  <Scatter
                    data={scatterData}
                    fill="oklch(27% 0.09 252)"
                    opacity={0.8}
                    shape={(props: { cx?: number; cy?: number; payload?: Cliente }) => {
                      const { cx = 0, cy = 0 } = props
                      return (
                        <motion.circle
                          cx={cx} cy={cy} r={6}
                          fill="oklch(48% 0.13 240)"
                          stroke="oklch(27% 0.09 252)"
                          strokeWidth={1.5}
                          opacity={0.85}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 20, delay: Math.random() * 0.3 }}
                        />
                      )
                    }}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-sm" style={{ color: 'var(--color-ink-subtle)' }}>
                Sin datos de indicadores aún
              </div>
            )}
          </ChartCard>

          <ChartCard title="Puntualidad promedio por grupo" icon={TrendingUp}>
            {byGrupo.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byGrupo} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--color-ink-subtle)' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--color-ink-subtle)' }} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--color-primary)', border: 'none', borderRadius: 12, color: 'white', fontSize: 12 }}
                    labelStyle={{ fontWeight: 600, color: 'white' }}
                    cursor={{ fill: 'var(--color-border)' }}
                    formatter={(v) => [`${v}%`, 'Puntualidad']}
                  />
                  <Bar dataKey="puntualidad" radius={[6, 6, 0, 0]} maxBarSize={48} isAnimationActive animationDuration={700} animationEasing="ease-out">
                    {byGrupo.map((_, i) => (
                      <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-sm" style={{ color: 'var(--color-ink-subtle)' }}>
                Sin grupos con datos
              </div>
            )}
          </ChartCard>
        </div>
      )}

      {/* Tabla */}
      <DataTable
        data={clientes} columns={COLS} loading={isLoading} searchKeys={['cliente']}
        onAdd={() => open()} onEdit={open} onDelete={(row) => del.mutate(row.id)}
        addLabel="Nuevo cliente"
      />

      <Modal open={modal.open} onClose={close} title={modal.row ? 'Editar cliente' : 'Nuevo cliente'} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <FormField label="Nombre del cliente" required value={form.cliente} onChange={set('cliente')} error={error} />
          </div>
          <FormField as="select" label="Grupo" required value={form.grupo_id} onChange={set('grupo_id')}>
            <option value="">Selecciona…</option>
            {grupos.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          </FormField>
          <FormField label="Fecha" type="date" value={form.fecha} onChange={set('fecha')} />
          <FormField label="% Puntualidad" type="number" min="0" max="100" step="0.01" value={form.pct_puntualidad} onChange={set('pct_puntualidad')} />
          <FormField label="% Exactitud" type="number" min="0" max="100" step="0.01" value={form.pct_exactitud} onChange={set('pct_exactitud')} />
          <FormField label="% Contratación" type="number" min="0" max="100" step="0.01" value={form.pct_contratacion} onChange={set('pct_contratacion')} />
          <ModalActions colSpan onClose={close} onSave={() => save.mutate()} isPending={save.isPending} disabled={!form.cliente.trim() || !form.grupo_id} />
        </div>
      </Modal>

      {/* Modal de asignaciones */}
      <Modal open={asigModal.open} onClose={() => setAsigModal({ open: false, cliente: null })} title={`Equipo · ${asigModal.cliente?.cliente ?? ''}`} size="lg">
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>Líder del cliente</label>
            <select value={asigLider} onChange={(e) => setAsigLider(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg text-xs outline-none"
              style={{ backgroundColor: 'oklch(100% 0 0 / 5%)', border: '1px solid var(--color-border)', color: 'var(--color-ink)' }}>
              <option value="">Sin líder</option>
              {lideres.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>
              Analistas asignados ({asigAnalistas.length})
            </label>
            <div className="mt-2 grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto p-2 rounded-lg" style={{ backgroundColor: 'oklch(100% 0 0 / 3%)' }}>
              {analistas.map((u) => {
                const checked = asigAnalistas.includes(u.id)
                return (
                  <label key={u.id} className="flex items-center gap-2 text-xs cursor-pointer select-none px-2 py-1.5 rounded-md" style={{ color: 'var(--color-ink)' }}>
                    <input type="checkbox" checked={checked} className="w-3.5 h-3.5 rounded"
                      style={{ accentColor: 'var(--color-accent)' }}
                      onChange={() => setAsigAnalistas((xs) => checked ? xs.filter((x) => x !== u.id) : [...xs, u.id])} />
                    <span className="truncate">{u.nombre}</span>
                  </label>
                )
              })}
              {analistas.length === 0 && <p className="text-xs col-span-2" style={{ color: 'var(--color-ink-muted)' }}>No hay usuarios con rol Analista</p>}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setAsigModal({ open: false, cliente: null })}
              className="px-3 py-2 rounded-lg text-xs font-medium cursor-pointer"
              style={{ backgroundColor: 'oklch(100% 0 0 / 5%)', color: 'var(--color-ink-muted)' }}>
              Cancelar
            </button>
            <button onClick={() => saveAsig.mutate()} disabled={saveAsig.isPending}
              className="px-3 py-2 rounded-lg text-xs font-medium text-white cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-accent)' }}>
              Guardar asignaciones
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
