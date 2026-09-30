import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { QuejasService } from './quejas.service';
import type { CrearQuejaDto } from './quejas.service';

@Controller('quejas')
@UseGuards(AdminGuard)
export class QuejasController {
  constructor(private service: QuejasService) {}

  @Get()
  buscar(
    @Query('cliente_id') clienteId?: string,
    @Query('anio') anio?: string,
    @Query('mes') mes?: string,
    @Query('usuario_id') usuarioId?: string,
  ) {
    return this.service.buscar({
      cliente_id: clienteId ? Number(clienteId) : undefined,
      anio: anio ? Number(anio) : undefined,
      mes: mes ? Number(mes) : undefined,
      usuario_id: usuarioId ? Number(usuarioId) : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CrearQuejaDto, @CurrentUser() usuario?: { sub: number }) {
    return this.service.create(dto, usuario?.sub);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<CrearQuejaDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
