import { Injectable } from '@nestjs/common';
import { BaseService } from '../../common/base.service';
import { SupabaseService } from '../../supabase/supabase.service';

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
}
