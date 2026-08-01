import { Injectable } from '@nestjs/common';
import { BaseService } from '../../common/base.service';
import { SupabaseService } from '../../supabase/supabase.service';

export interface Cargo { id: number; descripcion: string; creado_en: string; }

@Injectable()
export class CargosService extends BaseService<Cargo> {
  constructor(supabase: SupabaseService) { super(supabase, 'cargos'); }
}
