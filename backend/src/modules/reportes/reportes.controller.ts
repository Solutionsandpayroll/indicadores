import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ReportesService } from './reportes.service';

@Controller('reportes')
@UseGuards(JwtAuthGuard)
export class ReportesController {
  constructor(private service: ReportesService) {}

  @Get()
  getReporteCliente(
    @Query('cliente_id') clienteId: string,
    @Query('anio_desde') anioDesde: string,
    @Query('mes_desde') mesDesde: string,
    @Query('anio_hasta') anioHasta: string,
    @Query('mes_hasta') mesHasta: string,
    @CurrentUser() usuario?: { sub: number; rol?: string },
  ) {
    return this.service.getReporteCliente({
      cliente_id: Number(clienteId),
      anio_desde: Number(anioDesde),
      mes_desde: Number(mesDesde),
      anio_hasta: Number(anioHasta),
      mes_hasta: Number(mesHasta),
    });
  }

  @Get('clientes-accesibles')
  getClientesAccesibles(@CurrentUser() usuario?: { sub: number; rol?: string }) {
    return this.service.getClientesAccesibles(usuario?.sub ?? 0, usuario?.rol ?? 'Analista');
  }
}
