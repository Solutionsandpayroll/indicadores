import { Injectable } from '@nestjs/common';
import { BaseService } from '../../common/base.service';
import { SupabaseService } from '../../supabase/supabase.service';

export interface TipoRca { id: number; descripcion: string; creado_en: string; }

@Injectable()
export class TipoRcaService extends BaseService<TipoRca> {
  constructor(supabase: SupabaseService) { super(supabase, 'tipo_rca'); }
}
