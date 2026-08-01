import { Controller, Get } from '@nestjs/common';
import { BaseController } from '../../common/base.controller';
import { ClientesService, Cliente } from './clientes.service';

@Controller('clientes')
export class ClientesController extends BaseController<Cliente> {
  constructor(private clientesService: ClientesService) { super(clientesService); }

  @Get('con-grupo')
  findAllWithGrupo() {
    return this.clientesService.findAllWithGrupo();
  }
}
