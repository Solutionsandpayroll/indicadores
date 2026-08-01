import { Injectable, ConflictException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import * as bcrypt from 'bcrypt';

export interface Usuario {
  id: number; usuario: string; contrasena?: string; nombre: string;
  cargo_id: number; email: string; grupo_id: number; lider_id: number;
  es_admin: boolean; activo: boolean; creado_en: string;
}

const SAFE_SELECT = 'id, usuario, nombre, cargo_id, email, grupo_id, lider_id, es_admin, activo, creado_en';

@Injectable()
export class UsuariosService {
  constructor(private supabase: SupabaseService) {}

  async findAll(): Promise<Usuario[]> {
    const { data, error } = await this.supabase.db
      .from('usuarios')
      .select(`${SAFE_SELECT}, cargos(descripcion), grupos(nombre)`)
      .order('id');
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as unknown as Usuario[];
  }

  async findOne(id: number): Promise<Usuario> {
    const { data, error } = await this.supabase.db
      .from('usuarios')
      .select(SAFE_SELECT)
      .eq('id', id)
      .single();
    if (error || !data) throw new NotFoundException(`Usuario ${id} no encontrado`);
    return data as unknown as Usuario;
  }

  async create(dto: Partial<Usuario>): Promise<Usuario> {
    const { data: exists } = await this.supabase.db
      .from('usuarios').select('id').eq('usuario', dto.usuario!).single();
    if (exists) throw new ConflictException(`El usuario '${dto.usuario}' ya existe`);

    const hash = await bcrypt.hash(dto.contrasena!, 10);
    const { data, error } = await this.supabase.db
      .from('usuarios')
      .insert({ ...dto, contrasena: hash } as never)
      .select(SAFE_SELECT)
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data as unknown as Usuario;
  }

  async update(id: number, dto: Partial<Usuario>): Promise<Usuario> {
    await this.findOne(id);
    const payload: Record<string, unknown> = { ...dto };
    if (dto.contrasena) payload['contrasena'] = await bcrypt.hash(dto.contrasena, 10);
    const { data, error } = await this.supabase.db
      .from('usuarios')
      .update(payload as never)
      .eq('id', id)
      .select(SAFE_SELECT)
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data as unknown as Usuario;
  }

  async remove(id: number): Promise<{ message: string }> {
    await this.findOne(id);
    const { error } = await this.supabase.db.from('usuarios').delete().eq('id', id);
    if (error) throw new InternalServerErrorException(error.message);
    return { message: `Usuario ${id} eliminado` };
  }
}
