import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { BaseController } from '../../common/base.controller';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { IndicadoresService, Indicador } from './indicadores.service';

@Controller('indicadores')
export class IndicadoresController extends BaseController<Indicador> {
  constructor(private indicadoresService: IndicadoresService) { super(indicadoresService); }

  @Get()
  findAll() { return this.indicadoresService.findAll(); }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) { return this.indicadoresService.findOne(id); }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: Partial<Indicador>) { return this.indicadoresService.create(dto); }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<Indicador>) {
    return this.indicadoresService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id', ParseIntPipe) id: number) { return this.indicadoresService.remove(id); }
}
