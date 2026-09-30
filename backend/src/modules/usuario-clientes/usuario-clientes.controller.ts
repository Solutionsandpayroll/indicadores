import { Body, Controller, Delete, Get, Param, ParseIntPipe, Put, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { UsuarioClientesService, AsignacionInput } from './usuario-clientes.service';

@Controller('usuario-clientes')
@UseGuards(AdminGuard)
export class UsuarioClientesController {
  constructor(private service: UsuarioClientesService) {}

  @Get()
  findByCliente(@Query('cliente_id') clienteId: string) {
    return this.service.findByCliente(Number(clienteId));
  }

  @Put('sync')
  sync(@Body() dto: { cliente_id: number; asignaciones: AsignacionInput[] }) {
    return this.service.sync(dto.cliente_id, dto.asignaciones ?? []);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
