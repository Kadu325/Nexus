/**
 * Provisionamento idempotente da organização inicial e da conta administrativa (sistema.md, Fundação).
 *
 * - Lê ORG_INITIAL_NAME, ORG_INITIAL_SLUG, ADMIN_INITIAL_USERNAME e ADMIN_INITIAL_PASSWORD do ambiente do backend.
 * - Cria a organização e o usuário somente se ainda não existirem.
 * - Nunca redefine a senha de um usuário existente e nunca imprime a senha.
 * - Grava apenas o hash Argon2id.
 *
 * Uso: npm run provision   (executado também na inicialização do contêiner)
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { hashPassword } from './common/security';

function slugify(s: string) {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

export async function provision(prisma: PrismaClient, env: NodeJS.ProcessEnv = process.env) {
  const orgName = (env.ORG_INITIAL_NAME || 'Organização Inicial').trim();
  const orgSlug = (env.ORG_INITIAL_SLUG || slugify(orgName)).trim();
  const username = (env.ADMIN_INITIAL_USERNAME || '').trim().toLowerCase();
  const password = env.ADMIN_INITIAL_PASSWORD ?? '';

  const org =
    (await prisma.organization.findUnique({ where: { slug: orgSlug } })) ??
    (await prisma.organization.create({ data: { name: orgName, slug: orgSlug } }).catch(async (e) => {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return prisma.organization.findUniqueOrThrow({ where: { slug: orgSlug } });
      }
      throw e;
    }));

  if (!username || !password) {
    const admins = await prisma.membership.count({ where: { orgId: org.id, role: 'ADMIN' } });
    return {
      org: org.slug,
      status: admins > 0 ? 'SEM_ALTERACAO' : 'SEM_CREDENCIAIS',
      message:
        admins > 0
          ? 'Administrador já existente; variáveis de provisionamento ausentes (esperado após a instalação).'
          : 'ATENÇÃO: nenhuma conta administrativa. Defina ADMIN_INITIAL_USERNAME e ADMIN_INITIAL_PASSWORD e reinicie o backend.',
    };
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    const membership = await prisma.membership.findUnique({ where: { userId_orgId: { userId: existing.id, orgId: org.id } } });
    return {
      org: org.slug,
      status: 'JA_PROVISIONADO',
      message: membership
        ? `Usuário "${username}" já existe; senha preservada (não é redefinida pelo provisionamento).`
        : `Usuário "${username}" já existe sem vínculo com "${org.slug}"; nenhuma alteração feita.`,
    };
  }

  const passwordHash = await hashPassword(password);
  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { username, name: 'Administrador', passwordHash, passwordChangedAt: null },
      });
      await tx.membership.create({ data: { userId: user.id, orgId: org.id, role: 'ADMIN' } });
      await tx.auditLog.create({
        data: { orgId: org.id, userId: null, action: 'PROVISIONAR_ADMIN', entity: 'Usuario', entityId: user.id, summary: { username } },
      });
    });
  } catch (e) {
    // outra instância provisionou ao mesmo tempo
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { org: org.slug, status: 'JA_PROVISIONADO', message: 'Provisionado por outra instância.' };
    }
    throw e;
  }
  return { org: org.slug, status: 'CRIADO', message: `Conta "${username}" criada como Administrador de "${org.name}".` };
}

if (require.main === module) {
  const prisma = new PrismaClient();
  provision(prisma)
    .then((r) => {
      console.log(`[provisionamento] ${r.status}: ${r.message}`);
    })
    .catch((e) => {
      console.error(`[provisionamento] falhou: ${(e as Error).message}`);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
