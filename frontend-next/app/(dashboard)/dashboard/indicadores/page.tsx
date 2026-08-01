'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts'
import { BarChart2, Activity } from 'lucide-react'
import { api } from '@/lib/api'
import DataTable, { type Column } from '@/components/ui/DataTable'
import Modal from '@/components/ui/Modal'
import FormField from '@/components/ui/FormField'
import ModalActions from '@/components/ui/ModalActions'

interface Indicador { id: number; nombre: string; mostrar: boolean }
interface Entregable { id: number; indicador_id: number; pct_avance: number | null; mes: number; anio: number }

const COLS: Column<Indicador>[] = [
  { key: 'id', label: 'ID' },
  { key: 'nombre', label: 'Nombre' },
]

const COLORS = ['oklch(27% 0.09 252)','oklch(48% 0.13 240)','oklch(52% 0.22 15)','oklch(56% 0.18 145)','oklch(70% 0.16 65)','oklch(60% 0.14 300)']

function ChartCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
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

export default function IndicadoresPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<{ open: boolean; row: Indicador | null }>({ open: false, row: null })
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState('')

  const { data = [], isLoading } = useQuery<Indicador[]>({
    queryKey: ['indicadores'],
    queryFn: async () => { const { data } = await api.get<Indicador[]>('/indicadores'); return data },
  })
  const { data: entregables = [] } = useQuery<Entregable[]>({
    queryKey: ['entregables'],
    queryFn: async () => { const { data } = await api.get<Entregable[]>('/entregables'); return data },
  })

  // Barras horizontales: entregables por indicador
  const porIndicador = data.map((ind) => {
    const ents = entregables.filter((e) => e.indicador_id === ind.id)
    const avgAvance = ents.length ? ents.reduce((s, e) => s + (e.pct_avance ?? 0), 0) / ents.length : 0
    return {
      name: ind.nombre.length > 18 ? ind.nombre.slice(0, 18) + '…' : ind.nombre,
      entregables: ents.length,
      avance: Math.round(avgAvance),
    }
  }).filter((d) => d.entregables > 0).slice(0, 8)

  // Radar: cobertura por indicador (número de entregables / max)
  const maxEnt = Math.max(...porIndicador.map((d) => d.entregables), 1)
  const radarData = porIndicador.slice(0, 6).map((d) => ({
    subject: d.name,
    A: Math.round((d.entregables / maxEnt) * 100),
    fullMark: 100,
  }))

  const save = useMutation({
    mutationFn: async () => {
      if (modal.row) await api.patch(`/indicadores/${modal.row.id}`, { nombre })
      else await api.post('/indicadores', { nombre })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['indicadores'] }); close() },
    onError: () => setError('Error al guardar'),
  })
  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/indicadores/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['indicadores'] }),
  })

  function open(row?: Indicador) { setModal({ open: true, row: row ?? null }); setNombre(row?.nombre ?? ''); setError('') }
  function close() { setModal({ open: false, row: null }) }

  return (
    <div className="max-w-6xl space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}>
        <div className="flex items-center gap-2 mb-1">
          <BarChart2 size={14} style={{ color: 'var(--color-accent)' }} />
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-accent)', letterSpacing: '0.1em' }}>Indicadores</span>
        </div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-ink)', letterSpacing: '-0.05em' }}>Indicadores de Desempeño</h1>
      </motion.div>

      {porIndicador.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-3">
            <ChartCard title="Entregables y avance por indicador" icon={BarChart2}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={porIndicador} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--color-ink-subtle)' }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10, fill: 'var(--color-ink-muted)' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--color-primary)', border: 'none', borderRadius: 12, color: 'white', fontSize: 12 }}
                    formatter={(v, n) => [v, n === 'entregables' ? 'Entregables' : 'Avance %']}
                    cursor={{ fill: 'var(--color-border)' }}
                  />
                  <Bar dataKey="entregables" radius={[0, 6, 6, 0]} maxBarSize={18} isAnimationActive animationDuration={700}>
                    {porIndicador.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                  <Bar dataKey="avance" radius={[0, 6, 6, 0]} maxBarSize={18} fill="oklch(48% 0.13 240 / 30%)" isAnimationActive animationDuration={900} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="lg:col-span-2">
            <ChartCard title="Cobertura relativa" icon={Activity}>
              {radarData.length >= 3 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="var(--color-border)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: 'var(--color-ink-muted)' }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Radar name="Cobertura" dataKey="A" stroke="oklch(27% 0.09 252)" fill="oklch(27% 0.09 252)" fillOpacity={0.2} strokeWidth={2} isAnimationActive animationDuration={800} />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[240px] flex items-center justify-center text-sm" style={{ color: 'var(--color-ink-subtle)' }}>
                  Necesitas ≥3 indicadores con entregables
                </div>
              )}
            </ChartCard>
          </div>
        </div>
      )}

      <DataTable data={data} columns={COLS} loading={isLoading} searchKeys={['nombre']}
        onAdd={() => open()} onEdit={open} onDelete={(row) => del.mutate(row.id)} addLabel="Nuevo indicador" />

      <Modal open={modal.open} onClose={close} title={modal.row ? 'Editar indicador' : 'Nuevo indicador'}>
        <div className="flex flex-col gap-4">
          <FormField label="Nombre" required value={nombre} onChange={(e) => setNombre((e.target as HTMLInputElement).value)} error={error} />
          <ModalActions onClose={close} onSave={() => save.mutate()} isPending={save.isPending} disabled={!nombre.trim()} />
        </div>
      </Modal>
    </div>
  )
}
