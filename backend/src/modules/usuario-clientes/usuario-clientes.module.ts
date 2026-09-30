import { Module } from '@nestjs/common';
import { UsuarioClientesController } from './usuario-clientes.controller';
import { UsuarioClientesService } from './usuario-clientes.service';

@Module({
  controllers: [UsuarioClientesController],
  providers: [UsuarioClientesService],
})
export class UsuarioClientesModule {}
