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
  usuario_id: number; cliente_id: number; lider_id: number | null;
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

    let query = this.supabase.db
      .from('entregables')
      .select(`
        usuario_id, cliente_id, lider_id, resultado, resultado_cantidad,
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
      // El líder solo ve entregables que ÉL lidera o ejecuta (no todo el portafolio del cliente).
      if (f.usuarioId && f.usuarioId !== usuario.sub) {
        query = query.eq('usuario_id', f.usuarioId).eq('lider_id', usuario.sub);
      } else if (f.usuarioId === usuario.sub) {
        query = query.eq('usuario_id', usuario.sub);
      } else {
        query = query.or(`usuario_id.eq.${usuario.sub},lider_id.eq.${usuario.sub}`);
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

    const acumular = (t: { plan: BloquePlan; exactitud: BloqueExactitud }, e: FilaEntregable, interno: number, errCli: number) => {
      const modo = esIndicadorSistema(e.indicadores?.nombre);
      if (modo === 'plan') {
        t.plan.asignados++;
        if (e.resultado != null) {
          t.plan.evaluados++;
          const aTiempo = e.fecha_compromiso != null && e.resultado <= e.fecha_compromiso;
          if (aTiempo) t.plan.cumplidos++; else t.plan.incumplidos++;
        }
      } else if (modo === 'exactitud') {
        t.exactitud.asignados++;
        if (e.resultado_cantidad != null) {
          // Los errores solo penalizan cuando la fila ya tiene resultado definitivo.
          // Un pendiente excepcional con errores registrados no debe afectar el
          // consolidado hasta que el analista registre su resultado (regla William).
          t.exactitud.evaluados++;
          t.exactitud.compromiso_total += e.cantidad_compromiso ?? 0;
          t.exactitud.procesados_total += e.resultado_cantidad;
          t.exactitud.error_interno += interno;
          t.exactitud.error_cliente += errCli;
        }
      }
    };

    // Acumulador del consolidado PROPIO del líder (solo lo que lidera o ejecuta).
    const propio = rol === 'Lider'
      ? {
          plan: { ...PLAN_VACIO },
          exactitud: { ...EXACTITUD_VACIA },
          claves: new Set<string>(),
          maxMetaPlan: null as number | null,
          maxMetaExact: null as number | null,
        }
      : null;

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
      acumular(acc, e, interno, errCli);

      // Para el consolidado PROPIO del líder: solo lo que lidera o ejecuta.
      if (propio && (e.lider_id === usuario.sub || e.usuario_id === usuario.sub)) {
        propio.claves.add(clave);
        if (cliente.pct_puntualidad != null) propio.maxMetaPlan = propio.maxMetaPlan == null ? cliente.pct_puntualidad : Math.max(propio.maxMetaPlan, cliente.pct_puntualidad);
        if (cliente.pct_exactitud != null) propio.maxMetaExact = propio.maxMetaExact == null ? cliente.pct_exactitud : Math.max(propio.maxMetaExact, cliente.pct_exactitud);
        acumular(propio, e, interno, errCli);
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

    // ── Líder: fila consolidada de SUS entregables (lo que lidera o ejecuta) ──
    if (rol === 'Lider' && propio) {
      const { data: liderInfo } = await this.supabase.db
        .from('usuarios').select('id, nombre, usuario, rol').eq('id', usuario.sub).single();

      const agg: Acc = {
        usuario: (liderInfo as FilaCumplimiento['usuario']) ?? { id: usuario.sub, nombre: `#${usuario.sub}`, usuario: '', rol: 'Lider' },
        cliente: { id: 0, cliente: 'Todos sus clientes' },
        plan: propio.plan,
        exactitud: propio.exactitud,
      };

      // Quejas del líder = las de los pares (responsable-cliente) donde tiene entregables propios.
      let quejasLider = 0;
      for (const k of propio.claves) quejasLider += (quejas.get(k) ?? 0);

      if (agg.plan.asignados > 0 || agg.exactitud.asignados > 0) {
        agg.plan.meta = propio.maxMetaPlan;
        agg.exactitud.meta = propio.maxMetaExact;
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
