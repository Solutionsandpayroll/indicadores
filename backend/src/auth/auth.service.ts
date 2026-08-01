import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { SupabaseService } from '../supabase/supabase.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private supabase: SupabaseService,
    private jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const { data, error } = await this.supabase.db
      .from('usuarios')
      .select('id, usuario, contrasena, nombre, es_admin, cargo_id, grupo_id, activo')
      .eq('usuario', dto.usuario)
      .single();

    if (error || !data) throw new UnauthorizedException('Credenciales inválidas');
    if (!data.activo) throw new UnauthorizedException('Usuario inactivo');

    const match = await bcrypt.compare(dto.contrasena, data.contrasena);
    if (!match) throw new UnauthorizedException('Credenciales inválidas');

    const payload = {
      sub: data.id,
      usuario: data.usuario,
      nombre: data.nombre,
      es_admin: data.es_admin,
      cargo_id: data.cargo_id,
      grupo_id: data.grupo_id,
    };

    return {
      access_token: this.jwt.sign(payload),
      usuario: {
        id: data.id,
        usuario: data.usuario,
        nombre: data.nombre,
        es_admin: data.es_admin,
        cargo_id: data.cargo_id,
        grupo_id: data.grupo_id,
      },
    };
  }
}
