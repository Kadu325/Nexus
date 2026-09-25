import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import * as argon2 from "argon2";

@Injectable()
export class ProvisioningService implements OnModuleInit {
  private readonly logger = new Logger(ProvisioningService.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async onModuleInit() {
    const username = this.configService.get<string>("ADMIN_INITIAL_USERNAME");
    const password = this.configService.get<string>("ADMIN_INITIAL_PASSWORD");

    if (!username || !password) return;

    const existingAdmin = await this.prisma.user.findUnique({
      where: { username },
    });
    if (existingAdmin) return;

    try {
      const hashedPassword = await argon2.hash(password, {
        type: argon2.argon2id,
      });

      await this.prisma.$transaction(async (tx) => {
        let org = await tx.organization.findFirst({
          where: { name: "Organização Principal" },
        });
        if (!org) {
          org = await tx.organization.create({
            data: { name: "Organização Principal" },
          });
        }

        await tx.user.create({
          data: {
            username,
            passwordHash: hashedPassword,
            organizationId: org.id,
            role: "ADMIN",
          },
        });
      });
      this.logger.log("Administrador inicial provisionado com sucesso.");
    } catch (error) {
      this.logger.error("Erro ao provisionar administrador", error);
    }
  }
}
