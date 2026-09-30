import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

export interface UsuarioCliente {
  id: number; usuario_id: number; cliente_id: number; rol: string; creado_en: string;
  usuario?: { id: number; nombre: string; usuario: string };
}

export interface AsignacionInput {
  usuario_id: number;
  rol: 'Lider' | 'Analista';
}

@Injectable()
export class UsuarioClientesService {
  constructor(private supabase: SupabaseService) {}

  /** Asignaciones de un cliente, con datos del usuario. */
  async findByCliente(clienteId: number): Promise<UsuarioCliente[]> {
    const { data, error } = await this.supabase.db
      .from('usuario_clientes')
      .select('*, usuario:usuarios(id, nombre, usuario)')
      .eq('cliente_id', clienteId)
      .order('id');
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as unknown as UsuarioCliente[];
  }

  /** Reemplaza todas las asignaciones de un cliente. */
  async sync(clienteId: number, asignaciones: AsignacionInput[]): Promise<UsuarioCliente[]> {
    const { error: eDel } = await this.supabase.db
      .from('usuario_clientes')
      .delete()
      .eq('cliente_id', clienteId);
    if (eDel) throw new InternalServerErrorException(eDel.message);

    if (asignaciones.length > 0) {
      const filas = asignaciones.map((a) => ({ ...a, cliente_id: clienteId }));
      const { error: eIns } = await this.supabase.db
        .from('usuario_clientes')
        .insert(filas as never);
      if (eIns) throw new InternalServerErrorException(eIns.message);
    }

    return this.findByCliente(clienteId);
  }

  async remove(id: number): Promise<{ message: string }> {
    const { error } = await this.supabase.db
      .from('usuario_clientes')
      .delete()
      .eq('id', id);
    if (error) throw new InternalServerErrorException(error.message);
    return { message: `Asignación ${id} eliminada` };
  }
}
