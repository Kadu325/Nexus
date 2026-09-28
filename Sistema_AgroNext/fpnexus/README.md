# FPNexus — etapa 1

**Dados conectados. Decisões inteligentes.**

Plataforma de gestão de projetos, PMO, governança de TI, compliance, finanças, recursos, IA, analytics e agronegócio.
Especificação: [`sistema.md`](../sistema.md) (revisão 2, com o registro das correções B01–B28).

> Esta é a **etapa 1** da plataforma. Ela entrega os nove módulos com fluxos completos (interface, API, validação,
> autorização, regras e persistência), mas não esgota o escopo aprovado. O que falta está em
> [`docs/matriz-requisitos.md`](docs/matriz-requisitos.md) e na seção “Estado da implementação” do `sistema.md`.

## Arquitetura

```
Navegador ──HTTPS──► Caddy (proxy, certificado automático)
                       ├── /api/*  ► backend  NestJS 11 + Prisma ──► PostgreSQL 17 (volume pgdata)
                       └── /*      ► frontend Next.js (React 19, Tailwind 4, componentes shadcn/ui)
```

- Mesma origem para interface e API: cookie de sessão `HttpOnly` + `SameSite=Lax`, sem CORS com credenciais.
- Sessões revogáveis no banco (token guardado só como hash SHA-256), expiração absoluta e por inatividade.
- CSRF por *double submit* (`fpx_csrf` + cabeçalho `x-csrf-token`) em toda mutação.
- Senhas com Argon2id (19 MiB, t=2, p=1 — mínimo recomendado pela OWASP; configurável).
- Isolamento por organização em todas as consultas, referências e relações (`orgId` + verificação de referências).
- Trilha de auditoria de acessos, alterações, aprovações, exclusões e consultas, sem senhas ou tokens.
- OpenAPI em `/api/docs`; verificação de saúde em `/api/health`.

## Estrutura de diretórios

```
fpnexus/
├── docker-compose.yml             # db, backend, frontend, proxy
├── .env.example                   # variáveis do Compose (copiar para .env)
├── FPNexus_acesso_inicial.env.example  # modelo do arquivo reservado do admin
├── infra/Caddyfile                # proxy reverso e HTTPS
├── scripts/                       # backup.sh, restore-test.sh, restore.sh
├── docs/
│   ├── implantacao.md             # guia numerado de instalação na VPS (12 passos)
│   └── matriz-requisitos.md       # requisito → módulo → implementação → teste → pendência
├── backend/
│   ├── Dockerfile, docker-entrypoint.sh   # migrações → provisionamento → API
│   ├── prisma/schema.prisma       # modelo de dados (≈45 tabelas, todas com orgId)
│   ├── prisma/migrations/         # migração inicial (SQL gerado do schema e validado em PostgreSQL 16)
│   ├── src/
│   │   ├── main.ts, app.module.ts
│   │   ├── provision.ts           # conta admin idempotente (Argon2id)
│   │   ├── seed-demo.ts           # dados demonstrativos opcionais
│   │   ├── common/                # guarda de sessão/CSRF/papéis, auditoria, validação, CRUD por organização
│   │   ├── auth/                  # login, logout, troca de senha, limite de tentativas
│   │   ├── domain/                # regras puras: EVM, CPM, PERT, Monte Carlo, ROI/TCO/payback, riscos, extrator de ações
│   │   └── modules/               # controladores dos nove módulos
│   └── test/unit, test/e2e        # testes de domínio e de ponta a ponta
└── frontend/
    ├── Dockerfile
    ├── public/brand/fpnexus-logo.jpeg
    └── src/
        ├── app/login              # tela de login com a marca
        ├── app/(app)/…            # páginas dos módulos
        ├── components/ui          # componentes no padrão shadcn/ui
        ├── components/project     # Kanban, Gantt, EAP, TAP, Business Case, visão geral/EVM
        └── lib                    # cliente da API, formatação pt-BR, rótulos
```

## Módulos da etapa 1

| Módulo | O que funciona |
| --- | --- |
| Gestão de Projetos | Portfólios, programas, projetos e subprojetos; EAP com pacotes; Kanban com arrastar e soltar e limite WIP; Gantt com linha de base e caminho crítico (CPM); Meu Trabalho; dependências sem ciclos; comentários |
| PMO Corporativo | TAP com campos obrigatórios; Business Case com ROI, TCO e payback; aprovação eletrônica (quem submete não aprova); stakeholders (poder × interesse); riscos (P × I); contratos com saldo; Sala de Reuniões com decisões, ações, ata versionada e conversão ação → tarefa idempotente; biblioteca de documentos versionada |
| Governança de TI | Catálogo de sistemas com ciclo de vida e alerta de fim de suporte; mudanças com plano de reversão e aprovação |
| Compliance Tecnológico | Frameworks, controles, evidências (substituíveis, não apagáveis), avaliações, não conformidades automáticas, trilha de auditoria |
| Gestão Financeira | Lançamentos CAPEX/OPEX, receitas e despesas por competência, centros de custo, orçado × realizado, EVM (PV, EV, AC, CPI, SPI, EAC), Curva S, burnup |
| Gestão de Recursos | Recursos de cinco tipos, competências, alocações, heatmap de capacidade × demanda, timesheet com submissão, aprovação e bloqueio de período |
| Inteligência Artificial | Meeting Copilot por consultas com fontes; IA generativa (ata, resumo, riscos, rascunho de TAP, perguntas) via API compatível com OpenAI, com limite diário e registro de uso; PERT; Monte Carlo reproduzível sobre a rede de dependências |
| Analytics Avançado | Dashboards executivo, PMO, produtividade e governança; catálogo de indicadores com fórmula e tratamento de ausência |
| Agronegócio | Unidades com coordenadas, mapa do Brasil embarcado, safras, indicadores com fórmula/unidade/fonte, medições com origem e séries sem interpolação |

## Execução rápida (local, com Docker)

Pré-requisitos: Docker Engine 24+ com o plugin Compose v2.24+ e Node.js 22 LTS (só para gerar os lockfiles).

> **Primeiro passo obrigatório — lockfiles.** Este pacote foi escrito num ambiente sem acesso ao registro do npm,
> então `package-lock.json` ainda não existe. Gere e versione os dois uma vez:
>
> ```bash
> cd backend && npm install && cd ../frontend && npm install && cd ..
> git add backend/package-lock.json frontend/package-lock.json
> ```
>
> Os Dockerfiles usam `npm ci` quando o lockfile existe (builds reproduzíveis) e `npm install` apenas se ele faltar.

```bash
cp .env.example .env
# edite .env: POSTGRES_PASSWORD (use: openssl rand -hex 24), mantenha SITE_ADDRESS=http://localhost e COOKIE_SECURE=false

cp FPNexus_acesso_inicial.env.example FPNexus_acesso_inicial.env
# edite FPNexus_acesso_inicial.env: ADMIN_INITIAL_PASSWORD = a senha definida para o admin

docker compose up -d --build
docker compose logs backend | grep provisionamento   # esperado: "[provisionamento] CRIADO: Conta "admin" criada..."
```

Abra http://localhost, entre com `admin` e a senha do arquivo reservado.

Dados demonstrativos (opcional, apenas para avaliação):

```bash
docker compose exec backend node dist/seed-demo.js
```

Os projetos e unidades de demonstração aparecem com o selo **Demonstração**; as pessoas de demonstração não têm senha.

Para produção em VPS (domínio, HTTPS, backups, atualização e reversão), siga [`docs/implantacao.md`](docs/implantacao.md).

## Desenvolvimento sem Docker

```bash
# banco local (exemplo com Docker só para o PostgreSQL)
docker run -d --name fpnexus-pg -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=fpnexus -p 5432:5432 postgres:17-alpine

cd backend
npm ci
set DATABASE_URL=postgresql://postgres:dev@localhost:5432/fpnexus   # Windows (PowerShell: $env:DATABASE_URL="...")
npx prisma migrate deploy
set ADMIN_INITIAL_USERNAME=admin
set ADMIN_INITIAL_PASSWORD=<senha>
npm run build && npm run provision
set COOKIE_SECURE=false
npm run dev          # API em http://localhost:3001/api

cd ../frontend
npm ci
npm run dev          # interface em http://localhost:3000 (o Next.js encaminha /api para :3001)
```

## Testes e verificações

Confira se a migração inicial corresponde ao `schema.prisma` (deve responder “No difference detected” ou vazio):

```bash
cd backend
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "postgresql://postgres:dev@localhost:5432/fpnexus_shadow"
```

```bash
cd backend
npm run typecheck && npm run lint
npm test                      # regras de domínio: EVM, CPM, PERT, Monte Carlo, ROI, riscos, extrator de ações
# ponta a ponta (API rodando + banco de TESTE):
E2E_ADMIN_USER=admin E2E_ADMIN_PASSWORD=<senha> DATABASE_URL=... npm run test:e2e

cd ../frontend
npm run typecheck && npm run lint && npm run build
```

Os testes de ponta a ponta verificam os sete critérios de aceite do acesso (login, senha incorreta, API sem sessão,
logout, isolamento entre organizações, hash Argon2id, provisionamento idempotente) e fluxos críticos (EVM, caminho
crítico, limite WIP, ata → ação → tarefa sem duplicidade, aprovação sem autoaprovação).

## Segurança da conta inicial

- A senha do admin só existe no arquivo reservado `FPNexus_acesso_inicial.env`, lido apenas pelo contêiner do backend.
  Ela nunca vai para o código, o bundle do navegador, os logs ou a documentação.
- O provisionamento é idempotente: reexecutar não duplica a conta nem redefine uma senha já alterada.
- Depois do primeiro acesso, altere a senha em **Minha conta** e remova o arquivo reservado (passo 7 do guia).
