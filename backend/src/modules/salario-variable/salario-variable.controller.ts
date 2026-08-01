import { Controller, Get } from '@nestjs/common';
import { BaseController } from '../../common/base.controller';
import { SalarioVariableService, SalarioVariable } from './salario-variable.service';

@Controller('salario-variable')
export class SalarioVariableController extends BaseController<SalarioVariable> {
  constructor(private salarioService: SalarioVariableService) { super(salarioService); }

  @Get('con-relaciones')
  findAllWithRelations() {
    return this.salarioService.findAllWithRelations();
  }
}
