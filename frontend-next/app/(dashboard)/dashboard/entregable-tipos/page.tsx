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

interface Indicador { id: number; nombre: string }
interface EntregableTipo {
  id: number; indicador_id: number; nombre: string
  orden: number; mostrar: boolean
}

const empty = { indicador_id: '', nombre: '', orden: '1', mostrar: 'true' }

export default function EntregableTiposPage() {
  const qc = useQueryClient()
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

  const indicadorMap = Object.fromEntries(indicadores.map((i) => [i.id, i.nombre]))

  // El catálogo es grande (un puñado de tipos por cada indicador), así que
  // se filtra en cliente: ya está todo cargado.
  const visibles = useMemo(() => {
    return tipos
      .filter((t) => !filtros.indicador_id || t.indicador_id === Number(filtros.indicador_id))
      .filter((t) => !filtros.mostrar || String(t.mostrar) === filtros.mostrar)
      .sort((a, b) => a.indicador_id - b.indicador_id || a.orden - b.orden)
  }, [tipos, filtros])

  const FILTROS: FilterDef[] = [
    { key: 'indicador_id', label: 'Indicador', span: 2, options: indicadores.map((i) => ({ value: String(i.id), label: i.nombre })) },
    { key: 'mostrar', label: 'Visibilidad', options: [{ value: 'true', label: 'Visibles' }, { value: 'false', label: 'Ocultos' }] },
  ]

  const COLS: Column<EntregableTipo>[] = [
    { key: 'id', label: 'ID' },
    { key: 'indicador_id', label: 'Indicador', render: (r) => indicadorMap[r.indicador_id] ?? r.indicador_id },
    { key: 'nombre', label: 'Tipo' },
    { key: 'orden', label: 'Orden', render: (r) => <span className="tabular-nums">{r.orden}</span> },
    {
      key: 'mostrar', label: 'Visible',
      render: (r) => <Badge variant={r.mostrar ? 'success' : 'muted'}>{r.mostrar ? 'Sí' : 'No'}</Badge>,
    },
  ]

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        indicador_id: Number(form.indicador_id),
        nombre: form.nombre.trim(),
        orden: Number(form.orden) || 1,
        mostrar: form.mostrar === 'true',
      }
      if (modal.row) await api.patch(`/entregable-tipos/${modal.row.id}`, payload)
      else await api.post('/entregable-tipos', payload)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['entregable-tipos'] }); close() },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      setError(e?.response?.data?.message ?? 'Error al guardar'),
  })

  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/entregable-tipos/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['entregable-tipos'] }),
    onError: () => window.alert('No se pudo eliminar: puede haber entregables que usan este tipo.'),
  })

  function open(row?: EntregableTipo) {
    setModal({ open: true, row: row ?? null })
    setForm(row
      ? { indicador_id: String(row.indicador_id), nombre: row.nombre, orden: String(row.orden), mostrar: String(row.mostrar) }
      : { ...empty, indicador_id: filtros.indicador_id ?? '' })
    setError('')
  }
  function close() { setModal({ open: false, row: null }) }
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const canSave = form.indicador_id && form.nombre.trim()

  return (
    <div className="max-w-5xl space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: easeOut }}>
        <div className="flex items-center gap-2 mb-1">
          <Tags size={14} style={{ color: 'var(--color-accent)' }} />
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-accent)', letterSpacing: '0.1em' }}>Catálogo</span>
        </div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-ink)', letterSpacing: '-0.05em' }}>Tipos de entregable</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-ink-muted)' }}>
          Cada indicador tiene sus propios tipos. Son los que aparecen al crear un entregable.
        </p>
      </motion.div>

      <FilterBar
        filters={FILTROS} values={filtros}
        onChange={(k, v) => setFiltros((f) => ({ ...f, [k]: v }))}
        onReset={() => setFiltros({})}
        summary={
          <span className="text-xs tabular-nums" style={{ color: 'var(--color-ink-muted)' }}>
            {visibles.length} de {tipos.length}
          </span>
        }
      />

      <DataTable
        data={visibles} columns={COLS} loading={isLoading} searchKeys={['nombre']}
        onAdd={() => open()} onEdit={open} onDelete={(row) => del.mutate(row.id)}
        addLabel="Nuevo tipo"
      />

      <Modal open={modal.open} onClose={close} title={modal.row ? 'Editar tipo' : 'Nuevo tipo'}>
        <div className="flex flex-col gap-4">
          <FormField as="select" label="Indicador" required value={form.indicador_id} onChange={set('indicador_id')}>
            <option value="">Selecciona…</option>
            {indicadores.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
          </FormField>
          <FormField label="Nombre del tipo" required value={form.nombre} onChange={set('nombre')} placeholder="Mensual, Quincenal…" />
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Orden" type="number" min="1" value={form.orden} onChange={set('orden')} />
            <FormField as="select" label="Visible" value={form.mostrar} onChange={set('mostrar')}>
              <option value="true">Sí</option>
              <option value="false">No</option>
            </FormField>
          </div>
          {error && <p className="text-xs" style={{ color: 'var(--color-accent)' }}>{error}</p>}
          <ModalActions onClose={close} onSave={() => save.mutate()} isPending={save.isPending} disabled={!canSave} />
        </div>
      </Modal>
    </div>
  )
}
