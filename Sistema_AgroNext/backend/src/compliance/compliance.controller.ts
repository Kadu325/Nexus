import {
  Controller,
  Get,
  Query,
  Headers,
  UnauthorizedException,
} from "@nestjs/common";
import { AuditService } from "./audit.service";

@Controller("compliance/audit")
export class ComplianceController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async getAuditLogs(
    @Query("entity") entity: string,
    @Query("entityId") entityId: string,
    @Headers("x-org-id") orgId: string,
  ) {
    if (!orgId) throw new UnauthorizedException("Tenant não identificado.");
    return this.auditService.getAuditTrail(entity, entityId, orgId);
  }
}
