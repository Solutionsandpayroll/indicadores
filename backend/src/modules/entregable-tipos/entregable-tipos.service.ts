import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { BaseService } from '../../common/base.service';
import { SupabaseService } from '../../supabase/supabase.service';

export interface EntregableTipo {
  id: number; indicador_id: number; nombre: string;
  orden: number; mostrar: boolean; creado_en: string;
}

@Injectable()
export class EntregableTiposService extends BaseService<EntregableTipo> {
  constructor(supabase: SupabaseService) { super(supabase, 'entregable_tipos'); }

  /** Catálogo completo con el nombre del indicador al que pertenece cada tipo. */
  async findAllConIndicador() {
    const { data, error } = await this.supabase.db
      .from('entregable_tipos')
      .select('*, indicadores(id, nombre)')
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
}
