import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  async getBoardTasks(projectId: string, organizationId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId }
    });

    if (!project) throw new UnauthorizedException('Projeto não encontrado ou acesso negado.');

    return this.prisma.task.findMany({
      where: { projectId },
      include: { assignee: { select: { id: true, username: true } } },
      orderBy: { createdAt: 'asc' }
    });
  }

  async updateTaskStatus(taskId: string, newStatus: string, organizationId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, project: { organizationId } }
    });

    if (!task) throw new UnauthorizedException('Acesso negado à tarefa.');

    return this.prisma.task.update({
      where: { id: taskId },
      data: { status: newStatus }
    });
  }
}