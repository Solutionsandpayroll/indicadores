import { Module } from '@nestjs/common';
import { EntregablesController } from './entregables.controller';
import { EntregablesService } from './entregables.service';
import { UsuariosModule } from '../usuarios/usuarios.module';

@Module({
  imports: [UsuariosModule],
  controllers: [EntregablesController],
  providers: [EntregablesService],
})
export class EntregablesModule {}
