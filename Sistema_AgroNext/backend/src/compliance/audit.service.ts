import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuditService {
  constructor(private defaultPrisma: PrismaService) {}

  /**
   * Registra eventos na trilha de auditoria. Aceita transação opcional[cite: 2].
   */
  async logAction(
    prismaClient: any,
    data: {
      action: "CREATE" | "UPDATE" | "DELETE" | "EXPORT" | "LOGIN";
      entity: string;
      entityId?: string;
      userId: string;
      details: any;
      ipAddress?: string;
    },
  ) {
    const client = prismaClient || this.defaultPrisma;
    return client.auditLog.create({
      data: {
        action: data.action,
        entity: data.entity,
        entityId: data.entityId,
        userId: data.userId,
        details: data.details,
        ipAddress: data.ipAddress,
      },
    });
  }

  async getAuditTrail(entity: string, entityId: string, orgId: string) {
    return this.defaultPrisma.auditLog.findMany({
      where: {
        entity,
        entityId,
        user: { organizationId: orgId }, // Garante isolamento de tenant[cite: 2]
      },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { username: true } } },
    });
  }
}
