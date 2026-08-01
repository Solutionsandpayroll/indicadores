import { Module } from '@nestjs/common';
import { EntregablesController } from './entregables.controller';
import { EntregablesService } from './entregables.service';

@Module({ controllers: [EntregablesController], providers: [EntregablesService] })
export class EntregablesModule {}
