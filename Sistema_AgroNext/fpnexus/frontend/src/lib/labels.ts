/** Rótulos em português para os valores enumerados da API. */
export const L: Record<string, Record<string, string>> = {
  role: { ADMIN: 'Administrador', PMO: 'PMO', GERENTE: 'Gerente de Projeto', MEMBRO: 'Membro', LEITOR: 'Leitor' },
  projectType: { ESTRATEGICO: 'Estratégico', OPERACIONAL: 'Operacional' },
  projectStatus: { PLANEJAMENTO: 'Planejamento', EM_ANDAMENTO: 'Em andamento', PAUSADO: 'Pausado', CONCLUIDO: 'Concluído', CANCELADO: 'Cancelado' },
  taskStatus: { A_FAZER: 'A fazer', EM_ANDAMENTO: 'Em andamento', EM_REVISAO: 'Em revisão', CONCLUIDA: 'Concluída' },
  priority: { BAIXA: 'Baixa', MEDIA: 'Média', ALTA: 'Alta', CRITICA: 'Crítica' },
  approval: { RASCUNHO: 'Rascunho', EM_APROVACAO: 'Em aprovação', APROVADO: 'Aprovado', REJEITADO: 'Rejeitado' },
  decision: { PENDENTE: 'Pendente', APROVADO: 'Aprovado', REJEITADO: 'Rejeitado', CANCELADO: 'Cancelado' },
  approvalEntity: { TAP: 'TAP', BUSINESS_CASE: 'Business Case', DOCUMENTO: 'Documento', MUDANCA: 'Mudança de TI' },
  riskStatus: { ABERTO: 'Aberto', MITIGANDO: 'Mitigando', OCORRIDO: 'Ocorrido', FECHADO: 'Fechado' },
  band: { BAIXA: 'Baixa', MODERADA: 'Moderada', ALTA: 'Alta', CRITICA: 'Crítica' },
  contract: { EM_NEGOCIACAO: 'Em negociação', VIGENTE: 'Vigente', ENCERRADO: 'Encerrado', CANCELADO: 'Cancelado' },
  meetingType: { REUNIAO: 'Reunião', COMITE: 'Comitê', KICKOFF: 'Kickoff', STATUS_REPORT: 'Status report', ENCERRAMENTO: 'Encerramento' },
  action: { EM_REVISAO: 'Em revisão', VALIDADA: 'Validada', CONVERTIDA: 'Tarefa criada', CONCLUIDA: 'Concluída', DESCARTADA: 'Descartada' },
  docType: { ATA: 'Ata', POP: 'POP', PROCEDIMENTO: 'Procedimento', POLITICA: 'Política', WIKI: 'Wiki', LICAO_APRENDIDA: 'Lição aprendida', RELATORIO: 'Relatório' },
  nature: { RECEITA: 'Receita', DESPESA: 'Despesa' },
  entryStatus: { PREVISTO: 'Previsto', REALIZADO: 'Realizado' },
  category: { RECURSOS: 'Recursos', EQUIPAMENTOS: 'Equipamentos', FORNECEDORES: 'Fornecedores', SERVICOS: 'Serviços', MATERIAIS: 'Materiais', OUTROS: 'Outros' },
  source: { MANUAL: 'Manual', ERP: 'ERP', IMPORTACAO: 'Importação' },
  resourceType: { PESSOA: 'Pessoa', EQUIPAMENTO: 'Equipamento', MAQUINA: 'Máquina', VEICULO: 'Veículo', CONSULTOR: 'Consultor' },
  timeStatus: { RASCUNHO: 'Rascunho', SUBMETIDO: 'Submetido', APROVADO: 'Aprovado', REJEITADO: 'Rejeitado' },
  criticality: { BAIXA: 'Baixa', MEDIA: 'Média', ALTA: 'Alta', CRITICA: 'Crítica' },
  lifecycle: { EM_AVALIACAO: 'Em avaliação', EM_PRODUCAO: 'Em produção', EM_DESCONTINUACAO: 'Em descontinuação', DESCONTINUADO: 'Descontinuado' },
  frequency: { MENSAL: 'Mensal', TRIMESTRAL: 'Trimestral', SEMESTRAL: 'Semestral', ANUAL: 'Anual' },
  result: { CONFORME: 'Conforme', PARCIAL: 'Parcialmente conforme', NAO_CONFORME: 'Não conforme', NAO_AVALIADO: 'Não avaliado' },
  ncStatus: { ABERTA: 'Aberta', EM_TRATAMENTO: 'Em tratamento', ENCERRADA: 'Encerrada' },
  ncSource: { COMPLIANCE: 'Compliance', QUALIDADE: 'Qualidade', AUDITORIA: 'Auditoria' },
  unitType: { FAZENDA: 'Fazenda', FILIAL: 'Filial', ARMAZEM: 'Armazém', ESCRITORIO: 'Escritório' },
  origin: { MANUAL: 'Manual', INTEGRACAO: 'Integração', SENSOR: 'Sensor' },
  caseKind: { BENEFICIO: 'Benefício', CUSTO: 'Custo' },
};

export const label = (group: string, value?: string | null) => (value ? L[group]?.[value] ?? value : '—');
export const options = (group: string) => Object.entries(L[group]).map(([value, text]) => ({ value, label: text }));

/** Tom visual por valor (texto sempre acompanha a cor). */
export function tone(value?: string | null): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  switch (value) {
    case 'APROVADO':
    case 'CONCLUIDA':
    case 'CONCLUIDO':
    case 'CONFORME':
    case 'REALIZADO':
    case 'VIGENTE':
    case 'ENCERRADA':
    case 'EM_PRODUCAO':
    case 'BAIXA':
      return 'success';
    case 'EM_APROVACAO':
    case 'EM_REVISAO':
    case 'PARCIAL':
    case 'PENDENTE':
    case 'SUBMETIDO':
    case 'MODERADA':
    case 'EM_DESCONTINUACAO':
    case 'MITIGANDO':
    case 'EM_TRATAMENTO':
      return 'warning';
    case 'REJEITADO':
    case 'NAO_CONFORME':
    case 'CRITICA':
    case 'ALTA':
    case 'CANCELADO':
    case 'OCORRIDO':
    case 'ABERTA':
    case 'DESCONTINUADO':
      return 'danger';
    case 'EM_ANDAMENTO':
    case 'CONVERTIDA':
    case 'VALIDADA':
    case 'PREVISTO':
      return 'info';
    default:
      return 'neutral';
  }
}
