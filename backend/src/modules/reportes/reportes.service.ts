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
  id: number;
  entregable_id: number;
  cliente: string;
  periodo: string;
  tipo_entregable: string;
  lider: string;
  responsable: string;
  tipo: 'interno' | 'cliente';
  descripcion: string;
  correccion: string | null;
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
    procesados_total: number;
    errores_internos: number;
    errores_cliente: number;
  };
  errores: ErrorReporte[];
}

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
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
        fecha_compromiso, cantidad_compromiso,
        entregable_tipos(nombre),
        lider:usuarios!lider_id(nombre),
        responsable:usuarios!usuario_id(nombre, usuario),
        entregable_errores(id, tipo, descripcion, correccion)
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

    // ── Exactitud (indicador Exactitud = 36), perspectiva CLIENTE ──
    // El indicador del cliente solo descuenta errores que LLEGARON al cliente.
    const exact = enPeriodo.filter((e) => e.indicador_id === 36);
    const exactEvaluados = exact.filter((e) => e.resultado_cantidad != null);
    const compTotal = exactEvaluados.reduce((s, e) => s + (e.cantidad_compromiso ?? 0), 0);
    const procTotal = exactEvaluados.reduce((s, e) => s + (e.resultado_cantidad ?? 0), 0);
    let errInt = 0;
    let errCli = 0;
    for (const e of exact) {
      for (const er of (e.entregable_errores ?? []) as { tipo: string }[]) {
        if (er.tipo === 'interno') errInt++; else errCli++;
      }
    }
    const correctosCliente = Math.max(0, procTotal - errCli);
    const exactPct = compTotal > 0 ? Math.round((correctosCliente / compTotal) * 10000) / 100 : null;

    // ── Lista de errores (filas individuales) ──
    const errores: ErrorReporte[] = [];
    for (const e of enPeriodo) {
      for (const er of (e.entregable_errores ?? []) as {
        id: number; tipo: string; descripcion: string; correccion: string | null;
      }[]) {
        errores.push({
          id: er.id,
          entregable_id: e.id,
          cliente: cliente.cliente,
          periodo: `${String(e.mes).padStart(2, '0')}-${e.anio}`,
          tipo_entregable: unwrap(e.entregable_tipos as { nombre: string } | { nombre: string }[] | null)?.nombre ?? '—',
          lider: unwrap(e.lider as { nombre: string } | { nombre: string }[] | null)?.nombre ?? '—',
          responsable: unwrap(e.responsable as { nombre: string } | { nombre: string }[] | null)?.nombre ?? '—',
          tipo: er.tipo === 'interno' ? 'interno' : 'cliente',
          descripcion: er.descripcion,
          correccion: er.correccion ?? null,
        });
      }
    }

    const redondo = (x: number | null) => (x != null ? Math.round(x * 100) / 100 : null);

    return {
      cliente: {
        id: cliente.id,
        cliente: cliente.cliente,
        grupo: unwrap(cliente.grupos as { nombre: string } | { nombre: string }[] | null)?.nombre ?? null,
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
        procesados_total: procTotal,
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
