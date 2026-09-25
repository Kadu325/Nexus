import { Module } from "@nestjs/common";
import { AgroController } from "./agro.controller";
import { AgroService } from "./agro.service";
import { PrismaService } from "../prisma/prisma.service";

@Module({
  controllers: [AgroController],
  providers: [AgroService, PrismaService],
})
export class AgroModule {}
