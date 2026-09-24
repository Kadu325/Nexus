import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../compliance/audit.service';

@Injectable()
export class MeetingsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService
  ) {}

  async generateMinuteDraft(meetingId: string, transcript: string, orgId: string) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, project: { organizationId: orgId } }
    });
    if (!meeting) throw new UnauthorizedException('Reunião não encontrada no seu tenant.');

    // Simulação da chamada ao provedor de IA com limites
    const draftContent = "Rascunho gerado pela IA com base na transcrição...";
    const aiActions = [
      { description: "Validar contrato de fornecedores", rawAssignee: "Marcos", dueDate: new Date() }
    ];

    return this.prisma.$transaction(async (tx) => {
      const minute = await tx.meetingMinute.create({
        data: { meetingId, content: draftContent, status: 'DRAFT' } // IA não aprova
      });

      for (const action of aiActions) {
        await tx.meetingAction.create({
          data: {
            minuteId: minute.id,
            description: action.description,
            rawAssignee: action.rawAssignee,
            dueDate: action.dueDate,
            status: 'PENDING'
          }
        });
      }
      return minute;
    });
  }

  async authorizeActionToTask(actionId: string, resolvedUserId: string, projectId: string, orgId: string, authorizerId: string) {
    return this.prisma.$transaction(async (tx) => {
      const action = await tx.meetingAction.findFirst({
        where: { id: actionId, minute: { meeting: { project: { organizationId: orgId } } } }
      });
      
      if (!action) throw new BadRequestException('Ação não encontrada.');
      
      // Regra de deduplicação e idempotência
      if (action.taskId || action.status === 'AUTHORIZED') {
        throw new BadRequestException('Esta ação já foi transformada em tarefa.');
      }

      const user = await tx.user.findFirst({ where: { id: resolvedUserId, organizationId: orgId } });
      if (!user) throw new BadRequestException('Usuário atribuído inválido.');

      const task = await tx.task.create({
        data: {
          title: action.description,
          status: 'TODO',
          dueDate: action.dueDate,
          assigneeId: resolvedUserId,
          projectId: projectId
        }
      });

      await tx.meetingAction.update({
        where: { id: actionId },
        data: { status: 'AUTHORIZED', resolvedUserId, taskId: task.id }
      });

      // Trilha de auditoria obrigatória para automações
      await this.auditService.logAction(tx, {
        action: 'CREATE',
        entity: 'Task',
        entityId: task.id,
        userId: authorizerId,
        details: { source: 'MeetingAction', actionId: action.id }
      });

      return task;
    });
  }
}