import { Controller, Get, Query } from '@nestjs/common';
import { BaseController } from '../../common/base.controller';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ClientesService, Cliente } from './clientes.service';

@Controller('clientes')
export class ClientesController extends BaseController<Cliente> {
  constructor(private clientesService: ClientesService) { super(clientesService); }

  @Get('con-grupo')
  findAllWithGrupo() {
    return this.clientesService.findAllWithGrupo();
  }

  @Get('asignados')
  findAsignados(@CurrentUser() usuario: { sub: number }) {
    return this.clientesService.findByUsuario(usuario.sub);
  }

  @Get('mis-clientes')
  findMisClientes(@CurrentUser() usuario: { sub: number; rol?: string }) {
    return this.clientesService.findMisClientes(usuario.sub, usuario.rol ?? 'Analista');
  }

  @Get('mis-clientes/resumen')
  getResumenCliente(
    @CurrentUser() usuario: { sub: number; rol?: string },
    @Query('cliente_id') clienteId: string,
  ) {
    return this.clientesService.getResumenCliente(Number(clienteId), usuario.sub, usuario.rol ?? 'Analista');
  }
}
