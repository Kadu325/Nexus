import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Role } from '@prisma/client';

export interface AuthCtx {
  userId: string;
  orgId: string;
  role: Role;
  sessionId: string;
  username: string;
  name: string;
  ip?: string;
}

export const IS_PUBLIC = 'fpx:isPublic';
export const ROLES = 'fpx:roles';

/** Rota acessível sem sessão (login, health). */
export const Public = () => SetMetadata(IS_PUBLIC, true);
/** Papéis autorizados; sem o decorador, qualquer membro autenticado da organização. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export const Auth = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthCtx => {
  const req = ctx.switchToHttp().getRequest();
  return req.auth;
});

export const R = {
  ALL: ['ADMIN', 'PMO', 'GERENTE', 'MEMBRO', 'LEITOR'] as Role[],
  WORKERS: ['ADMIN', 'PMO', 'GERENTE', 'MEMBRO'] as Role[],
  MANAGE: ['ADMIN', 'PMO', 'GERENTE'] as Role[],
  PMO: ['ADMIN', 'PMO'] as Role[],
  ADMIN: ['ADMIN'] as Role[],
};
