import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { BaseController } from '../../common/base.controller';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { EntregablesService, Entregable } from './entregables.service';
import { FiltrarEntregablesDto } from './dto/filtrar-entregables.dto';
import { SeguimientoEntregableDto } from './dto/seguimiento.dto';
import { CrearAvanceDto } from './dto/avance.dto';

@Controller('entregables')
export class EntregablesController extends BaseController<Entregable> {
  constructor(private entregablesService: EntregablesService) {
    super(entregablesService);
  }

  // ⚠️ Las rutas literales van ANTES que el `@Get(':id')` heredado,
  // si no Nest intentaría interpretar "buscar" como un id.

  /** Listado con filtros dinámicos + cumplimiento calculado. */
  @Get('buscar')
  buscar(@Query() filtros: FiltrarEntregablesDto) {
    return this.entregablesService.buscar(filtros);
  }

  /** Totales agregados del conjunto filtrado. */
  @Get('resumen')
  resumen(@Query() filtros: FiltrarEntregablesDto) {
    return this.entregablesService.resumen(filtros);
  }

  @Get('con-relaciones')
  findAllWithRelations() {
    return this.entregablesService.findAllWithRelations();
  }

  @Get('por-cliente/:id')
  findByCliente(@Param('id', ParseIntPipe) id: number) {
    return this.entregablesService.findByCliente(id);
  }

  @Get(':id/historial')
  historial(@Param('id', ParseIntPipe) id: number) {
    return this.entregablesService.historial(id);
  }

  // ── Bitácora de avances ──

  @Get(':id/avances')
  avances(@Param('id', ParseIntPipe) id: number) {
    return this.entregablesService.avances(id);
  }

  @Post(':id/avances')
  crearAvance(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CrearAvanceDto,
    @CurrentUser() usuario?: { sub: number },
  ) {
    return this.entregablesService.crearAvance(id, dto, usuario?.sub);
  }

  @Delete(':id/avances/:avanceId')
  eliminarAvance(
    @Param('id', ParseIntPipe) id: number,
    @Param('avanceId', ParseIntPipe) avanceId: number,
  ) {
    return this.entregablesService.eliminarAvance(id, avanceId);
  }

  @Get(':id/detalle')
  detalle(@Param('id', ParseIntPipe) id: number) {
    return this.entregablesService.findOneConCumplimiento(id);
  }

  /** Seguimiento: resultado, errores y aprobación. */
  @Patch(':id/seguimiento')
  seguimiento(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SeguimientoEntregableDto,
    // El payload del JWT identifica al usuario en `sub`, no en `id`.
    @CurrentUser() usuario?: { sub: number },
  ) {
    return this.entregablesService.registrarSeguimiento(id, dto, usuario?.sub);
  }
}
