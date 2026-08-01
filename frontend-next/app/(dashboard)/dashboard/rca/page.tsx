'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { easeOut } from '@/lib/easing'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import type { PieLabelRenderProps } from 'recharts'
import { AlertTriangle, PieChart as PieIcon, TrendingUp } from 'lucide-react'
import { api } from '@/lib/api'
import DataTable, { type Column } from '@/components/ui/DataTable'
import Modal from '@/components/ui/Modal'
import FormField from '@/components/ui/FormField'
import ModalActions from '@/components/ui/ModalActions'

interface Grupo { id: number; nombre: string }
interface Cliente { id: number; cliente: string }
interface TipoRca { id: number; descripcion: string }
interface RcaRecord {
  id: number; codigo: string | null; anio: number; grupo_id: number
  mes: number; cliente_id: number; tipo_rca_id: number
  errores: string | null; acciones_mejora: string | null
}

const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const empty = { codigo: '', anio: String(new Date().getFullYear()), grupo_id: '', mes: String(new Date().getMonth() + 1), cliente_id: '', tipo_rca_id: '', errores: '', acciones_mejora: '' }
const PIE_COLORS = ['oklch(27% 0.09 252)','oklch(52% 0.22 15)','oklch(48% 0.13 240)','oklch(56% 0.18 145)','oklch(70% 0.16 65)','oklch(60% 0.14 300)']

function ChartCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: easeOut }}
      className="rounded-2xl p-5"
      style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--color-accent-muted)', color: 'var(--color-accent)' }}>
          <Icon size={14} />
        </div>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-ink)', letterSpacing: '-0.03em' }}>{title}</h3>
      </div>
      {children}
    </motion.div>
  )
}

// Recharts declara estas props como opcionales, de ahí los valores por defecto.
const CustomLabel = ({ cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0 }: PieLabelRenderProps) => {
  if (percent < 0.06) return null
  const RADIAN = Math.PI / 180
  const r = Number(innerRadius) + (Number(outerRadius) - Number(innerRadius)) * 0.5
  const x = Number(cx) + r * Math.cos(-midAngle * RADIAN)
  const y = Number(cy) + r * Math.sin(-midAngle * RADIAN)
  return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>{`${(percent * 100).toFixed(0)}%`}</text>
}

export default function RcaPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<{ open: boolean; row: RcaRecord | null }>({ open: false, row: null })
  const [form, setForm] = useState(empty)
  const [error, setError] = useState('')

  const { data: rca = [], isLoading } = useQuery<RcaRecord[]>({ queryKey: ['rca'], queryFn: async () => { const { data } = await api.get<RcaRecord[]>('/rca'); return data } })
  const { data: grupos = [] } = useQuery<Grupo[]>({ queryKey: ['grupos'], queryFn: async () => { const { data } = await api.get<Grupo[]>('/grupos'); return data } })
  const { data: clientes = [] } = useQuery<Cliente[]>({ queryKey: ['clientes'], queryFn: async () => { const { data } = await api.get<Cliente[]>('/clientes'); return data } })
  const { data: tiposRca = [] } = useQuery<TipoRca[]>({ queryKey: ['tipo-rca'], queryFn: async () => { const { data } = await api.get<TipoRca[]>('/tipo-rca'); return data } })

  const clienteMap = Object.fromEntries(clientes.map((c) => [c.id, c.cliente]))
  const grupoMap = Object.fromEntries(grupos.map((g) => [g.id, g.nombre]))
  const tipoMap = Object.fromEntries(tiposRca.map((t) => [t.id, t.descripcion]))

  // Donut: RCA por tipo
  const porTipo = tiposRca.map((t) => ({
    name: t.descripcion.length > 20 ? t.descripcion.slice(0, 20) + '…' : t.descripcion,
    value: rca.filter((r) => r.tipo_rca_id === t.id).length,
  })).filter((t) => t.value > 0)

  // Barras: RCA por mes
  const porMes = MESES_CORTO.map((m, i) => ({
    mes: m,
    total: rca.filter((r) => r.mes === i + 1).length,
  })).filter((m) => m.total > 0)

  const COLS: Column<RcaRecord>[] = [
    { key: 'id', label: 'ID' },
    { key: 'codigo', label: 'Código', render: (r) => r.codigo ?? '—' },
    { key: 'mes', label: 'Período', render: (r) => `${MESES_CORTO[r.mes - 1]} ${r.anio}` },
    { key: 'cliente_id', label: 'Cliente', render: (r) => clienteMap[r.cliente_id] ?? r.cliente_id },
    { key: 'grupo_id', label: 'Grupo', render: (r) => grupoMap[r.grupo_id] ?? r.grupo_id },
    { key: 'tipo_rca_id', label: 'Tipo', render: (r) => tipoMap[r.tipo_rca_id] ?? r.tipo_rca_id },
  ]

  const save = useMutation({
    mutationFn: async () => {
      const payload = { codigo: form.codigo || null, anio: Number(form.anio), grupo_id: Number(form.grupo_id), mes: Number(form.mes), cliente_id: Number(form.cliente_id), tipo_rca_id: Number(form.tipo_rca_id), errores: form.errores || null, acciones_mejora: form.acciones_mejora || null }
      if (modal.row) await api.patch(`/rca/${modal.row.id}`, payload)
      else await api.post('/rca', payload)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rca'] }); close() },
    onError: () => setError('Error al guardar'),
  })
  const del = useMutation({ mutationFn: (id: number) => api.delete(`/rca/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['rca'] }) })

  function open(row?: RcaRecord) {
    setModal({ open: true, row: row ?? null })
    setForm(row ? { codigo: row.codigo ?? '', anio: String(row.anio), grupo_id: String(row.grupo_id), mes: String(row.mes), cliente_id: String(row.cliente_id), tipo_rca_id: String(row.tipo_rca_id), errores: row.errores ?? '', acciones_mejora: row.acciones_mejora ?? '' } : empty)
    setError('')
  }
  function close() { setModal({ open: false, row: null }) }
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const canSave = form.anio && form.grupo_id && form.mes && form.cliente_id && form.tipo_rca_id

  return (
    <div className="max-w-6xl space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: easeOut }}>
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle size={14} style={{ color: 'var(--color-accent)' }} />
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-accent)', letterSpacing: '0.1em' }}>RCA</span>
        </div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-ink)', letterSpacing: '-0.05em' }}>Análisis de Causa Raíz</h1>
      </motion.div>

      {rca.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-2">
            <ChartCard title="RCA por tipo" icon={PieIcon}>
              {porTipo.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={porTipo} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} labelLine={false} label={CustomLabel} isAnimationActive animationDuration={700}>
                      {porTipo.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'var(--color-primary)', border: 'none', borderRadius: 12, color: 'white', fontSize: 12 }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8, color: 'var(--color-ink-muted)' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="h-[240px] flex items-center justify-center text-sm" style={{ color: 'var(--color-ink-subtle)' }}>Sin tipos disponibles</div>}
            </ChartCard>
          </div>

          <div className="lg:col-span-3">
            <ChartCard title="Frecuencia de RCA por mes" icon={TrendingUp}>
              {porMes.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={porMes} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--color-ink-subtle)' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--color-ink-subtle)' }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--color-primary)', border: 'none', borderRadius: 12, color: 'white', fontSize: 12 }} formatter={(v) => [v, 'RCAs']} cursor={{ fill: 'var(--color-border)' }} />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={48} isAnimationActive animationDuration={700}>
                      {porMes.map((d, i) => (
                        <Cell key={i} fill={d.total > 3 ? 'var(--color-accent)' : 'oklch(27% 0.09 252)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="h-[240px] flex items-center justify-center text-sm" style={{ color: 'var(--color-ink-subtle)' }}>Sin datos por mes</div>}
            </ChartCard>
          </div>
        </div>
      )}

      <DataTable data={rca} columns={COLS} loading={isLoading} searchKeys={['codigo']}
        onAdd={() => open()} onEdit={open} onDelete={(row) => del.mutate(row.id)} addLabel="Nuevo RCA" />

      <Modal open={modal.open} onClose={close} title={modal.row ? 'Editar RCA' : 'Nuevo RCA'} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Código" value={form.codigo} onChange={set('codigo')} />
          <FormField label="Año" required type="number" min="2000" value={form.anio} onChange={set('anio')} />
          <FormField as="select" label="Mes" required value={form.mes} onChange={set('mes')}>
            {MESES_CORTO.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </FormField>
          <FormField as="select" label="Grupo" required value={form.grupo_id} onChange={set('grupo_id')}>
            <option value="">Selecciona…</option>
            {grupos.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          </FormField>
          <FormField as="select" label="Cliente" required value={form.cliente_id} onChange={set('cliente_id')}>
            <option value="">Selecciona…</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.cliente}</option>)}
          </FormField>
          <FormField as="select" label="Tipo RCA" required value={form.tipo_rca_id} onChange={set('tipo_rca_id')}>
            <option value="">Selecciona…</option>
            {tiposRca.map((t) => <option key={t.id} value={t.id}>{t.descripcion}</option>)}
          </FormField>
          <div className="col-span-2"><FormField as="textarea" label="Errores" value={form.errores} onChange={set('errores')} /></div>
          <div className="col-span-2"><FormField as="textarea" label="Acciones de mejora" value={form.acciones_mejora} onChange={set('acciones_mejora')} /></div>
          {error && <p className="col-span-2 text-xs" style={{ color: 'var(--color-accent)' }}>{error}</p>}
          <ModalActions colSpan onClose={close} onSave={() => save.mutate()} isPending={save.isPending} disabled={!canSave} />
        </div>
      </Modal>
    </div>
  )
}
