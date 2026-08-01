import { Module } from '@nestjs/common';
import { SalarioVariableController } from './salario-variable.controller';
import { SalarioVariableService } from './salario-variable.service';

@Module({ controllers: [SalarioVariableController], providers: [SalarioVariableService] })
export class SalarioVariableModule {}
