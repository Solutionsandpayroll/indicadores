import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

/** Un registro de avance en la bitácora de un entregable. */
export class CrearAvanceDto {
  /** Si se omite, la base usa la fecha de hoy. */
  @IsOptional() @IsDateString()
  fecha?: string;

  @Type(() => Number) @IsNumber() @Min(0) @Max(100)
  pct_avance: number;

  @IsOptional() @IsString()
  observacion?: string;
}
