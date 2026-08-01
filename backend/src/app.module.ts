import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { GruposModule } from './modules/grupos/grupos.module';
import { IndicadoresModule } from './modules/indicadores/indicadores.module';
import { CargosModule } from './modules/cargos/cargos.module';
import { ConceptosModule } from './modules/conceptos/conceptos.module';
import { TipoRcaModule } from './modules/tipo-rca/tipo-rca.module';
import { EstatusModule } from './modules/estatus/estatus.module';
import { ClientesModule } from './modules/clientes/clientes.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { EntregablesModule } from './modules/entregables/entregables.module';
import { EntregableTiposModule } from './modules/entregable-tipos/entregable-tipos.module';
import { RcaModule } from './modules/rca/rca.module';
import { SalarioVariableModule } from './modules/salario-variable/salario-variable.module';
import { StatsModule } from './modules/stats/stats.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SupabaseModule,
    AuthModule,
    GruposModule,
    IndicadoresModule,
    CargosModule,
    ConceptosModule,
    TipoRcaModule,
    EstatusModule,
    ClientesModule,
    UsuariosModule,
    EntregablesModule,
    EntregableTiposModule,
    RcaModule,
    SalarioVariableModule,
    StatsModule,
  ],
})
export class AppModule {}
