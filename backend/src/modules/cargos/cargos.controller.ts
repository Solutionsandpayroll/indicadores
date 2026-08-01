import { Controller } from '@nestjs/common';
import { BaseController } from '../../common/base.controller';
import { CargosService, Cargo } from './cargos.service';

@Controller('cargos')
export class CargosController extends BaseController<Cargo> {
  constructor(service: CargosService) { super(service); }
}
