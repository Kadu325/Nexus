import {
  Controller,
  Get,
  Param,
  Headers,
  UnauthorizedException,
} from "@nestjs/common";
import { AgroService } from "./agro.service";

@Controller("agro/units")
export class AgroController {
  constructor(private readonly agroService: AgroService) {}

  @Get(":unitId/indicators")
  async getIndicators(
    @Param("unitId") unitId: string,
    @Headers("x-org-id") orgId: string,
  ) {
    if (!orgId) throw new UnauthorizedException("Tenant não identificado.");
    return this.agroService.getIndicatorsByUnit(unitId, orgId);
  }
}
