import { Controller } from '@nestjs/common';
import { BaseController } from '../../common/base.controller';
import { GruposService, Grupo } from './grupos.service';

@Controller('grupos')
export class GruposController extends BaseController<Grupo> {
  constructor(service: GruposService) { super(service); }
}
