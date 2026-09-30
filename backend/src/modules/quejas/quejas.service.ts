import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

export interface Queja {
  id: number; cliente_id: number; mes: number; anio: number;
  fecha_registro: string; descripcion: string;
  registrado_por: number | null; creado_en: string;
  clientes?: { cliente: string } | null;
  queja_usuarios?: { usuario_id: number; usuarios?: { id: number; nombre: string } | null }[];
}

export interface CrearQuejaDto {
  cliente_id: number;
  mes: number;
  anio: number;
  fecha_registro?: string;
  descripcion: string;
  usuarios?: number[];
}

const SELECT_QUEJA = `
  *,
  clientes(cliente),
  queja_usuarios(usuario_id, usuarios(id, nombre)),
  registrado_por_nombre:usuarios!registrado_por(nombre)
`;

@Injectable()
export class QuejasService {
  constructor(private supabase: SupabaseService) {}

  /**
   * Listado con filtros combinables: cliente, período (año/mes)
   * y usuario afectado.
   */
  async buscar(f: { cliente_id?: number; anio?: number; mes?: number; usuario_id?: number }): Promise<Queja[]> {
    let query = this.supabase.db
      .from('quejas')
      .select(SELECT_QUEJA)
      .order('anio', { ascending: false })
      .order('mes', { ascending: false })
      .order('id', { ascending: false });

    if (f.cliente_id) query = query.eq('cliente_id', f.cliente_id);
    if (f.anio) query = query.eq('anio', f.anio);
    if (f.mes) query = query.eq('mes', f.mes);
    if (f.usuario_id) query = query.eq('queja_usuarios.usuario_id', f.usuario_id);

    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as unknown as Queja[];
  }

  async findOne(id: number): Promise<Queja> {
    const { data, error } = await this.supabase.db
      .from('quejas')
      .select(SELECT_QUEJA)
      .eq('id', id)
      .single();
    if (error || !data) throw new NotFoundException(`Queja ${id} no encontrada`);
    return data as unknown as Queja;
  }

  /** Crea la queja y sus asociaciones con usuarios afectados. */
  async create(dto: CrearQuejaDto, registradoPor?: number): Promise<Queja> {
    const { data: queja, error } = await this.supabase.db
      .from('quejas')
      .insert({
        cliente_id: dto.cliente_id,
        mes: dto.mes,
        anio: dto.anio,
        fecha_registro: dto.fecha_registro ?? new Date().toISOString().slice(0, 10),
        descripcion: dto.descripcion,
        registrado_por: registradoPor ?? null,
      } as never)
      .select('id')
      .single();
    if (error) throw new InternalServerErrorException(error.message);

    await this.reemplazarUsuarios(queja.id, dto.usuarios ?? []);
    return this.findOne(queja.id);
  }

  /** Actualiza la queja y, si vienen usuarios, reemplaza las asociaciones. */
  async update(id: number, dto: Partial<CrearQuejaDto>): Promise<Queja> {
    await this.findOne(id);

    const payload: Record<string, unknown> = {};
    if (dto.cliente_id !== undefined) payload.cliente_id = dto.cliente_id;
    if (dto.mes !== undefined) payload.mes = dto.mes;
    if (dto.anio !== undefined) payload.anio = dto.anio;
    if (dto.fecha_registro !== undefined) payload.fecha_registro = dto.fecha_registro;
    if (dto.descripcion !== undefined) payload.descripcion = dto.descripcion;

    if (Object.keys(payload).length > 0) {
      const { error } = await this.supabase.db.from('quejas').update(payload as never).eq('id', id);
      if (error) throw new InternalServerErrorException(error.message);
    }

    if (dto.usuarios !== undefined) {
      await this.reemplazarUsuarios(id, dto.usuarios);
    }

    return this.findOne(id);
  }

  async remove(id: number): Promise<{ message: string }> {
    await this.findOne(id);
    // queja_usuarios se elimina en cascada por la FK.
    const { error } = await this.supabase.db.from('quejas').delete().eq('id', id);
    if (error) throw new InternalServerErrorException(error.message);
    return { message: `Queja ${id} eliminada` };
  }

  /** Reemplaza las asociaciones de usuarios afectados de una queja. */
  private async reemplazarUsuarios(quejaId: number, usuarioIds: number[]) {
    const { error: eDel } = await this.supabase.db
      .from('queja_usuarios')
      .delete()
      .eq('queja_id', quejaId);
    if (eDel) throw new InternalServerErrorException(eDel.message);

    if (usuarioIds.length > 0) {
      const filas = usuarioIds.map((usuario_id) => ({ queja_id: quejaId, usuario_id }));
      const { error: eIns } = await this.supabase.db.from('queja_usuarios').insert(filas as never);
      if (eIns) throw new InternalServerErrorException(eIns.message);
    }
  }
}
