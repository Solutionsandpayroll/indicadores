import { Module } from '@nestjs/common';
import { EntregableTiposController } from './entregable-tipos.controller';
import { EntregableTiposService } from './entregable-tipos.service';

@Module({ controllers: [EntregableTiposController], providers: [EntregableTiposService] })
export class EntregableTiposModule {}
