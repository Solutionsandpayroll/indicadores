import { Module } from '@nestjs/common';
import { ConceptosController } from './conceptos.controller';
import { ConceptosService } from './conceptos.service';

@Module({ controllers: [ConceptosController], providers: [ConceptosService] })
export class ConceptosModule {}
