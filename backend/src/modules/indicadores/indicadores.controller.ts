import { Controller } from '@nestjs/common';
import { BaseController } from '../../common/base.controller';
import { IndicadoresService, Indicador } from './indicadores.service';

@Controller('indicadores')
export class IndicadoresController extends BaseController<Indicador> {
  constructor(service: IndicadoresService) { super(service); }
}
