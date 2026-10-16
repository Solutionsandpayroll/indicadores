import { Injectable, InternalServerErrorException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { BaseService } from '../../common/base.service';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  calcularPlan, calcularExactitud, esIndicadorSistema, Perspectiva,
} from '../entregables/cumplimiento';

export interface Cliente {
  id: number; cliente: string; grupo_id: number;
  pct_puntualidad: number; pct_exactitud: number; pct_contratacion: number;
  fecha: string; mostrar: boolean; creado_en: string;
}

interface FilaEntregable {
  usuario_id: number; cliente_id: number; indicador_id: number;
  resultado: string | null; resultado_cantidad: number | null;
  fecha_compromiso: string | null; cantidad_compromiso: number | null;
  aprobado: boolean;
  indicadores?: { nombre: string } | null;
  clientes?: { id: number; cliente: string; pct_puntualidad: number | null; pct_exactitud: number | null } | null;
  entregable_errores?: { tipo: string }[] | null;
}

const SEL_ERRORES = `
  usuario_id, cliente_id, indicador_id, resultado, resultado_cantidad,
  fecha_compromiso, cantidad_compromiso, aprobado,
  indicadores(nombre),
  clientes(id, cliente, pct_puntualidad, pct_exactitud),
  entregable_errores(tipo)
`;

function contarErrores(filas: { tipo: string }[] | null | undefined) {
  let interno = 0; let cliente = 0;
  for (const e of filas ?? []) { if (e.tipo === 'interno') interno++; else if (e.tipo === 'cliente') cliente++; }
  return { interno, cliente };
}

/** Los embeds de PostgREST llegan como array; normaliza a objeto. */
function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

@Injectable()
export class ClientesService extends BaseService<Cliente> {
  constructor(supabase: SupabaseService) { super(supabase, 'clientes'); }

  findAllWithGrupo() {
    return this.supabase.db.from('clientes').select('*, grupos(nombre)').order('id');
  }

  /** Clientes donde el usuario es responsable (usado por /clientes/asignados). */
  async findByUsuario(usuarioId: number) {
    const { data: entregables } = await this.supabase.db
      .from('entregables').select('cliente_id').eq('usuario_id', usuarioId);
    const clienteIds = [...new Set((entregables ?? []).map((e) => e.cliente_id))];
    if (clienteIds.length === 0) return [] as unknown as Cliente[];
    const { data, error } = await this.supabase.db
      .from('clientes').select('*, grupos(nombre)').in('id', clienteIds).order('id');
    if (error) throw new InternalServerErrorException(error.message);
    return data as unknown as Cliente[];
  }

  /** Perspectiva de exactitud según quién consulta. */
  private perspectivaPara(rol: string): Perspectiva {
    return rol === 'Analista' ? 'analista' : 'cliente';
  }

  /**
   * Clientes a los que el usuario tiene acceso (para scoping y 403).
   * Admin → null (acceso total). Analista/Líder → set de ids.
   */
  private async clientesAccesibles(usuarioId: number, rol: string): Promise<Set<number> | null> {
    if (rol === 'Admin') return null;
    const ids = new Set<number>();

    const { data: asignaciones } = await this.supabase.db
      .from('usuario_clientes').select('cliente_id').eq('usuario_id', usuarioId);
    (asignaciones ?? []).forEach((a) => ids.add(a.cliente_id));

    // Analista: clientes donde es responsable. Líder: donde es responsable o líder.
    const filtro = rol === 'Lider'
      ? `usuario_id.eq.${usuarioId},lider_id.eq.${usuarioId}`
      : `usuario_id.eq.${usuarioId}`;
    const { data: ents } = await this.supabase.db
      .from('entregables').select('cliente_id').or(filtro);
    (ents ?? []).forEach((e) => ids.add(e.cliente_id));

    return ids;
  }

  /** Lanza 403 si el usuario no tiene acceso al cliente. */
  private async assertAccesoCliente(usuarioId: number, rol: string, clienteId: number) {
    const accesibles = await this.clientesAccesibles(usuarioId, rol);
    if (accesibles === null) return; // admin
    if (!accesibles.has(clienteId)) {
      throw new ForbiddenException('No tienes acceso a este cliente');
    }
  }

  /**
   * Clientes accesibles + métricas por cliente en un PERIODO dado.
   * Analista → solo sus entregables; Líder/Admin → todos los del cliente.
   */
  async findMisClientes(usuarioId: number, rol: string, anio: number, mes: number) {
    // Lista de clientes accesibles (asignaciones ∪ entregables). Admin → todos los clientes.
    let listaIds: number[];
    if (rol === 'Admin') {
      const { data: todos, error } = await this.supabase.db
        .from('clientes').select('id').eq('mostrar', true);
      if (error) throw new InternalServerErrorException(error.message);
      listaIds = (todos ?? []).map((c) => c.id);
    } else {
      const accesibles = await this.clientesAccesibles(usuarioId, rol);
      listaIds = [...(accesibles ?? [])];
    }
    if (listaIds.length === 0) return [];

    const { data: clientes, error: eC } = await this.supabase.db
      .from('clientes').select('id, cliente, pct_puntualidad, pct_exactitud, grupos(nombre)')
      .in('id', listaIds).order('cliente');
    if (eC) throw new InternalServerErrorException(eC.message);

    // Entregables SOLO del período. Analista → solo los suyos.
    let q = this.supabase.db.from('entregables').select(SEL_ERRORES)
      .in('cliente_id', listaIds).eq('anio', anio).eq('mes', mes);
    if (rol === 'Analista') q = q.eq('usuario_id', usuarioId);
    const { data: filas, error: eF } = await q;
    if (eF) throw new InternalServerErrorException(eF.message);

    // Quejas del período por cliente.
    const { data: quejas, error: eQ } = await this.supabase.db
      .from('quejas').select('cliente_id').in('cliente_id', listaIds).eq('anio', anio).eq('mes', mes);
    if (eQ) throw new InternalServerErrorException(eQ.message);
    const quejasPorCliente = new Map<number, number>();
    for (const qj of quejas ?? []) {
      quejasPorCliente.set(qj.cliente_id, (quejasPorCliente.get(qj.cliente_id) ?? 0) + 1);
    }

    const perspectiva = this.perspectivaPara(rol);

    type Acc = { punt: number[]; comp: number; proc: number; ei: number; ec: number; pendientes: number; total: number };
    const porCliente = new Map<number, Acc>();
    for (const e of (filas ?? []) as unknown as FilaEntregable[]) {
      const acc = porCliente.get(e.cliente_id) ?? { punt: [], comp: 0, proc: 0, ei: 0, ec: 0, pendientes: 0, total: 0 };
      acc.total++;
      const { interno, cliente } = contarErrores(e.entregable_errores);
      const modo = esIndicadorSistema(e.indicadores?.nombre);
      if (modo === 'plan') {
        const p = calcularPlan({ resultado: e.resultado, fechaCompromiso: e.fecha_compromiso, metaPuntualidad: e.clientes?.pct_puntualidad });
        if (p.puntualidad !== null) acc.punt.push(p.puntualidad);
        if (e.resultado == null) acc.pendientes++;
      } else if (modo === 'exactitud') {
        acc.comp += e.cantidad_compromiso ?? 0;
        acc.proc += e.resultado_cantidad ?? 0;
        acc.ei += interno; acc.ec += cliente;
        if (e.resultado_cantidad == null) acc.pendientes++;
      }
      porCliente.set(e.cliente_id, acc);
    }

    const prom = (xs: number[]) => xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 100) / 100 : null;

    return (clientes ?? []).map((c) => {
      const acc = porCliente.get(c.id);
      let exactitud_actual: number | null = null;
      if (acc && acc.comp > 0) {
        const correctos = perspectiva === 'analista'
          ? Math.max(0, acc.proc - acc.ei - acc.ec) : Math.max(0, acc.proc - acc.ec);
        exactitud_actual = Math.round((correctos / acc.comp) * 10000) / 100;
      }
      return {
        ...c,
        total: acc?.total ?? 0,
        pendientes: acc?.pendientes ?? 0,
        puntualidad_actual: acc ? prom(acc.punt) : null,
        exactitud_actual,
        quejas: quejasPorCliente.get(c.id) ?? 0,
      };
    });
  }

  /**
   * Detalle de un cliente en un PERIODO, con validación de acceso (403) y quejas.
   * Analista → solo sus entregables/resultados. Líder/Admin → consolidado del cliente.
   */
  async getResumenCliente(clienteId: number, usuarioId: number, rol: string, anio: number, mes: number) {
    const { data: existe } = await this.supabase.db.from('clientes').select('id').eq('id', clienteId).maybeSingle();
    if (!existe) throw new NotFoundException('Cliente no encontrado');
    await this.assertAccesoCliente(usuarioId, rol, clienteId);

    let query = this.supabase.db.from('entregables')
      .select(`
        id, mes, anio, usuario_id, indicador_id, resultado, resultado_cantidad,
        fecha_compromiso, cantidad_compromiso, aprobado, comentarios,
        estatus:estatus_id(id, descripcion),
        indicadores(id, nombre),
        entregable_tipos(id, nombre),
        responsable:usuarios!usuario_id(id, nombre, usuario),
        entregable_errores(id, tipo, descripcion, correccion)
      `)
      .eq('cliente_id', clienteId)
      .eq('anio', anio)
      .eq('mes', mes)
      .order('id');

    if (rol === 'Analista') query = query.eq('usuario_id', usuarioId);

    const { data: filas, error } = await query;
    if (error) throw new InternalServerErrorException(error.message);

    const perspectiva = this.perspectivaPara(rol);

    const entregables = (filas ?? []).map((e) => {
      const errs = contarErrores((e as { entregable_errores?: { tipo: string }[] }).entregable_errores);
      const nombreInd = unwrap((e as { indicadores?: { nombre: string } | { nombre: string }[] }).indicadores)?.nombre;
      const modo = esIndicadorSistema(nombreInd);
      const calculo = modo === 'plan'
        ? calcularPlan({ resultado: e.resultado, fechaCompromiso: e.fecha_compromiso })
        : modo === 'exactitud'
          ? calcularExactitud({
              cantidadProcesada: e.resultado_cantidad, cantidadCompromiso: e.cantidad_compromiso,
              errorInterno: errs.interno, errorCliente: errs.cliente, perspectiva,
            })
          : { diferencia: null, puntualidad: null, exactitud: null, pct_cumple: null, cumple_meta: null };
      return { ...e, ...calculo, error_interno: errs.interno, error_cliente: errs.cliente, _modo: modo };
    });

    const evaluados = entregables.filter((e) => e.pct_cumple !== null);
    const prom = (xs: number[]) => xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 100) / 100 : null;

    const { data: cliente } = await this.supabase.db
      .from('clientes').select('pct_puntualidad, pct_exactitud').eq('id', clienteId).single();

    // Exactitud global del periodo (agregado, perspectiva del consultante).
    const exRec = entregables.filter((e) => (e as { _modo?: string })._modo === 'exactitud');
    const comp = exRec.reduce((s, e) => s + (e.cantidad_compromiso ?? 0), 0);
    const proc = exRec.reduce((s, e) => s + (e.resultado_cantidad ?? 0), 0);
    const ei = exRec.reduce((s, e) => s + (e.error_interno ?? 0), 0);
    const ec = exRec.reduce((s, e) => s + (e.error_cliente ?? 0), 0);
    const exactitudGlobal = comp > 0
      ? Math.round((Math.max(0, perspectiva === 'analista' ? proc - ei - ec : proc - ec) / comp) * 10000) / 100
      : null;

    // Quejas del cliente+periodo (todas, visibles para quien ve el cliente).
    const { data: qfilas, error: qErr } = await this.supabase.db
      .from('quejas')
      .select('id, descripcion, fecha_registro, creado_en, queja_usuarios(usuario_id, usuarios(id, nombre))')
      .eq('cliente_id', clienteId).eq('anio', anio).eq('mes', mes).order('id');
    if (qErr) throw new InternalServerErrorException(qErr.message);
    const quejasDetalle = (qfilas ?? []).map((q) => ({
      id: (q as { id: number }).id,
      descripcion: (q as { descripcion: string }).descripcion,
      fecha_registro: (q as { fecha_registro: string }).fecha_registro,
      afectados: ((q as { queja_usuarios?: { usuarios: { id: number; nombre: string } | { id: number; nombre: string }[] }[] }).queja_usuarios ?? [])
        .map((qu) => unwrap(qu.usuarios)).filter(Boolean),
    }));

    const resumen = {
      total: entregables.length,
      terminados: entregables.filter((e) => e.resultado || e.resultado_cantidad).length,
      pendientes: entregables.filter((e) => !e.resultado && !e.resultado_cantidad).length,
      aprobados: entregables.filter((e) => e.aprobado).length,
      pct_cumple_promedio: evaluados.length ? prom(evaluados.map((e) => e.pct_cumple as number)) : null,
      meta_puntualidad: cliente?.pct_puntualidad ?? null,
      meta_exactitud: cliente?.pct_exactitud ?? null,
      puntualidad_promedio: evaluados.filter((e) => e.puntualidad !== null).length
        ? prom(evaluados.filter((e) => e.puntualidad !== null).map((e) => e.puntualidad as number)) : null,
      exactitud_promedio: exactitudGlobal,
      errores_internos: entregables.reduce((s, e) => s + (e.error_interno ?? 0), 0),
      errores_cliente: entregables.reduce((s, e) => s + (e.error_cliente ?? 0), 0),
      quejas: quejasDetalle.length,
    };

    type Ref = { id: number } & Record<string, unknown>;
    const analistas = [...new Map(
      entregables.map((e) => e.responsable as unknown as Ref | null).filter((r): r is Ref => !!r).map((r) => [r.id, r]),
    ).values()];
    const indicadores = [...new Map(
      entregables.map((e) => e.indicadores as unknown as Ref | null).filter((r): r is Ref => !!r).map((r) => [r.id, r]),
    ).values()];

    return { resumen, analistas, indicadores, entregables, quejas: quejasDetalle };
  }
}
