import { Body, Controller, Delete, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { BaseController } from '../../common/base.controller';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { EstatusService, Estatus } from './estatus.service';

@Controller('estatus')
@UseGuards(RolesGuard)
export class EstatusController extends BaseController<Estatus> {
  constructor(service: EstatusService) { super(service); }

  @Post()
  @Roles('Admin')
  create(@Body() dto: Partial<Estatus>) {
    return super.create(dto);
  }

  @Patch(':id')
  @Roles('Admin')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<Estatus>) {
    return super.update(id, dto);
  }

  @Delete(':id')
  @Roles('Admin')
  remove(@Param('id', ParseIntPipe) id: number) {
    return super.remove(id);
  }
}
