'use client'

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts';
import { FileText, Download, TrendingUp, Target, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

interface ReporteData {
  cliente: { id: number; cliente: string; grupo: string | null };
  periodo: { desde: string; hasta: string };
  puntualidad: {
    meta: number; resultado: number | null; unidad: string;
    estado: 'cumple' | 'no_cumple' | 'sin_datos';
    total_entregables: number; evaluados: number;
    cumplidos: number; incumplidos: number; pendientes: number;
  };
  exactitud: {
    meta: number; resultado: number | null; unidad: string;
    estado: 'cumple' | 'no_cumple' | 'sin_datos';
    total_entregables: number; evaluados: number;
    compromiso_total: number; correctos_total: number;
    errores_internos: number; errores_cliente: number;
  };
  errores: {
    entregable_id: number; cliente: string; periodo: string;
    tipo_entregable: string; lider: string; responsable: string;
    error_interno: number; error_cliente: number; accion_tomada: string | null;
  }[];
}

interface ClienteOpt { id: number; cliente: string }

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const AHORA = new Date()

function fmtPct(n: number | null) {
  if (n == null) return '—'
  return `${n}%`
}

function EstadoBadge({ estado }: { estado: 'cumple' | 'no_cumple' | 'sin_datos' }) {
  if (estado === 'cumple') return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md text-white" style={{ backgroundColor: 'oklch(56% 0.18 145)' }}><CheckCircle2 size={10} />Cumple</span>
  if (estado === 'no_cumple') return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md text-white" style={{ backgroundColor: 'oklch(52% 0.22 15)' }}><XCircle size={10} />No cumple</span>
  return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md" style={{ backgroundColor: 'oklch(100% 0 0 / 8%)', color: 'var(--color-ink-muted)' }}>Sin datos</span>
}

export default function ReportesPage() {
  const { usuario: currentUser } = useAuth()

  // Inyectar estilos de impresión (solo cliente)
  useEffect(() => {
    const sid = 'reportes-print-style'
    if (!document.getElementById(sid)) {
      const s = document.createElement('style')
      s.id = sid
      s.textContent = `
        @media print {
          aside, nav, header, .print\\:hidden, button, select { display: none !important; }
          body, html { background: #fff !important; margin: 0 !important; padding: 0 !important; }
          #reporte-contenido { 
            position: absolute !important; top: 0 !important; left: 0 !important;
            width: 100% !important; padding: 20px !important; background: #fff !important;
          }
          .print\\\\:break-inside-avoid { break-inside: avoid; }
          @page { size: auto; margin: 10mm; }
        }
      `
      document.head.appendChild(s)
    }
  }, [])
  const isAdmin = currentUser?.rol === 'Admin'

  const [clienteId, setClienteId] = useState<number | ''>('')
  const [anioDesde, setAnioDesde] = useState(2026)
  const [mesDesde, setMesDesde] = useState(7)
  const [anioHasta, setAnioHasta] = useState(2026)
  const [mesHasta, setMesHasta] = useState(7)

  // Clientes accesibles
  const { data: clientes = [] } = useQuery<ClienteOpt[]>({
    queryKey: ['reportes-clientes', currentUser?.id],
    queryFn: async () => { const { data } = await api.get<ClienteOpt[]>('/reportes/clientes-accesibles'); return data },
    enabled: !!currentUser,
  })

  const puedeConsultar = clienteId !== ''

  const { data: reporte, isLoading } = useQuery<ReporteData>({
    queryKey: ['reporte-cliente', clienteId, anioDesde, mesDesde, anioHasta, mesHasta],
    queryFn: async () => {
      const p = new URLSearchParams({
        cliente_id: String(clienteId), anio_desde: String(anioDesde), mes_desde: String(mesDesde),
        anio_hasta: String(anioHasta), mes_hasta: String(mesHasta),
      })
      const { data } = await api.get<ReporteData>(`/reportes?${p.toString()}`)
      return data
    },
    enabled: puedeConsultar,
  })

  // Datos para el gráfico
  const chartData = reporte ? [
    { nombre: 'Puntualidad', meta: reporte.puntualidad.meta, resultado: reporte.puntualidad.resultado ?? 0 },
    { nombre: 'Exactitud', meta: reporte.exactitud.meta, resultado: reporte.exactitud.resultado ?? 0 },
  ] : []

  function descargarPDF() {
    window.print()
  }

  if (currentUser && currentUser.rol !== 'Admin' && currentUser.rol !== 'Lider') return null

  const selectStyle = {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-ink)',
  } as const

  return (
    <div className="max-w-6xl">
      <div className="mb-6 print:hidden">
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-ink)', letterSpacing: '-0.03em' }}>
          Reporte por Cliente
        </h1>
        <p className="text-xs mt-1" style={{ color: 'var(--color-ink-muted)' }}>
          Indicadores de cumplimiento, errores y acciones por cliente y período
        </p>
      </div>

      {/* Selectores */}
      <div className="flex flex-wrap gap-3 mb-6 print:hidden">
        <select value={clienteId} onChange={(e) => setClienteId(e.target.value ? Number(e.target.value) : '')}
          className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer" style={selectStyle}>
          <option value="">Seleccionar cliente...</option>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.cliente}</option>)}
        </select>
        <select value={anioDesde} onChange={(e) => setAnioDesde(Number(e.target.value))} className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer" style={selectStyle}>
          {[2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={mesDesde} onChange={(e) => setMesDesde(Number(e.target.value))} className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer" style={selectStyle}>
          {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <span className="text-xs self-center" style={{ color: 'var(--color-ink-muted)' }}>a</span>
        <select value={anioHasta} onChange={(e) => setAnioHasta(Number(e.target.value))} className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer" style={selectStyle}>
          {[2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={mesHasta} onChange={(e) => setMesHasta(Number(e.target.value))} className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer" style={selectStyle}>
          {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        {reporte && (
          <button onClick={descargarPDF}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium text-white cursor-pointer ml-auto"
            style={{ backgroundColor: 'var(--color-accent)' }}>
            <Download size={13} /> Descargar PDF
          </button>
        )}
      </div>

      {/* Reporte */}
      {!puedeConsultar ? (
        <div className="text-center py-16 rounded-xl" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <FileText size={28} className="mx-auto mb-3" style={{ color: 'var(--color-ink-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--color-ink-muted)' }}>Selecciona un cliente y un período para generar el reporte</p>
        </div>
      ) : isLoading ? (
        <p className="text-xs text-center py-16" style={{ color: 'var(--color-ink-muted)' }}>Generando reporte...</p>
      ) : !reporte ? null : (
        <div className="space-y-6" id="reporte-contenido">
          {/* Encabezado */}
          <div className="rounded-xl p-6 print:rounded-none" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary-muted)', color: 'var(--color-primary)' }}>
                    <TrendingUp size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold" style={{ color: 'var(--color-ink)', letterSpacing: '-0.02em' }}>
                      INFORME DE GESTIÓN SOLUTIONS &amp; PAYROLL
                    </h2>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>{reporte.cliente.cliente}</p>
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[11px]" style={{ color: 'var(--color-ink-muted)' }}>Período reportado</p>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>{reporte.periodo.desde} a {reporte.periodo.hasta}</p>
              </div>
            </div>
            <p className="text-xs mt-3" style={{ color: 'var(--color-ink-muted)' }}>
              &quot;Garantizar el cumplimiento de los compromisos adquiridos con nuestros clientes.&quot;
            </p>
          </div>

          {/* Tabla indicadores */}
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--color-ink)' }}>
                <Target size={13} style={{ color: 'var(--color-primary)' }} /> Indicadores
              </h3>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ backgroundColor: 'oklch(100% 0 0 / 3%)' }}>
                  <th className="text-left px-5 py-2.5 font-semibold" style={{ color: 'var(--color-ink-muted)' }}>Indicador</th>
                  <th className="text-right px-5 py-2.5 font-semibold" style={{ color: 'var(--color-ink-muted)' }}>Meta</th>
                  <th className="text-right px-5 py-2.5 font-semibold" style={{ color: 'var(--color-ink-muted)' }}>Resultado</th>
                  <th className="text-center px-5 py-2.5 font-semibold" style={{ color: 'var(--color-ink-muted)' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-5 py-3" style={{ color: 'var(--color-ink)' }}>Puntualidad en la entrega de Informes</td>
                  <td className="px-5 py-3 text-right tabular-nums" style={{ color: 'var(--color-ink-muted)' }}>{fmtPct(reporte.puntualidad.meta)}</td>
                  <td className="px-5 py-3 text-right tabular-nums font-semibold" style={{ color: 'var(--color-ink)' }}>{fmtPct(reporte.puntualidad.resultado)}</td>
                  <td className="px-5 py-3 text-center"><EstadoBadge estado={reporte.puntualidad.estado} /></td>
                </tr>
                <tr className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-5 py-3" style={{ color: 'var(--color-ink)' }}>Exactitud en los cálculos</td>
                  <td className="px-5 py-3 text-right tabular-nums" style={{ color: 'var(--color-ink-muted)' }}>{fmtPct(reporte.exactitud.meta)}</td>
                  <td className="px-5 py-3 text-right tabular-nums font-semibold" style={{ color: 'var(--color-ink)' }}>{fmtPct(reporte.exactitud.resultado)}</td>
                  <td className="px-5 py-3 text-center"><EstadoBadge estado={reporte.exactitud.estado} /></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Gráfico */}
          <div className="rounded-xl p-5 print:break-inside-avoid" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-ink)' }}>Indicadores de Cumplimiento</h3>
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barGap={8} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(100% 0 0 / 8%)" vertical={false} />
                  <XAxis dataKey="nombre" tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--color-ink-muted)' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 11 }}
                    formatter={(v: number) => `${v}%`}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, display: 'flex', justifyContent: 'center', gap: 20 }}
                    content={() => (
                      <div className="flex items-center gap-5" style={{ fontSize: 11 }}>
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: 'oklch(56% 0.18 145)' }} />
                          <span style={{ color: 'var(--color-ink-muted)' }}>Meta</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: 'oklch(52% 0.22 15)' }} />
                          <span style={{ color: 'var(--color-ink-muted)' }}>Resultado</span>
                        </span>
                      </div>
                    )}
                  />
                  <Bar dataKey="meta" name="Meta" radius={[4, 4, 0, 0]} maxBarSize={36}>
                    {chartData.map((_, i) => <Cell key={i} fill="oklch(56% 0.18 145)" />)}
                  </Bar>
                  <Bar dataKey="resultado" name="Resultado" radius={[4, 4, 0, 0]} maxBarSize={36}>
                    {chartData.map((d, i) => <Cell key={i} fill={d.resultado >= d.meta ? 'oklch(56% 0.18 145)' : 'oklch(52% 0.22 15)'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Errores / Acciones */}
          <div className="rounded-xl overflow-hidden print:break-inside-avoid" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--color-ink)' }}>
                <AlertTriangle size={13} style={{ color: 'var(--color-accent)' }} /> Errores Identificados y Acciones Tomadas
              </h3>
            </div>
            {reporte.errores.length === 0 ? (
              <p className="px-5 py-8 text-center text-xs" style={{ color: 'var(--color-ink-muted)' }}>
                No se identificaron errores en el período reportado
              </p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ backgroundColor: 'oklch(100% 0 0 / 3%)' }}>
                    <th className="text-left px-5 py-2.5 font-semibold w-1/2" style={{ color: 'var(--color-ink-muted)' }}>ErrorIdentificado</th>
                    <th className="text-left px-5 py-2.5 font-semibold" style={{ color: 'var(--color-ink-muted)' }}>Acción Tomada</th>
                  </tr>
                </thead>
                <tbody>
                  {reporte.errores.map((e) => (
                    <tr key={e.entregable_id} className="border-t" style={{ borderColor: 'var(--color-ink-muted)' }}>
                      <td className="px-5 py-2.5" style={{ color: 'var(--color-ink)' }}>
                        <p className="font-medium">{e.tipo_entregable} — {e.periodo}</p>
                        <p className="text-[10px]" style={{ color: 'var(--color-ink-muted)' }}>
                          Err. interno: {e.error_interno} · Err. cliente: {e.error_cliente} · Líder: {e.lider} · Responsable: {e.responsable}
                        </p>
                      </td>
                      <td className="px-5 py-2.5" style={{ color: 'var(--color-ink-muted)' }}>
                        {e.accion_tomada ?? <span className="italic" style={{ color: 'oklch(70% 0.16 65)' }}>Pendiente de registrar</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
      </div>
  )
}
