import { Controller, UseGuards } from '@nestjs/common';
import { BaseController } from '../../common/base.controller';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ConceptosService, Concepto } from './conceptos.service';

@Controller('conceptos')
@UseGuards(RolesGuard)
@Roles('Admin')
export class ConceptosController extends BaseController<Concepto> {
  constructor(service: ConceptosService) { super(service); }
}
