import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { BaseController } from '../../common/base.controller';
import { EntregableTiposService, EntregableTipo } from './entregable-tipos.service';

@Controller('entregable-tipos')
export class EntregableTiposController extends BaseController<EntregableTipo> {
  constructor(private tiposService: EntregableTiposService) { super(tiposService); }

  // Las rutas literales van antes del `@Get(':id')` heredado.

  @Get('con-indicador')
  findAllConIndicador() {
    return this.tiposService.findAllConIndicador();
  }

  @Get('por-indicador/:id')
  findByIndicador(@Param('id', ParseIntPipe) id: number) {
    return this.tiposService.findByIndicador(id);
  }
}
