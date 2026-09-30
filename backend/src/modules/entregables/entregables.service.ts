import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { BaseService } from '../../common/base.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { calcularCumplimiento, calcularPlan, calcularExactitud, esIndicadorSistema, ResultadoCumplimiento } from './cumplimiento';
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
  /** Cantidad de compromiso numérica (ej: 3 meses, 5 revisiones). Alternativa a fecha. */
  cantidad_compromiso: number | null;
  /** Resultado numérico real para entregables por cantidad. */
  resultado_cantidad: number | null;
  // Seguimiento
  resultado: string | null; error_interno: number | null; error_cliente: number | null;
  aprobado: boolean; terminado_en: string | null; aprobado_en: string | null;
  aprobado_por_id: number | null; actualizado_en: string;
  /** true = registros del nuevo modelo (indicador del sistema + concepto por cliente). */
  es_nuevo_modelo: boolean;
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
  clientes?: { pct_exactitud?: number | null; pct_puntualidad?: number | null } | null;
  indicadores?: { id: number; nombre: string } | null;
}

/** Contexto del usuario autenticado para restringir visibilidad por rol. */
export type UsuarioCtx = { sub: number; rol?: string } | undefined;

@Injectable()
export class EntregablesService extends BaseService<Entregable> {
  constructor(supabase: SupabaseService) {
    super(supabase, 'entregables');
  }

  /** Adjunta diferencia y % cumple a una fila que ya trae su cliente embebido. */
  private enriquecer<T extends FilaConRelaciones>(fila: T): T & ResultadoCumplimiento {
    // Nuevo modelo: la fórmula depende del indicador del sistema.
    if ((fila as { es_nuevo_modelo?: boolean }).es_nuevo_modelo) {
      const modo = esIndicadorSistema(fila.indicadores?.nombre);
      if (modo === 'plan') {
        return {
          ...fila,
          ...calcularPlan({
            resultado: fila.resultado,
            fechaCompromiso: fila.fecha_compromiso,
            metaPuntualidad: fila.clientes?.pct_puntualidad,
          }),
        };
      }
      if (modo === 'exactitud') {
        return {
          ...fila,
          ...calcularExactitud({
            resultadoCantidad: fila.resultado_cantidad,
            cantidadCompromiso: fila.cantidad_compromiso,
            metaExactitud: fila.clientes?.pct_exactitud,
          }),
        };
      }
    }

    // Modelo histórico: fórmula mixta original (intacta).
    return {
      ...fila,
      ...calcularCumplimiento({
        resultado: fila.resultado,
        fechaCompromiso: fila.fecha_compromiso,
        cantidadCompromiso: fila.cantidad_compromiso,
        resultadoCantidad: fila.resultado_cantidad,
        error_interno: fila.error_interno,
        error_cliente: fila.error_cliente,
        metaExactitud: fila.clientes?.pct_exactitud,
      }),
    };
  }

  /**
   * Restringe las filas según el rol del usuario autenticado:
   * - Analista: solo entregables donde es responsable (usuario_id).
   * - Líder: solo entregables donde es responsable o líder.
   * - Admin (o sin rol): sin restricción.
   */
  private restringir<T extends Entregable>(filas: T[], usuario: UsuarioCtx): T[] {
    if (!usuario?.rol || usuario.rol === 'Admin') return filas;
    if (usuario.rol === 'Analista') {
      return filas.filter((e) => e.usuario_id === usuario.sub);
    }
    if (usuario.rol === 'Lider') {
      return filas.filter((e) => e.usuario_id === usuario.sub || e.lider_id === usuario.sub);
    }
    return filas;
  }

  /**
   * Listado con filtros dinámicos combinables.
   * Devuelve las métricas de cumplimiento ya calculadas por fila.
   */
  async buscar(f: FiltrarEntregablesDto, usuario?: UsuarioCtx): Promise<EntregableConCumplimiento[]> {
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
    return this.restringir(filas as EntregableConCumplimiento[], usuario);
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

  /**
   * Valida que el usuario pueda operar entregables de un cliente:
   * Admin = todos; Líder = clientes asignados (usuario_clientes) o donde
   * ya tiene entregables como líder/responsable.
   */
  private async puedeOperarCliente(usuario: UsuarioCtx, clienteId: number): Promise<boolean> {
    if (!usuario?.rol || usuario.rol === 'Admin') return true;
    if (usuario.rol !== 'Lider') return false;

    const { data: asignado } = await this.supabase.db
      .from('usuario_clientes')
      .select('id')
      .eq('usuario_id', usuario.sub)
      .eq('cliente_id', clienteId)
      .maybeSingle();
    if (asignado) return true;

    const { data: ent } = await this.supabase.db
      .from('entregables')
      .select('id')
      .eq('cliente_id', clienteId)
      .or(`lider_id.eq.${usuario.sub},usuario_id.eq.${usuario.sub}`)
      .limit(1);
    return (ent ?? []).length > 0;
  }

  async create(dto: Partial<Entregable>, usuario?: UsuarioCtx): Promise<Entregable> {
    // Líder: solo puede crear para sus clientes. (Analista ya bloqueado en controller.)
    if (usuario?.rol === 'Lider' && dto.cliente_id) {
      const ok = await this.puedeOperarCliente(usuario, dto.cliente_id);
      if (!ok) throw new ForbiddenException('Solo puedes crear entregables de tus clientes asignados');
    }

    // Nuevo modelo: el concepto (tipo) define cliente + indicador del sistema.
    if (dto.entregable_tipo_id) {
      const { data: tipo } = await this.supabase.db
        .from('entregable_tipos')
        .select('id, nombre, cliente_id, indicador_id, mostrar, activo, indicadores(nombre)')
        .eq('id', dto.entregable_tipo_id)
        .single();

      if (tipo?.cliente_id != null) {
        const nombreIndicador = (tipo.indicadores as unknown as { nombre: string } | null)?.nombre;
        const modo = esIndicadorSistema(nombreIndicador);

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
          if (!dto.fecha_compromiso) {
            throw new BadRequestException('Plan de Entregables requiere fecha de compromiso');
          }
          if (dto.cantidad_compromiso != null || dto.resultado_cantidad != null
            || dto.error_interno != null || dto.error_cliente != null) {
            throw new BadRequestException(
              'Plan de Entregables no admite cantidades ni errores, solo fechas',
            );
          }
          dto = { ...dto, cantidad_compromiso: null, resultado_cantidad: null, error_interno: null, error_cliente: null };
        } else if (modo === 'exactitud') {
          if (dto.cantidad_compromiso == null) {
            throw new BadRequestException('Exactitud de Cálculos requiere cantidad de compromiso');
          }
          if (dto.fecha_compromiso != null || dto.resultado != null) {
            throw new BadRequestException(
              'Exactitud de Cálculos no admite fechas de compromiso ni resultado, solo cantidades',
            );
          }
          dto = { ...dto, fecha_compromiso: null, resultado: null };
        }

        dto = { ...dto, es_nuevo_modelo: true };
      }
    }

    return super.create(await this.conNombreDeTipo(dto));
  }

  async update(id: number, dto: Partial<Entregable>, usuario?: UsuarioCtx): Promise<Entregable> {
    // Nuevo modelo: no permitir cambiar el compromiso de modo incompatible.
    const { data: actual } = await this.supabase.db
      .from('entregables')
      .select('cliente_id, es_nuevo_modelo')
      .eq('id', id)
      .single();

    if (usuario?.rol === 'Lider' && actual?.cliente_id) {
      const ok = await this.puedeOperarCliente(usuario, actual.cliente_id);
      if (!ok) throw new ForbiddenException('Solo puedes editar entregables de tus clientes asignados');
    }

    if (actual?.es_nuevo_modelo) {
      // Coherencia de modo: no permitir mezclar fechas y cantidades.
      if (dto.fecha_compromiso != null && dto.cantidad_compromiso != null) {
        throw new BadRequestException('Un entregable del nuevo modelo no admite fecha y cantidad a la vez');
      }
    }

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
    id: number, dto: SeguimientoEntregableDto, usuario?: { sub: number; rol?: string },
  ): Promise<EntregableConCumplimiento> {
    const actual = await this.findOne(id);
    const usuarioId = usuario?.sub;

    const cambios: Record<string, unknown> = { ...dto };

    // ── Nuevo modelo: validación por modo de indicador ──
    if (actual.es_nuevo_modelo) {
      const { data: ind } = await this.supabase.db
        .from('indicadores')
        .select('nombre')
        .eq('id', actual.indicador_id)
        .single();
      const modo = esIndicadorSistema((ind as { nombre?: string } | null)?.nombre);

      if (modo === 'plan') {
        // Plan de Entregables: solo fecha real. Sin cantidades ni errores.
        if (dto.resultado_cantidad != null) {
          throw new BadRequestException('Plan de Entregables no admite cantidades de resultado');
        }
        delete cambios.resultado_cantidad;
        delete cambios.cantidad_compromiso;
        // Los errores no aplican en este modo: se ignoran silenciosamente.
        delete cambios.error_interno;
        delete cambios.error_cliente;
      } else if (modo === 'exactitud') {
        // Exactitud de Cálculos: solo cantidad correcta. Sin fechas.
        if (dto.resultado != null) {
          throw new BadRequestException('Exactitud de Cálculos no admite fechas de resultado');
        }
        delete cambios.resultado;
        delete cambios.fecha_compromiso;
      }

      // Los errores solo los registran líderes y administradores.
      if (usuario?.rol === 'Analista'
        && (dto.error_interno !== undefined || dto.error_cliente !== undefined)) {
        delete cambios.error_interno;
        delete cambios.error_cliente;
      }
    } else {
      // Modelo histórico: los analistas tampoco modifican errores.
      if (usuario?.rol === 'Analista'
        && (dto.error_interno !== undefined || dto.error_cliente !== undefined)) {
        delete cambios.error_interno;
        delete cambios.error_cliente;
      }
    }

    // Poner resultado (fecha o cantidad) implica que el entregable quedó terminado.
    let cerrarAl100 = false;
    const tieneResultado = dto.resultado != null || dto.resultado_cantidad != null;
    if (tieneResultado && !actual.terminado_en) {
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
      .from('entregables')
      .select(SELECT_RELACIONES)
      .order('id');
    if (error) throw new InternalServerErrorException(error.message);
    return this.restringir((data ?? []) as Entregable[], usuario);
  }

  findByCliente(cliente_id: number, usuario?: UsuarioCtx) {
    return this.buscar({ cliente_id }, usuario);
  }
}
