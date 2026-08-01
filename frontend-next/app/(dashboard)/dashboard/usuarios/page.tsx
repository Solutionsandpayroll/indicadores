'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { api } from '@/lib/api'
import DataTable, { type Column } from '@/components/ui/DataTable'
import Modal from '@/components/ui/Modal'
import FormField from '@/components/ui/FormField'
import Badge from '@/components/ui/Badge'
import ModalActions from '@/components/ui/ModalActions'

interface Cargo { id: number; descripcion: string }
interface Grupo { id: number; nombre: string }
interface Usuario {
  id: number; usuario: string; nombre: string; cargo_id: number | null
  email: string | null; grupo_id: number | null; lider_id: number | null
  es_admin: boolean; activo: boolean
}

const empty = { usuario: '', contrasena: '', nombre: '', cargo_id: '', email: '', grupo_id: '', lider_id: '', es_admin: false, activo: true }

export default function UsuariosPage() {
  const { usuario: currentUser } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (currentUser && !currentUser.es_admin) router.replace('/dashboard')
  }, [currentUser, router])

  const qc = useQueryClient()
  const [modal, setModal] = useState<{ open: boolean; row: Usuario | null }>({ open: false, row: null })
  const [form, setForm] = useState<typeof empty>(empty)
  const [error, setError] = useState('')

  const { data: usuarios = [], isLoading } = useQuery<Usuario[]>({ queryKey: ['usuarios'], queryFn: async () => { const { data } = await api.get<Usuario[]>('/usuarios'); return data } })
  const { data: cargos = [] } = useQuery<Cargo[]>({ queryKey: ['cargos'], queryFn: async () => { const { data } = await api.get<Cargo[]>('/cargos'); return data } })
  const { data: grupos = [] } = useQuery<Grupo[]>({ queryKey: ['grupos'], queryFn: async () => { const { data } = await api.get<Grupo[]>('/grupos'); return data } })

  const cargoMap = Object.fromEntries(cargos.map((c) => [c.id, c.descripcion]))

  const COLS: Column<Usuario>[] = [
    { key: 'id', label: 'ID' },
    { key: 'usuario', label: 'Usuario' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'cargo_id', label: 'Cargo', render: (r) => cargoMap[r.cargo_id ?? 0] ?? '—' },
    { key: 'email', label: 'Email', render: (r) => r.email ?? '—' },
    { key: 'es_admin', label: 'Rol', render: (r) => <Badge variant={r.es_admin ? 'danger' : 'default'}>{r.es_admin ? 'Admin' : 'Usuario'}</Badge> },
    { key: 'activo', label: 'Estado', render: (r) => <Badge variant={r.activo ? 'success' : 'muted'}>{r.activo ? 'Activo' : 'Inactivo'}</Badge> },
  ]

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = { usuario: form.usuario, nombre: form.nombre, cargo_id: form.cargo_id ? Number(form.cargo_id) : null, email: form.email || null, grupo_id: form.grupo_id ? Number(form.grupo_id) : null, lider_id: form.lider_id ? Number(form.lider_id) : null, es_admin: form.es_admin, activo: form.activo }
      if (form.contrasena) payload.contrasena = form.contrasena
      if (modal.row) await api.patch(`/usuarios/${modal.row.id}`, payload)
      else await api.post('/usuarios', { ...payload, contrasena: form.contrasena })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['usuarios'] }); close() },
    onError: () => setError('Error al guardar'),
  })

  const del = useMutation({ mutationFn: (id: number) => api.delete(`/usuarios/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }) })

  function open(row?: Usuario) {
    setModal({ open: true, row: row ?? null })
    setForm(row ? { usuario: row.usuario, contrasena: '', nombre: row.nombre, cargo_id: row.cargo_id ? String(row.cargo_id) : '', email: row.email ?? '', grupo_id: row.grupo_id ? String(row.grupo_id) : '', lider_id: row.lider_id ? String(row.lider_id) : '', es_admin: row.es_admin, activo: row.activo } : empty)
    setError('')
  }
  function close() { setModal({ open: false, row: null }) }

  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const val = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value
    setForm((f) => ({ ...f, [k]: val }))
  }

  const canSave = form.usuario.trim() && form.nombre.trim() && (!modal.row ? form.contrasena.trim() : true)

  if (currentUser && !currentUser.es_admin) return null

  return (
    <div className="max-w-6xl">
      <DataTable data={usuarios} columns={COLS} loading={isLoading} searchKeys={['usuario', 'nombre']}
        onAdd={() => open()} onEdit={open} onDelete={(row) => del.mutate(row.id)} addLabel="Nuevo usuario" />
      <Modal open={modal.open} onClose={close} title={modal.row ? 'Editar usuario' : 'Nuevo usuario'} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Usuario" required value={form.usuario} onChange={set('usuario')} />
          <FormField label={modal.row ? 'Nueva contraseña (vacío = no cambiar)' : 'Contraseña'} required={!modal.row} type="password" value={form.contrasena} onChange={set('contrasena')} />
          <div className="col-span-2"><FormField label="Nombre completo" required value={form.nombre} onChange={set('nombre')} /></div>
          <FormField as="select" label="Cargo" value={form.cargo_id} onChange={set('cargo_id')}>
            <option value="">Sin cargo</option>
            {cargos.map((c) => <option key={c.id} value={c.id}>{c.descripcion}</option>)}
          </FormField>
          <FormField label="Email" type="email" value={form.email} onChange={set('email')} />
          <FormField as="select" label="Grupo" value={form.grupo_id} onChange={set('grupo_id')}>
            <option value="">Sin grupo</option>
            {grupos.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          </FormField>
          <FormField as="select" label="Líder" value={form.lider_id} onChange={set('lider_id')}>
            <option value="">Sin líder</option>
            {usuarios.filter((u) => u.id !== modal.row?.id).map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </FormField>
          <div className="col-span-2 flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none" style={{ color: 'var(--color-ink-muted)' }}>
              <input type="checkbox" checked={form.es_admin} onChange={set('es_admin')} className="w-4 h-4 rounded" style={{ accentColor: 'var(--color-accent)' }} />
              Administrador
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none" style={{ color: 'var(--color-ink-muted)' }}>
              <input type="checkbox" checked={form.activo} onChange={set('activo')} className="w-4 h-4 rounded" style={{ accentColor: 'var(--color-primary)' }} />
              Activo
            </label>
          </div>
          {error && <p className="col-span-2 text-xs" style={{ color: 'var(--color-accent)' }}>{error}</p>}
          <ModalActions colSpan onClose={close} onSave={() => save.mutate()} isPending={save.isPending} disabled={!canSave} />
        </div>
      </Modal>
    </div>
  )
}
