'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { MessageSquareWarning, Plus, Pencil, Trash2, Save, X, Users } from 'lucide-react'
import { api } from '@/lib/api'
import DataTable, { type Column } from '@/components/ui/DataTable'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/context/AuthContext'

interface Queja {
  id: number; cliente_id: number; mes: number; anio: number
  fecha_registro: string; descripcion: string
  registrado_por: number | null; creado_en: string
  clientes?: { cliente: string } | null
  queja_usuarios?: { usuario_id: number; usuarios?: { id: number; nombre: string } | null }[]
}

interface Cliente { id: number; cliente: string }
interface UsuarioRow { id: number; nombre: string; usuario: string; rol: string }

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const hoy = () => new Date().toISOString().slice(0, 10)

const emptyForm = {
  cliente_id: '', mes: String(new Date().getMonth() + 1), anio: String(new Date().getFullYear()),
  fecha_registro: hoy(), descripcion: '', usuarios: [] as number[],
}

export default function QuejasPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const router = useRouter()
  const { usuario: currentUser } = useAuth()

  // Filtros
  const [filtros, setFiltros] = useState({ cliente_id: '', anio: '', mes: '', usuario_id: '' })

  // Modal crear/editar
  const [modal, setModal] = useState<{ open: boolean; row: Queja | null }>({ open: false, row: null })
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')

  // Confirmación de borrado
  const [delConfirm, setDelConfirm] = useState<Queja | null>(null)

  const isAnalistaOLider = currentUser?.rol === 'Analista' || currentUser?.rol === 'Lider'

  // ── Datos ──
  const queryString = new URLSearchParams(
    Object.entries(filtros).filter(([, v]) => v) as [string, string][],
  ).toString()

  const { data: quejas = [], isLoading } = useQuery<Queja[]>({
    queryKey: ['quejas', queryString],
    queryFn: async () => { const { data } = await api.get<Queja[]>(`/quejas${queryString ? `?${queryString}` : ''}`); return data },
  })

  const { data: clientes = [] } = useQuery<Cliente[]>({
    queryKey: ['clientes'],
    queryFn: async () => { const { data } = await api.get<Cliente[]>('/clientes'); return data },
  })

  const { data: usuarios = [] } = useQuery<UsuarioRow[]>({
    queryKey: ['usuarios'],
    queryFn: async () => { const { data } = await api.get<UsuarioRow[]>('/usuarios'); return data },
  })

  const afectables = usuarios.filter((u) => u.rol === 'Analista' || u.rol === 'Lider')
  const usuarioMap = Object.fromEntries(usuarios.map((u) => [u.id, u.nombre]))
  const clienteMap = Object.fromEntries(clientes.map((c) => [c.id, c.cliente]))

  // Años disponibles: actual, anterior y siguiente
  const anioActual = new Date().getFullYear()
  const anios = [anioActual - 2, anioActual - 1, anioActual, anioActual + 1]

  // ── Mutaciones ──
  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        cliente_id: Number(form.cliente_id),
        mes: Number(form.mes),
        anio: Number(form.anio),
        fecha_registro: form.fecha_registro || hoy(),
        descripcion: form.descripcion.trim(),
        usuarios: form.usuarios,
      }
      if (modal.row) await api.patch(`/quejas/${modal.row.id}`, payload)
      else await api.post('/quejas', payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quejas'] })
      setModal({ open: false, row: null })
      toast.success(modal.row ? 'Queja actualizada' : 'Queja registrada')
    },
    onError: () => { setError('Error al guardar'); toast.error('Error al guardar la queja') },
  })

  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/quejas/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quejas'] }); setDelConfirm(null); toast.success('Queja eliminada') },
    onError: () => toast.error('Error al eliminar la queja'),
  })

  function open(row?: Queja) {
    setModal({ open: true, row: row ?? null })
    if (row) {
      setForm({
        cliente_id: String(row.cliente_id),
        mes: String(row.mes),
        anio: String(row.anio),
        fecha_registro: row.fecha_registro?.slice(0, 10) ?? hoy(),
        descripcion: row.descripcion,
        usuarios: (row.queja_usuarios ?? []).map((qu) => qu.usuario_id),
      })
    } else {
      setForm({ ...emptyForm, fecha_registro: hoy() })
    }
    setError('')
  }

  function toggleUsuario(id: number) {
    setForm((f) => ({
      ...f,
      usuarios: f.usuarios.includes(id) ? f.usuarios.filter((x) => x !== id) : [...f.usuarios, id],
    }))
  }

  const canSave = form.cliente_id && form.descripcion.trim()

  // ── Columnas ──
  const COLS: Column<Queja>[] = [
    { key: 'id', label: 'ID' },
    { key: 'cliente_id', label: 'Cliente', render: (r) => clienteMap[r.cliente_id] ?? r.clientes?.cliente ?? '—' },
    { key: 'periodo', label: 'Período', render: (r) => `${MESES[r.mes - 1]} ${r.anio}` },
    {
      key: 'usuarios', label: 'Afectados',
      render: (r) => {
        const us = (r.queja_usuarios ?? []).map((qu) => qu.usuarios?.nombre ?? usuarioMap[qu.usuario_id] ?? `#${qu.usuario_id}`)
        if (us.length === 0) return <span style={{ color: 'var(--color-ink-muted)' }}>—</span>
        return (
          <span className="inline-flex items-center gap-1" title={us.join(', ')}>
            <Users size={11} style={{ color: 'var(--color-ink-muted)' }} />
            <span className="font-semibold">{us.length}</span>
            <span className="text-[10px] truncate max-w-32" style={{ color: 'var(--color-ink-muted)' }}>
              {us.slice(0, 2).join(', ')}{us.length > 2 ? '…' : ''}
            </span>
          </span>
        )
      },
    },
    { key: 'fecha_registro', label: 'Fecha registro', render: (r) => r.fecha_registro?.slice(0, 10) ?? '—' },
    {
      key: 'descripcion', label: 'Descripción',
      render: (r) => (
        <span title={r.descripcion} className="block max-w-md truncate" style={{ color: 'var(--color-ink-muted)' }}>
          {r.descripcion}
        </span>
      ),
    },
  ]

  // Redirección: solo Admin puede estar aquí
  if (currentUser && isAnalistaOLider) {
    router.replace('/dashboard')
    return null
  }

  const selectStyle = {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-ink)',
  } as const

  return (
    <div className="max-w-7xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-accent-muted)', color: 'var(--color-accent)' }}>
          <MessageSquareWarning size={17} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-ink)', letterSpacing: '-0.03em' }}>Quejas</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>
            Registro de quejas formales reportadas por clientes
          </p>
        </div>
      </div>

      {/* Resumen */}
      <div className="flex gap-4 mb-6">
        <div className="rounded-xl px-4 py-2" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <span className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>Quejas registradas</span>
          <p className="text-lg font-bold" style={{ color: 'var(--color-ink)' }}>{quejas.length}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select value={filtros.cliente_id} onChange={(e) => setFiltros({ ...filtros, cliente_id: e.target.value })}
          className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer" style={selectStyle}>
          <option value="">Todos los clientes</option>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.cliente}</option>)}
        </select>
        <select value={filtros.anio} onChange={(e) => setFiltros({ ...filtros, anio: e.target.value })}
          className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer" style={selectStyle}>
          <option value="">Todos los años</option>
          {anios.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filtros.mes} onChange={(e) => setFiltros({ ...filtros, mes: e.target.value })}
          className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer" style={selectStyle}>
          <option value="">Todos los meses</option>
          {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={filtros.usuario_id} onChange={(e) => setFiltros({ ...filtros, usuario_id: e.target.value })}
          className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer" style={selectStyle}>
          <option value="">Cualquier afectado</option>
          {afectables.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
        </select>
        {Object.values(filtros).some(Boolean) && (
          <button onClick={() => setFiltros({ cliente_id: '', anio: '', mes: '', usuario_id: '' })}
            className="px-3 py-2 rounded-lg text-xs font-medium cursor-pointer" style={selectStyle}>
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Tabla */}
      <DataTable
        data={quejas} columns={COLS} loading={isLoading} searchKeys={['descripcion']}
        onAdd={() => open()} onEdit={open} onDelete={(row) => setDelConfirm(row)}
        addLabel="Nueva queja"
      />

      {/* Modal crear/editar */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setModal({ open: false, row: null })}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--color-ink)' }}>
              {modal.row ? 'Editar queja' : 'Registrar nueva queja'}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>Cliente *</label>
                <select value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg text-xs outline-none cursor-pointer"
                  style={{ backgroundColor: 'oklch(100% 0 0 / 5%)', border: '1px solid var(--color-border)', color: 'var(--color-ink)' }}>
                  <option value="">Seleccionar…</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.cliente}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>Mes *</label>
                  <select value={form.mes} onChange={(e) => setForm({ ...form, mes: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-lg text-xs outline-none cursor-pointer"
                    style={{ backgroundColor: 'oklch(100% 0 0 / 5%)', border: '1px solid var(--color-border)', color: 'var(--color-ink)' }}>
                    {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>Año *</label>
                  <input type="number" min="2000" value={form.anio} onChange={(e) => setForm({ ...form, anio: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-lg text-xs outline-none"
                    style={{ backgroundColor: 'oklch(100% 0 0 / 5%)', border: '1px solid var(--color-border)', color: 'var(--color-ink)' }} />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>F. registro</label>
                  <input type="date" value={form.fecha_registro} onChange={(e) => setForm({ ...form, fecha_registro: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-lg text-xs outline-none"
                    style={{ backgroundColor: 'oklch(100% 0 0 / 5%)', border: '1px solid var(--color-border)', color: 'var(--color-ink)' }} />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>Descripción *</label>
                <textarea rows={4} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  placeholder="Ej: El cliente reportó que el proceso de nómina de septiembre se realizó con un descuento mal aplicado…"
                  className="w-full mt-1 px-3 py-2 rounded-lg text-xs outline-none resize-none"
                  style={{ backgroundColor: 'oklch(100% 0 0 / 5%)', border: '1px solid var(--color-border)', color: 'var(--color-ink)' }} />
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>
                  Usuarios afectados ({form.usuarios.length})
                </label>
                <div className="mt-2 grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto p-2 rounded-lg" style={{ backgroundColor: 'oklch(100% 0 0 / 3%)' }}>
                  {afectables.map((u) => {
                    const checked = form.usuarios.includes(u.id)
                    return (
                      <label key={u.id} className="flex items-center gap-2 text-xs cursor-pointer select-none px-2 py-1.5 rounded-md" style={{ color: 'var(--color-ink)' }}>
                        <input type="checkbox" checked={checked} className="w-3.5 h-3.5 rounded"
                          style={{ accentColor: 'var(--color-accent)' }}
                          onChange={() => toggleUsuario(u.id)} />
                        <span className="truncate">{u.nombre}</span>
                        <span className="text-[9px] shrink-0" style={{ color: 'var(--color-ink-muted)' }}>{u.rol}</span>
                      </label>
                    )
                  })}
                  {afectables.length === 0 && <p className="text-xs col-span-2" style={{ color: 'var(--color-ink-muted)' }}>No hay usuarios Analista/Líder</p>}
                </div>
              </div>

              {error && <p className="text-xs" style={{ color: 'var(--color-accent)' }}>{error}</p>}
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setModal({ open: false, row: null })}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer"
                style={{ backgroundColor: 'oklch(100% 0 0 / 5%)', color: 'var(--color-ink-muted)' }}>
                <X size={12} /> Cancelar
              </button>
              <button onClick={() => save.mutate()} disabled={save.isPending || !canSave}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white cursor-pointer disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-accent)' }}>
                <Save size={12} /> Guardar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Confirmación de borrado */}
      {delConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDelConfirm(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl p-6 w-full max-w-sm" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-accent-muted)', color: 'var(--color-accent)' }}>
                <Trash2 size={16} />
              </div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--color-ink)' }}>Eliminar queja</h3>
            </div>
            <p className="text-xs mb-1" style={{ color: 'var(--color-ink-muted)' }}>
              ¿Eliminar la queja de <strong style={{ color: 'var(--color-ink)' }}>{clienteMap[delConfirm.cliente_id]}</strong> ({MESES[delConfirm.mes - 1]} {delConfirm.anio})?
            </p>
            <p className="text-[10px] mb-4" style={{ color: 'var(--color-ink-muted)' }}>
              También se eliminarán las asociaciones con usuarios afectados.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDelConfirm(null)}
                className="px-3 py-2 rounded-lg text-xs font-medium cursor-pointer"
                style={{ backgroundColor: 'oklch(100% 0 0 / 5%)', color: 'var(--color-ink-muted)' }}>
                Cancelar
              </button>
              <button onClick={() => del.mutate(delConfirm.id)} disabled={del.isPending}
                className="px-3 py-2 rounded-lg text-xs font-medium text-white cursor-pointer disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-accent)' }}>
                Eliminar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
