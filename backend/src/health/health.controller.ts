import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';

/**
 * Sonda de salud para Render.
 *
 * Debe ser pública y no tocar Supabase: el health check solo confirma que el
 * proceso acepta conexiones. Si dependiera de la base, una caída de Supabase
 * tumbaría el despliegue entero.
 */
@Controller('salud')
export class HealthController {
  @Public()
  @Get()
  check() {
    return { estado: 'ok', hora: new Date().toISOString() };
  }
}
