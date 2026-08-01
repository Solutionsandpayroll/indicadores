import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class BaseService<T> {
  constructor(
    protected readonly supabase: SupabaseService,
    protected readonly table: string,
  ) {}

  async findAll(filters?: Record<string, unknown>): Promise<T[]> {
    let query = this.supabase.db.from(this.table).select('*').order('id');
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) query = query.eq(key, value as string);
      });
    }
    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as T[];
  }

  async findOne(id: number): Promise<T> {
    const { data, error } = await this.supabase.db
      .from(this.table)
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) throw new NotFoundException(`Registro ${id} no encontrado en ${this.table}`);
    return data as T;
  }

  async create(dto: Partial<T>): Promise<T> {
    const { data, error } = await this.supabase.db
      .from(this.table)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(dto as any)
      .select()
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data as T;
  }

  async update(id: number, dto: Partial<T>): Promise<T> {
    await this.findOne(id);
    const { data, error } = await this.supabase.db
      .from(this.table)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(dto as any)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data as T;
  }

  async remove(id: number): Promise<{ message: string }> {
    await this.findOne(id);
    const { error } = await this.supabase.db.from(this.table).delete().eq('id', id);
    if (error) throw new InternalServerErrorException(error.message);
    return { message: `Registro ${id} eliminado` };
  }
}
