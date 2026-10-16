import {
  Injectable, InternalServerErrorException, NotFoundException,
  BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { BaseService } from '../../common/base.service';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  calcularPlan, calcularExactitud, esIndicadorSistema, ResultadoCumplimiento,
  calcularImpactoVariable, ImpactoVariable, Perspectiva,
} from './cumplimiento';
import { FiltrarEntregablesDto } from './dto/filtrar-entregables.dto';
import { SeguimientoEntregableDto } from './dto/seguimiento.dto';
import { CrearErrorDto } from './dto/error.dto';

export interface Entregable {
  id: number; mes: number; anio: number; cliente_id: number; lider_id: number;
  estatus_id: number; usuario_id: number; comentarios: string;
  indicador_id: number; creado_en: string;
  entregable_tipo_id: number;
  tipo: string | null;
  fecha_compromiso: string | null;
  cantidad_compromiso: number | null;
  /** Cantidad PROCESADA (semántica nueva; antes era "correctos"). */
  resultado_cantidad: number | null;
  resultado: string | null;
  aprobado: boolean; terminado_en: string | null; aprobado_en: string | null;
  aprobado_por_id: number | null; actualizado_en: string;
  es_nuevo_modelo: boolean;
}

/** Conteos derivados de la tabla hija entregable_errores. */
export interface ConteosError {
  error_interno: number;
  error_cliente: number;
}

/** Entregable con cumplimiento + conteos de error derivados + señal de impacto al variable. */
export type EntregableConCumplimiento = Entregable & ResultadoCumplimiento & ConteosError & {
  impacto_variable: ImpactoVariable | null;
};

const ESTATUS_ASIGNADO = 'asignado';
const ESTATUS_TERMINADO = 'terminado';
const ESTATUS_APROBADO = 'aprobado';

const SELECT_RELACIONES = `
  id, mes, anio, cliente_id, indicador_id, entregable_tipo_id, tipo,
  lider_id, usuario_id, estatus_id, comentarios,
  fecha_compromiso, cantidad_compromiso, resultado, resultado_cantidad,
  aprobado, terminado_en, aprobado_en, aprobado_por_id,
  es_nuevo_modelo, creado_en, actualizado_en,
  clientes(id, cliente, fecha, pct_puntualidad, pct_exactitud, grupo_id),
  estatus(id, descripcion),
  indicadores(id, nombre),
  entregable_tipos(id, nombre),
  lider:usuarios!lider_id(id, nombre),
  responsable:usuarios!usuario_id(id, nombre, rol),
  entregable_errores(id, tipo, descripcion, correccion)
`;

interface FilaConRelaciones extends Entregable {
  clientes?: { pct_exactitud?: number | null; pct_puntualidad?: number | null } | null;
  indicadores?: { id: number; nombre: string } | null;
  responsable?: { id: number; nombre: string; rol?: string } | null;
  entregable_errores?: { tipo: string }[] | null;
}

/** Contexto del usuario autenticado para restringir visibilidad por rol. */
export type UsuarioCtx = { sub: number; rol?: string } | undefined;

/** Cuenta los errores por tipo desde las filas embebidas. */
function contarErrores(filas: { tipo: string }[] | null | undefined): ConteosError {
  let interno = 0;
  let cliente = 0;
  for (const e of filas ?? []) {
    if (e.tipo === 'interno') interno++;
    else if (e.tipo === 'cliente') cliente++;
  }
  return { error_interno: interno, error_cliente: cliente };
}

@Injectable()
export class EntregablesService extends BaseService<Entregable> {
  constructor(supabase: SupabaseService) {
    super(supabase, 'entregables');
  }

  /**
   * Perspectiva para Impacto variable:
   * Analista ve sus dos errores; Líder solo errores de cliente;
   * Admin (sin variable propio) usa la del responsable de la fila.
   */
  private perspectivaPara(usuario: UsuarioCtx, fila: FilaConRelaciones): Perspectiva {
    if (usuario?.rol === 'Lider') return 'lider';
    if (usuario?.rol === 'Analista') return 'analista';
    return fila.responsable?.rol === 'Lider' ? 'lider' : 'analista';
  }

  /**
   * Adjunta cumplimiento, conteos de error e impacto al variable a una fila.
   * El % del registro se evalúa en perspectiva ANALISTA (quien lo ejecutó);
   * el Impacto variable usa la perspectiva del usuario que consulta.
   */
  private enriquecer<T extends FilaConRelaciones>(fila: T, usuario?: UsuarioCtx): T & EntregableConCumplimiento {
    const conteos = contarErrores(fila.entregable_errores);
    const modo = esIndicadorSistema(fila.indicadores?.nombre);

    let calculo: ResultadoCumplimiento;
    if (modo === 'plan') {
      calculo = calcularPlan({
        resultado: fila.resultado,
        fechaCompromiso: fila.fecha_compromiso,
        metaPuntualidad: fila.clientes?.pct_puntualidad,
      });
    } else if (modo === 'exactitud') {
      calculo = calcularExactitud({
        cantidadProcesada: fila.resultado_cantidad,
        cantidadCompromiso: fila.cantidad_compromiso,
        errorInterno: conteos.error_interno,
        errorCliente: conteos.error_cliente,
        metaExactitud: fila.clientes?.pct_exactitud,
        perspectiva: 'analista',
      });
    } else {
      calculo = { diferencia: null, puntualidad: null, exactitud: null, pct_cumple: null, cumple_meta: null };
    }

    const impacto_variable = calcularImpactoVariable({
      modo,
      resultado: fila.resultado,
      resultadoCantidad: fila.resultado_cantidad,
      fechaCompromiso: fila.fecha_compromiso,
      cantidadCompromiso: fila.cantidad_compromiso,
      errorInterno: conteos.error_interno,
      errorCliente: conteos.error_cliente,
      perspectiva: this.perspectivaPara(usuario, fila),
    });

    return {
      ...fila,
      ...calculo,
      error_interno: conteos.error_interno,
      error_cliente: conteos.error_cliente,
      impacto_variable,
    } as T & EntregableConCumplimiento;
  }

  /**
   * Restringe las filas según el rol:
   * Analista → solo responsable; Líder → responsable o líder; Admin → todo.
   */
  private restringir<T extends Entregable>(filas: T[], usuario: UsuarioCtx): T[] {
    if (!usuario?.rol || usuario.rol === 'Admin') return filas;
    if (usuario.rol === 'Analista') return filas.filter((e) => e.usuario_id === usuario.sub);
    if (usuario.rol === 'Lider') return filas.filter((e) => e.usuario_id === usuario.sub || e.lider_id === usuario.sub);
    return filas;
  }

  async buscar(f: FiltrarEntregablesDto, usuario?: UsuarioCtx): Promise<EntregableConCumplimiento[]> {
    let query = this.supabase.db.from('entregables').select(SELECT_RELACIONES);

    const exactos = {
      cliente_id: f.cliente_id, indicador_id: f.indicador_id, estatus_id: f.estatus_id,
      lider_id: f.lider_id, usuario_id: f.usuario_id, aprobado: f.aprobado,
      entregable_tipo_id: f.entregable_tipo_id,
    };
    for (const [col, val] of Object.entries(exactos)) {
      if (val !== undefined) query = query.eq(col, val);
    }

    if (f.anio !== undefined) query = query.eq('anio', f.anio);
    if (f.mes !== undefined) query = query.eq('mes', f.mes);

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

    if (f.q) query = query.ilike('comentarios', `%${f.q}%`);

    const asc = f.dir !== 'desc';
    switch (f.orden) {
      case 'cliente': query = query.order('cliente_id', { ascending: asc }); break;
      case 'estatus': query = query.order('estatus_id', { ascending: asc }); break;
      case 'periodo': query = query.order('anio', { ascending: asc }).order('mes', { ascending: asc }); break;
      default: query = query.order('id', { ascending: asc });
    }

    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(error.message);

    const filas = (data ?? []).map((r) => this.enriquecer(r as unknown as FilaConRelaciones, usuario));

    if (f.orden === 'cumplimiento') {
      filas.sort((a, b) => ((a.pct_cumple ?? -1) - (b.pct_cumple ?? -1)) * (asc ? 1 : -1));
    }
    return this.restringir(filas as EntregableConCumplimiento[], usuario);
  }

  async findOneConCumplimiento(id: number, usuario?: UsuarioCtx): Promise<EntregableConCumplimiento> {
    const { data, error } = await this.supabase.db
      .from('entregables').select(SELECT_RELACIONES).eq('id', id).single();
    if (error || !data) throw new NotFoundException(`Entregable ${id} no encontrado`);
    return this.enriquecer(data as unknown as FilaConRelaciones, usuario) as EntregableConCumplimiento;
  }

  private async conNombreDeTipo(dto: Partial<Entregable>): Promise<Partial<Entregable>> {
    if (!dto.entregable_tipo_id) return dto;
    const { data } = await this.supabase.db
      .from('entregable_tipos').select('nombre').eq('id', dto.entregable_tipo_id).single();
    return data ? { ...dto, tipo: (data as { nombre: string }).nombre } : dto;
  }

  /** Busca un estatus por nombre (case-insensitive). */
  private async idEstatus(nombre: string): Promise<number | null> {
    const { data } = await this.supabase.db
      .from('estatus').select('id, descripcion').ilike('descripcion', nombre).limit(1);
    return data?.[0]?.id ?? null;
  }

  private async puedeOperarCliente(usuario: UsuarioCtx, clienteId: number): Promise<boolean> {
    if (!usuario?.rol || usuario.rol === 'Admin') return true;
    if (usuario.rol !== 'Lider') return false;
    const { data: asignado } = await this.supabase.db
      .from('usuario_clientes').select('id')
      .eq('usuario_id', usuario.sub).eq('cliente_id', clienteId).maybeSingle();
    if (asignado) return true;
    const { data: ent } = await this.supabase.db
      .from('entregables').select('id')
      .eq('cliente_id', clienteId)
      .or(`lider_id.eq.${usuario.sub},usuario_id.eq.${usuario.sub}`).limit(1);
    return (ent ?? []).length > 0;
  }

  async create(dto: Partial<Entregable>, usuario?: UsuarioCtx): Promise<Entregable> {
    if (usuario?.rol === 'Lider' && dto.cliente_id) {
      const ok = await this.puedeOperarCliente(usuario, dto.cliente_id);
      if (!ok) throw new ForbiddenException('Solo puedes crear entregables de tus clientes asignados');
    }

    // Nuevo entregable nace SIEMPRE en "Asignado" (no se pide al líder).
    const asignado = await this.idEstatus(ESTATUS_ASIGNADO);
    dto = { ...dto, estatus_id: asignado ?? dto.estatus_id };

    // Validación de modo por concepto del sistema.
    if (dto.entregable_tipo_id) {
      const { data: tipo } = await this.supabase.db
        .from('entregable_tipos')
        .select('id, nombre, cliente_id, indicador_id, mostrar, activo, indicadores(nombre)')
        .eq('id', dto.entregable_tipo_id).single();

      if (tipo?.cliente_id != null) {
        const modo = esIndicadorSistema((tipo.indicadores as unknown as { nombre: string } | null)?.nombre);
        if (dto.cliente_id !== tipo.cliente_id) {
          throw new BadRequestException('El concepto seleccionado no pertenece a ese cliente');
        }
        if (dto.indicador_id !== tipo.indicador_id) {
          throw new BadRequestException('El concepto seleccionado no pertenece a ese indicador');
        }
        if (!tipo.mostrar || !tipo.activo) {
          throw new BadRequestException('El concepto seleccionado no está disponible');
        }
        if (modo === 'plan') {
          if (!dto.fecha_compromiso) throw new BadRequestException('Plan de Entregables requiere fecha de compromiso');
          if (dto.cantidad_compromiso != null || dto.resultado_cantidad != null) {
            throw new BadRequestException('Plan de Entregables solo admite fechas');
          }
          dto = { ...dto, cantidad_compromiso: null, resultado_cantidad: null };
        } else if (modo === 'exactitud') {
          if (dto.cantidad_compromiso == null) throw new BadRequestException('Exactitud de Cálculos requiere cantidad de compromiso');
          if (dto.fecha_compromiso != null || dto.resultado != null) {
            throw new BadRequestException('Exactitud de Cálculos solo admite cantidades');
          }
          dto = { ...dto, fecha_compromiso: null, resultado: null };
        }
        dto = { ...dto, es_nuevo_modelo: true };
      }
    }

    return super.create(await this.conNombreDeTipo(dto));
  }

  async update(id: number, dto: Partial<Entregable>, usuario?: UsuarioCtx): Promise<Entregable> {
    const { data: actual } = await this.supabase.db
      .from('entregables').select('cliente_id, es_nuevo_modelo, indicador_id').eq('id', id).single();

    if (usuario?.rol === 'Lider' && actual?.cliente_id) {
      const ok = await this.puedeOperarCliente(usuario, actual.cliente_id);
      if (!ok) throw new ForbiddenException('Solo puedes editar entregables de tus clientes asignados');
    }

    if (actual?.es_nuevo_modelo) {
      if (dto.fecha_compromiso != null && dto.cantidad_compromiso != null) {
        throw new BadRequestException('Un entregable del nuevo modelo no admite fecha y cantidad a la vez');
      }
    }

    return super.update(id, await this.conNombreDeTipo(dto));
  }

  /**
   * Registra el seguimiento (resultado del analista / aprobación del líder).
   * Los errores NO se manejan aquí: viven en la tabla hija entregable_errores.
   */
  async registrarSeguimiento(
    id: number, dto: SeguimientoEntregableDto, usuario?: { sub: number; rol?: string },
  ): Promise<EntregableConCumplimiento> {
    const actual = await this.findOne(id);
    const usuarioId = usuario?.sub;

    const cambios: Record<string, unknown> = { ...dto };

    // Validación por modo del indicador del sistema.
    if (actual.es_nuevo_modelo) {
      const { data: ind } = await this.supabase.db
        .from('indicadores').select('nombre').eq('id', actual.indicador_id).single();
      const modo = esIndicadorSistema((ind as { nombre?: string } | null)?.nombre);

      if (modo === 'plan') {
        if (dto.resultado_cantidad != null) throw new BadRequestException('Plan de Entregables no admite cantidades de resultado');
        delete cambios.resultado_cantidad;
        delete cambios.cantidad_compromiso;
      } else if (modo === 'exactitud') {
        if (dto.resultado != null) throw new BadRequestException('Exactitud de Cálculos no admite fechas de resultado');
        delete cambios.resultado;
        delete cambios.fecha_compromiso;
      }
    }

    // Registrar resultado → pasa a Terminado automáticamente.
    const tieneResultado = dto.resultado != null || dto.resultado_cantidad != null;
    if (tieneResultado && !actual.terminado_en) {
      cambios.terminado_en = new Date().toISOString();
      if (dto.estatus_id === undefined) {
        const terminado = await this.idEstatus(ESTATUS_TERMINADO);
        if (terminado) cambios.estatus_id = terminado;
      }
    }

    // Aprobar (líder/admin) → Aprobado. Un entregable con errores puede aprobarse.
    if (dto.aprobado === true && !actual.aprobado) {
      cambios.aprobado_en = new Date().toISOString();
      cambios.aprobado_por_id = usuarioId ?? null;
      if (dto.estatus_id === undefined) {
        const aprobado = await this.idEstatus(ESTATUS_APROBADO);
        if (aprobado) cambios.estatus_id = aprobado;
      }
    }
    if (dto.aprobado === false && actual.aprobado) {
      cambios.aprobado_en = null;
      cambios.aprobado_por_id = null;
    }

    const { error } = await this.supabase.db.from('entregables').update(cambios).eq('id', id);
    if (error) throw new InternalServerErrorException(error.message);

    return this.findOneConCumplimiento(id, usuario);
  }

  // ─────────────────────────────────────────────
  // Errores (tabla hija)
  // ─────────────────────────────────────────────

  /** Errores de un entregable. */
  async listarErrores(entregableId: number) {
    const { data, error } = await this.supabase.db
      .from('entregable_errores')
      .select('*, autor:usuarios!registrado_por(id, nombre)')
      .eq('entregable_id', entregableId)
      .order('id');
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  /**
   * Valida que el entregable sea de un indicador del sistema y que el
   * usuario pueda gestionar errores. En Plan no alteran % Cumple (solo la
   * fecha), pero sí marcan Impacto variable; en Exactitud además penalizan.
   */
  private async validarGestionError(entregableId: number, usuario?: { sub: number; rol?: string }) {
    const { data: ent } = await this.supabase.db
      .from('entregables').select('id, indicador_id, cliente_id').eq('id', entregableId).single();
    if (!ent) throw new NotFoundException('Entregable no encontrado');

    const { data: ind } = await this.supabase.db
      .from('indicadores').select('nombre').eq('id', ent.indicador_id).single();
    if (esIndicadorSistema((ind as { nombre?: string } | null)?.nombre) === null) {
      throw new BadRequestException('Solo Plan de Entregables y Exactitud de Cálculos admiten errores');
    }
    if (usuario?.rol === 'Analista') {
      throw new ForbiddenException('Solo el líder o el administrador registran errores');
    }
    return ent as { id: number; indicador_id: number; cliente_id: number };
  }

  /** Crea un error (líder/admin). */
  async crearError(entregableId: number, dto: CrearErrorDto, usuario?: { sub: number; rol?: string }) {
    await this.validarGestionError(entregableId, usuario);
    if (dto.tipo !== 'interno' && dto.tipo !== 'cliente') {
      throw new BadRequestException('El tipo de error debe ser interno o cliente');
    }
    const { data, error } = await this.supabase.db
      .from('entregable_errores')
      .insert({
        entregable_id: entregableId,
        tipo: dto.tipo,
        descripcion: dto.descripcion,
        correccion: dto.correccion ?? null,
        registrado_por: usuario?.sub ?? null,
      } as never)
      .select('*, autor:usuarios!registrado_por(id, nombre)')
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  /** Edita un error: tipo, descripción o corrección (líder/admin). */
  async actualizarError(errorId: number, dto: Partial<CrearErrorDto>, usuario?: { sub: number; rol?: string }) {
    const { data: actual } = await this.supabase.db
      .from('entregable_errores').select('id, entregable_id').eq('id', errorId).single();
    if (!actual) throw new NotFoundException('Error no encontrado');
    await this.validarGestionError(actual.entregable_id, usuario);

    const payload: Record<string, unknown> = { actualizado_en: new Date().toISOString() };
    if (dto.tipo) payload.tipo = dto.tipo;
    if (dto.descripcion !== undefined) payload.descripcion = dto.descripcion;
    if (dto.correccion !== undefined) {
      payload.correccion = dto.correccion;
      payload.corregido_por = usuario?.sub ?? null;
    }
    const { data, error } = await this.supabase.db
      .from('entregable_errores').update(payload as never).eq('id', errorId)
      .select('*, autor:usuarios!registrado_por(id, nombre)').single();
    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  /** Elimina un error (SOLO admin). */
  async eliminarError(errorId: number, usuario?: { sub: number; rol?: string }) {
    if (usuario?.rol !== 'Admin') {
      throw new ForbiddenException('Solo el administrador puede eliminar un error');
    }
    const { error } = await this.supabase.db.from('entregable_errores').delete().eq('id', errorId);
    if (error) throw new InternalServerErrorException(error.message);
    return { message: `Error ${errorId} eliminado` };
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

  /** Resumen agregado del conjunto filtrado. */
  async resumen(f: FiltrarEntregablesDto, usuario?: UsuarioCtx) {
    const filas = await this.buscar(f, usuario);
    const evaluados = filas.filter((e) => e.pct_cumple !== null);
    const promedio = (xs: number[]) =>
      xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 100) / 100 : null;

    return {
      total: filas.length,
      terminados: filas.filter((e) => e.resultado || e.resultado_cantidad).length,
      aprobados: filas.filter((e) => e.aprobado).length,
      pendientes: filas.filter((e) => !e.resultado && !e.resultado_cantidad).length,
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

  async findAllWithRelations(usuario?: UsuarioCtx) {
    const { data, error } = await this.supabase.db
      .from('entregables').select(SELECT_RELACIONES).order('id');
    if (error) throw new InternalServerErrorException(error.message);
    return this.restringir((data ?? []) as unknown as Entregable[], usuario);
  }

  findByCliente(cliente_id: number, usuario?: UsuarioCtx) {
    return this.buscar({ cliente_id }, usuario);
  }
}
