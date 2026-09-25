import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import type { AuthCtx } from './auth-context';

const SECRET_KEYS = /pass|senha|token|secret|hash|key/i;

/** Remove campos sensíveis antes de gravar o resumo na trilha de auditoria. */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEYS.test(k) ? '[omitido]' : redact(v);
    }
    return out;
  }
  return value;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger('Auditoria');
  constructor(private readonly prisma: PrismaService) {}

  async log(
    auth: Partial<AuthCtx> | null,
    action: string,
    entity: string,
    entityId?: string | null,
    summary?: unknown,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prisma;
    try {
      await db.auditLog.create({
        data: {
          orgId: auth?.orgId ?? null,
          userId: auth?.userId ?? null,
          action,
          entity,
          entityId: entityId ?? null,
          summary: summary === undefined ? Prisma.JsonNull : (JSON.parse(JSON.stringify(redact(summary))) as Prisma.InputJsonValue),
          ip: auth?.ip ?? null,
        },
      });
    } catch (e) {
      if (tx) throw e; // dentro de transação, a falha da auditoria desfaz a operação
      this.logger.error(`Falha ao registrar auditoria de ${action} ${entity}: ${(e as Error).message}`);
    }
  }
}
