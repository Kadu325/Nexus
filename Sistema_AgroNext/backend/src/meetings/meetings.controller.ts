import {
  Controller,
  Post,
  Param,
  Body,
  Headers,
  UnauthorizedException,
} from "@nestjs/common";
import { MeetingsService } from "./meetings.service";

@Controller("meetings")
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Post(":meetingId/draft")
  async createDraft(
    @Param("meetingId") meetingId: string,
    @Body("transcript") transcript: string,
    @Headers("x-org-id") orgId: string,
  ) {
    if (!orgId) throw new UnauthorizedException("Tenant não identificado.");
    return this.meetingsService.generateMinuteDraft(
      meetingId,
      transcript,
      orgId,
    );
  }

  @Post("actions/:actionId/authorize")
  async authorizeAction(
    @Param("actionId") actionId: string,
    @Body() body: { resolvedUserId: string; projectId: string },
    @Headers("x-org-id") orgId: string,
    @Headers("x-user-id") userId: string,
  ) {
    if (!orgId || !userId)
      throw new UnauthorizedException("Identidade não fornecida.");
    return this.meetingsService.authorizeActionToTask(
      actionId,
      body.resolvedUserId,
      body.projectId,
      orgId,
      userId,
    );
  }
}
