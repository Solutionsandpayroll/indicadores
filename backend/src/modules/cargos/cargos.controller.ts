import { Controller, UseGuards } from '@nestjs/common';
import { BaseController } from '../../common/base.controller';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CargosService, Cargo } from './cargos.service';

@Controller('cargos')
@UseGuards(RolesGuard)
@Roles('Admin')
export class CargosController extends BaseController<Cargo> {
  constructor(service: CargosService) { super(service); }
}
