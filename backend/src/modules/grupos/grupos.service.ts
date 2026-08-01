import { Injectable } from '@nestjs/common';
import { BaseService } from '../../common/base.service';
import { SupabaseService } from '../../supabase/supabase.service';

export interface Grupo { id: number; nombre: string; mostrar: boolean; creado_en: string; }

@Injectable()
export class GruposService extends BaseService<Grupo> {
  constructor(supabase: SupabaseService) { super(supabase, 'grupos'); }
}
