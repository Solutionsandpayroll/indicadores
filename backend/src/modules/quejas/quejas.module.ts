import { Module } from '@nestjs/common';
import { QuejasController } from './quejas.controller';
import { QuejasService } from './quejas.service';

@Module({
  controllers: [QuejasController],
  providers: [QuejasService],
})
export class QuejasModule {}
