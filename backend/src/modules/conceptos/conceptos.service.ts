import { Injectable } from '@nestjs/common';
import { BaseService } from '../../common/base.service';
import { SupabaseService } from '../../supabase/supabase.service';

export interface Concepto { id: number; descripcion: string; creado_en: string; }

@Injectable()
export class ConceptosService extends BaseService<Concepto> {
  constructor(supabase: SupabaseService) { super(supabase, 'conceptos'); }
}
