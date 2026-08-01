import { Controller } from '@nestjs/common';
import { BaseController } from '../../common/base.controller';
import { TipoRcaService, TipoRca } from './tipo-rca.service';

@Controller('tipo-rca')
export class TipoRcaController extends BaseController<TipoRca> {
  constructor(service: TipoRcaService) { super(service); }
}
