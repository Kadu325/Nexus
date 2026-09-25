import {
  Controller,
  Get,
  Param,
  Headers,
  UnauthorizedException,
} from "@nestjs/common";
import { FinancialService } from "./financial.service";

@Controller("financial/projects")
export class FinancialController {
  constructor(private readonly financialService: FinancialService) {}

  @Get(":projectId/indicators")
  async getIndicators(
    @Param("projectId") projectId: string,
    @Headers("x-org-id") orgId: string,
  ) {
    if (!orgId) throw new UnauthorizedException("Tenant não identificado.");
    return this.financialService.getProjectIndicators(projectId, orgId);
  }
}
