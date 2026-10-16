import { Body, Controller, Delete, ForbiddenException, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { BaseController } from '../../common/base.controller';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { EntregablesService, Entregable } from './entregables.service';
import type { UsuarioCtx } from './entregables.service';
import { FiltrarEntregablesDto } from './dto/filtrar-entregables.dto';
import { SeguimientoEntregableDto } from './dto/seguimiento.dto';
import { CrearErrorDto } from './dto/error.dto';
import { UsuariosService } from '../usuarios/usuarios.service';

@Controller('entregables')
@UseGuards(RolesGuard)
export class EntregablesController extends BaseController<Entregable> {
  constructor(
    private entregablesService: EntregablesService,
    private usuariosService: UsuariosService,
  ) {
    super(entregablesService);
  }

  /** Usuarios para dropdowns del formulario (accesible por cualquier rol). */
  @Get('usuarios-dropdown')
  getUsuariosDropdown() {
    return this.usuariosService.findAllForDropdown();
  }

  // ⚠️ Las rutas literales van ANTES que el `@Get(':id')` heredado,
  // si no Nest intentaría interpretar "buscar" como un id.

  /** Sobrescribe el findAll base para restringir por rol. */
  @Get()
  findAll(@CurrentUser() usuario?: UsuarioCtx) {
    return this.entregablesService.buscar({}, usuario);
  }

  /** Crear: solo Líder y Admin. */
  @Post()
  create(@Body() dto: Partial<Entregable>, @CurrentUser() usuario?: UsuarioCtx) {
    if (usuario?.rol === 'Analista') {
      throw new ForbiddenException('Los analistas no pueden crear entregables');
    }
    return this.entregablesService.create(dto, usuario);
  }

  /** Editar: solo Líder y Admin. */
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<Entregable>,
    @CurrentUser() usuario?: UsuarioCtx,
  ) {
    if (usuario?.rol === 'Analista') {
      throw new ForbiddenException('Los analistas no pueden editar entregables');
    }
    return this.entregablesService.update(id, dto, usuario);
  }

  /** Listado con filtros dinámicos + cumplimiento calculado. */
  @Get('buscar')
  buscar(@Query() filtros: FiltrarEntregablesDto, @CurrentUser() usuario?: UsuarioCtx) {
    return this.entregablesService.buscar(filtros, usuario);
  }

  /** Totales agregados del conjunto filtrado. */
  @Get('resumen')
  resumen(@Query() filtros: FiltrarEntregablesDto, @CurrentUser() usuario?: UsuarioCtx) {
    return this.entregablesService.resumen(filtros, usuario);
  }

  @Get('con-relaciones')
  findAllWithRelations(@CurrentUser() usuario?: UsuarioCtx) {
    return this.entregablesService.findAllWithRelations(usuario);
  }

  @Get('por-cliente/:id')
  findByCliente(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario?: UsuarioCtx,
  ) {
    return this.entregablesService.findByCliente(id, usuario);
  }

  @Get(':id/historial')
  historial(@Param('id', ParseIntPipe) id: number) {
    return this.entregablesService.historial(id);
  }

  // ── Errores del entregable (tabla hija) ──

  @Get(':id/errores')
  listarErrores(@Param('id', ParseIntPipe) id: number) {
    return this.entregablesService.listarErrores(id);
  }

  @Post(':id/errores')
  crearError(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CrearErrorDto,
    @CurrentUser() usuario?: { sub: number; rol?: string },
  ) {
    return this.entregablesService.crearError(id, dto, usuario);
  }

  @Patch('errores/:errorId')
  actualizarError(
    @Param('errorId', ParseIntPipe) errorId: number,
    @Body() dto: Partial<CrearErrorDto>,
    @CurrentUser() usuario?: { sub: number; rol?: string },
  ) {
    return this.entregablesService.actualizarError(errorId, dto, usuario);
  }

  @Delete('errores/:errorId')
  eliminarError(
    @Param('errorId', ParseIntPipe) errorId: number,
    @CurrentUser() usuario?: { sub: number; rol?: string },
  ) {
    return this.entregablesService.eliminarError(errorId, usuario);
  }

  @Get(':id/detalle')
  detalle(@Param('id', ParseIntPipe) id: number, @CurrentUser() usuario?: UsuarioCtx) {
    return this.entregablesService.findOneConCumplimiento(id, usuario);
  }

  /** Seguimiento: resultado, errores y aprobación. */
  @Patch(':id/seguimiento')
  seguimiento(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SeguimientoEntregableDto,
    // El payload del JWT identifica al usuario en `sub`, no en `id`.
    @CurrentUser() usuario?: { sub: number; rol?: string },
  ) {
    if (dto.aprobado === true && usuario?.rol === 'Analista') {
      throw new ForbiddenException('Los analistas no pueden aprobar entregables');
    }
    return this.entregablesService.registrarSeguimiento(id, dto, usuario);
  }

  /** Eliminar: solo Admin. */
  @Delete(':id')
  @Roles('Admin')
  remove(@Param('id', ParseIntPipe) id: number) {
    return super.remove(id);
  }
}
