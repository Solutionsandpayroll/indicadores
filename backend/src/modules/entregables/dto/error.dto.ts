import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/** Datos para registrar o editar un error de un entregable. */
export class CrearErrorDto {
  @IsIn(['interno', 'cliente'])
  tipo: 'interno' | 'cliente';

  @IsString() @MaxLength(1000)
  descripcion: string;

  @IsOptional() @IsString() @MaxLength(1000)
  correccion?: string;
}
