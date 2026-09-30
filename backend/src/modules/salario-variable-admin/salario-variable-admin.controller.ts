import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { SalarioVariableAdminService } from './salario-variable-admin.service';
import { CumplimientoService } from './cumplimiento.service';
import { ResultadosPagoService } from './resultados-pago.service';

@Controller('salario-variable-admin')
export class SalarioVariableAdminController {
  constructor(
    private svc: SalarioVariableAdminService,
    private cumplimiento: CumplimientoService,
    private resultadosPago: ResultadosPagoService,
  ) {}

  // ── Cumplimiento consolidado (accesible a todos los roles, con alcance) ──
  @Get('cumplimiento')
  getCumplimiento(
    @Query('anio') anio: string,
    @Query('mes') mes: string,
    @Query('usuario_id') usuarioId?: string,
    @Query('cliente_id') clienteId?: string,
    @Query('rol') rol?: string,
    @Query('aprobado') aprobado?: string,
    @CurrentUser() usuario?: { sub: number; rol?: string },
  ) {
    return this.cumplimiento.getResumen(
      {
        anio: Number(anio),
        mes: Number(mes),
        usuarioId: usuarioId ? Number(usuarioId) : undefined,
        clienteId: clienteId ? Number(clienteId) : undefined,
        rol: rol || undefined,
        aprobado: aprobado === undefined || aprobado === '' ? undefined : aprobado === 'true',
      },
      usuario ?? { sub: 0, rol: 'Analista' },
    );
  }

  // ---- SECCIÓN 1: Configuración por Perfil ----
  @Get('config')
  getConfig() { return this.svc.getConfig(); }

  @Post('config')
  createConfig(@Body() dto: Record<string, unknown>) { return this.svc.createConfig(dto as never); }

  @Patch('config/:id')
  updateConfig(@Param('id', ParseIntPipe) id: number, @Body() dto: Record<string, unknown>) {
    return this.svc.updateConfig(id, dto as never);
  }

  @Delete('config/:id')
  deleteConfig(@Param('id', ParseIntPipe) id: number) { return this.svc.deleteConfig(id); }

  // ---- SECCIÓN 2: Valores de Variable ----
  @Get('valores')
  getValores(@Query('anio') anio?: string, @Query('mes') mes?: string) {
    return this.svc.getValores(anio ? Number(anio) : undefined, mes ? Number(mes) : undefined);
  }

  @Post('valores')
  createValor(@Body() dto: Record<string, unknown>) { return this.svc.createValor(dto as never); }

  @Patch('valores/:id')
  updateValor(@Param('id', ParseIntPipe) id: number, @Body() dto: Record<string, unknown>) {
    return this.svc.updateValor(id, dto as never);
  }

  @Delete('valores/:id')
  deleteValor(@Param('id', ParseIntPipe) id: number) { return this.svc.deleteValor(id); }

  @Get('valores/:id/historial')
  getHistorial(@Param('id', ParseIntPipe) id: number) { return this.svc.getHistorial(id); }

  // ---- SECCIÓN 3: Casos Especiales ----
  @Get('casos')
  getCasos() { return this.svc.getCasos(); }

  @Post('casos')
  createCaso(@Body() dto: Record<string, unknown>) { return this.svc.createCaso(dto as never); }

  @Patch('casos/:id')
  updateCaso(@Param('id', ParseIntPipe) id: number, @Body() dto: Record<string, unknown>) {
    return this.svc.updateCaso(id, dto as never);
  }

  @Delete('casos/:id')
  deleteCaso(@Param('id', ParseIntPipe) id: number) { return this.svc.deleteCaso(id); }

  // ---- SECCIÓN 4: Resultados de pago ----
  // Calculados en vivo desde Cumplimiento + configuración. No se persisten.
  @Get('resultados-pago')
  getResultadosPago(
    @Query('anio') anio: string,
    @Query('mes') mes: string,
    @Query('usuario_id') usuarioId?: string,
    @Query('cliente_id') clienteId?: string,
    @Query('rol') rol?: string,
    @CurrentUser() usuario?: { sub: number; rol?: string },
  ) {
    return this.resultadosPago.getResultados(
      {
        anio: Number(anio),
        mes: Number(mes),
        usuarioId: usuarioId ? Number(usuarioId) : undefined,
        clienteId: clienteId ? Number(clienteId) : undefined,
        rol: rol || undefined,
      },
      usuario ?? { sub: 0, rol: 'Analista' },
    );
  }
}
