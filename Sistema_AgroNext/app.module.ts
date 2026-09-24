import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma/prisma.service';
import { AuthModule } from './auth/auth.module';
import { TasksModule } from './tasks/tasks.module';
import { FinancialModule } from './financial/financial.module';
import { MeetingsModule } from './meetings/meetings.module';
import { ComplianceModule } from './compliance/compliance.module';
import { AgroModule } from './agro/agro.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    TasksModule,
    FinancialModule,
    ComplianceModule,
    MeetingsModule,
    AgroModule,
  ],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}