import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { BaseService } from '../../common/base.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { calcularCumplimiento } from '../entregables/cumplimiento';

export interface Cliente {
  id: number; cliente: string; grupo_id: number;
  pct_puntualidad: number; pct_exactitud: number; pct_contratacion: number;
  fecha: string; mostrar: boolean; creado_en: string;
}

@Injectable()
export class ClientesService extends BaseService<Cliente> {
  constructor(supabase: SupabaseService) { super(supabase, 'clientes'); }

  findAllWithGrupo() {
    return this.supabase.db
      .from('clientes')
      .select('*, grupos(nombre)')
      .order('id');
  }

  async findByUsuario(usuarioId: number) {
    const { data: entregables } = await this.supabase.db
      .from('entregables')
      .select('cliente_id')
      .eq('usuario_id', usuarioId);

    const clienteIds = [...new Set((entregables ?? []).map((e) => e.cliente_id))];
    if (clienteIds.length === 0) return [] as unknown as Cliente[];

    const { data, error } = await this.supabase.db
      .from('clientes')
      .select('*, grupos(nombre)')
      .in('id', clienteIds)
      .order('id');

    if (error) throw new InternalServerErrorException(error.message);
    return data as unknown as Cliente[];
  }

  /**
   * Clientes del usuario autenticado según su rol.
   * FUENTE 1: asignaciones explícitas (usuario_clientes), con o sin entregables.
   * FUENTE 2: entregables donde es responsable (Analista) o responsable/líder (Líder).
   * Además devuelve métricas resumidas por cliente: metas del cliente,
   * puntualidad/exactitud actual y pendientes.
   */
  async findMisClientes(usuarioId: number, rol: string) {
    // ── Fuente 1: asignaciones explícitas ──
    const { data: asignaciones, error: eA } = await this.supabase.db
      .from('usuario_clientes')
      .select('cliente_id')
      .eq('usuario_id', usuarioId);
    if (eA) throw new InternalServerErrorException(eA.message);

    const ids = new Set<number>((asignaciones ?? []).map((a) => a.cliente_id));

    // ── Fuente 2: entregables ──
    if (rol === 'Analista') {
      const { data: ents, error } = await this.supabase.db
        .from('entregables')
        .select('cliente_id')
        .eq('usuario_id', usuarioId);
      if (error) throw new InternalServerErrorException(error.message);
      (ents ?? []).forEach((e) => ids.add(e.cliente_id));
    } else if (rol === 'Lider') {
      const { data: ents, error } = await this.supabase.db
        .from('entregables')
        .select('cliente_id')
        .or(`usuario_id.eq.${usuarioId},lider_id.eq.${usuarioId}`);
      if (error) throw new InternalServerErrorException(error.message);
      (ents ?? []).forEach((e) => ids.add(e.cliente_id));
    }

    if (ids.size === 0) return [];

    const listaIds = [...ids];

    // ── Clientes con metas ──
    const { data: clientes, error: eC } = await this.supabase.db
      .from('clientes')
      .select('id, cliente, pct_puntualidad, pct_exactitud, grupos(nombre)')
      .in('id', listaIds)
      .order('cliente');
    if (eC) throw new InternalServerErrorException(eC.message);

    // ── Métricas por cliente (mismo alcance que el módulo Entregables) ──
    let q = this.supabase.db
      .from('entregables')
      .select('cliente_id, resultado, resultado_cantidad, fecha_compromiso, cantidad_compromiso, error_interno, error_cliente')
      .in('cliente_id', listaIds);
    if (rol === 'Analista') q = q.eq('usuario_id', usuarioId);

    const { data: filas, error: eF } = await q;
    if (eF) throw new InternalServerErrorException(eF.message);

    type Acc = { punt: number[]; exact: number[]; pendientes: number; total: number };
    const porCliente = new Map<number, Acc>();
    (filas ?? []).forEach((e) => {
      const c = calcularCumplimiento({
        resultado: e.resultado,
        fechaCompromiso: e.fecha_compromiso,
        cantidadCompromiso: e.cantidad_compromiso,
        resultadoCantidad: e.resultado_cantidad,
        error_interno: e.error_interno,
        error_cliente: e.error_cliente,
      });
      const acc = porCliente.get(e.cliente_id) ?? { punt: [], exact: [], pendientes: 0, total: 0 };
      acc.total++;
      if (c.puntualidad !== null) acc.punt.push(c.puntualidad);
      if (c.exactitud !== null) acc.exact.push(c.exactitud);
      if (!e.resultado && !e.resultado_cantidad) acc.pendientes++;
      porCliente.set(e.cliente_id, acc);
    });

    const prom = (xs: number[]) =>
      xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 100) / 100 : null;

    return (clientes ?? []).map((c) => {
      const acc = porCliente.get(c.id);
      return {
        ...c,
        total: acc?.total ?? 0,
        pendientes: acc?.pendientes ?? 0,
        puntualidad_actual: prom(acc?.punt ?? []),
        exactitud_actual: prom(acc?.exact ?? []),
      };
    });
  }

  /**
   * Resumen de entregables de un cliente para el usuario autenticado.
   * Analista: solo sus entregables. Líder: todos los del cliente.
   */
  async getResumenCliente(clienteId: number, usuarioId: number, rol: string) {
    let query = this.supabase.db
      .from('entregables')
      .select(`
        id, mes, anio, pct_avance, resultado, resultado_cantidad,
        fecha_compromiso, cantidad_compromiso, error_interno, error_cliente,
        aprobado, comentarios,
        estatus:estatus_id(id, descripcion),
        indicadores(id, nombre),
        entregable_tipos(id, nombre),
        responsable:usuarios!usuario_id(id, nombre, usuario)
      `)
      .eq('cliente_id', clienteId)
      .order('anio', { ascending: false })
      .order('mes', { ascending: false });

    if (rol === 'Analista') query = query.eq('usuario_id', usuarioId);

    const { data: filas, error } = await query;
    if (error) throw new InternalServerErrorException(error.message);

    const entregables = (filas ?? []).map((e) => ({
      ...e,
      ...calcularCumplimiento({
        resultado: e.resultado,
        fechaCompromiso: e.fecha_compromiso,
        cantidadCompromiso: e.cantidad_compromiso,
        resultadoCantidad: e.resultado_cantidad,
        error_interno: e.error_interno,
        error_cliente: e.error_cliente,
      }),
    }));

    const evaluados = entregables.filter((e) => e.pct_cumple !== null);
    const prom = (xs: number[]) =>
      xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 100) / 100 : null;

    // Metas del cliente (SLA pactado)
    const { data: cliente } = await this.supabase.db
      .from('clientes')
      .select('pct_puntualidad, pct_exactitud')
      .eq('id', clienteId)
      .single();

    const resumen = {
      total: entregables.length,
      terminados: entregables.filter((e) => e.resultado || e.resultado_cantidad).length,
      pendientes: entregables.filter((e) => !e.resultado && !e.resultado_cantidad).length,
      aprobados: entregables.filter((e) => e.aprobado).length,
      pct_cumple_promedio: prom(evaluados.map((e) => e.pct_cumple as number)),
      meta_puntualidad: cliente?.pct_puntualidad ?? null,
      meta_exactitud: cliente?.pct_exactitud ?? null,
      puntualidad_promedio: prom(
        evaluados.filter((e) => e.puntualidad !== null).map((e) => e.puntualidad as number),
      ),
      exactitud_promedio: prom(
        evaluados.filter((e) => e.exactitud !== null).map((e) => e.exactitud as number),
      ),
    };

    type Ref = { id: number } & Record<string, unknown>;
    const analistas = [...new Map(
      entregables
        .map((e) => e.responsable as unknown as Ref | null)
        .filter((r): r is Ref => !!r)
        .map((r) => [r.id, r]),
    ).values()];
    const indicadores = [...new Map(
      entregables
        .map((e) => e.indicadores as unknown as Ref | null)
        .filter((r): r is Ref => !!r)
        .map((r) => [r.id, r]),
    ).values()];

    return { resumen, analistas, indicadores, entregables };
  }
}
