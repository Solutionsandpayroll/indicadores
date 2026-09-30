import { Injectable, InternalServerErrorException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { BaseService } from '../../common/base.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { esIndicadorSistema } from '../entregables/cumplimiento';

export interface EntregableTipo {
  id: number; indicador_id: number; nombre: string;
  orden: number; mostrar: boolean; creado_en: string;
  cliente_id: number | null; activo: boolean; actualizado_en: string;
  indicadores?: { id: number; nombre: string; es_sistema: boolean } | null;
  clientes?: { id: number; cliente: string } | null;
}

type UsuarioCtx = { sub: number; rol?: string } | undefined;

@Injectable()
export class EntregableTiposService extends BaseService<EntregableTipo> {
  constructor(supabase: SupabaseService) { super(supabase, 'entregable_tipos'); }

  /** Catálogo completo con indicador y cliente embebidos. */
  async findAllConIndicador() {
    const { data, error } = await this.supabase.db
      .from('entregable_tipos')
      .select('*, indicadores(id, nombre, es_sistema), clientes(id, cliente)')
      .order('indicador_id')
      .order('orden');
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  /** Tipos visibles de un indicador — alimenta el select del modal de entregables. */
  async findByIndicador(indicador_id: number) {
    const { data, error } = await this.supabase.db
      .from('entregable_tipos')
      .select('*')
      .eq('indicador_id', indicador_id)
      .eq('mostrar', true)
      .order('orden');
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  /**
   * Conceptos visibles y activos de un cliente + indicador del sistema.
   * Alimenta el campo Tipo del formulario de entregables (nuevo modelo).
   */
  async findByClienteIndicador(clienteId: number, indicadorId: number) {
    const { data, error } = await this.supabase.db
      .from('entregable_tipos')
      .select('*')
      .eq('cliente_id', clienteId)
      .eq('indicador_id', indicadorId)
      .eq('mostrar', true)
      .eq('activo', true)
      .order('orden');
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  /** ¿El usuario puede gestionar conceptos de este cliente? */
  private async puedeGestionarCliente(usuario: UsuarioCtx, clienteId: number): Promise<boolean> {
    if (!usuario?.rol || usuario.rol === 'Admin') return true;
    if (usuario.rol !== 'Lider') return false;
    const { data } = await this.supabase.db
      .from('usuario_clientes')
      .select('id')
      .eq('usuario_id', usuario.sub)
      .eq('cliente_id', clienteId)
      .maybeSingle();
    return !!data;
  }

  /** Valida que el concepto pertenezca a un cliente y a un indicador del sistema. */
  private async validarConcepto(dto: Partial<EntregableTipo>) {
    if (dto.cliente_id == null) {
      throw new BadRequestException('El concepto debe pertenecer a un cliente');
    }
    if (dto.indicador_id == null) {
      throw new BadRequestException('El concepto debe pertenecer a un indicador');
    }
    const { data: indicador } = await this.supabase.db
      .from('indicadores')
      .select('id, nombre, es_sistema')
      .eq('id', dto.indicador_id)
      .single();
    if (!indicador?.es_sistema || !esIndicadorSistema(indicador.nombre)) {
      throw new BadRequestException('El concepto debe usar un indicador del sistema (Plan de Entregables o Exactitud de Cálculos)');
    }
  }

  async create(dto: Partial<EntregableTipo>, usuario?: UsuarioCtx): Promise<EntregableTipo> {
    await this.validarConcepto(dto);
    if (usuario?.rol === 'Lider' && dto.cliente_id != null) {
      const ok = await this.puedeGestionarCliente(usuario, dto.cliente_id);
      if (!ok) throw new ForbiddenException('Solo puedes gestionar conceptos de tus clientes asignados');
    }
    try {
      return await super.create(dto);
    } catch (e) {
      if (String(e?.message ?? e).includes('duplicate')) {
        throw new BadRequestException('Ya existe un concepto con ese nombre para este cliente e indicador');
      }
      throw e;
    }
  }

  async update(id: number, dto: Partial<EntregableTipo>, usuario?: UsuarioCtx): Promise<EntregableTipo> {
    const actual = await this.findOne(id);
    if (usuario?.rol === 'Lider' && actual.cliente_id != null) {
      const ok = await this.puedeGestionarCliente(usuario, actual.cliente_id);
      if (!ok) throw new ForbiddenException('Solo puedes gestionar conceptos de tus clientes asignados');
    }
    const merged = { ...actual, ...dto };
    await this.validarConcepto(merged as Partial<EntregableTipo>);
    try {
      return await super.update(id, { ...dto, actualizado_en: new Date().toISOString() });
    } catch (e) {
      if (String(e?.message ?? e).includes('duplicate')) {
        throw new BadRequestException('Ya existe un concepto con ese nombre para este cliente e indicador');
      }
      throw e;
    }
  }

  async remove(id: number, usuario?: UsuarioCtx): Promise<{ message: string }> {
    const actual = await this.findOne(id);
    if (usuario?.rol === 'Lider' && actual.cliente_id != null) {
      const ok = await this.puedeGestionarCliente(usuario, actual.cliente_id);
      if (!ok) throw new ForbiddenException('Solo puedes gestionar conceptos de tus clientes asignados');
    }
    return super.remove(id);
  }
}
