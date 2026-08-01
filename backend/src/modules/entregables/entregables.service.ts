import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { BaseService } from '../../common/base.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { calcularCumplimiento, ResultadoCumplimiento } from './cumplimiento';
import { FiltrarEntregablesDto } from './dto/filtrar-entregables.dto';
import { SeguimientoEntregableDto } from './dto/seguimiento.dto';
import { CrearAvanceDto } from './dto/avance.dto';

export interface Entregable {
  id: number; mes: number; anio: number; cliente_id: number; lider_id: number;
  estatus_id: number; usuario_id: number; pct_avance: number; comentarios: string;
  indicador_id: number; creado_en: string;
  /** Tipo del catálogo `entregable_tipos`. Obligatorio. */
  entregable_tipo_id: number;
  /** Nombre del tipo en texto libre. Legado: se conserva por compatibilidad. */
  tipo: string | null;
  /** Fecha pactada de entrega, capturada al crear. Referencia de puntualidad. */
  fecha_compromiso: string | null;
  // Seguimiento
  resultado: string | null; error_interno: number | null; error_cliente: number | null;
  aprobado: boolean; terminado_en: string | null; aprobado_en: string | null;
  aprobado_por_id: number | null; actualizado_en: string;
}

/** Entregable con las métricas de cumplimiento ya calculadas. */
export type EntregableConCumplimiento = Entregable & ResultadoCumplimiento;

/** Estatus del catálogo cuyo nombre marca un entregable como terminado. */
const ESTATUS_TERMINADO = 'terminado';
const ESTATUS_APROBADO = 'aprobado';

const SELECT_RELACIONES = `
  *,
  clientes(id, cliente, fecha, pct_puntualidad, pct_exactitud, grupo_id),
  estatus(id, descripcion),
  indicadores(id, nombre),
  entregable_tipos(id, nombre),
  lider:usuarios!lider_id(id, nombre),
  responsable:usuarios!usuario_id(id, nombre)
`;

interface FilaConRelaciones extends Entregable {
  clientes?: { pct_exactitud?: number | null } | null;
}

@Injectable()
export class EntregablesService extends BaseService<Entregable> {
  constructor(supabase: SupabaseService) {
    super(supabase, 'entregables');
  }

  /** Adjunta diferencia y % cumple a una fila que ya trae su cliente embebido. */
  private enriquecer<T extends FilaConRelaciones>(fila: T): T & ResultadoCumplimiento {
    return {
      ...fila,
      ...calcularCumplimiento({
        resultado: fila.resultado,
        fechaCompromiso: fila.fecha_compromiso,
        error_interno: fila.error_interno,
        error_cliente: fila.error_cliente,
        metaExactitud: fila.clientes?.pct_exactitud,
      }),
    };
  }

  /**
   * Listado con filtros dinámicos combinables.
   * Devuelve las métricas de cumplimiento ya calculadas por fila.
   */
  async buscar(f: FiltrarEntregablesDto): Promise<EntregableConCumplimiento[]> {
    let query = this.supabase.db.from('entregables').select(SELECT_RELACIONES);

    // Filtros de igualdad directa
    const exactos = {
      cliente_id: f.cliente_id, indicador_id: f.indicador_id, estatus_id: f.estatus_id,
      lider_id: f.lider_id, usuario_id: f.usuario_id, aprobado: f.aprobado,
      entregable_tipo_id: f.entregable_tipo_id,
    };
    for (const [col, val] of Object.entries(exactos)) {
      if (val !== undefined) query = query.eq(col, val);
    }

    // Período puntual (mes/año exactos)
    if (f.anio !== undefined) query = query.eq('anio', f.anio);
    if (f.mes !== undefined) query = query.eq('mes', f.mes);

    // Rango de período. Se traduce a un entero comparable AAAAMM para que
    // "jun-2025 a feb-2026" no se convierta en "meses 6..2" de cada año.
    if (f.anio_desde !== undefined) {
      const desde = f.anio_desde * 100 + (f.mes_desde ?? 1);
      query = query.or(
        `anio.gt.${Math.floor(desde / 100)},and(anio.eq.${Math.floor(desde / 100)},mes.gte.${desde % 100})`,
      );
    }
    if (f.anio_hasta !== undefined) {
      const hasta = f.anio_hasta * 100 + (f.mes_hasta ?? 12);
      query = query.or(
        `anio.lt.${Math.floor(hasta / 100)},and(anio.eq.${Math.floor(hasta / 100)},mes.lte.${hasta % 100})`,
      );
    }

    // Búsqueda libre sobre comentarios
    if (f.q) query = query.ilike('comentarios', `%${f.q}%`);

    // Orden
    const asc = f.dir !== 'desc';
    switch (f.orden) {
      case 'cliente': query = query.order('cliente_id', { ascending: asc }); break;
      case 'estatus': query = query.order('estatus_id', { ascending: asc }); break;
      case 'periodo': query = query.order('anio', { ascending: asc }).order('mes', { ascending: asc }); break;
      default: query = query.order('id', { ascending: asc });
    }

    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(error.message);

    const filas = (data ?? []).map((r) => this.enriquecer(r as FilaConRelaciones));

    // El cumplimiento se calcula en memoria, así que ese orden se aplica aquí.
    if (f.orden === 'cumplimiento') {
      filas.sort((a, b) => ((a.pct_cumple ?? -1) - (b.pct_cumple ?? -1)) * (asc ? 1 : -1));
    }
    return filas as EntregableConCumplimiento[];
  }

  /** Un entregable con relaciones y cumplimiento. */
  async findOneConCumplimiento(id: number): Promise<EntregableConCumplimiento> {
    const { data, error } = await this.supabase.db
      .from('entregables').select(SELECT_RELACIONES).eq('id', id).single();
    if (error || !data) throw new NotFoundException(`Entregable ${id} no encontrado`);
    return this.enriquecer(data as FilaConRelaciones) as EntregableConCumplimiento;
  }

  /**
   * Mantiene sincronizada la columna legada `tipo` (texto) con el nombre del
   * tipo elegido del catálogo, para que los registros queden coherentes.
   */
  private async conNombreDeTipo(dto: Partial<Entregable>): Promise<Partial<Entregable>> {
    if (!dto.entregable_tipo_id) return dto;
    const { data } = await this.supabase.db
      .from('entregable_tipos').select('nombre').eq('id', dto.entregable_tipo_id).single();
    return data ? { ...dto, tipo: (data as { nombre: string }).nombre } : dto;
  }

  async create(dto: Partial<Entregable>): Promise<Entregable> {
    return super.create(await this.conNombreDeTipo(dto));
  }

  async update(id: number, dto: Partial<Entregable>): Promise<Entregable> {
    return super.update(id, await this.conNombreDeTipo(dto));
  }

  /** Busca en el catálogo de estatus por nombre (case-insensitive). */
  private async idEstatus(nombre: string): Promise<number | null> {
    const { data } = await this.supabase.db
      .from('estatus').select('id, descripcion').ilike('descripcion', nombre).limit(1);
    return data?.[0]?.id ?? null;
  }

  /**
   * Registra el seguimiento de un entregable.
   * Al aprobarlo, mueve el estatus a "Aprobado" y sella quién y cuándo.
   */
  async registrarSeguimiento(
    id: number, dto: SeguimientoEntregableDto, usuarioId?: number,
  ): Promise<EntregableConCumplimiento> {
    const actual = await this.findOne(id);

    const cambios: Record<string, unknown> = { ...dto };

    // Poner fecha de resultado implica que el entregable quedó terminado.
    let cerrarAl100 = false;
    if (dto.resultado && !actual.terminado_en) {
      cambios.terminado_en = new Date().toISOString();
      if (dto.estatus_id === undefined) {
        const terminado = await this.idEstatus(ESTATUS_TERMINADO);
        if (terminado) cambios.estatus_id = terminado;
      }
      // Un entregable entregado está al 100%. Se registra como un avance más
      // de la bitácora — que es la única fuente de verdad del %— en vez de
      // escribir pct_avance a mano y dejarlo en desacuerdo con el historial.
      cerrarAl100 = dto.pct_avance === undefined && actual.pct_avance !== 100;
    }

    // Aprobación: sella auditoría y adelanta el estatus.
    if (dto.aprobado === true && !actual.aprobado) {
      cambios.aprobado_en = new Date().toISOString();
      cambios.aprobado_por_id = usuarioId ?? null;
      if (dto.estatus_id === undefined) {
        const aprobado = await this.idEstatus(ESTATUS_APROBADO);
        if (aprobado) cambios.estatus_id = aprobado;
      }
    }

    // Revertir la aprobación limpia el sello, para no dejar rastros falsos.
    if (dto.aprobado === false && actual.aprobado) {
      cambios.aprobado_en = null;
      cambios.aprobado_por_id = null;
    }

    const { error } = await this.supabase.db
      .from('entregables').update(cambios).eq('id', id);
    if (error) throw new InternalServerErrorException(error.message);

    // Cierre al 100%: queda registrado en la bitácora con la fecha de entrega.
    if (cerrarAl100) {
      await this.crearAvance(
        id,
        { pct_avance: 100, fecha: dto.resultado, observacion: 'Entregable terminado' },
        usuarioId,
      );
    }

    return this.findOneConCumplimiento(id);
  }

  // ─────────────────────────────────────────────
  // Bitácora de avances
  // ─────────────────────────────────────────────

  /** Avances de un entregable, del más reciente al más antiguo. */
  async avances(id: number) {
    const { data, error } = await this.supabase.db
      .from('entregables_avances')
      .select('*, usuarios(id, nombre)')
      .eq('entregable_id', id)
      .order('fecha', { ascending: false })
      .order('id', { ascending: false });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  /**
   * Sincroniza `entregables.pct_avance` con el avance más reciente de la
   * bitácora — el de mayor fecha, desempatando por id. Así el % que se ve en
   * la tabla siempre corresponde al último registro, aunque se haya cargado
   * un avance con fecha atrasada o se haya borrado el más nuevo.
   */
  private async sincronizarAvance(entregableId: number): Promise<void> {
    const { data } = await this.supabase.db
      .from('entregables_avances')
      .select('pct_avance')
      .eq('entregable_id', entregableId)
      .order('fecha', { ascending: false })
      .order('id', { ascending: false })
      .limit(1);

    // Sin avances en la bitácora, el entregable vuelve a 0.
    const pct = data?.[0]?.pct_avance ?? 0;
    await this.supabase.db
      .from('entregables').update({ pct_avance: pct }).eq('id', entregableId);
  }

  /** Registra un avance y actualiza el % del entregable. */
  async crearAvance(id: number, dto: CrearAvanceDto, usuarioId?: number) {
    await this.findOne(id); // 404 si el entregable no existe

    const { data, error } = await this.supabase.db
      .from('entregables_avances')
      .insert({ ...dto, entregable_id: id, usuario_id: usuarioId ?? null })
      .select()
      .single();
    if (error) throw new InternalServerErrorException(error.message);

    await this.sincronizarAvance(id);
    return data;
  }

  /** Elimina un avance y recalcula el % del entregable. */
  async eliminarAvance(entregableId: number, avanceId: number) {
    const { error } = await this.supabase.db
      .from('entregables_avances')
      .delete()
      .eq('id', avanceId)
      .eq('entregable_id', entregableId);
    if (error) throw new InternalServerErrorException(error.message);

    await this.sincronizarAvance(entregableId);
    return { message: `Avance ${avanceId} eliminado` };
  }

  /** Bitácora de cambios de estatus de un entregable. */
  async historial(id: number) {
    const { data, error } = await this.supabase.db
      .from('entregables_historial')
      .select('*, anterior:estatus!estatus_anterior(descripcion), nuevo:estatus!estatus_nuevo(descripcion)')
      .eq('entregable_id', id)
      .order('creado_en', { ascending: false });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  /**
   * Resumen agregado del conjunto filtrado: alimenta las tarjetas
   * de cumplimiento de la pestaña Entregables.
   */
  async resumen(f: FiltrarEntregablesDto) {
    const filas = await this.buscar(f);
    const evaluados = filas.filter((e) => e.pct_cumple !== null);
    const promedio = (xs: number[]) =>
      xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 100) / 100 : null;

    return {
      total: filas.length,
      terminados: filas.filter((e) => e.resultado).length,
      aprobados: filas.filter((e) => e.aprobado).length,
      pendientes: filas.filter((e) => !e.resultado).length,
      a_tiempo: evaluados.filter((e) => (e.diferencia ?? 0) <= 0).length,
      con_retraso: evaluados.filter((e) => (e.diferencia ?? 0) > 0).length,
      error_interno_total: filas.reduce((s, e) => s + (e.error_interno ?? 0), 0),
      error_cliente_total: filas.reduce((s, e) => s + (e.error_cliente ?? 0), 0),
      pct_cumple_promedio: promedio(evaluados.map((e) => e.pct_cumple as number)),
      puntualidad_promedio: promedio(
        evaluados.filter((e) => e.puntualidad !== null).map((e) => e.puntualidad as number),
      ),
      exactitud_promedio: promedio(
        evaluados.filter((e) => e.exactitud !== null).map((e) => e.exactitud as number),
      ),
      diferencia_promedio: promedio(
        evaluados.filter((e) => e.diferencia !== null).map((e) => e.diferencia as number),
      ),
    };
  }

  findAllWithRelations() {
    return this.supabase.db.from('entregables').select(SELECT_RELACIONES).order('id');
  }

  findByCliente(cliente_id: number) {
    return this.buscar({ cliente_id });
  }
}
