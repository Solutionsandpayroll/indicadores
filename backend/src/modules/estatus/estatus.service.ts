import { Injectable } from '@nestjs/common';
import { BaseService } from '../../common/base.service';
import { SupabaseService } from '../../supabase/supabase.service';

export interface Estatus { id: number; descripcion: string; creado_en: string; }

@Injectable()
export class EstatusService extends BaseService<Estatus> {
  constructor(supabase: SupabaseService) { super(supabase, 'estatus'); }
}
