import type { Field } from '@/components/entity-form';
import { options } from './labels';

const ref = (path: string, labelOf: (r: any) => string) => ({ path, labelOf });
export const REF = {
  portfolio: ref('/portfolios', (r) => r.name),
  program: ref('/programs', (r) => r.name),
  project: ref('/projects', (r) => `${r.code} — ${r.name}`),
  costCenter: ref('/cost-centers', (r) => `${r.code} — ${r.name}`),
  unit: ref('/units', (r) => r.name),
  contract: ref('/contracts', (r) => `${r.supplier} — ${r.object}`),
  resource: ref('/resources', (r) => r.name),
  itSystem: ref('/it-systems', (r) => r.name),
  framework: ref('/frameworks', (r) => `${r.name}${r.version ? ` (${r.version})` : ''}`),
  control: ref('/controls', (r) => `${r.code} — ${r.title}`),
  season: ref('/seasons', (r) => r.name),
  indicator: ref('/agro-indicators', (r) => `${r.name} (${r.unit})`),
};

export const projectFields: Field[] = [
  { name: 'code', label: 'Código', required: true, placeholder: 'PRJ-001' },
  { name: 'name', label: 'Nome', required: true },
  { name: 'type', label: 'Tipo', type: 'select', options: options('projectType') },
  { name: 'status', label: 'Status', type: 'select', options: options('projectStatus') },
  { name: 'portfolioId', label: 'Portfólio', type: 'ref', ref: REF.portfolio },
  { name: 'programId', label: 'Programa', type: 'ref', ref: REF.program },
  { name: 'parentId', label: 'Projeto-pai (subprojeto)', type: 'ref', ref: REF.project },
  { name: 'managerId', label: 'Gerente', type: 'member' },
  { name: 'costCenterId', label: 'Centro de custo', type: 'ref', ref: REF.costCenter },
  { name: 'unitId', label: 'Unidade (fazenda/filial)', type: 'ref', ref: REF.unit },
  { name: 'startDate', label: 'Início', type: 'date' },
  { name: 'endDate', label: 'Término', type: 'date' },
  { name: 'priorityScore', label: 'Prioridade no portfólio (1–5)', type: 'number', min: 1, max: 5 },
  { name: 'description', label: 'Descrição', type: 'textarea' },
];

export const taskFields: Field[] = [
  { name: 'wbsCode', label: 'Código EAP', placeholder: '1.2' },
  { name: 'title', label: 'Título', required: true },
  { name: 'status', label: 'Status', type: 'select', options: options('taskStatus') },
  { name: 'priority', label: 'Prioridade', type: 'select', options: options('priority') },
  { name: 'assigneeId', label: 'Responsável', type: 'member' },
  { name: 'startDate', label: 'Início', type: 'date' },
  { name: 'endDate', label: 'Término', type: 'date', help: 'Sem início e término, a tarefa fica como "não agendada" no Gantt.' },
  { name: 'isMilestone', label: 'Marco', type: 'checkbox' },
  { name: 'progress', label: '% concluído', type: 'number', min: 0, max: 100 },
  { name: 'budget', label: 'Orçamento', type: 'money' },
  { name: 'estOptimistic', label: 'Estimativa otimista (dias úteis)', type: 'number', min: 0 },
  { name: 'estLikely', label: 'Mais provável (dias úteis)', type: 'number', min: 0 },
  { name: 'estPessimistic', label: 'Pessimista (dias úteis)', type: 'number', min: 0 },
  { name: 'tags', label: 'Tags', type: 'tags' },
  { name: 'description', label: 'Descrição / dicionário da EAP', type: 'textarea' },
];
