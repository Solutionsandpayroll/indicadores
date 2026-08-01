import { Module } from '@nestjs/common';
import { TipoRcaController } from './tipo-rca.controller';
import { TipoRcaService } from './tipo-rca.service';

@Module({ controllers: [TipoRcaController], providers: [TipoRcaService] })
export class TipoRcaModule {}
