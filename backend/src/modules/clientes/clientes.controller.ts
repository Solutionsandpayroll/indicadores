import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { BaseController } from '../../common/base.controller';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ClientesService, Cliente } from './clientes.service';

@Controller('clientes')
@UseGuards(RolesGuard)
export class ClientesController extends BaseController<Cliente> {
  constructor(private clientesService: ClientesService) { super(clientesService); }

  @Post()
  @Roles('Admin')
  create(@Body() dto: Partial<Cliente>) {
    return this.clientesService.create(dto);
  }

  @Patch(':id')
  @Roles('Admin')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<Cliente>) {
    return this.clientesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('Admin')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.clientesService.remove(id);
  }

  @Get('con-grupo')
  findAllWithGrupo() {
    return this.clientesService.findAllWithGrupo();
  }

  @Get('asignados')
  findAsignados(@CurrentUser() usuario: { sub: number }) {
    return this.clientesService.findByUsuario(usuario.sub);
  }

  @Get('mis-clientes')
  findMisClientes(
    @CurrentUser() usuario: { sub: number; rol?: string },
    @Query('anio') anio?: string,
    @Query('mes') mes?: string,
  ) {
    const hoy = new Date();
    return this.clientesService.findMisClientes(
      usuario.sub, usuario.rol ?? 'Analista',
      anio ? Number(anio) : hoy.getFullYear(),
      mes ? Number(mes) : hoy.getMonth() + 1,
    );
  }

  @Get('mis-clientes/resumen')
  getResumenCliente(
    @CurrentUser() usuario: { sub: number; rol?: string },
    @Query('cliente_id') clienteId: string,
    @Query('anio') anio?: string,
    @Query('mes') mes?: string,
  ) {
    const hoy = new Date();
    return this.clientesService.getResumenCliente(
      Number(clienteId), usuario.sub, usuario.rol ?? 'Analista',
      anio ? Number(anio) : hoy.getFullYear(),
      mes ? Number(mes) : hoy.getMonth() + 1,
    );
  }
}
