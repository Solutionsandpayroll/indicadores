import { Body, Controller, Delete, ForbiddenException, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { BaseController } from '../../common/base.controller';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
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

  /** Conceptos visibles de un cliente + indicador (nuevo modelo). */
  @Get('por-cliente-indicador')
  findByClienteIndicador(
    @Query('cliente_id') clienteId: string,
    @Query('indicador_id') indicadorId: string,
  ) {
    return this.tiposService.findByClienteIndicador(Number(clienteId), Number(indicadorId));
  }

  /** Crear conceptos: Admin y Líder (solo sus clientes, validado en servicio). */
  @Post()
  create(@Body() dto: Partial<EntregableTipo>, @CurrentUser() usuario?: { sub: number; rol?: string }) {
    if (usuario?.rol === 'Analista') {
      throw new ForbiddenException('Los analistas no pueden crear conceptos del catálogo');
    }
    return this.tiposService.create(dto, usuario);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<EntregableTipo>,
    @CurrentUser() usuario?: { sub: number; rol?: string },
  ) {
    if (usuario?.rol === 'Analista') {
      throw new ForbiddenException('Los analistas no pueden editar conceptos del catálogo');
    }
    return this.tiposService.update(id, dto, usuario);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() usuario?: { sub: number; rol?: string }) {
    if (usuario?.rol === 'Analista') {
      throw new ForbiddenException('Los analistas no pueden eliminar conceptos del catálogo');
    }
    return this.tiposService.remove(id, usuario);
  }
}
