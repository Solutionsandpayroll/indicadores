import { Controller, Get, Post, Patch, Delete, Param, Body, ParseIntPipe, UseGuards } from '@nestjs/common';
import { UsuariosService, Usuario } from './usuarios.service';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';

@Controller('usuarios')
@UseGuards(RolesGuard)
export class UsuariosController {
  constructor(private service: UsuariosService) {}

  /** Lista para dropdowns/filtros: cualquier rol autenticado (no expone campos sensibles). */
  @Get()
  findAll() { return this.service.findAll(); }

  @Get(':id')
  @Roles('Admin')
  findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }

  @Post()
  @Roles('Admin')
  create(@Body() dto: Partial<Usuario>) { return this.service.create(dto); }

  @Patch(':id')
  @Roles('Admin')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<Usuario>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('Admin')
  remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}
