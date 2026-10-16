import { Controller, UseGuards } from '@nestjs/common';
import { BaseController } from '../../common/base.controller';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { GruposService, Grupo } from './grupos.service';

@Controller('grupos')
@UseGuards(RolesGuard)
@Roles('Admin')
export class GruposController extends BaseController<Grupo> {
  constructor(service: GruposService) { super(service); }
}
