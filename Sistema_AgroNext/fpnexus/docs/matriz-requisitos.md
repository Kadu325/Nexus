# Matriz de requisitos — etapa 1

Legenda: **E** entregue nesta etapa (interface + API + regras + persistência) · **P** parcial · **—** pendente.
“Teste” indica onde há verificação automatizada (U = `test/unit`, E2E = `test/e2e`).

## Fundação

| Requisito (sistema.md) | Situação | Onde | Teste |
| --- | --- | --- | --- |
| Tela /login com marca, Usuário/Senha, Entrar, exibir senha, carregamento, erro genérico | E | `frontend/src/app/login` | E2E 2 (mensagem) |
| Redirecionar não autenticados; API rejeita sem sessão | E | `middleware.ts`, `auth.guard.ts` | E2E 3 |
| Logout invalida sessão no servidor | E | `auth.controller.ts` | E2E 4 |
| Alteração de senha autenticada (encerra outras sessões) | E | `/auth/change-password`, `/conta` | — |
| Conta admin por ADMIN_INITIAL_USERNAME/PASSWORD, Argon2id, idempotente | E | `provision.ts` | E2E 1, 6, 7 |
| Sessão revogável, HttpOnly, Secure, SameSite, CSRF, limite de tentativas, expiração | E | `auth.guard.ts`, `login-limiter.ts` | E2E 1, CSRF |
| Isolamento por organização | E | `org-scope.ts`, `crud.factory.ts` | E2E 5 |
| Papéis e matriz de permissões (RBAC por organização) | E | `auth-context.ts` (R.*) | E2E (autoaprovação) |
| ABAC por projeto, departamento e unidade | — | — | — |
| SSO, MFA, passwordless, Entra ID, Google, LDAP/AD | — | — | — |
| Recuperação de senha por canal verificado | — (informado na tela) | — | — |

## Módulos

| Módulo / requisito | Situação | Observação |
| --- | --- | --- |
| **Gestão de Projetos** — portfólios, programas, projetos, subprojetos, estratégicos/operacionais | E | |
| Modelos de projeto | — | |
| Meu Trabalho (atribuídas, prioridades, pendências) | E | Favoritos pendentes |
| Tarefas, subtarefas, comentários, tags, dependências | E | Checklist, anexos, campos customizados e SLA pendentes |
| Kanban com arrastar e soltar, WIP, alternativa por teclado | E | Swimlanes, backlog e sprint board pendentes |
| Gantt, marcos, linha de base, caminho crítico (CPM), não agendadas | E | Roadmap, calendário, diagrama de rede e feriados pendentes |
| EAP e dicionário (descrição da tarefa) | E | |
| **PMO** — TAP com campos obrigatórios e versão | E | |
| Business Case com ROI, TCO, payback (fórmulas padrão) | E | VPL pendente |
| Aprovação eletrônica interna | E | BPMN executável e assinatura digital por provedor pendentes |
| Stakeholders, riscos (P×I, faixas), contratos com saldo | E | Reservas gerenciais e apetite por projeto pendentes |
| Sala de Reuniões: decisões, ações, ata versionada, extração, validação, conversão idempotente, sincronização | E | E2E |
| IA para reuniões (ata, resumo, riscos) | E | Requer provedor configurado |
| Integração Teams/Outlook/Meet/Calendar | — | |
| Biblioteca documental com versões e aprovação | E | Upload de anexos pendente |
| Qualidade: auditorias, checklists, Pareto, Ishikawa, DMAIC, CEP, 5 porquês, SWOT | — | Não conformidades de qualidade já aceitas (origem QUALIDADE) |
| OKRs e ranking de portfólio | P | Prioridade 1–5 no projeto; OKRs pendentes |
| **Governança de TI** — sistemas, ciclo de vida, fim de suporte, mudanças com aprovação | E | |
| **Compliance** — frameworks, controles, evidências, avaliações, NCs, conformidade, auditoria | E | Exportação da trilha pendente |
| **Financeiro** — CAPEX/OPEX, receitas, despesas, competência/caixa, centros de custo | E | Conciliação e importação de ERP pendentes |
| EVM (PV, EV, AC, CPI, SPI, EAC), Curva S, burnup/burndown | E | U, E2E |
| Forecast, fluxo de caixa projetado, ordens de serviço | — | |
| **Recursos** — cinco tipos, competências, alocação, heatmap capacidade × demanda | E | |
| Timesheet com submissão, aprovação, bloqueio de período, limite diário | E | Banco de horas e horas extras aguardam política |
| Produtividade: lead time, throughput | E | Cycle time aguarda histórico de status |
| **IA** — Meeting Copilot com fontes | E | Consultas estruturadas |
| PMO Copilot generativo (pergunta, rascunho de TAP) | E | Requer provedor |
| PERT, Monte Carlo reproduzível | E | U |
| Delphi, paramétrica, bottom-up | — | |
| IA preditiva | — | Indisponível por falta de dados validados (exibido na tela) |
| RAG vetorial e MCP | — | Etapa 1 usa recuperação estruturada dos registros do projeto |
| **Analytics** — executivo, PMO, produtividade, governança, catálogo | E | |
| Power BI / Fabric | — | |
| **Agronegócio** — unidades, mapa, safras, indicadores, medições, séries | E | |
| Sensores IoT, estações, drones, GIS, telemetria | — | |
| Integrações corporativas (Microsoft, Google, ERPs, RH, service desk, DevOps, BI) | — | Cada conector exige contrato próprio (sistema.md) |
| Redis e workers | — | Sem processamento assíncrono na etapa 1 |

## Não funcionais

| Item | Situação |
| --- | --- |
| Docker Compose com volumes persistentes, proxy HTTPS, healthchecks, limites de memória | E |
| Backup com retenção, checksum e teste de restauração | E (`scripts/`) |
| OpenAPI e /api/health | E |
| Usuários simultâneos, volumes, RTO/RPO | Pendência de negócio |
