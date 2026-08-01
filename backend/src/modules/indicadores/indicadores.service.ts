import { Injectable } from '@nestjs/common';
import { BaseService } from '../../common/base.service';
import { SupabaseService } from '../../supabase/supabase.service';

export interface Indicador { id: number; nombre: string; mostrar: boolean; creado_en: string; }

@Injectable()
export class IndicadoresService extends BaseService<Indicador> {
  constructor(supabase: SupabaseService) { super(supabase, 'indicadores'); }
}
