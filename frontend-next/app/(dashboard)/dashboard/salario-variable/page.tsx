'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Settings, DollarSign, Users, BarChart3, Plus, Pencil, Trash2,
  Save, X, History, Calculator, Download, Search, Filter, CheckCircle2, XCircle, Clock, FileText, FileSpreadsheet,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/context/AuthContext'

// =====================================================
// TIPOS
// =====================================================
interface ConfigRow {
  id: number; perfil: string; concepto_id: number; pct_meta: number;
  pct_peso: number; activo: boolean; creado_en: string; actualizado_en: string;
  metrica: string | null;
  conceptos?: { descripcion: string };
}

interface ValorRow {
  id: number; usuario_id: number; valor: number; periodo_anio: number;
  activo: boolean; usuario?: { nombre: string; usuario: string };
}

interface CasoRow {
  id: number; usuario_id: number; descripcion: string; tipo_regla: string;
  configuracion: Record<string, unknown>; activo: boolean;
  usuario?: { nombre: string; usuario: string };
}

interface Concepto { id: number; descripcion: string }
interface Usuario { id: number; nombre: string; usuario: string; rol: string }

const TABS = [
  { key: 'config', label: 'Configuración por Perfil', icon: Settings, roles: ['Admin'] },
  { key: 'valores', label: 'Valores de Variable', icon: DollarSign, roles: ['Admin'] },
  { key: 'casos', label: 'Casos Especiales', icon: Users, roles: ['Admin'] },
  { key: 'cumplimiento', label: 'Cumplimiento', icon: CheckCircle2, roles: ['Admin', 'Lider', 'Analista'] },
  { key: 'resultados', label: 'Resultados', icon: BarChart3, roles: ['Admin', 'Lider'] },
] as const

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function fmtMoney(n: number | null) {
  if (n == null) return '—'
  return '$' + n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' }) {
  const colors: Record<string, string> = {
    default: 'oklch(60% 0.02 252)',
    success: 'oklch(56% 0.18 145)',
    warning: 'oklch(70% 0.16 65)',
    danger: 'oklch(52% 0.22 15)',
    info: 'oklch(48% 0.13 240)',
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold text-white" style={{ backgroundColor: colors[variant] }}>
      {children}
    </span>
  )
}

export default function SalarioVariablePage() {
  const toast = useToast()
  const { usuario: currentUser } = useAuth()
  const qc = useQueryClient()

  // Tabs visibles según rol: Analista/Líder solo ven Cumplimiento.
  const tabsVisibles = TABS.filter((t) => (t.roles as readonly string[]).includes(currentUser?.rol ?? ''))
  const tabInicial = tabsVisibles[0]?.key ?? 'cumplimiento'
  const [tab, setTab] = useState<typeof TABS[number]['key']>(tabInicial)

  return (
    <div className="max-w-7xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-ink)', letterSpacing: '-0.03em' }}>
          Salario Variable
        </h1>
        <p className="text-xs mt-1" style={{ color: 'var(--color-ink-muted)' }}>
          {currentUser?.rol === 'Admin'
            ? 'Parametrización, asignación y consulta del salario variable'
            : 'Consulta de cumplimiento mensual'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        {tabsVisibles.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer"
            style={{
              backgroundColor: tab === key ? 'var(--color-accent)' : 'transparent',
              color: tab === key ? 'white' : 'var(--color-ink-muted)',
            }}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {tab === 'config' && <ConfigTab toast={toast} qc={qc} />}
        {tab === 'valores' && <ValoresTab toast={toast} qc={qc} />}
        {tab === 'casos' && <CasosTab toast={toast} qc={qc} />}
        {tab === 'cumplimiento' && <CumplimientoTab />}
        {tab === 'resultados' && <ResultadosTab />}
      </motion.div>
    </div>
  )
}

// =====================================================
// SECCIÓN 1: CONFIGURACIÓN POR PERFIL
// =====================================================
function ConfigTab({ toast, qc }: { toast: ReturnType<typeof useToast>; qc: ReturnType<typeof useQueryClient> }) {
  const { data: config = [], isLoading } = useQuery<ConfigRow[]>({
    queryKey: ['sv-config'],
    queryFn: async () => { const { data } = await api.get<ConfigRow[]>('/salario-variable-admin/config'); return data },
  })
  const { data: conceptos = [] } = useQuery<Concepto[]>({
    queryKey: ['conceptos'],
    queryFn: async () => { const { data } = await api.get<Concepto[]>('/conceptos'); return data },
  })

  const [showModal, setShowModal] = useState(false)
  const [editRow, setEditRow] = useState<ConfigRow | null>(null)
  const [form, setForm] = useState({ perfil: 'Analista', concepto_id: '', pct_meta: '', pct_peso: '', metrica: '' })

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        perfil: form.perfil,
        concepto_id: Number(form.concepto_id),
        pct_meta: Number(form.pct_meta) || 0,
        pct_peso: Number(form.pct_peso) || 0,
        metrica: form.metrica || null,
      }
      if (editRow) await api.patch(`/salario-variable-admin/config/${editRow.id}`, payload)
      else await api.post('/salario-variable-admin/config', payload)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sv-config'] }); setShowModal(false); toast.success(editRow ? 'Configuración actualizada' : 'Configuración creada') },
    onError: () => toast.error('Error al guardar'),
  })

  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/salario-variable-admin/config/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sv-config'] }); toast.success('Configuración eliminada') },
    onError: () => toast.error('Error al eliminar'),
  })

  function openNew() { setEditRow(null); setForm({ perfil: 'Analista', concepto_id: '', pct_meta: '', pct_peso: '', metrica: '' }); setShowModal(true) }
  function openEdit(r: ConfigRow) { setEditRow(r); setForm({ perfil: r.perfil, concepto_id: String(r.concepto_id), pct_meta: String(r.pct_meta), pct_peso: String(r.pct_peso), metrica: r.metrica ?? '' }); setShowModal(true) }

  const analistas = config.filter((c) => c.perfil === 'Analista')
  const lideres = config.filter((c) => c.perfil === 'Lider')

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex gap-4">
          <div className="rounded-xl px-4 py-2" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <span className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>Analista</span>
            <p className="text-lg font-bold" style={{ color: 'var(--color-ink)' }}>{analistas.length} conceptos</p>
          </div>
          <div className="rounded-xl px-4 py-2" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <span className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>Líder</span>
            <p className="text-lg font-bold" style={{ color: 'var(--color-ink)' }}>{lideres.length} conceptos</p>
          </div>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-white cursor-pointer transition-colors hover:opacity-90" style={{ backgroundColor: 'var(--color-accent)' }}>
          <Plus size={13} /> Nueva configuración
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Analista */}
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-ink)' }}>
            <Badge variant="info">Analista</Badge> Reglas de cálculo
          </h3>
          {isLoading ? <p className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>Cargando...</p> :
            analistas.length === 0 ? <p className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>Sin configuración</p> :
            <table className="w-full text-xs">
              <thead>
                <tr style={{ backgroundColor: 'oklch(100% 0 0 / 3%)' }}>
                  <th className="text-left px-3 py-2.5 font-semibold text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>Concepto</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>Cumplimiento mínimo individual</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>Peso sobre el pago variable</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {analistas.map((r) => (
                  <tr key={r.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="px-3 py-2.5 font-medium" style={{ color: 'var(--color-ink)' }}>{r.conceptos?.descripcion}</td>
                    <td className="px-3 py-2.5 text-center" style={{ color: 'var(--color-ink)' }}>{r.pct_meta}%</td>
                    <td className="px-3 py-2.5 text-center" style={{ color: 'var(--color-ink)' }}>{r.pct_peso}%</td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(r)} className="p-1.5 rounded-md cursor-pointer hover:bg-white/10" style={{ color: 'var(--color-ink-muted)' }}><Pencil size={12} /></button>
                        <button onClick={() => del.mutate(r.id)} className="p-1.5 rounded-md cursor-pointer hover:bg-white/10" style={{ color: 'var(--color-accent)' }}><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        </div>

        {/* Líder */}
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-ink)' }}>
            <Badge variant="warning">Líder</Badge> Reglas de cálculo
          </h3>
          {isLoading ? <p className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>Cargando...</p> :
            lideres.length === 0 ? <p className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>Sin configuración</p> :
            <table className="w-full text-xs">
              <thead>
                <tr style={{ backgroundColor: 'oklch(100% 0 0 / 3%)' }}>
                  <th className="text-left px-3 py-2.5 font-semibold text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>Concepto</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>Cumplimiento mínimo individual</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>Peso sobre el pago variable</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {lideres.map((r) => (
                  <tr key={r.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="px-3 py-2.5 font-medium" style={{ color: 'var(--color-ink)' }}>{r.conceptos?.descripcion}</td>
                    <td className="px-3 py-2.5 text-center" style={{ color: 'var(--color-ink)' }}>{r.pct_meta}%</td>
                    <td className="px-3 py-2.5 text-center" style={{ color: 'var(--color-ink)' }}>{r.pct_peso}%</td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(r)} className="p-1.5 rounded-md cursor-pointer hover:bg-white/10" style={{ color: 'var(--color-ink-muted)' }}><Pencil size={12} /></button>
                        <button onClick={() => del.mutate(r.id)} className="p-1.5 rounded-md cursor-pointer hover:bg-white/10" style={{ color: 'var(--color-accent)' }}><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowModal(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl p-6 w-full max-w-md" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--color-ink)' }}>
              {editRow ? 'Editar configuración' : 'Nueva configuración'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>Perfil</label>
                <select value={form.perfil} onChange={(e) => setForm({ ...form, perfil: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg text-xs outline-none" style={{ backgroundColor: 'oklch(100% 0 0 / 5%)', border: '1px solid var(--color-border)', color: 'var(--color-ink)' }}>
                  <option value="Analista">Analista</option>
                  <option value="Lider">Líder</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>Concepto</label>
                <select value={form.concepto_id} onChange={(e) => setForm({ ...form, concepto_id: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg text-xs outline-none" style={{ backgroundColor: 'oklch(100% 0 0 / 5%)', border: '1px solid var(--color-border)', color: 'var(--color-ink)' }}>
                  <option value="">Seleccionar...</option>
                  {conceptos.map((c) => <option key={c.id} value={c.id}>{c.descripcion}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>Métrica que evalúa</label>
                <select value={form.metrica} onChange={(e) => setForm({ ...form, metrica: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg text-xs outline-none cursor-pointer" style={{ backgroundColor: 'oklch(100% 0 0 / 5%)', border: '1px solid var(--color-border)', color: 'var(--color-ink)' }}>
                  <option value="">Pendiente (sin métrica)</option>
                  <option value="plan">Plan de Entregables (%)</option>
                  <option value="exactitud">Exactitud de Cálculos (%)</option>
                  <option value="quejas">Quejas (cantidad)</option>
                </select>
                <p className="text-[9px] mt-1" style={{ color: 'var(--color-ink-subtle)' }}>
                  Los componentes "Pendiente" no suman al total hasta que exista su métrica.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>Meta cumplimiento (%)</label>
                  <input type="number" min="0" max="100" step="0.01" value={form.pct_meta} onChange={(e) => setForm({ ...form, pct_meta: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-lg text-xs outline-none" style={{ backgroundColor: 'oklch(100% 0 0 / 5%)', border: '1px solid var(--color-border)', color: 'var(--color-ink)' }} />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>Peso (%)</label>
                  <input type="number" min="0" max="100" step="0.01" value={form.pct_peso} onChange={(e) => setForm({ ...form, pct_peso: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-lg text-xs outline-none" style={{ backgroundColor: 'oklch(100% 0 0 / 5%)', border: '1px solid var(--color-border)', color: 'var(--color-ink)' }} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowModal(false)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer" style={{ backgroundColor: 'oklch(100% 0 0 / 5%)', color: 'var(--color-ink-muted)' }}>
                <X size={12} /> Cancelar
              </button>
              <button onClick={() => save.mutate()} disabled={save.isPending || !form.concepto_id}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white cursor-pointer disabled:opacity-50" style={{ backgroundColor: 'var(--color-accent)' }}>
                <Save size={12} /> Guardar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

// =====================================================
// SECCIÓN 2: VALORES DE VARIABLE
// =====================================================
function ValoresTab({ toast, qc }: { toast: ReturnType<typeof useToast>; qc: ReturnType<typeof useQueryClient> }) {
  const [anio, setAnio] = useState(2026)
  const { data: valores = [], isLoading } = useQuery<ValorRow[]>({
    queryKey: ['sv-valores', anio],
    queryFn: async () => { const { data } = await api.get<ValorRow[]>(`/salario-variable-admin/valores?anio=${anio}`); return data },
  })
  const { data: usuarios = [] } = useQuery<Usuario[]>({
    queryKey: ['usuarios'],
    queryFn: async () => { const { data } = await api.get<Usuario[]>('/usuarios'); return data },
  })

  const [showModal, setShowModal] = useState(false)
  const [editRow, setEditRow] = useState<ValorRow | null>(null)
  const [showHist, setShowHist] = useState<number | null>(null)
  const [form, setForm] = useState({ usuario_id: '', valor: '', periodo_anio: '2026' })

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        usuario_id: Number(form.usuario_id),
        valor: Number(form.valor),
        periodo_anio: Number(form.periodo_anio),
      }
      if (editRow) await api.patch(`/salario-variable-admin/valores/${editRow.id}`, payload)
      else await api.post('/salario-variable-admin/valores', payload)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sv-valores'] }); setShowModal(false); toast.success(editRow ? 'Valor actualizado' : 'Valor creado') },
    onError: () => toast.error('Error al guardar'),
  })

  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/salario-variable-admin/valores/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sv-valores'] }); toast.success('Valor eliminado') },
    onError: () => toast.error('Error al eliminar'),
  })

  function openNew() { setEditRow(null); setForm({ usuario_id: '', valor: '', periodo_anio: String(anio) }); setShowModal(true) }
  function openEdit(r: ValorRow) { setEditRow(r); setForm({ usuario_id: String(r.usuario_id), valor: String(r.valor), periodo_anio: String(r.periodo_anio) }); setShowModal(true) }

  const totalValor = valores.reduce((s, v) => s + (v.valor || 0), 0)
  const asignados = valores.length
  const disponibles = usuarios.filter((u) => u.rol === 'Analista' || u.rol === 'Lider').length - asignados

  const { data: historial = [] } = useQuery({
    queryKey: ['sv-historial', showHist],
    queryFn: async () => { if (showHist == null) return []; const { data } = await api.get(`/salario-variable-admin/valores/${showHist}/historial`); return data },
    enabled: showHist != null,
  })

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="flex gap-4">
        <div className="rounded-xl px-4 py-2 flex-1" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <span className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>Total asignado</span>
          <p className="text-lg font-bold" style={{ color: 'var(--color-ink)' }}>{fmtMoney(totalValor)}</p>
        </div>
        <div className="rounded-xl px-4 py-2 flex-1" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <span className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>Asignados</span>
          <p className="text-lg font-bold" style={{ color: 'var(--color-ink)' }}>{asignados}</p>
        </div>
        <div className="rounded-xl px-4 py-2 flex-1" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <span className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>Sin asignar</span>
          <p className="text-lg font-bold" style={{ color: 'var(--color-ink)' }}>{Math.max(0, disponibles)}</p>
        </div>
      </div>

      {/* Filtros + botón */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <select value={anio} onChange={(e) => setAnio(Number(e.target.value))}
            className="px-3 py-2 rounded-lg text-xs outline-none" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-ink)' }}>
            {[2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-white cursor-pointer hover:opacity-90" style={{ backgroundColor: 'var(--color-accent)' }}>
          <Plus size={13} /> Nuevo valor
        </button>
      </div>

      {/* Tabla */}
      {isLoading ? (
        <p className="text-xs text-center py-8" style={{ color: 'var(--color-ink-muted)' }}>Cargando...</p>
      ) : valores.length === 0 ? (
        <div className="text-center py-12 rounded-xl" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <p className="text-sm" style={{ color: 'var(--color-ink-muted)' }}>No hay valores asignados para este año</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ backgroundColor: 'oklch(100% 0 0 / 3%)' }}>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--color-ink-muted)' }}>Usuario</th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--color-ink-muted)' }}>Nombre</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--color-ink-muted)' }}>Valor anual</th>
                <th className="text-center px-4 py-3 font-semibold" style={{ color: 'var(--color-ink-muted)' }}>Estado</th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--color-ink-muted)' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {valores.map((v) => (
                <tr key={v.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--color-ink)' }}>{v.usuario?.usuario}</td>
                  <td className="px-4 py-2.5" style={{ color: 'var(--color-ink-muted)' }}>{v.usuario?.nombre}</td>
                  <td className="px-4 py-2.5 text-right font-semibold" style={{ color: 'var(--color-ink)' }}>{fmtMoney(v.valor)}</td>
                  <td className="px-4 py-2.5 text-center"><Badge variant={v.activo ? 'success' : 'danger'}>{v.activo ? 'Activo' : 'Inactivo'}</Badge></td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setShowHist(v.id)} className="p-1.5 rounded-md cursor-pointer hover:bg-white/10" style={{ color: 'var(--color-ink-muted)' }} title="Historial"><History size={12} /></button>
                      <button onClick={() => openEdit(v)} className="p-1.5 rounded-md cursor-pointer hover:bg-white/10" style={{ color: 'var(--color-ink-muted)' }}><Pencil size={12} /></button>
                      <button onClick={() => del.mutate(v.id)} className="p-1.5 rounded-md cursor-pointer hover:bg-white/10" style={{ color: 'var(--color-accent)' }}><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal crear/editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowModal(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl p-6 w-full max-w-md" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--color-ink)' }}>{editRow ? 'Editar valor' : 'Nuevo valor'}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>Usuario</label>
                <select value={form.usuario_id} onChange={(e) => setForm({ ...form, usuario_id: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg text-xs outline-none" style={{ backgroundColor: 'oklch(100% 0 0 / 5%)', border: '1px solid var(--color-border)', color: 'var(--color-ink)' }}>
                  <option value="">Seleccionar...</option>
                  {usuarios.filter((u) => u.rol !== 'Admin').map((u) => <option key={u.id} value={u.id}>{u.nombre} ({u.usuario})</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>Valor anual ($)</label>
                <input type="number" min="0" step="1000" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg text-xs outline-none" style={{ backgroundColor: 'oklch(100% 0 0 / 5%)', border: '1px solid var(--color-border)', color: 'var(--color-ink)' }} placeholder="6000000" />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>Año</label>
                <input type="number" min="2000" value={form.periodo_anio} onChange={(e) => setForm({ ...form, periodo_anio: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg text-xs outline-none" style={{ backgroundColor: 'oklch(100% 0 0 / 5%)', border: '1px solid var(--color-border)', color: 'var(--color-ink)' }} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowModal(false)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer" style={{ backgroundColor: 'oklch(100% 0 0 / 5%)', color: 'var(--color-ink-muted)' }}>
                <X size={12} /> Cancelar
              </button>
              <button onClick={() => save.mutate()} disabled={save.isPending || !form.usuario_id || !form.valor}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white cursor-pointer disabled:opacity-50" style={{ backgroundColor: 'var(--color-accent)' }}>
                <Save size={12} /> Guardar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal historial */}
      {showHist != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowHist(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl p-6 w-full max-w-md max-h-[60vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--color-ink)' }}>Historial de cambios</h3>
            <div className="space-y-2">
              {historial.length === 0 && <p className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>Sin registros</p>}
              {historial.map((h: { id: number; valor_anterior: number; valor_nuevo: number; modificado_en: string }) => (
                <div key={h.id} className="p-2.5 rounded-lg" style={{ backgroundColor: 'oklch(100% 0 0 / 3%)' }}>
                  <p className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>{h.modificado_en}</p>
                  <p className="text-xs font-medium" style={{ color: 'var(--color-ink)' }}>{fmtMoney(h.valor_anterior)} → {fmtMoney(h.valor_nuevo)}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={() => setShowHist(null)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer" style={{ backgroundColor: 'oklch(100% 0 0 / 5%)', color: 'var(--color-ink-muted)' }}>
                Cerrar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

// =====================================================
// SECCIÓN 3: CASOS ESPECIALES
// =====================================================
function CasosTab({ toast, qc }: { toast: ReturnType<typeof useToast>; qc: ReturnType<typeof useQueryClient> }) {
  const { data: casos = [], isLoading } = useQuery<CasoRow[]>({
    queryKey: ['sv-casos'],
    queryFn: async () => { const { data } = await api.get<CasoRow[]>('/salario-variable-admin/casos'); return data },
  })
  const { data: usuarios = [] } = useQuery<Usuario[]>({
    queryKey: ['usuarios'],
    queryFn: async () => { const { data } = await api.get<Usuario[]>('/usuarios'); return data },
  })

  const [showModal, setShowModal] = useState(false)
  const [editRow, setEditRow] = useState<CasoRow | null>(null)
  const [form, setForm] = useState<{
    usuario_id: string; descripcion: string;
    usuariosFuente: number[];
    componentes: { metrica: string; nombre: string; peso: string }[];
  }>({ usuario_id: '', descripcion: '', usuariosFuente: [], componentes: [] })

  const pesoTotal = form.componentes.reduce((s, c) => s + (Number(c.peso) || 0), 0)
  const pesosValidos = form.componentes.length === 0 || pesoTotal === 100

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        usuario_id: Number(form.usuario_id),
        descripcion: form.descripcion,
        tipo_regla: 'consolidado',
        configuracion: {
          usuarios_fuente: form.usuariosFuente,
          componentes: form.componentes.map((c) => ({ metrica: c.metrica, nombre: c.nombre, peso: Number(c.peso) || 0 })),
        },
      }
      if (editRow) await api.patch(`/salario-variable-admin/casos/${editRow.id}`, payload)
      else await api.post('/salario-variable-admin/casos', payload)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sv-casos'] }); setShowModal(false); toast.success(editRow ? 'Caso actualizado' : 'Caso creado') },
    onError: () => toast.error('Error al guardar'),
  })

  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/salario-variable-admin/casos/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sv-casos'] }); toast.success('Caso eliminado') },
    onError: () => toast.error('Error al eliminar'),
  })

  function openNew() {
    setEditRow(null)
    setForm({ usuario_id: '', descripcion: '', usuariosFuente: [], componentes: [] })
    setShowModal(true)
  }
  function openEdit(r: CasoRow) {
    setEditRow(r)
    const cfg = r.configuracion ?? {}
    const comps = (cfg.componentes as Array<{ metrica?: string; nombre?: string; peso?: number }>) ?? []
    setForm({
      usuario_id: String(r.usuario_id),
      descripcion: r.descripcion,
      usuariosFuente: (cfg.usuarios_fuente as number[]) ?? [],
      componentes: comps.map((c) => ({ metrica: c.metrica ?? 'plan', nombre: c.nombre ?? '', peso: String(c.peso ?? '') })),
    })
    setShowModal(true)
  }

  function toggleUsuarioFuente(id: number) {
    setForm((f) => ({ ...f, usuariosFuente: f.usuariosFuente.includes(id) ? f.usuariosFuente.filter((x) => x !== id) : [...f.usuariosFuente, id] }))
  }

  function updateComponente(i: number, patch: Partial<{ metrica: string; nombre: string; peso: string }>) {
    setForm((f) => ({ ...f, componentes: f.componentes.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) }))
  }
  function addComponente() {
    setForm((f) => ({ ...f, componentes: [...f.componentes, { metrica: 'plan', nombre: '', peso: '' }] }))
  }
  function removeComponente(i: number) {
    setForm((f) => ({ ...f, componentes: f.componentes.filter((_, idx) => idx !== i) }))
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>
          Reglas especiales: el cálculo de un usuario se consolida desde otros usuarios fuente.
        </p>
        <button onClick={openNew} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-white cursor-pointer hover:opacity-90" style={{ backgroundColor: 'var(--color-accent)' }}>
          <Plus size={13} /> Nuevo caso
        </button>
      </div>

      {isLoading ? (
        <p className="text-xs text-center py-8" style={{ color: 'var(--color-ink-muted)' }}>Cargando...</p>
      ) : casos.length === 0 ? (
        <div className="text-center py-12 rounded-xl" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <Users size={24} className="mx-auto mb-2" style={{ color: 'var(--color-ink-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--color-ink-muted)' }}>No hay casos especiales configurados</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {casos.map((c) => {
            const cfg = c.configuracion ?? {}
            const fuentes = (cfg.usuarios_fuente as number[]) ?? []
            const comps = (cfg.componentes as Array<{ metrica?: string; nombre?: string; peso?: number }>) ?? []
            const fuenteNombres = usuarios.filter((u) => fuentes.includes(u.id)).map((u) => u.nombre)
            return (
              <div key={c.id} className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs font-semibold" style={{ color: 'var(--color-ink)' }}>{c.usuario?.nombre}</p>
                      <Badge variant="info">Consolidado</Badge>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>{c.descripcion}</p>
                    {fuenteNombres.length > 0 && (
                      <p className="text-[10px] mt-1.5" style={{ color: 'var(--color-ink-muted)' }}>
                        <strong>Usuarios fuente:</strong> {fuenteNombres.join(', ')}
                      </p>
                    )}
                    {comps.length > 0 && (
                      <p className="text-[10px]" style={{ color: 'var(--color-ink-muted)' }}>
                        <strong>Componentes:</strong> {comps.map((cc) => `${cc.nombre ?? cc.metrica} ${cc.peso ?? 0}%`).join(' · ')}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(c)} className="p-1.5 rounded-md cursor-pointer hover:bg-white/10" style={{ color: 'var(--color-ink-muted)' }}><Pencil size={12} /></button>
                    <button onClick={() => del.mutate(c.id)} className="p-1.5 rounded-md cursor-pointer hover:bg-white/10" style={{ color: 'var(--color-accent)' }}><Trash2 size={12} /></button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowModal(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--color-ink)' }}>{editRow ? 'Editar caso' : 'Nuevo caso especial'}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>Usuario destino</label>
                <select value={form.usuario_id} onChange={(e) => setForm({ ...form, usuario_id: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg text-xs outline-none cursor-pointer" style={{ backgroundColor: 'oklch(100% 0 0 / 5%)', border: '1px solid var(--color-border)', color: 'var(--color-ink)' }}>
                  <option value="">Seleccionar...</option>
                  {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre} ({u.usuario})</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>Descripción</label>
                <input type="text" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg text-xs outline-none" style={{ backgroundColor: 'oklch(100% 0 0 / 5%)', border: '1px solid var(--color-border)', color: 'var(--color-ink)' }} placeholder="Ej: Consolidado equipos Nomina y Admin. Personal" />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>
                  Usuarios fuente ({form.usuariosFuente.length} seleccionados)
                </label>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto p-2 rounded-lg" style={{ backgroundColor: 'oklch(100% 0 0 / 3%)' }}>
                  {usuarios.filter((u) => u.id !== Number(form.usuario_id)).map((u) => {
                    const checked = form.usuariosFuente.includes(u.id)
                    return (
                      <label key={u.id} className="flex items-center gap-2 text-xs cursor-pointer select-none px-2 py-1.5 rounded-md" style={{ color: 'var(--color-ink)' }}>
                        <input type="checkbox" checked={checked} className="w-3.5 h-3.5 rounded" style={{ accentColor: 'var(--color-accent)' }} onChange={() => toggleUsuarioFuente(u.id)} />
                        <span className="truncate">{u.nombre}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>Componentes del caso</label>
                  <button type="button" onClick={addComponente} className="flex items-center gap-1 text-[10px] font-medium cursor-pointer hover:opacity-80" style={{ color: 'var(--color-accent)' }}>
                    <Plus size={11} /> Agregar
                  </button>
                </div>
                <div className="mt-1.5 space-y-2 p-2 rounded-lg" style={{ backgroundColor: 'oklch(100% 0 0 / 3%)' }}>
                  {form.componentes.length === 0 && (
                    <p className="text-[10px]" style={{ color: 'var(--color-ink-muted)' }}>
                      Sin componentes propios: se usará la configuración del perfil del usuario.
                    </p>
                  )}
                  {form.componentes.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <select value={c.metrica} onChange={(e) => updateComponente(i, { metrica: e.target.value })}
                        className="w-32 px-2 py-1.5 rounded-md text-xs outline-none cursor-pointer" style={{ backgroundColor: 'oklch(100% 0 0 / 5%)', border: '1px solid var(--color-border)', color: 'var(--color-ink)' }}>
                        <option value="plan">Plan de Entregables</option>
                        <option value="exactitud">Exactitud de Cálculos</option>
                        <option value="quejas">Quejas</option>
                      </select>
                      <input type="text" value={c.nombre} onChange={(e) => updateComponente(i, { nombre: e.target.value })} placeholder="Nombre del componente"
                        className="flex-1 min-w-0 px-2 py-1.5 rounded-md text-xs outline-none" style={{ backgroundColor: 'oklch(100% 0 0 / 5%)', border: '1px solid var(--color-border)', color: 'var(--color-ink)' }} />
                      <div className="relative">
                        <input type="number" min="0" max="100" value={c.peso} onChange={(e) => updateComponente(i, { peso: e.target.value })} placeholder="50"
                          className="w-20 px-2 py-1.5 pr-5 rounded-md text-xs outline-none text-right" style={{ backgroundColor: 'oklch(100% 0 0 / 5%)', border: '1px solid var(--color-border)', color: 'var(--color-ink)' }} />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px]" style={{ color: 'var(--color-ink-muted)' }}>%</span>
                      </div>
                      <button type="button" onClick={() => removeComponente(i)} className="p-1.5 rounded-md cursor-pointer hover:bg-white/10 shrink-0" style={{ color: 'var(--color-accent)' }} title="Quitar"><Trash2 size={12} /></button>
                    </div>
                  ))}
                  {form.componentes.length > 0 && (
                    <div className="flex justify-end pt-1">
                      <span className="text-[10px] font-semibold" style={{ color: pesosValidos ? 'oklch(56% 0.18 145)' : 'oklch(52% 0.22 15)' }}>
                        Suma de pesos: {pesoTotal}% {pesosValidos ? '✓' : '(debe ser 100%)'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowModal(false)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer" style={{ backgroundColor: 'oklch(100% 0 0 / 5%)', color: 'var(--color-ink-muted)' }}>
                <X size={12} /> Cancelar
              </button>
              <button onClick={() => save.mutate()} disabled={save.isPending || !form.usuario_id || !form.descripcion || form.usuariosFuente.length === 0 || !pesosValidos || form.componentes.some((c) => !c.nombre.trim())}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white cursor-pointer disabled:opacity-50" style={{ backgroundColor: 'var(--color-accent)' }}>
                <Save size={12} /> Guardar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
interface ComponentePago {
  nombre: string; metrica: string | null; peso: number
  estado: 'ganado' | 'perdido' | 'pendiente'; detalle: string
}
interface ConsolidadoGlobal {
  plan: { asignados: number; evaluados: number; cumplidos: number; incumplidos: number; pendientes: number; pct: number | null; meta: number | null }
  exactitud: { asignados: number; evaluados: number; pendientes: number; compromiso_total: number; correctos_total: number; procesados_total?: number; pct: number | null; meta: number | null }
  error_interno: number; error_cliente: number; quejas: number
}
interface FilaResultado {
  usuario: { id: number; nombre: string; usuario: string; rol: string }
  periodo: { anio: number; mes: number }
  clientes: { id: number; cliente: string }[]
  valor_base: number | null
  consolidado: ConsolidadoGlobal
  componentes: ComponentePago[]
  pct_final: number
  valor_a_pagar: number | null
  caso_especial: boolean
}

function ResultadosTab() {
  const { usuario: currentUser } = useAuth()
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [usuarioId, setUsuarioId] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [rolFiltro, setRolFiltro] = useState('')

  const isAdmin = currentUser?.rol === 'Admin'

  const params = new URLSearchParams({ anio: String(anio), mes: String(mes) })
  if (usuarioId) params.set('usuario_id', usuarioId)
  if (clienteId) params.set('cliente_id', clienteId)
  if (rolFiltro) params.set('rol', rolFiltro)

  const { data: resultados = [], isLoading } = useQuery<FilaResultado[]>({
    queryKey: ['sv-resultados-pago', params.toString()],
    queryFn: async () => { const { data } = await api.get<FilaResultado[]>(`/salario-variable-admin/resultados-pago?${params.toString()}`); return data },
  })
  const { data: usuarios = [] } = useQuery<Usuario[]>({
    queryKey: ['usuarios'],
    queryFn: async () => { const { data } = await api.get<Usuario[]>('/usuarios'); return data },
  })
  const { data: clientes = [] } = useQuery<{ id: number; cliente: string }[]>({
    queryKey: ['clientes'],
    queryFn: async () => { const { data } = await api.get<{ id: number; cliente: string }[]>('/clientes'); return data },
  })

  const totalPagar = resultados.reduce((s, r) => s + (r.valor_a_pagar ?? 0), 0)

  function exportCSV() {
    // Formato para nómina: Nombre, Variable, Porcentaje cumplimiento, Valor a pagar
    const headers = ['Nombre', 'Variable anual', 'Porcentaje cumplimiento', 'Valor a pagar']
    const rows = resultados.map((r) => [
      r.usuario.nombre,
      r.valor_base != null ? Math.round(r.valor_base) : '',
      `${r.pct_final}%`,
      r.valor_a_pagar != null ? Math.round(r.valor_a_pagar) : '',
    ])
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
    const BOM = '﻿'
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `salario_variable_${anio}_${mes}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  async function exportXLSX() {
    const ExcelJS = require('exceljs')
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Solutions & Payroll'
    wb.created = new Date()

    // ══════════════════════════════════════════
    // HOJA: Salario Variable
    // ══════════════════════════════════════════
    const ws = wb.addWorksheet('Salario Variable', { views: [{ showGridLines: false }] })

    // Fila 1: Título
    ws.mergeCells('A1:D1')
    const titulo = ws.getCell('A1')
    titulo.value = 'SALARIO VARIABLE'
    titulo.font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FFFFFFFF' } }
    titulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } }
    titulo.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(1).height = 34

    // Fila 2: Subtítulo
    ws.mergeCells('A2:D2')
    const sub = ws.getCell('A2')
    sub.value = `Período: ${MESES[mes - 1]} ${anio}`
    sub.font = { name: 'Calibri', size: 11, color: { argb: 'FFFFFFFF' } }
    sub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } }
    sub.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(2).height = 20

    // Fila 3: vacía
    ws.getRow(3).height = 8

    // Fila 4: Encabezados
    const encabezados = ['Nombre', 'Variable anual', '% Cumplimiento', 'Valor a Pagar']
    encabezados.forEach((h, i) => {
      const cell = ws.getCell(4, i + 1)
      cell.value = h
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E5395' } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FF1F3864' } },
      }
    })
    ws.getRow(4).height = 30

    // Filas de datos (desde fila 5)
    const dataStart = 5
    resultados.forEach((r, idx) => {
      const row = wb.getWorksheet('Salario Variable')!.getRow(dataStart + idx)
      const isEven = idx % 2 === 0
      const bgColor = isEven ? 'FFEEF2FA' : 'FFFFFFFF'

      row.getCell(1).value = r.usuario.nombre
      row.getCell(1).font = { name: 'Calibri', size: 11, color: { argb: 'FF000000' } }
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
      row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' }

      row.getCell(2).value = r.valor_base != null ? Math.round(r.valor_base) : 0
      row.getCell(2).font = { name: 'Calibri', size: 11, color: { argb: 'FF000000' } }
      row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
      row.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' }
      row.getCell(2).numFmt = '#,##0'

      row.getCell(3).value = r.pct_final / 100
      row.getCell(3).font = { name: 'Calibri', size: 11, bold: true, color: { argb: r.pct_final >= 60 ? 'FF1F3864' : 'FFCC0000' } }
      row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
      row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' }
      row.getCell(3).numFmt = '0%'

      row.getCell(4).value = r.valor_a_pagar != null ? Math.round(r.valor_a_pagar) : 0
      row.getCell(4).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1F3864' } }
      row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
      row.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' }
      row.getCell(4).numFmt = '#,##0'

      // Bordes sutiles
      for (let c = 1; c <= 4; c++) {
        row.getCell(c).border = {
          bottom: { style: 'thin', color: { argb: 'FFDDDFE8' } },
        }
      }
    })

    // Fila TOTAL
    const totalRowNum = dataStart + resultados.length
    const totalRow = wb.getWorksheet('Salario Variable')!.getRow(totalRowNum)
    totalRow.getCell(1).value = 'TOTAL'
    totalRow.getCell(1).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1F3864' } }
    totalRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E2F3' } }

    totalRow.getCell(2).value = { formula: `SUM(B${dataStart}:B${totalRowNum - 1})` }
    totalRow.getCell(2).font = { name: 'Calibri', size: 11, bold: true }
    totalRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E2F3' } }
    totalRow.getCell(2).numFmt = '#,##0'

    totalRow.getCell(3).value = { formula: `AVERAGE(C${dataStart}:C${totalRowNum - 1})` }
    totalRow.getCell(3).font = { name: 'Calibri', size: 11, bold: true }
    totalRow.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E2F3' } }
    totalRow.getCell(3).numFmt = '0%'

    totalRow.getCell(4).value = { formula: `SUM(D${dataStart}:D${totalRowNum - 1})` }
    totalRow.getCell(4).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1F3864' } }
    totalRow.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E2F3' } }
    totalRow.getCell(4).numFmt = '#,##0'
    totalRow.height = 24

    // Ancho de columnas
    ws.getColumn(1).width = 32
    ws.getColumn(2).width = 15
    ws.getColumn(3).width = 18
    ws.getColumn(4).width = 16

    // ══════════════════════════════════════════
    // HOJA: Resumen
    // ══════════════════════════════════════════
    const ws2 = wb.addWorksheet('Resumen')

    ws2.mergeCells('A1:B1')
    const r2t = ws2.getCell('A1')
    r2t.value = 'RESUMEN EJECUTIVO'
    r2t.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
    r2t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } }
    r2t.alignment = { horizontal: 'center', vertical: 'middle' }

    ws2.mergeCells('A2:B2')
    const r2s = ws2.getCell('A2')
    r2s.value = `Salario Variable – ${MESES[mes - 1]} ${anio}`
    r2s.font = { name: 'Calibri', size: 11, color: { argb: 'FFFFFFFF' } }
    r2s.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } }
    r2s.alignment = { horizontal: 'center', vertical: 'middle' }

    ws2.getRow(3).height = 12

    ;['Concepto', 'Valor'].forEach((h, i) => {
      const cell = ws2.getCell(4, i + 1)
      cell.value = h
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E5395' } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
    })

    ws2.getCell('A5').value = 'Período'
    ws2.getCell('B5').value = `${MESES[mes - 1]} ${anio}`
    ws2.getCell('A6').value = 'Total colaboradores'
    ws2.getCell('B6').value = resultados.length
    ws2.getCell('A7').value = 'Total a pagar'
    ws2.getCell('B7').value = Math.round(resultados.reduce((s, r) => s + (r.valor_a_pagar ?? 0), 0))
    ws2.getCell('B7').numFmt = '#,##0'

    ws2.getColumn(1).width = 22
    ws2.getColumn(2).width = 18

    // ── Descargar ──
    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `salario_variable_${anio}_${mes}.xlsx`; a.click()
    URL.revokeObjectURL(url)
  }

  const selectStyle = {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-ink)',
  } as const

  return (
    <div className="space-y-5">
      {/* Resumen */}
      <div className="flex gap-4">
        <div className="rounded-xl px-4 py-2 flex-1" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <span className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>Total a pagar</span>
          <p className="text-lg font-bold" style={{ color: 'var(--color-ink)' }}>{fmtMoney(totalPagar)}</p>
        </div>
        <div className="rounded-xl px-4 py-2 flex-1" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <span className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>Colaboradores</span>
          <p className="text-lg font-bold" style={{ color: 'var(--color-ink)' }}>{resultados.length}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <select value={anio} onChange={(e) => setAnio(Number(e.target.value))} className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer" style={selectStyle}>
          {[2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer" style={selectStyle}>
          {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        {isAdmin && (
          <select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)} className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer" style={selectStyle}>
            <option value="">Todos los usuarios</option>
            {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </select>
        )}
        <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer" style={selectStyle}>
          <option value="">Todos los clientes</option>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.cliente}</option>)}
        </select>
        <select value={rolFiltro} onChange={(e) => setRolFiltro(e.target.value)} className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer" style={selectStyle}>
          <option value="">Todos los roles</option>
          <option value="Analista">Analista</option>
          <option value="Lider">Líder</option>
        </select>
        {isAdmin && (
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer" style={selectStyle}>
              <Download size={13} /> CSV
            </button>
            <button onClick={exportXLSX} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-white cursor-pointer" style={{ backgroundColor: 'oklch(56% 0.18 145)' }}>
              <FileSpreadsheet size={13} /> Excel (XLSX)
            </button>
          </div>
        )}
      </div>

      {/* Resumen para nómina */}
      <div className="rounded-xl p-4 print:hidden" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-2 mb-2">
          <FileText size={13} style={{ color: 'var(--color-primary)' }} />
          <span className="text-xs font-semibold" style={{ color: 'var(--color-ink)' }}>Reporte para Nómina</span>
        </div>
        <p className="text-[11px]" style={{ color: 'var(--color-ink-muted)' }}>
          Descarga directa con columnas: Nombre · Variable · Porcentaje cumplimiento · Valor a pagar.
          Formato CSV compatible con Excel.
        </p>
      </div>

      {/* Cards por usuario */}
      {isLoading ? (
        <p className="text-xs text-center py-10" style={{ color: 'var(--color-ink-muted)' }}>Calculando...</p>
      ) : resultados.length === 0 ? (
        <div className="text-center py-14 rounded-xl" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <DollarSign size={26} className="mx-auto mb-2" style={{ color: 'var(--color-ink-muted)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>Sin resultados en este período</p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-ink-muted)' }}>
            Se calculan en vivo desde Cumplimiento + Configuración por Perfil + Valores de Variable
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {resultados.map((r) => (
            <motion.div
              key={r.usuario.id}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
              className="rounded-xl p-5"
              style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              {/* Header */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0"
                  style={{ background: 'linear-gradient(135deg, var(--color-accent) 0%, oklch(45% 0.22 15) 100%)' }}>
                  {r.usuario.nombre?.[0]?.toUpperCase() ?? 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>{r.usuario.nombre}</p>
                    <Badge variant={r.usuario.rol === 'Lider' ? 'warning' : 'info'}>{r.usuario.rol}</Badge>
                    {r.caso_especial && <Badge variant="danger">Caso especial</Badge>}
                  </div>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-ink-muted)' }}>
                    {MESES[r.periodo.mes - 1]} {r.periodo.anio} · {r.clientes.map((c) => c.cliente).join(', ')}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-semibold tracking-wider block" style={{ color: 'var(--color-ink-muted)' }}>Variable base (anual)</span>
                  <span className="text-sm font-bold" style={{ color: 'var(--color-ink)' }}>{fmtMoney(r.valor_base)}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Consolidado */}
                <div className="rounded-xl p-4 space-y-2.5" style={{ backgroundColor: 'oklch(100% 0 0 / 3%)' }}>
                  <p className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: 'var(--color-ink-muted)' }}>Consolidado global</p>
                  <div className="flex items-center justify-between text-[11px]">
                    <span style={{ color: 'var(--color-ink-muted)' }}>Plan ({r.consolidado.plan.cumplidos}/{r.consolidado.plan.evaluados})</span>
                    <span className="font-semibold" style={{ color: 'var(--color-ink)' }}>
                      {r.consolidado.plan.pct != null ? `${r.consolidado.plan.pct}%` : '—'}
                      <span className="font-normal" style={{ color: 'var(--color-ink-muted)' }}> / {r.consolidado.plan.meta ?? '—'}%</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span style={{ color: 'var(--color-ink-muted)' }}>Exactitud ({r.consolidado.exactitud.correctos_total}/{r.consolidado.exactitud.compromiso_total})</span>
                    <span className="font-semibold" style={{ color: 'var(--color-ink)' }}>
                      {r.consolidado.exactitud.pct != null ? `${r.consolidado.exactitud.pct}%` : '—'}
                      <span className="font-normal" style={{ color: 'var(--color-ink-muted)' }}> / {r.consolidado.exactitud.meta ?? '—'}%</span>
                    </span>
                  </div>
                  <div className="space-y-1.5 text-[11px] pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
                    <div className="flex items-center justify-between">
                      <span style={{ color: 'var(--color-ink-muted)' }}>Errores internos</span>
                      <span className="font-semibold" style={{ color: r.consolidado.error_interno > 0 ? 'oklch(70% 0.16 65)' : 'var(--color-ink)' }}>{r.consolidado.error_interno}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span style={{ color: 'var(--color-ink-muted)' }}>Errores de cliente</span>
                      <span className="font-semibold" style={{ color: r.consolidado.error_cliente > 0 ? 'oklch(52% 0.22 15)' : 'var(--color-ink)' }}>{r.consolidado.error_cliente}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span style={{ color: 'var(--color-ink-muted)' }}>Quejas</span>
                      <span className="font-semibold" style={{ color: r.consolidado.quejas > 0 ? 'oklch(52% 0.22 15)' : 'var(--color-ink)' }}>{r.consolidado.quejas}</span>
                    </div>
                  </div>
                </div>

                {/* Componentes */}
                <div className="rounded-xl p-4 lg:col-span-2" style={{ backgroundColor: 'oklch(100% 0 0 / 3%)' }}>
                  <p className="text-[10px] uppercase font-semibold tracking-wider mb-2.5" style={{ color: 'var(--color-ink-muted)' }}>Componentes del variable</p>
                  <div className="space-y-1.5">
                    {r.componentes.length === 0 && (
                      <p className="text-[11px]" style={{ color: 'var(--color-ink-muted)' }}>Sin configuración para el perfil {r.usuario.rol}</p>
                    )}
                    {r.componentes.map((c, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 text-[11px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {c.estado === 'ganado' && <CheckCircle2 size={12} style={{ color: 'oklch(56% 0.18 145)' }} />}
                          {c.estado === 'perdido' && <XCircle size={12} style={{ color: 'oklch(52% 0.22 15)' }} />}
                          {c.estado === 'pendiente' && <Clock size={12} style={{ color: 'var(--color-ink-subtle)' }} />}
                          <span className="font-medium truncate" style={{ color: 'var(--color-ink)' }}>{c.nombre}</span>
                          <span className="shrink-0" style={{ color: 'var(--color-ink-muted)' }}>· {c.peso}% · {c.detalle}</span>
                        </div>
                        <span className="font-semibold shrink-0"
                          style={{ color: c.estado === 'ganado' ? 'oklch(56% 0.18 145)' : c.estado === 'perdido' ? 'oklch(52% 0.22 15)' : 'var(--color-ink-subtle)' }}>
                          {c.estado === 'ganado' ? `+${c.peso}%` : c.estado === 'perdido' ? '0%' : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Resultado final */}
              <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
                <div className="flex items-center gap-6">
                  <div>
                    <span className="text-[10px] uppercase font-semibold tracking-wider block" style={{ color: 'var(--color-ink-muted)' }}>Cumplimiento final</span>
                    <span className="text-xl font-bold tabular-nums" style={{ color: 'var(--color-ink)' }}>{r.pct_final}%</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-semibold tracking-wider block" style={{ color: 'var(--color-ink-muted)' }}>Valor a pagar</span>
                    <span className="text-xl font-bold" style={{ color: 'oklch(56% 0.18 145)' }}>{fmtMoney(r.valor_a_pagar)}</span>
                  </div>
                </div>
                {r.valor_base == null && (
                  <span className="text-[10px] px-2 py-1 rounded-md" style={{ backgroundColor: 'oklch(70% 0.16 65 / 15%)', color: 'oklch(60% 0.14 65)' }}>
                    Sin valor de variable asignado para el período
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

// =====================================================
// SECCIÓN: CUMPLIMIENTO CONSOLIDADO
// =====================================================
interface BloquePlan {
  asignados: number; evaluados: number; cumplidos: number; incumplidos: number
  pendientes: number; pct: number | null; meta: number | null; cumple_meta: boolean | null
}
interface BloqueExactitud {
  asignados: number; evaluados: number; pendientes: number
  compromiso_total: number; correctos_total: number
  pct: number | null; meta: number | null; cumple_meta: boolean | null
}
interface FilaCumplimiento {
  usuario: { id: number; nombre: string; usuario: string; rol: string }
  cliente: { id: number; cliente: string }
  plan: BloquePlan
  exactitud: BloqueExactitud
  errores_internos: number; errores_cliente: number; quejas: number
}

function EstadoMeta({ cumple }: { cumple: boolean | null }) {
  if (cumple === null) return <span className="text-[10px]" style={{ color: 'var(--color-ink-subtle)' }}>Sin evaluar</span>
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold"
      style={{ color: cumple ? 'oklch(56% 0.18 145)' : 'oklch(52% 0.22 15)' }}>
      {cumple ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
      {cumple ? 'Cumple' : 'No cumple'}
    </span>
  )
}

function CumplimientoTab() {
  const { usuario: currentUser } = useAuth()
  const router = useRouter()
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [usuarioId, setUsuarioId] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [rolFiltro, setRolFiltro] = useState('')
  const [aprobado, setAprobado] = useState('')

  const isAdmin = currentUser?.rol === 'Admin'

  const params = new URLSearchParams({ anio: String(anio), mes: String(mes) })
  if (usuarioId) params.set('usuario_id', usuarioId)
  if (clienteId) params.set('cliente_id', clienteId)
  if (rolFiltro) params.set('rol', rolFiltro)
  if (aprobado) params.set('aprobado', aprobado)

  const { data: filas = [], isLoading } = useQuery<FilaCumplimiento[]>({
    queryKey: ['sv-cumplimiento', params.toString()],
    queryFn: async () => { const { data } = await api.get<FilaCumplimiento[]>(`/salario-variable-admin/cumplimiento?${params.toString()}`); return data },
  })
  const { data: usuarios = [] } = useQuery<Usuario[]>({
    queryKey: ['usuarios'],
    queryFn: async () => { const { data } = await api.get<Usuario[]>('/usuarios'); return data },
  })
  const { data: clientes = [] } = useQuery<{ id: number; cliente: string }[]>({
    queryKey: ['clientes'],
    queryFn: async () => { const { data } = await api.get<{ id: number; cliente: string }[]>('/clientes'); return data },
  })
  const { data: indicadores = [] } = useQuery<{ id: number; nombre: string }[]>({
    queryKey: ['indicadores'],
    queryFn: async () => { const { data } = await api.get<{ id: number; nombre: string }[]>('/indicadores'); return data },
  })

  const idPlan = indicadores.find((i) => i.nombre.trim().toUpperCase() === 'PLAN DE ENTREGABLES')?.id
  const idExactitud = indicadores.find((i) => i.nombre.trim().toUpperCase() === 'EXACTITUD DE CÁLCULOS')?.id

  function irADetalle(fila: FilaCumplimiento, indicador: 'plan' | 'exactitud') {
    const p = new URLSearchParams({
      cliente_id: String(fila.cliente.id),
      usuario_id: String(fila.usuario.id),
      anio: String(anio),
      mes: String(mes),
    })
    const indId = indicador === 'plan' ? idPlan : idExactitud
    if (indId) p.set('indicador_id', String(indId))
    router.push(`/dashboard/entregables?${p.toString()}`)
  }

  function exportCSV() {
    const headers = ['Usuario', 'Rol', 'Cliente', 'Plan asignados', 'Plan evaluados', 'Plan cumplidos', 'Plan incumplidos', 'Plan pendientes', 'Plan %', 'Plan meta', 'Plan cumple', 'Exactitud compromiso', 'Exactitud correctos', 'Exactitud %', 'Exactitud meta', 'Exactitud cumple', 'Err. internos', 'Err. cliente', 'Quejas']
    const rows = filas.map((f) => [
      f.usuario.nombre, f.usuario.rol, f.cliente.cliente,
      f.plan.asignados, f.plan.evaluados, f.plan.cumplidos, f.plan.incumplidos, f.plan.pendientes,
      f.plan.pct ?? '', f.plan.meta ?? '', f.plan.cumple_meta ?? '',
      f.exactitud.compromiso_total, f.exactitud.correctos_total,
      f.exactitud.pct ?? '', f.exactitud.meta ?? '', f.exactitud.cumple_meta ?? '',
      f.errores_internos, f.errores_cliente, f.quejas,
    ])
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `cumplimiento_${anio}_${mes}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const selectStyle = {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-ink)',
  } as const

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <select value={anio} onChange={(e) => setAnio(Number(e.target.value))} className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer" style={selectStyle}>
          {[2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer" style={selectStyle}>
          {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        {isAdmin && (
          <select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)} className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer" style={selectStyle}>
            <option value="">Todos los usuarios</option>
            {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </select>
        )}
        <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer" style={selectStyle}>
          <option value="">Todos los clientes</option>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.cliente}</option>)}
        </select>
        <select value={rolFiltro} onChange={(e) => setRolFiltro(e.target.value)} className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer" style={selectStyle}>
          <option value="">Todos los roles</option>
          <option value="Analista">Analista</option>
          <option value="Lider">Líder</option>
        </select>
        <select value={aprobado} onChange={(e) => setAprobado(e.target.value)} className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer" style={selectStyle}>
          <option value="">Con y sin aprobar</option>
          <option value="true">Solo aprobados</option>
          <option value="false">Solo no aprobados</option>
        </select>
        {isAdmin && (
          <button onClick={exportCSV}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer ml-auto"
            style={selectStyle}>
            <Download size={13} /> Exportar CSV
          </button>
        )}
      </div>

      {/* Resumen de filas */}
      <p className="text-xs" style={{ color: 'var(--color-ink-muted)' }}>
        {isLoading ? 'Calculando...' : `${filas.length} consolidado${filas.length === 1 ? '' : 's'} · ${MESES[mes - 1]} ${anio}`}
      </p>

      {/* Cards por usuario + cliente */}
      {isLoading ? (
        <p className="text-xs text-center py-10" style={{ color: 'var(--color-ink-muted)' }}>Cargando...</p>
      ) : filas.length === 0 ? (
        <div className="text-center py-14 rounded-xl" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <BarChart3 size={26} className="mx-auto mb-2" style={{ color: 'var(--color-ink-muted)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>Sin datos en este período</p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-ink-muted)' }}>
            Los entregables del nuevo modelo aparecerán aquí al registrarse resultados
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filas.map((f) => (
            <motion.div
              key={`${f.usuario.id}-${f.cliente.id}`}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
              className="rounded-xl p-5"
              style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              {/* Header */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ background: 'linear-gradient(135deg, var(--color-accent) 0%, oklch(45% 0.22 15) 100%)' }}>
                  {f.usuario.nombre?.[0]?.toUpperCase() ?? 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-ink)' }}>{f.usuario.nombre}</p>
                  <p className="text-[11px]" style={{ color: 'var(--color-ink-muted)' }}>{f.cliente.cliente} · {MESES[mes - 1]} {anio}</p>
                </div>
                <Badge variant={f.usuario.rol === 'Lider' ? 'warning' : 'info'}>{f.usuario.rol}</Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Plan de Entregables */}
                <div className="rounded-xl p-4" style={{ backgroundColor: 'oklch(100% 0 0 / 3%)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold" style={{ color: 'var(--color-ink)' }}>Plan de Entregables</p>
                    <EstadoMeta cumple={f.plan.cumple_meta} />
                  </div>
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-2xl font-bold tabular-nums" style={{ color: 'var(--color-ink)' }}>
                      {f.plan.pct != null ? `${f.plan.pct}%` : '—'}
                    </span>
                    <span className="text-[11px]" style={{ color: 'var(--color-ink-muted)' }}>
                      meta {f.plan.meta != null ? `${f.plan.meta}%` : '—'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-y-1.5 text-[11px]">
                    <button onClick={() => irADetalle(f, 'plan')} className="text-left cursor-pointer hover:underline" style={{ color: 'var(--color-ink-muted)' }}>
                      Asignados: <strong style={{ color: 'var(--color-ink)' }}>{f.plan.asignados}</strong>
                    </button>
                    <button onClick={() => irADetalle(f, 'plan')} className="text-left cursor-pointer hover:underline" style={{ color: 'var(--color-ink-muted)' }}>
                      Cumplidos a tiempo: <strong style={{ color: 'oklch(56% 0.18 145)' }}>{f.plan.cumplidos}</strong>
                    </button>
                    <button onClick={() => irADetalle(f, 'plan')} className="text-left cursor-pointer hover:underline" style={{ color: 'var(--color-ink-muted)' }}>
                      Incumplidos: <strong style={{ color: 'oklch(52% 0.22 15)' }}>{f.plan.incumplidos}</strong>
                    </button>
                    <span style={{ color: 'var(--color-ink-muted)' }}>
                      Pendientes: <strong style={{ color: 'var(--color-ink)' }}>{f.plan.pendientes}</strong>
                    </span>
                  </div>
                </div>

                {/* Exactitud de Cálculos */}
                <div className="rounded-xl p-4" style={{ backgroundColor: 'oklch(100% 0 0 / 3%)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold" style={{ color: 'var(--color-ink)' }}>Exactitud de Cálculos</p>
                    <EstadoMeta cumple={f.exactitud.cumple_meta} />
                  </div>
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-2xl font-bold tabular-nums" style={{ color: 'var(--color-ink)' }}>
                      {f.exactitud.pct != null ? `${f.exactitud.pct}%` : '—'}
                    </span>
                    <span className="text-[11px]" style={{ color: 'var(--color-ink-muted)' }}>
                      meta {f.exactitud.meta != null ? `${f.exactitud.meta}%` : '—'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-y-1.5 text-[11px]">
                    <button onClick={() => irADetalle(f, 'exactitud')} className="text-left cursor-pointer hover:underline" style={{ color: 'var(--color-ink-muted)' }}>
                      Cantidad procesada: <strong style={{ color: 'var(--color-ink)' }}>{f.exactitud.compromiso_total}</strong>
                    </button>
                    <button onClick={() => irADetalle(f, 'exactitud')} className="text-left cursor-pointer hover:underline" style={{ color: 'var(--color-ink-muted)' }}>
                      Correctos: <strong style={{ color: 'oklch(56% 0.18 145)' }}>{f.exactitud.correctos_total}</strong>
                    </button>
                    <span style={{ color: 'var(--color-ink-muted)' }}>
                      Registros: <strong style={{ color: 'var(--color-ink)' }}>{f.exactitud.asignados}</strong>
                    </span>
                    <span style={{ color: 'var(--color-ink-muted)' }}>
                      Pendientes: <strong style={{ color: 'var(--color-ink)' }}>{f.exactitud.pendientes}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Métricas independientes */}
              <div className="flex flex-wrap gap-2 mt-4 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
                <span className="px-2.5 py-1 rounded-md text-[10px] font-medium"
                  style={{ backgroundColor: f.errores_internos > 0 ? 'oklch(70% 0.16 65 / 15%)' : 'oklch(100% 0 0 / 4%)', color: f.errores_internos > 0 ? 'oklch(60% 0.14 65)' : 'var(--color-ink-muted)' }}>
                  Errores internos: {f.errores_internos}
                </span>
                <span className="px-2.5 py-1 rounded-md text-[10px] font-medium"
                  style={{ backgroundColor: f.errores_cliente > 0 ? 'oklch(52% 0.22 15 / 12%)' : 'oklch(100% 0 0 / 4%)', color: f.errores_cliente > 0 ? 'oklch(52% 0.22 15)' : 'var(--color-ink-muted)' }}>
                  Errores de cliente: {f.errores_cliente}
                </span>
                <span className="px-2.5 py-1 rounded-md text-[10px] font-medium"
                  style={{ backgroundColor: f.quejas > 0 ? 'oklch(52% 0.22 15 / 12%)' : 'oklch(100% 0 0 / 4%)', color: f.quejas > 0 ? 'oklch(52% 0.22 15)' : 'var(--color-ink-muted)' }}>
                  Quejas: {f.quejas}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
