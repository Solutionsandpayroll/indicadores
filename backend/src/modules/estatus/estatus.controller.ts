import { Controller } from '@nestjs/common';
import { BaseController } from '../../common/base.controller';
import { EstatusService, Estatus } from './estatus.service';

@Controller('estatus')
export class EstatusController extends BaseController<Estatus> {
  constructor(service: EstatusService) { super(service); }
}
