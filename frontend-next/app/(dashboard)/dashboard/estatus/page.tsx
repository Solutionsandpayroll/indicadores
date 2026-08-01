'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import DataTable, { type Column } from '@/components/ui/DataTable'
import Modal from '@/components/ui/Modal'
import FormField from '@/components/ui/FormField'
import ModalActions from '@/components/ui/ModalActions'

interface Estatus { id: number; descripcion: string }

const COLS: Column<Estatus>[] = [
  { key: 'id', label: 'ID' },
  { key: 'descripcion', label: 'Descripción' },
]

export default function EstatusPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<{ open: boolean; row: Estatus | null }>({ open: false, row: null })
  const [descripcion, setDescripcion] = useState('')
  const [error, setError] = useState('')

  const { data = [], isLoading } = useQuery<Estatus[]>({
    queryKey: ['estatus'],
    queryFn: async () => { const { data } = await api.get<Estatus[]>('/estatus'); return data },
  })

  const save = useMutation({
    mutationFn: async () => {
      if (modal.row) await api.patch(`/estatus/${modal.row.id}`, { descripcion })
      else await api.post('/estatus', { descripcion })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['estatus'] }); close() },
    onError: () => setError('Error al guardar'),
  })

  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/estatus/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['estatus'] }),
  })

  function open(row?: Estatus) {
    setModal({ open: true, row: row ?? null })
    setDescripcion(row?.descripcion ?? '')
    setError('')
  }
  function close() { setModal({ open: false, row: null }) }

  return (
    <div className="max-w-2xl">
      <DataTable
        data={data} columns={COLS} loading={isLoading} searchKeys={['descripcion']}
        onAdd={() => open()} onEdit={open} onDelete={(row) => del.mutate(row.id)}
        addLabel="Nuevo estatus"
      />
      <Modal open={modal.open} onClose={close} title={modal.row ? 'Editar estatus' : 'Nuevo estatus'}>
        <div className="flex flex-col gap-4">
          <FormField label="Descripción" required value={descripcion}
            onChange={(e) => setDescripcion((e.target as HTMLInputElement).value)} error={error} />
          <ModalActions onClose={close} onSave={() => save.mutate()} isPending={save.isPending} disabled={!descripcion.trim()} />
        </div>
      </Modal>
    </div>
  )
}
