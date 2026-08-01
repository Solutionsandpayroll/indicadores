'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import DataTable, { type Column } from '@/components/ui/DataTable'
import Modal from '@/components/ui/Modal'
import FormField from '@/components/ui/FormField'
import ModalActions from '@/components/ui/ModalActions'

interface Grupo { id: number; nombre: string }

const COLS: Column<Grupo>[] = [
  { key: 'id', label: 'ID' },
  { key: 'nombre', label: 'Nombre' },
]

export default function GruposPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<{ open: boolean; row: Grupo | null }>({ open: false, row: null })
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState('')

  const { data = [], isLoading } = useQuery<Grupo[]>({
    queryKey: ['grupos'],
    queryFn: async () => { const { data } = await api.get<Grupo[]>('/grupos'); return data },
  })

  const save = useMutation({
    mutationFn: async () => {
      if (modal.row) await api.patch(`/grupos/${modal.row.id}`, { nombre })
      else await api.post('/grupos', { nombre })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['grupos'] }); close() },
    onError: () => setError('Error al guardar'),
  })

  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/grupos/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grupos'] }),
  })

  function open(row?: Grupo) {
    setModal({ open: true, row: row ?? null })
    setNombre(row?.nombre ?? '')
    setError('')
  }
  function close() { setModal({ open: false, row: null }) }

  return (
    <div className="max-w-2xl">
      <DataTable
        data={data} columns={COLS} loading={isLoading} searchKeys={['nombre']}
        onAdd={() => open()} onEdit={open} onDelete={(row) => del.mutate(row.id)}
        addLabel="Nuevo grupo"
      />
      <Modal open={modal.open} onClose={close} title={modal.row ? 'Editar grupo' : 'Nuevo grupo'}>
        <div className="flex flex-col gap-4">
          <FormField label="Nombre" required value={nombre}
            onChange={(e) => setNombre((e.target as HTMLInputElement).value)} error={error} />
          <ModalActions onClose={close} onSave={() => save.mutate()} isPending={save.isPending} disabled={!nombre.trim()} />
        </div>
      </Modal>
    </div>
  )
}
