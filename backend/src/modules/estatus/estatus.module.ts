import { Module } from '@nestjs/common';
import { EstatusController } from './estatus.controller';
import { EstatusService } from './estatus.service';

@Module({ controllers: [EstatusController], providers: [EstatusService] })
export class EstatusModule {}
