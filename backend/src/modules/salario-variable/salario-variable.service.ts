import { Injectable } from '@nestjs/common';
import { BaseService } from '../../common/base.service';
import { SupabaseService } from '../../supabase/supabase.service';

export interface SalarioVariable {
  id: number; cargo_id: number; concepto_id: number;
  pct_cumplimiento: number; pct_peso: number; mostrar: boolean; creado_en: string;
}

@Injectable()
export class SalarioVariableService extends BaseService<SalarioVariable> {
  constructor(supabase: SupabaseService) { super(supabase, 'salario_variable'); }

  findAllWithRelations() {
    return this.supabase.db
      .from('salario_variable')
      .select('*, cargos(descripcion), conceptos(descripcion)')
      .order('id');
  }
}
