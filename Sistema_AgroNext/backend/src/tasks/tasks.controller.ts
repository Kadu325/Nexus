import { Controller, Get, Param, Patch, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { TasksService } from './tasks.service';

@Controller('projects/:projectId/tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  async getTasks(@Param('projectId') projectId: string, @Headers('x-org-id') orgId: string) {
    if (!orgId) throw new UnauthorizedException('Tenant não identificado.');
    return this.tasksService.getBoardTasks(projectId, orgId);
  }

  @Patch(':taskId/status')
  async updateStatus(
    @Param('taskId') taskId: string, 
    @Body('status') status: string,
    @Headers('x-org-id') orgId: string
  ) {
    if (!orgId) throw new UnauthorizedException('Tenant não identificado.');
    return this.tasksService.updateTaskStatus(taskId, status, orgId);
  }
}