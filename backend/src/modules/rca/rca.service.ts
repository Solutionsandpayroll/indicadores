import { Injectable } from '@nestjs/common';
import { BaseService } from '../../common/base.service';
import { SupabaseService } from '../../supabase/supabase.service';

export interface Rca {
  id: number; codigo: string; anio: number; grupo_id: number; mes: number;
  cliente_id: number; tipo_rca_id: number; errores: string; acciones_mejora: string; creado_en: string;
}

@Injectable()
export class RcaService extends BaseService<Rca> {
  constructor(supabase: SupabaseService) { super(supabase, 'rca'); }

  findAllWithRelations() {
    return this.supabase.db
      .from('rca')
      .select('*, grupos(nombre), clientes(cliente), tipo_rca(descripcion)')
      .order('anio', { ascending: false });
  }
}
