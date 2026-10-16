import { Controller, Get, UseGuards } from '@nestjs/common';
import { BaseController } from '../../common/base.controller';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { SalarioVariableService, SalarioVariable } from './salario-variable.service';

@Controller('salario-variable')
@UseGuards(RolesGuard)
@Roles('Admin')
export class SalarioVariableController extends BaseController<SalarioVariable> {
  constructor(private salarioService: SalarioVariableService) { super(salarioService); }

  @Get('con-relaciones')
  findAllWithRelations() {
    return this.salarioService.findAllWithRelations();
  }
}
