import { Controller, Get } from '@nestjs/common';
import { BaseController } from '../../common/base.controller';
import { RcaService, Rca } from './rca.service';

@Controller('rca')
export class RcaController extends BaseController<Rca> {
  constructor(private rcaService: RcaService) { super(rcaService); }

  @Get('con-relaciones')
  findAllWithRelations() {
    return this.rcaService.findAllWithRelations();
  }
}
