import { Controller } from '@nestjs/common';
import { BaseController } from '../../common/base.controller';
import { ConceptosService, Concepto } from './conceptos.service';

@Controller('conceptos')
export class ConceptosController extends BaseController<Concepto> {
  constructor(service: ConceptosService) { super(service); }
}
