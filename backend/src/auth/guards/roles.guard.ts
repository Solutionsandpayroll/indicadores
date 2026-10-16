import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Requiere que el rol del JWT esté entre los permitidos por @Roles().
 * Sin @Roles en la ruta, permite el paso (el JwtAuthGuard global ya exigió sesión).
 * Tokens antiguos sin `rol`: se infiere 'Admin' si es_admin; si no, se exige re-login.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    const rol: string | undefined = user?.rol ?? (user?.es_admin ? 'Admin' : undefined);
    if (!rol || !required.includes(rol)) {
      throw new ForbiddenException('Acceso restringido por rol');
    }
    return true;
  }
}
