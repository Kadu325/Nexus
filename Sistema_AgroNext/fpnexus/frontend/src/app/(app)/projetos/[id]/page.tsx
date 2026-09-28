'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useApi } from '@/lib/hooks';
import { fmtDate, fmtMoney, wbsCompare } from '@/lib/format';
import { label, options } from '@/lib/labels';
import { projectFields } from '@/lib/fields';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { DemoBadge, Empty, ErrorBox, Loading, PageHeader, StatusBadge } from '@/components/common';
import { EntityForm } from '@/components/entity-form';
import { CrudSection } from '@/components/crud-section';
import { ROLES, useSession } from '@/components/session';
import { Kanban } from '@/components/project/kanban';
import { Gantt } from '@/components/project/gantt';
import { TaskDialog } from '@/components/project/task-dialog';
import { ProjectOverview } from '@/components/project/overview';
import { BusinessCaseTab, CharterTab } from '@/components/project/charter';

function depthMap(tasks: any[]) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const depth = (t: any, guard = 0): number => (t.parentId && byId.has(t.parentId) && guard < 20 ? 1 + depth(byId.get(t.parentId), guard + 1) : 0);
  return new Map(tasks.map((t) => [t.id, depth(t)]));
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { can, me, memberName } = useSession();
  const project = useApi<any>(`/projects/${id}`);
  const tasks = useApi<any>(`/projects/${id}/tasks`);
  const schedule = useApi<any>(`/projects/${id}/schedule`);
  const [taskId, setTaskId] = React.useState<string | null>(search.get('tarefa'));
  const [taskOpen, setTaskOpen] = React.useState<boolean>(!!search.get('tarefa'));
  const [defaults, setDefaults] = React.useState<Record<string, unknown> | undefined>();
  const [editProject, setEditProject] = React.useState(false);
  const currency = me?.organization.currency ?? 'BRL';

  const refresh = () => {
    tasks.reload();
    schedule.reload();
  };
  const openTask = (tid: string | null, d?: Record<string, unknown>) => {
    setTaskId(tid);
    setDefaults(d);
    setTaskOpen(true);
  };

  if (project.error) return <ErrorBox message={project.error} onRetry={project.reload} />;
  if (!project.data) return <Loading />;
  const p = project.data;
  const list: any[] = tasks.data?.tasks ?? [];
  const sorted = [...list].sort((a, b) => wbsCompare(a.wbsCode, b.wbsCode));
  const depths = depthMap(list);

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/projetos" className="text-tech hover:underline">
          Projetos
        </Link>{' '}
        › {p.code}
      </p>
      <PageHeader
        title={`${p.code} — ${p.name}`}
        description={`${label('projectType', p.type)} · ${fmtDate(p.startDate)} a ${fmtDate(p.endDate)}`}
        actions={
          <>
            <DemoBadge show={p.isDemo} />
            <StatusBadge group="projectStatus" value={p.status} />
            {can(ROLES.MANAGE) ? (
              <Button variant="secondary" onClick={() => setEditProject(true)}>
                Editar projeto
              </Button>
            ) : null}
            {can(ROLES.MANAGE) ? (
              <Button onClick={() => openTask(null)}>
                <Plus aria-hidden /> Nova tarefa
              </Button>
            ) : null}
          </>
        }
      />
      <Tabs defaultValue={search.get('aba') ?? 'visao'}>
        <TabsList>
          <TabsTrigger value="visao">Visão geral</TabsTrigger>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="gantt">Cronograma</TabsTrigger>
          <TabsTrigger value="eap">EAP</TabsTrigger>
          <TabsTrigger value="tap">TAP</TabsTrigger>
          <TabsTrigger value="bc">Business Case</TabsTrigger>
          <TabsTrigger value="riscos">Riscos</TabsTrigger>
          <TabsTrigger value="stakeholders">Stakeholders</TabsTrigger>
          <TabsTrigger value="reunioes">Reuniões</TabsTrigger>
        </TabsList>
        <TabsContent value="visao">
          <ProjectOverview project={p} onChanged={project.reload} />
        </TabsContent>
        <TabsContent value="kanban">
          {tasks.loading && !tasks.data ? <Loading /> : <Kanban tasks={list} wipLimits={p.wipLimits ?? {}} onChanged={refresh} onOpen={(tid) => openTask(tid)} />}
        </TabsContent>
        <TabsContent value="gantt">
          {schedule.error ? <ErrorBox message={schedule.error} /> : null}
          {schedule.data ? <Gantt schedule={schedule.data} onOpen={(tid) => openTask(tid)} /> : <Loading />}
        </TabsContent>
        <TabsContent value="eap">
          <Card>
            <CardHeader>
              <CardTitle>Estrutura Analítica do Projeto</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {list.length === 0 ? (
                <div className="p-4">
                  <Empty text="Sem tarefas. Crie os pacotes de trabalho da EAP." />
                </div>
              ) : (
                <Table>
                  <THead>
                    <tr>
                      <TH>EAP</TH>
                      <TH>Pacote / tarefa</TH>
                      <TH>Responsável</TH>
                      <TH>Período</TH>
                      <TH className="text-right">Orçamento</TH>
                      <TH>Status</TH>
                      {can(ROLES.MANAGE) ? <TH /> : null}
                    </tr>
                  </THead>
                  <TBody>
                    {sorted.map((t) => (
                      <TR key={t.id}>
                        <TD className="tabular-nums text-muted">{t.wbsCode ?? '—'}</TD>
                        <TD>
                          <button className="text-left font-medium hover:text-tech" style={{ paddingLeft: `${(depths.get(t.id) ?? 0) * 20}px` }} onClick={() => openTask(t.id)}>
                            {t.isMilestone ? '◆ ' : ''}
                            {t.title}
                          </button>
                          {t.description ? <p className="line-clamp-1 text-xs text-subtle" style={{ paddingLeft: `${(depths.get(t.id) ?? 0) * 20}px` }}>{t.description}</p> : null}
                        </TD>
                        <TD>{memberName(t.assigneeId)}</TD>
                        <TD className="whitespace-nowrap">{t.startDate && t.endDate ? `${fmtDate(t.startDate)} a ${fmtDate(t.endDate)}` : 'Não agendada'}</TD>
                        <TD className="text-right tabular-nums">{fmtMoney(t.budget, currency)}</TD>
                        <TD>
                          <StatusBadge group="taskStatus" value={t.status} /> <span className="text-xs text-muted">{t.progress}%</span>
                        </TD>
                        {can(ROLES.MANAGE) ? (
                          <TD className="text-right">
                            <Button size="sm" variant="ghost" onClick={() => openTask(null, { parentId: t.id, wbsCode: t.wbsCode ? `${t.wbsCode}.` : '' })}>
                              + Subtarefa
                            </Button>
                          </TD>
                        ) : null}
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="tap">
          <CharterTab projectId={id} />
        </TabsContent>
        <TabsContent value="bc">
          <BusinessCaseTab projectId={id} />
        </TabsContent>
        <TabsContent value="riscos">
          <CrudSection
            title="Registro de riscos"
            description="Exposição = probabilidade × impacto (1–5 cada). Faixas: baixa 1–4, moderada 5–9, alta 10–14, crítica 15–25."
            entityName="risco"
            path="/risks"
            query={`projectId=${id}`}
            fixed={{ projectId: id }}
            writeRoles={ROLES.MANAGE}
            deleteRoles={ROLES.PMO}
            fields={[
              { name: 'title', label: 'Risco', required: true, full: true },
              { name: 'probability', label: 'Probabilidade (1–5)', type: 'number', required: true, min: 1, max: 5 },
              { name: 'impact', label: 'Impacto (1–5)', type: 'number', required: true, min: 1, max: 5 },
              { name: 'category', label: 'Categoria' },
              { name: 'status', label: 'Status', type: 'select', options: options('riskStatus') },
              { name: 'ownerId', label: 'Responsável', type: 'member' },
              { name: 'contingency', label: 'Reserva de contingência', type: 'money' },
              { name: 'response', label: 'Resposta planejada', type: 'textarea' },
              { name: 'description', label: 'Descrição', type: 'textarea' },
            ]}
            columns={[
              { key: 'title', label: 'Risco', render: (r: any) => <span className="font-medium">{r.title}</span> },
              { key: 'pi', label: 'P × I', render: (r: any) => `${r.probability} × ${r.impact} = ${r.exposure}`, className: 'tabular-nums' },
              { key: 'band', label: 'Faixa', render: (r: any) => <StatusBadge group="band" value={r.band} /> },
              { key: 'status', label: 'Status', render: (r: any) => <StatusBadge group="riskStatus" value={r.status} /> },
              { key: 'owner', label: 'Responsável', render: (r: any) => memberName(r.ownerId) },
            ]}
          />
        </TabsContent>
        <TabsContent value="stakeholders">
          <CrudSection
            title="Stakeholders"
            description="Matriz poder × interesse (1–5): gerenciar de perto, manter satisfeito, manter informado ou monitorar."
            entityName="stakeholder"
            path="/stakeholders"
            query={`projectId=${id}`}
            fixed={{ projectId: id }}
            writeRoles={ROLES.MANAGE}
            deleteRoles={ROLES.MANAGE}
            fields={[
              { name: 'name', label: 'Nome', required: true },
              { name: 'organization', label: 'Organização / área' },
              { name: 'role', label: 'Papel' },
              { name: 'contact', label: 'Contato' },
              { name: 'power', label: 'Poder (1–5)', type: 'number', required: true, min: 1, max: 5 },
              { name: 'interest', label: 'Interesse (1–5)', type: 'number', required: true, min: 1, max: 5 },
              { name: 'attitude', label: 'Atitude' },
              { name: 'userId', label: 'Usuário vinculado', type: 'member' },
              { name: 'strategy', label: 'Estratégia de engajamento', type: 'textarea' },
            ]}
            columns={[
              { key: 'name', label: 'Nome', render: (r: any) => <span className="font-medium">{r.name}</span> },
              { key: 'role', label: 'Papel', render: (r: any) => r.role ?? '—' },
              { key: 'pi', label: 'Poder / Interesse', render: (r: any) => `${r.power} / ${r.interest}` },
              { key: 'quadrant', label: 'Estratégia', render: (r: any) => r.quadrant },
            ]}
          />
        </TabsContent>
        <TabsContent value="reunioes">
          <CrudSection
            title="Reuniões do projeto"
            entityName="reunião"
            path="/meetings"
            query={`projectId=${id}`}
            fixed={{ projectId: id }}
            writeRoles={ROLES.MANAGE}
            deleteRoles={ROLES.PMO}
            fields={[
              { name: 'title', label: 'Título', required: true },
              { name: 'type', label: 'Tipo', type: 'select', options: options('meetingType') },
              { name: 'scheduledAt', label: 'Data e hora', type: 'datetime', required: true },
              { name: 'location', label: 'Local ou link' },
              { name: 'notes', label: 'Anotações', type: 'textarea', help: 'Frases como “Fulano deverá … até 15/10” viram ações para revisão.' },
            ]}
            columns={[
              {
                key: 'title',
                label: 'Reunião',
                render: (m: any) => (
                  <Link className="font-medium hover:text-tech" href={`/pmo/reunioes/${m.id}`}>
                    {m.title}
                  </Link>
                ),
              },
              { key: 'type', label: 'Tipo', render: (m: any) => label('meetingType', m.type) },
              { key: 'when', label: 'Quando', render: (m: any) => new Date(m.scheduledAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) },
            ]}
          />
        </TabsContent>
      </Tabs>

      <TaskDialog
        open={taskOpen}
        onClose={() => {
          setTaskOpen(false);
          if (search.get('tarefa')) router.replace(`/projetos/${id}`);
        }}
        projectId={id}
        taskId={taskId}
        tasks={list}
        defaults={defaults}
        onSaved={refresh}
      />
      <Dialog open={editProject} onOpenChange={setEditProject}>
        {editProject ? (
          <DialogContent title="Editar projeto">
            <EntityForm
              fields={projectFields}
              row={p}
              path="/projects"
              onCancel={() => setEditProject(false)}
              onSaved={() => {
                setEditProject(false);
                project.reload();
              }}
            />
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}
