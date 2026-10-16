import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { esIndicadorSistema, correctosExactitud, Perspectiva } from '../entregables/cumplimiento';

/** Filtros del resumen de cumplimiento. */
export interface FiltrosCumplimiento {
  anio: number;
  mes: number;
  usuarioId?: number;
  clienteId?: number;
  rol?: string;
  aprobado?: boolean;
}

export interface BloquePlan {
  asignados: number; evaluados: number; cumplidos: number; incumplidos: number; pendientes: number;
  pct: number | null; meta: number | null; cumple_meta: boolean | null;
}

export interface BloqueExactitud {
  asignados: number; evaluados: number; pendientes: number;
  compromiso_total: number;
  /** SUM(cantidad procesada) sobre evaluados. */
  procesados_total: number;
  error_interno: number;
  error_cliente: number;
  /** correctos según la perspectiva de la fila. */
  correctos_total: number;
  pct: number | null; meta: number | null; cumple_meta: boolean | null;
}

export interface FilaCumplimiento {
  usuario: { id: number; nombre: string; usuario: string; rol: string };
  cliente: { id: number; cliente: string };
  plan: BloquePlan;
  exactitud: BloqueExactitud;
  errores_internos: number;
  errores_cliente: number;
  quejas: number;
}

interface FilaEntregable {
  usuario_id: number; cliente_id: number;
  resultado: string | null; resultado_cantidad: number | null;
  fecha_compromiso: string | null; cantidad_compromiso: number | null;
  indicadores?: { nombre: string } | null;
  clientes?: { id: number; cliente: string; pct_puntualidad: number | null; pct_exactitud: number | null } | null;
  responsable?: { id: number; nombre: string; usuario: string; rol: string } | null;
  entregable_errores?: { tipo: string }[] | null;
}

const PLAN_VACIO: BloquePlan = {
  asignados: 0, evaluados: 0, cumplidos: 0, incumplidos: 0, pendientes: 0,
  pct: null, meta: null, cumple_meta: null,
};
const EXACTITUD_VACIA: BloqueExactitud = {
  asignados: 0, evaluados: 0, pendientes: 0,
  compromiso_total: 0, procesados_total: 0, error_interno: 0, error_cliente: 0,
  correctos_total: 0, pct: null, meta: null, cumple_meta: null,
};

function contarErrores(filas: { tipo: string }[] | null | undefined) {
  let interno = 0; let cliente = 0;
  for (const e of filas ?? []) { if (e.tipo === 'interno') interno++; else if (e.tipo === 'cliente') cliente++; }
  return { interno, cliente };
}

@Injectable()
export class CumplimientoService {
  constructor(private supabase: SupabaseService) {}

  /**
   * Resumen mensual consolidado por usuario + cliente.
   * La exactitud se evalúa por perspectiva: un analista paga sus errores
   * internos y de cliente; un líder solo los de cliente.
   */
  async getResumen(f: FiltrosCumplimiento, usuario: { sub: number; rol?: string }): Promise<FilaCumplimiento[]> {
    const rol = usuario.rol ?? 'Analista';

    let liderClienteIds: number[] = [];
    if (rol === 'Lider') liderClienteIds = await this.clientesDeLider(usuario.sub);

    let query = this.supabase.db
      .from('entregables')
      .select(`
        usuario_id, cliente_id, resultado, resultado_cantidad,
        fecha_compromiso, cantidad_compromiso,
        indicadores(nombre),
        clientes(id, cliente, pct_puntualidad, pct_exactitud),
        responsable:usuarios!usuario_id(id, nombre, usuario, rol),
        entregable_errores(tipo)
      `)
      .eq('anio', f.anio)
      .eq('mes', f.mes)
      .eq('es_nuevo_modelo', true);

    if (rol === 'Analista') {
      query = query.eq('usuario_id', usuario.sub);
    } else if (rol === 'Lider') {
      if (f.usuarioId && f.usuarioId !== usuario.sub) {
        query = query.eq('usuario_id', f.usuarioId).in('cliente_id', liderClienteIds.length ? liderClienteIds : [-1]);
      } else if (f.usuarioId === usuario.sub) {
        query = query.eq('usuario_id', usuario.sub);
      } else if (liderClienteIds.length > 0) {
        query = query.or(`usuario_id.eq.${usuario.sub},cliente_id.in.(${liderClienteIds.join(',')})`);
      } else {
        query = query.eq('usuario_id', usuario.sub);
      }
    } else if (f.usuarioId) {
      query = query.eq('usuario_id', f.usuarioId);
    }

    if (f.clienteId) query = query.eq('cliente_id', f.clienteId);
    if (f.aprobado !== undefined) query = query.eq('aprobado', f.aprobado);

    const { data: filas, error } = await query;
    if (error) throw new InternalServerErrorException(error.message);

    type Acc = {
      usuario: FilaCumplimiento['usuario'];
      cliente: FilaCumplimiento['cliente'];
      plan: BloquePlan;
      exactitud: BloqueExactitud;
    };
    const porClave = new Map<string, Acc>();

    for (const e of (filas ?? []) as unknown as FilaEntregable[]) {
      const clave = `${e.usuario_id}-${e.cliente_id}`;
      const cliente = e.clientes ?? { id: e.cliente_id, cliente: `#${e.cliente_id}`, pct_puntualidad: null, pct_exactitud: null };
      let acc = porClave.get(clave);
      if (!acc) {
        acc = {
          usuario: (e.responsable as FilaCumplimiento['usuario']) ?? { id: e.usuario_id, nombre: `#${e.usuario_id}`, usuario: '', rol: '' },
          cliente: { id: cliente.id, cliente: cliente.cliente },
          plan: { ...PLAN_VACIO, meta: cliente.pct_puntualidad ?? null },
          exactitud: { ...EXACTITUD_VACIA, meta: cliente.pct_exactitud ?? null },
        };
        porClave.set(clave, acc);
      }

      const { interno, cliente: errCli } = contarErrores(e.entregable_errores);
      const modo = esIndicadorSistema(e.indicadores?.nombre);

      if (modo === 'plan') {
        acc.plan.asignados++;
        if (e.resultado != null) {
          acc.plan.evaluados++;
          const aTiempo = e.fecha_compromiso != null && e.resultado <= e.fecha_compromiso;
          if (aTiempo) acc.plan.cumplidos++; else acc.plan.incumplidos++;
        }
      } else if (modo === 'exactitud') {
        acc.exactitud.asignados++;
        acc.exactitud.error_interno += interno;
        acc.exactitud.error_cliente += errCli;
        if (e.resultado_cantidad != null) {
          acc.exactitud.evaluados++;
          acc.exactitud.compromiso_total += e.cantidad_compromiso ?? 0;
          acc.exactitud.procesados_total += e.resultado_cantidad;
        }
      }
    }

    const quejas = await this.contarQuejas(f);
    const redondo = (x: number) => Math.round(x * 100) / 100;

    const cerrar = (acc: Acc, perspectiva: Perspectiva): FilaCumplimiento => {
      acc.plan.pendientes = acc.plan.asignados - acc.plan.evaluados;
      acc.plan.pct = acc.plan.evaluados > 0 ? redondo((acc.plan.cumplidos / acc.plan.evaluados) * 100) : null;
      acc.plan.cumple_meta = acc.plan.pct != null && acc.plan.meta != null ? acc.plan.pct >= acc.plan.meta : null;

      acc.exactitud.pendientes = acc.exactitud.asignados - acc.exactitud.evaluados;
      acc.exactitud.correctos_total = correctosExactitud(
        acc.exactitud.procesados_total, acc.exactitud.error_interno, acc.exactitud.error_cliente, perspectiva,
      );
      acc.exactitud.pct = acc.exactitud.compromiso_total > 0
        ? redondo((acc.exactitud.correctos_total / acc.exactitud.compromiso_total) * 100) : null;
      acc.exactitud.cumple_meta = acc.exactitud.pct != null && acc.exactitud.meta != null
        ? acc.exactitud.pct >= acc.exactitud.meta : null;

      return {
        usuario: acc.usuario,
        cliente: acc.cliente,
        plan: acc.plan,
        exactitud: acc.exactitud,
        errores_internos: acc.exactitud.error_interno,
        errores_cliente: acc.exactitud.error_cliente,
        quejas: quejas.get(`${acc.usuario.id}-${acc.cliente.id}`) ?? 0,
      };
    };

    const resultado: FilaCumplimiento[] = [];

    for (const acc of porClave.values()) {
      if (f.rol && acc.usuario.rol !== f.rol) continue;
      // Perspectiva según el usuario de la fila (analista paga interno; líder no).
      const perspectiva: Perspectiva = acc.usuario.rol === 'Lider' ? 'lider' : 'analista';
      resultado.push(cerrar(acc, perspectiva));
    }

    // ── Líder: fila consolidada de TODOS sus clientes (perspectiva líder) ──
    if (rol === 'Lider') {
      const { data: liderInfo } = await this.supabase.db
        .from('usuarios').select('id, nombre, usuario, rol').eq('id', usuario.sub).single();

      const agg: Acc = {
        usuario: (liderInfo as FilaCumplimiento['usuario']) ?? { id: usuario.sub, nombre: `#${usuario.sub}`, usuario: '', rol: 'Lider' },
        cliente: { id: 0, cliente: 'Todos sus clientes' },
        plan: { ...PLAN_VACIO },
        exactitud: { ...EXACTITUD_VACIA },
      };
      let maxMetaPlan: number | null = null;
      let maxMetaExact: number | null = null;

      for (const acc of porClave.values()) {
        agg.plan.asignados += acc.plan.asignados;
        agg.plan.evaluados += acc.plan.evaluados;
        agg.plan.cumplidos += acc.plan.cumplidos;
        agg.plan.incumplidos += acc.plan.incumplidos;
        agg.exactitud.asignados += acc.exactitud.asignados;
        agg.exactitud.evaluados += acc.exactitud.evaluados;
        agg.exactitud.compromiso_total += acc.exactitud.compromiso_total;
        agg.exactitud.procesados_total += acc.exactitud.procesados_total;
        agg.exactitud.error_interno += acc.exactitud.error_interno;
        agg.exactitud.error_cliente += acc.exactitud.error_cliente;
        if (acc.plan.meta != null) maxMetaPlan = maxMetaPlan == null ? acc.plan.meta : Math.max(maxMetaPlan, acc.plan.meta);
        if (acc.exactitud.meta != null) maxMetaExact = maxMetaExact == null ? acc.exactitud.meta : Math.max(maxMetaExact, acc.exactitud.meta);
      }
      // quejas del líder = suma de quejas de todas sus filas
      let quejasLider = 0;
      for (const acc of porClave.values()) quejasLider += (quejas.get(`${acc.usuario.id}-${acc.cliente.id}`) ?? 0);

      if (agg.plan.asignados > 0 || agg.exactitud.asignados > 0) {
        agg.plan.meta = maxMetaPlan;
        agg.exactitud.meta = maxMetaExact;
        const fila = cerrar(agg, 'lider');
        fila.quejas = quejasLider;
        resultado.push(fila);
      }
    }

    resultado.sort((a, b) =>
      a.usuario.nombre.localeCompare(b.usuario.nombre) || a.cliente.cliente.localeCompare(b.cliente.cliente),
    );
    return resultado;
  }

  private async clientesDeLider(usuarioId: number): Promise<number[]> {
    const ids = new Set<number>();
    const { data: asignaciones } = await this.supabase.db
      .from('usuario_clientes').select('cliente_id').eq('usuario_id', usuarioId);
    (asignaciones ?? []).forEach((a) => ids.add(a.cliente_id));
    const { data: ents } = await this.supabase.db
      .from('entregables').select('cliente_id').or(`usuario_id.eq.${usuarioId},lider_id.eq.${usuarioId}`);
    (ents ?? []).forEach((e) => ids.add(e.cliente_id));
    return [...ids];
  }

  private async contarQuejas(f: FiltrosCumplimiento): Promise<Map<string, number>> {
    let query = this.supabase.db
      .from('quejas').select('cliente_id, queja_usuarios(usuario_id)')
      .eq('anio', f.anio).eq('mes', f.mes);
    if (f.clienteId) query = query.eq('cliente_id', f.clienteId);
    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(error.message);
    const conteo = new Map<string, number>();
    for (const q of data ?? []) {
      for (const qu of (q.queja_usuarios ?? []) as { usuario_id: number }[]) {
        if (f.usuarioId && qu.usuario_id !== f.usuarioId) continue;
        const clave = `${qu.usuario_id}-${q.cliente_id}`;
        conteo.set(clave, (conteo.get(clave) ?? 0) + 1);
      }
    }
    return conteo;
  }
}
