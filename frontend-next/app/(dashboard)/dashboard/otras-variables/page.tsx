'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import DataTable, { type Column } from '@/components/ui/DataTable'
import Modal from '@/components/ui/Modal'
import FormField from '@/components/ui/FormField'
import ModalActions from '@/components/ui/ModalActions'

interface Cargo { id: number; descripcion: string }
interface Concepto { id: number; descripcion: string }
interface SalarioVariable { id: number; cargo_id: number; concepto_id: number; pct_cumplimiento: number | null; pct_peso: number | null; mostrar: boolean }
type Tab = 'cargos' | 'conceptos' | 'salario'

function CargosTab() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<{ open: boolean; row: Cargo | null }>({ open: false, row: null })
  const [descripcion, setDescripcion] = useState('')
  const [error, setError] = useState('')
  const COLS: Column<Cargo>[] = [{ key: 'id', label: 'ID' }, { key: 'descripcion', label: 'Descripción' }]
  const { data = [], isLoading } = useQuery<Cargo[]>({ queryKey: ['cargos'], queryFn: async () => { const { data } = await api.get<Cargo[]>('/cargos'); return data } })
  const save = useMutation({ mutationFn: async () => { if (modal.row) await api.patch(`/cargos/${modal.row.id}`, { descripcion }); else await api.post('/cargos', { descripcion }) }, onSuccess: () => { qc.invalidateQueries({ queryKey: ['cargos'] }); close() }, onError: () => setError('Error al guardar') })
  const del = useMutation({ mutationFn: (id: number) => api.delete(`/cargos/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['cargos'] }) })
  function open(row?: Cargo) { setModal({ open: true, row: row ?? null }); setDescripcion(row?.descripcion ?? ''); setError('') }
  function close() { setModal({ open: false, row: null }) }
  return (
    <>
      <DataTable data={data} columns={COLS} loading={isLoading} searchKeys={['descripcion']} onAdd={() => open()} onEdit={open} onDelete={(r) => del.mutate(r.id)} addLabel="Nuevo cargo" />
      <Modal open={modal.open} onClose={close} title={modal.row ? 'Editar cargo' : 'Nuevo cargo'}>
        <div className="flex flex-col gap-4">
          <FormField label="Descripción" required value={descripcion} onChange={(e) => setDescripcion((e.target as HTMLInputElement).value)} error={error} />
          <ModalActions onClose={close} onSave={() => save.mutate()} isPending={save.isPending} disabled={!descripcion.trim()} />
        </div>
      </Modal>
    </>
  )
}

function ConceptosTab() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<{ open: boolean; row: Concepto | null }>({ open: false, row: null })
  const [descripcion, setDescripcion] = useState('')
  const [error, setError] = useState('')
  const COLS: Column<Concepto>[] = [{ key: 'id', label: 'ID' }, { key: 'descripcion', label: 'Descripción' }]
  const { data = [], isLoading } = useQuery<Concepto[]>({ queryKey: ['conceptos'], queryFn: async () => { const { data } = await api.get<Concepto[]>('/conceptos'); return data } })
  const save = useMutation({ mutationFn: async () => { if (modal.row) await api.patch(`/conceptos/${modal.row.id}`, { descripcion }); else await api.post('/conceptos', { descripcion }) }, onSuccess: () => { qc.invalidateQueries({ queryKey: ['conceptos'] }); close() }, onError: () => setError('Error al guardar') })
  const del = useMutation({ mutationFn: (id: number) => api.delete(`/conceptos/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['conceptos'] }) })
  function open(row?: Concepto) { setModal({ open: true, row: row ?? null }); setDescripcion(row?.descripcion ?? ''); setError('') }
  function close() { setModal({ open: false, row: null }) }
  return (
    <>
      <DataTable data={data} columns={COLS} loading={isLoading} searchKeys={['descripcion']} onAdd={() => open()} onEdit={open} onDelete={(r) => del.mutate(r.id)} addLabel="Nuevo concepto" />
      <Modal open={modal.open} onClose={close} title={modal.row ? 'Editar concepto' : 'Nuevo concepto'}>
        <div className="flex flex-col gap-4">
          <FormField label="Descripción" required value={descripcion} onChange={(e) => setDescripcion((e.target as HTMLInputElement).value)} error={error} />
          <ModalActions onClose={close} onSave={() => save.mutate()} isPending={save.isPending} disabled={!descripcion.trim()} />
        </div>
      </Modal>
    </>
  )
}

function SalarioVariableTab() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<{ open: boolean; row: SalarioVariable | null }>({ open: false, row: null })
  const [form, setForm] = useState({ cargo_id: '', concepto_id: '', pct_cumplimiento: '', pct_peso: '' })
  const [error, setError] = useState('')
  const { data = [], isLoading } = useQuery<SalarioVariable[]>({ queryKey: ['salario-variable'], queryFn: async () => { const { data } = await api.get<SalarioVariable[]>('/salario-variable'); return data } })
  const { data: cargos = [] } = useQuery<Cargo[]>({ queryKey: ['cargos'], queryFn: async () => { const { data } = await api.get<Cargo[]>('/cargos'); return data } })
  const { data: conceptos = [] } = useQuery<Concepto[]>({ queryKey: ['conceptos'], queryFn: async () => { const { data } = await api.get<Concepto[]>('/conceptos'); return data } })
  const cargoMap = Object.fromEntries(cargos.map((c) => [c.id, c.descripcion]))
  const conceptoMap = Object.fromEntries(conceptos.map((c) => [c.id, c.descripcion]))
  const COLS: Column<SalarioVariable>[] = [
    { key: 'id', label: 'ID' },
    { key: 'cargo_id', label: 'Cargo', render: (r) => cargoMap[r.cargo_id] ?? r.cargo_id },
    { key: 'concepto_id', label: 'Concepto', render: (r) => conceptoMap[r.concepto_id] ?? r.concepto_id },
    { key: 'pct_cumplimiento', label: '% Cumplimiento', render: (r) => r.pct_cumplimiento != null ? `${r.pct_cumplimiento}%` : '—' },
    { key: 'pct_peso', label: '% Peso', render: (r) => r.pct_peso != null ? `${r.pct_peso}%` : '—' },
  ]
  const save = useMutation({
    mutationFn: async () => {
      const payload = { cargo_id: Number(form.cargo_id), concepto_id: Number(form.concepto_id), pct_cumplimiento: form.pct_cumplimiento ? Number(form.pct_cumplimiento) : null, pct_peso: form.pct_peso ? Number(form.pct_peso) : null }
      if (modal.row) await api.patch(`/salario-variable/${modal.row.id}`, payload); else await api.post('/salario-variable', payload)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['salario-variable'] }); close() },
    onError: () => setError('Error al guardar'),
  })
  const del = useMutation({ mutationFn: (id: number) => api.delete(`/salario-variable/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['salario-variable'] }) })
  function open(row?: SalarioVariable) { setModal({ open: true, row: row ?? null }); setForm(row ? { cargo_id: String(row.cargo_id), concepto_id: String(row.concepto_id), pct_cumplimiento: row.pct_cumplimiento != null ? String(row.pct_cumplimiento) : '', pct_peso: row.pct_peso != null ? String(row.pct_peso) : '' } : { cargo_id: '', concepto_id: '', pct_cumplimiento: '', pct_peso: '' }); setError('') }
  function close() { setModal({ open: false, row: null }) }
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))
  return (
    <>
      <DataTable data={data} columns={COLS} loading={isLoading} searchKeys={[]} onAdd={() => open()} onEdit={open} onDelete={(r) => del.mutate(r.id)} addLabel="Nueva entrada" />
      <Modal open={modal.open} onClose={close} title={modal.row ? 'Editar salario variable' : 'Nuevo salario variable'}>
        <div className="grid grid-cols-2 gap-4">
          <FormField as="select" label="Cargo" required value={form.cargo_id} onChange={set('cargo_id')}>
            <option value="">Selecciona…</option>
            {cargos.map((c) => <option key={c.id} value={c.id}>{c.descripcion}</option>)}
          </FormField>
          <FormField as="select" label="Concepto" required value={form.concepto_id} onChange={set('concepto_id')}>
            <option value="">Selecciona…</option>
            {conceptos.map((c) => <option key={c.id} value={c.id}>{c.descripcion}</option>)}
          </FormField>
          <FormField label="% Cumplimiento" type="number" min="0" max="100" step="0.01" value={form.pct_cumplimiento} onChange={set('pct_cumplimiento')} />
          <FormField label="% Peso" type="number" min="0" max="100" step="0.01" value={form.pct_peso} onChange={set('pct_peso')} />
          {error && <p className="col-span-2 text-xs" style={{ color: 'var(--color-accent)' }}>{error}</p>}
          <ModalActions colSpan onClose={close} onSave={() => save.mutate()} isPending={save.isPending} disabled={!form.cargo_id || !form.concepto_id} />
        </div>
      </Modal>
    </>
  )
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'cargos', label: 'Cargos' },
  { key: 'conceptos', label: 'Conceptos' },
  { key: 'salario', label: 'Salario Variable' },
]

export default function OtrasVariablesPage() {
  const [tab, setTab] = useState<Tab>('cargos')
  return (
    <div className="max-w-5xl">
      <div
        className="flex gap-1 mb-6 rounded-xl p-1 w-fit"
        style={{ backgroundColor: 'var(--color-border)' }}
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="h-8 px-4 rounded-lg text-sm font-medium transition-[background-color,color,box-shadow] duration-150 cursor-pointer"
            style={tab === t.key
              ? { backgroundColor: 'var(--color-surface)', color: 'var(--color-ink)', boxShadow: '0 1px 3px oklch(0% 0 0 / 10%)' }
              : { backgroundColor: 'transparent', color: 'var(--color-ink-muted)' }
            }
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'cargos' && <CargosTab />}
      {tab === 'conceptos' && <ConceptosTab />}
      {tab === 'salario' && <SalarioVariableTab />}
    </div>
  )
}
