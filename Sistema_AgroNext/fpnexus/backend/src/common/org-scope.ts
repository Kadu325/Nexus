import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from './prisma.service';
import type { Prisma } from '@prisma/client';

type Db = PrismaService | Prisma.TransactionClient;

/** Modelos com orgId que podem ser referenciados por outros registros. */
export type OrgModel =
  | 'portfolio'
  | 'program'
  | 'project'
  | 'task'
  | 'costCenter'
  | 'contract'
  | 'unit'
  | 'resource'
  | 'itSystem'
  | 'framework'
  | 'control'
  | 'season'
  | 'agroIndicator'
  | 'meeting'
  | 'document';

/** Tipo especial: o id deve ser de um usuário vinculado à organização. */
export type RefKind = OrgModel | 'member';

/**
 * Garante que cada referência informada pertence à organização da sessão.
 * Impede que um usuário associe (ou leia via relação) registros de outra organização.
 */
export async function assertRefs(db: Db, orgId: string, data: Record<string, unknown>, refs: Record<string, RefKind>) {
  for (const [field, kind] of Object.entries(refs)) {
    const id = data[field];
    if (id === undefined || id === null || id === '') continue;
    if (typeof id !== 'string') throw new BadRequestException(`Referência inválida em ${field}.`);
    const ok =
      kind === 'member'
        ? (await db.membership.count({ where: { orgId, userId: id } })) === 1
        : (await (db as any)[kind].count({ where: { id, orgId } })) === 1;
    if (!ok) throw new BadRequestException(`Referência inválida em ${field}.`);
  }
}

export async function findInOrg<T = any>(db: Db, model: OrgModel | string, id: string, orgId: string, args: object = {}): Promise<T> {
  const row = await (db as any)[model].findFirst({ where: { id, orgId }, ...args });
  if (!row) throw new NotFoundException('Registro não encontrado.');
  return row as T;
}
