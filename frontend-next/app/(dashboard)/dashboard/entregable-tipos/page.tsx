'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { easeOut } from '@/lib/easing'
import { Tags } from 'lucide-react'
import { api } from '@/lib/api'
import DataTable, { type Column } from '@/components/ui/DataTable'
import FilterBar, { type FilterDef } from '@/components/ui/FilterBar'
import Modal from '@/components/ui/Modal'
import FormField from '@/components/ui/FormField'
import Badge from '@/components/ui/Badge'
import ModalActions from '@/components/ui/ModalActions'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/context/AuthContext'

interface Indicador { id: number; nombre: string; es_sistema: boolean }
interface ClienteRow { id: number; cliente: string }
interface EntregableTipo {
  id: number; indicador_id: number; nombre: string
  orden: number; mostrar: boolean; cliente_id: number | null
  activo: boolean
}

const empty = { cliente_id: '', indicador_id: '', nombre: '', orden: '1', mostrar: 'true', activo: 'true' }

export default function EntregableTiposPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const { usuario: currentUser } = useAuth()
  const isLider = currentUser?.rol === 'Lider'
  const isAdmin = currentUser?.rol === 'Admin'

  const [modal, setModal] = useState<{ open: boolean; row: EntregableTipo | null }>({ open: false, row: null })
  const [form, setForm] = useState(empty)
  const [error, setError] = useState('')
  const [filtros, setFiltros] = useState<Record<string, string>>({})

  const { data: tipos = [], isLoading } = useQuery<EntregableTipo[]>({
    queryKey: ['entregable-tipos'],
    queryFn: async () => { const { data } = await api.get<EntregableTipo[]>('/entregable-tipos'); return data },
  })
  const { data: indicadores = [] } = useQuery<Indicador[]>({
    queryKey: ['indicadores'],
    queryFn: async () => { const { data } = await api.get<Indicador[]>('/indicadores'); return data },
  })
  const { data: clientes = [] } = useQuery<ClienteRow[]>({
    queryKey: ['clientes'],
    queryFn: async () => { const { data } = await api.get<ClienteRow[]>('/clientes'); return data },
  })
  // Clientes del líder (para restringir el dropdown)
  const { data: misClientes = [] } = useQuery<ClienteRow[]>({
    queryKey: ['mis-clientes', currentUser?.id],
    queryFn: async () => { const { data } = await api.get<ClienteRow[]>('/clientes/mis-clientes'); return data },
    enabled: isLider,
  })

  const indicadorMap = Object.fromEntries(indicadores.map((i) => [i.id, i.nombre]))
  const clienteMap = Object.fromEntries(clientes.map((c) => [c.id, c.cliente]))
  const sistemaIndicadores = indicadores.filter((i) => i.es_sistema)

  // Clientes disponibles: líder ve solo los suyos
  const clientesDisponibles = isLider ? misClientes : clientes

  // Solo conceptos del nuevo modelo (con cliente asociado)
  const conceptos = useMemo(() => tipos.filter((t) => t.cliente_id != null), [tipos])

  const visibles = useMemo(() => {
    return conceptos
      .filter((t) => !filtros.cliente_id || t.cliente_id === Number(filtros.cliente_id))
      .filter((t) => !filtros.indicador_id || t.indicador_id === Number(filtros.indicador_id))
      .filter((t) => !filtros.mostrar || String(t.mostrar) === filtros.mostrar)
      .filter((t) => !filtros.activo || String(t.activo) === filtros.activo)
      .filter((t) => !isLider || misClientes.some((c) => c.id === t.cliente_id))
      .sort((a, b) => (a.cliente_id ?? 0) - (b.cliente_id ?? 0) || a.indicador_id - b.indicador_id || a.orden - b.orden)
  }, [conceptos, filtros, isLider, misClientes])

  const FILTROS: FilterDef[] = [
    { key: 'cliente_id', label: 'Cliente', span: 2, options: clientesDisponibles.map((c) => ({ value: String(c.id), label: c.cliente })) },
    { key: 'indicador_id', label: 'Indicador', span: 2, options: sistemaIndicadores.map((i) => ({ value: String(i.id), label: i.nombre })) },
    { key: 'mostrar', label: 'Visibilidad', options: [{ value: 'true', label: 'Visibles' }, { value: 'false', label: 'Ocultos' }] },
    { key: 'activo', label: 'Estado', options: [{ value: 'true', label: 'Activos' }, { value: 'false', label: 'Inactivos' }] },
  ]

  const COLS: Column<EntregableTipo>[] = [
    { key: 'id', label: 'ID' },
    { key: 'cliente_id', label: 'Cliente', render: (r) => clienteMap[r.cliente_id ?? 0] ?? '—' },
    { key: 'indicador_id', label: 'Indicador', render: (r) => indicadorMap[r.indicador_id] ?? r.indicador_id },
    { key: 'nombre', label: 'Concepto' },
    { key: 'orden', label: 'Orden', render: (r) => <span className="tabular-nums">{r.orden}</span> },
    {
      key: 'mostrar', label: 'Visible',
      render: (r) => <Badge variant={r.mostrar ? 'success' : 'muted'}>{r.mostrar ? 'Sí' : 'No'}</Badge>,
    },
    {
      key: 'activo', label: 'Estado',
      render: (r) => <Badge variant={r.activo ? 'success' : 'danger'}>{r.activo ? 'Activo' : 'Inactivo'}</Badge>,
    },
  ]

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        cliente_id: Number(form.cliente_id),
        indicador_id: Number(form.indicador_id),
        nombre: form.nombre.trim(),
        orden: Number(form.orden) || 1,
        mostrar: form.mostrar === 'true',
        activo: form.activo === 'true',
      }
      if (modal.row) await api.patch(`/entregable-tipos/${modal.row.id}`, payload)
      else await api.post('/entregable-tipos', payload)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['entregable-tipos'] }); close(); toast.success(modal.row ? 'Concepto actualizado' : 'Concepto creado') },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      const msg = e?.response?.data?.message ?? 'Error al guardar'
      setError(msg); toast.error(msg)
    },
  })

  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/entregable-tipos/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['entregable-tipos'] }); toast.success('Concepto eliminado') },
    onError: () => toast.error('No se pudo eliminar: puede haber entregables que usan este concepto.'),
  })

  function open(row?: EntregableTipo) {
    setModal({ open: true, row: row ?? null })
    setForm(row
      ? {
          cliente_id: String(row.cliente_id ?? ''), indicador_id: String(row.indicador_id),
          nombre: row.nombre, orden: String(row.orden), mostrar: String(row.mostrar), activo: String(row.activo),
        }
      : { ...empty, cliente_id: filtros.cliente_id ?? '', indicador_id: filtros.indicador_id ?? '' })
    setError('')
  }
  function close() { setModal({ open: false, row: null }) }
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const canSave = form.cliente_id && form.indicador_id && form.nombre.trim()

  // El analista no gestiona el catálogo
  if (currentUser && !isAdmin && !isLider) return null

  return (
    <div className="max-w-6xl space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: easeOut }}>
        <div className="flex items-center gap-2 mb-1">
          <Tags size={14} style={{ color: 'var(--color-accent)' }} />
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-accent)', letterSpacing: '0.1em' }}>Catálogo</span>
        </div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-ink)', letterSpacing: '-0.05em' }}>Entregables por cliente</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-ink-muted)' }}>
          Conceptos configurados por cliente dentro de Plan de Entregables (fechas) o Exactitud de Cálculos (cantidades).
          {isLider && ' Solo ves los clientes donde eres líder.'}
        </p>
      </motion.div>

      <FilterBar
        filters={FILTROS} values={filtros}
        onChange={(k, v) => setFiltros((f) => ({ ...f, [k]: v }))}
        onReset={() => setFiltros({})}
        summary={
          <span className="text-xs tabular-nums" style={{ color: 'var(--color-ink-muted)' }}>
            {visibles.length} concepto{visibles.length === 1 ? '' : 's'}
          </span>
        }
      />

      <DataTable
        data={visibles} columns={COLS} loading={isLoading} searchKeys={['nombre']}
        onAdd={() => open()} onEdit={open} onDelete={(row) => del.mutate(row.id)}
        addLabel="Nuevo concepto"
      />

      <Modal open={modal.open} onClose={close} title={modal.row ? 'Editar concepto' : 'Nuevo concepto'}>
        <div className="flex flex-col gap-4">
          <FormField as="select" label="Cliente" required value={form.cliente_id} onChange={set('cliente_id')}>
            <option value="">Selecciona…</option>
            {clientesDisponibles.map((c) => <option key={c.id} value={c.id}>{c.cliente}</option>)}
          </FormField>
          <FormField as="select" label="Indicador" required value={form.indicador_id} onChange={set('indicador_id')}>
            <option value="">Selecciona…</option>
            {sistemaIndicadores.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
          </FormField>
          <FormField label="Nombre del concepto" required value={form.nombre} onChange={set('nombre')} placeholder="Reporte de nómina primera quincena…" />
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Orden" type="number" min="1" value={form.orden} onChange={set('orden')} />
            <FormField as="select" label="Visible" value={form.mostrar} onChange={set('mostrar')}>
              <option value="true">Sí</option>
              <option value="false">No</option>
            </FormField>
            <FormField as="select" label="Estado" value={form.activo} onChange={set('activo')}>
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </FormField>
          </div>
          {error && <p className="text-xs" style={{ color: 'var(--color-accent)' }}>{error}</p>}
          <ModalActions onClose={close} onSave={() => save.mutate()} isPending={save.isPending} disabled={!canSave} />
        </div>
      </Modal>
    </div>
  )
}
