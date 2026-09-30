import { Module } from '@nestjs/common';
import { SalarioVariableAdminController } from './salario-variable-admin.controller';
import { SalarioVariableAdminService } from './salario-variable-admin.service';
import { CumplimientoService } from './cumplimiento.service';
import { ResultadosPagoService } from './resultados-pago.service';

@Module({
  controllers: [SalarioVariableAdminController],
  providers: [SalarioVariableAdminService, CumplimientoService, ResultadosPagoService],
})
export class SalarioVariableAdminModule {}
