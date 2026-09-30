import { Injectable, BadRequestException } from '@nestjs/common';
import { BaseService } from '../../common/base.service';
import { SupabaseService } from '../../supabase/supabase.service';

export interface Indicador {
  id: number; nombre: string; mostrar: boolean; creado_en: string;
  es_sistema: boolean;
}

@Injectable()
export class IndicadoresService extends BaseService<Indicador> {
  constructor(supabase: SupabaseService) { super(supabase, 'indicadores'); }

  /** Los indicadores del sistema no pueden modificarse ni ocultarse. */
  async update(id: number, dto: Partial<Indicador>): Promise<Indicador> {
    const actual = await this.findOne(id);
    if (actual.es_sistema) {
      if (dto.nombre !== undefined && dto.nombre !== actual.nombre) {
        throw new BadRequestException('Los indicadores del sistema no pueden renombrarse');
      }
      if (dto.mostrar !== undefined && dto.mostrar !== actual.mostrar) {
        throw new BadRequestException('Los indicadores del sistema no pueden ocultarse');
      }
      if (dto.es_sistema !== undefined && dto.es_sistema !== actual.es_sistema) {
        throw new BadRequestException('Los indicadores del sistema no pueden cambiar de categoría');
      }
    }
    return super.update(id, dto);
  }

  /** Los indicadores del sistema no pueden eliminarse. */
  async remove(id: number) {
    const actual = await this.findOne(id);
    if (actual.es_sistema) {
      throw new BadRequestException('Los indicadores del sistema no pueden eliminarse');
    }
    return super.remove(id);
  }
}
