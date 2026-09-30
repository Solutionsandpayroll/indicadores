import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

export interface FiltrosReporte {
  cliente_id: number;
  anio_desde: number;
  mes_desde: number;
  anio_hasta: number;
  mes_hasta: number;
}

export interface IndicadorResumen {
  meta: number;
  resultado: number | null;
  unidad: string;
  estado: 'cumple' | 'no_cumple' | 'sin_datos';
}

export interface ErrorReporte {
  entregable_id: number;
  cliente: string;
  periodo: string;
  tipo_entregable: string;
  lider: string;
  responsable: string;
  error_interno: number;
  error_cliente: number;
  accion_tomada: string | null;
}

export interface ReporteCliente {
  cliente: { id: number; cliente: string; grupo: string | null };
  periodo: { desde: string; hasta: string };
  puntualidad: IndicadorResumen & {
    total_entregables: number;
    evaluados: number;
    cumplidos: number;
    incumplidos: number;
    pendientes: number;
  };
  exactitud: IndicadorResumen & {
    total_entregables: number;
    evaluados: number;
    compromiso_total: number;
    correctos_total: number;
    errores_internos: number;
    errores_cliente: number;
  };
  errores: ErrorReporte[];
}

@Injectable()
export class ReportesService {
  constructor(private supabase: SupabaseService) {}

  /**
   * Genera el reporte consolidado de un cliente para un período.
   * Agrega entregables del nuevo modelo (es_nuevo_modelo = true).
   */
  async getReporteCliente(f: FiltrosReporte): Promise<ReporteCliente> {
    // ── Info del cliente ──
    const { data: cliente, error: eCli } = await this.supabase.db
      .from('clientes')
      .select('id, cliente, grupos(nombre), pct_puntualidad, pct_exactitud')
      .eq('id', f.cliente_id)
      .single();
    if (eCli || !cliente) throw new InternalServerErrorException('Cliente no encontrado');

    // Rango AAAAMM para el filtro
    const desde = f.anio_desde * 100 + f.mes_desde;
    const hasta = f.anio_hasta * 100 + f.mes_hasta;

    // ── Entregables del cliente en el período (nuevo modelo) ──
    const { data: filas, error } = await this.supabase.db
      .from('entregables')
      .select(`
        id, mes, anio, indicador_id, resultado, resultado_cantidad,
        fecha_compromiso, cantidad_compromiso, error_interno, error_cliente,
        entregable_tipos(nombre),
        lider:usuarios!lider_id(nombre),
        responsable:usuarios!usuario_id(nombre, usuario)
      `)
      .eq('cliente_id', f.cliente_id)
      .eq('es_nuevo_modelo', true);

    if (error) throw new InternalServerErrorException(error.message);

    // Filtrar por período AAAAMM
    const enPeriodo = (filas ?? []).filter((e) => {
      const aamm = e.anio * 100 + e.mes;
      return aamm >= desde && aamm <= hasta;
    });

    // ── Puntualidad (indicador Plan = 5) ──
    const plan = enPeriodo.filter((e) => e.indicador_id === 5);
    const planEvaluados = plan.filter((e) => e.resultado != null);
    const planCumplidos = planEvaluados.filter((e) => e.fecha_compromiso != null && e.resultado <= e.fecha_compromiso);
    const planIncumplidos = planEvaluados.length - planCumplidos.length;
    const planPendientes = plan.length - planEvaluados.length;
    const puntPct = planEvaluados.length > 0
      ? Math.round((planCumplidos.length / planEvaluados.length) * 10000) / 100
      : null;

    // ── Exactitud (indicador Exactitud = 36) ──
    const exact = enPeriodo.filter((e) => e.indicador_id === 36);
    const exactEvaluados = exact.filter((e) => e.resultado_cantidad != null);
    const compTotal = exactEvaluados.reduce((s, e) => s + (e.cantidad_compromiso ?? 0), 0);
    const correctTotal = exactEvaluados.reduce((s, e) => s + (e.resultado_cantidad ?? 0), 0);
    const errInt = exactEvaluados.reduce((s, e) => s + (e.error_interno ?? 0), 0);
    const errCli = exactEvaluados.reduce((s, e) => s + (e.error_cliente ?? 0), 0);
    const exactPct = compTotal > 0 ? Math.round((correctTotal / compTotal) * 10000) / 100 : null;

    // ── Lista de errores ──
    const errores: ErrorReporte[] = enPeriodo
      .filter((e) => (e.error_interno ?? 0) > 0 || (e.error_cliente ?? 0) > 0)
      .map((e) => ({
        entregable_id: e.id,
        cliente: cliente.cliente,
        periodo: `${String(e.mes).padStart(2, '0')}-${e.anio}`,
        tipo_entregable: Array.isArray(e.entregable_tipos)
          ? (e.entregable_tipos as { nombre: string }[])[0]?.nombre ?? '—'
          : (e.entregable_tipos as { nombre: string } | null)?.nombre ?? '—',
        lider: Array.isArray(e.lider)
          ? (e.lider as { nombre: string }[])[0]?.nombre ?? '—'
          : (e.lider as { nombre: string } | null)?.nombre ?? '—',
        responsable: Array.isArray(e.responsable)
          ? (e.responsable as { nombre: string; usuario: string }[])[0]?.nombre ?? '—'
          : (e.responsable as { nombre: string; usuario: string } | null)?.nombre ?? '—',
        error_interno: e.error_interno ?? 0,
        error_cliente: e.error_cliente ?? 0,
        accion_tomada: null,
      }));

    const redondo = (x: number | null) => (x != null ? Math.round(x * 100) / 100 : null);

    return {
      cliente: {
        id: cliente.id,
        cliente: cliente.cliente,
        grupo: Array.isArray(cliente.grupos)
          ? (cliente.grupos as { nombre: string }[])[0]?.nombre ?? null
          : (cliente.grupos as { nombre: string } | null)?.nombre ?? null,
      },
      periodo: {
        desde: `${String(f.mes_desde).padStart(2, '0')}-${f.anio_desde}`,
        hasta: `${String(f.mes_hasta).padStart(2, '0')}-${f.anio_hasta}`,
      },
      puntualidad: {
        meta: redondo((cliente as { pct_puntualidad: number | null }).pct_puntualidad) ?? 0,
        resultado: puntPct,
        unidad: '%',
        estado: puntPct == null ? 'sin_datos' : puntPct >= ((cliente as { pct_puntualidad: number | null }).pct_puntualidad ?? 0) ? 'cumple' : 'no_cumple',
        total_entregables: plan.length,
        evaluados: planEvaluados.length,
        cumplidos: planCumplidos.length,
        incumplidos: planIncumplidos,
        pendientes: planPendientes,
      },
      exactitud: {
        meta: redondo((cliente as { pct_exactitud: number | null }).pct_exactitud) ?? 0,
        resultado: exactPct,
        unidad: '%',
        estado: exactPct == null ? 'sin_datos' : exactPct >= ((cliente as { pct_exactitud: number | null }).pct_exactitud ?? 0) ? 'cumple' : 'no_cumple',
        total_entregables: exact.length,
        evaluados: exactEvaluados.length,
        compromiso_total: compTotal,
        correctos_total: correctTotal,
        errores_internos: errInt,
        errores_cliente: errCli,
      },
      errores,
    };
  }

  /** Clientes accesibles según rol: Admin = todos, Líder = asignados. */
  async getClientesAccesibles(usuarioId: number, rol: string) {
    if (rol === 'Admin') {
      const { data } = await this.supabase.db
        .from('clientes')
        .select('id, cliente')
        .eq('mostrar', true)
        .order('cliente');
      return data ?? [];
    }
    // Líder: clientes asignados vía usuario_clientes
    const { data } = await this.supabase.db
      .from('usuario_clientes')
      .select('clientes(id, cliente)')
      .eq('usuario_id', usuarioId);
    return ((data ?? []) as { clientes: { id: number; cliente: string }[] }[])
      .map((r) => r.clientes)
      .filter(Boolean);
  }
}
