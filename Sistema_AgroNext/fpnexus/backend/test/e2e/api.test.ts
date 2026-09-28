/**
 * Testes de ponta a ponta contra uma API em execução com banco real.
 * Cobrem os critérios de aceite do acesso (sistema.md, Fundação) e fluxos críticos.
 *
 * Pré-requisitos: API rodando (API_URL, padrão http://localhost:3001/api), DATABASE_URL apontando para o mesmo banco,
 * e as credenciais do admin provisionado em E2E_ADMIN_USER / E2E_ADMIN_PASSWORD.
 * Use um banco de TESTE: o teste cria uma segunda organização e registros com prefixo E2E.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../../src/common/security';
import { provision } from '../../src/provision';

const API = process.env.API_URL ?? 'http://localhost:3001/api';
const ADMIN_USER = process.env.E2E_ADMIN_USER ?? 'admin';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? '';
const prisma = new PrismaClient();
const run = randomUUID().slice(0, 8);

class Client {
  cookies = new Map<string, string>();
  async req(method: string, path: string, body?: unknown, opts: { csrf?: boolean } = {}) {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.cookies.size) headers.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    if (method !== 'GET' && opts.csrf !== false && this.cookies.get('fpx_csrf')) headers['x-csrf-token'] = this.cookies.get('fpx_csrf')!;
    const res = await fetch(`${API}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    for (const c of res.headers.getSetCookie()) {
      const [pair, ...attrs] = c.split(';');
      const [k, v] = pair.split('=');
      if (attrs.some((a) => /expires=Thu, 01 Jan 1970/i.test(a)) || v === '') this.cookies.delete(k.trim());
      else this.cookies.set(k.trim(), v);
    }
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, setCookie: res.headers.getSetCookie() };
  }
  login(username: string, password: string) {
    return this.req('POST', '/auth/login', { username, password });
  }
}

const admin = new Client();
let orgBUserPassword = `senha-org-b-${run}-segura`;
let orgBUsername = `e2e.orgb.${run}`;
let projectA: any;

before(async () => {
  assert.ok(ADMIN_PASSWORD, 'Defina E2E_ADMIN_PASSWORD com a senha do admin provisionado.');
  // segunda organização, criada direto no banco apenas para o teste de isolamento
  const orgB = await prisma.organization.create({ data: { name: `E2E Org B ${run}`, slug: `e2e-org-b-${run}` } });
  const userB = await prisma.user.create({ data: { username: orgBUsername, name: 'Usuário Org B', passwordHash: await hashPassword(orgBUserPassword) } });
  await prisma.membership.create({ data: { userId: userB.id, orgId: orgB.id, role: 'ADMIN' } });
});

after(async () => {
  await prisma.$disconnect();
});

describe('Critérios de aceite do acesso', () => {
  test('1. a conta provisionada autentica com a senha inicial e recebe cookies HttpOnly', async () => {
    const r = await admin.login(ADMIN_USER, ADMIN_PASSWORD);
    assert.equal(r.status, 200);
    assert.equal(r.body.role, 'ADMIN');
    const session = r.setCookie.find((c) => c.startsWith('fpx_session='))!;
    assert.match(session, /HttpOnly/i);
    assert.match(session, /SameSite=Lax/i);
  });

  test('2. senha incorreta é rejeitada sem criar sessão e com mensagem genérica', async () => {
    const c = new Client();
    const r = await c.login(ADMIN_USER, `${ADMIN_PASSWORD}x`);
    assert.equal(r.status, 401);
    assert.equal(r.body.message, 'Usuário ou senha inválidos.');
    assert.equal(c.cookies.has('fpx_session'), false);
    const unknown = await c.login(`nao-existe-${run}`, 'qualquer');
    assert.equal(unknown.body.message, r.body.message, 'não revela se o usuário existe');
  });

  test('3. API protegida sem sessão é rejeitada', async () => {
    const c = new Client();
    assert.equal((await c.req('GET', '/projects')).status, 401);
    assert.equal((await c.req('GET', '/auth/me')).status, 401);
  });

  test('mutação sem token CSRF é rejeitada', async () => {
    const r = await admin.req('POST', '/portfolios', { name: 'x' }, { csrf: false });
    assert.equal(r.status, 403);
  });

  test('4. logout invalida a sessão no servidor', async () => {
    const c = new Client();
    await c.login(ADMIN_USER, ADMIN_PASSWORD);
    const stolen = new Client();
    stolen.cookies = new Map(c.cookies);
    assert.equal((await stolen.req('GET', '/auth/me')).status, 200);
    assert.equal((await c.req('POST', '/auth/logout')).status, 204);
    assert.equal((await stolen.req('GET', '/auth/me')).status, 401, 'o cookie antigo deixa de valer');
  });

  test('5. usuário de outra organização não acessa dados alterando parâmetros', async () => {
    const r = await admin.req('POST', '/projects', { code: `E2E-${run}`, name: `Projeto E2E ${run}`, startDate: '2026-09-21', endDate: '2026-10-30' });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    projectA = r.body;
    const b = new Client();
    assert.equal((await b.login(orgBUsername, orgBUserPassword)).status, 200);
    assert.equal((await b.req('GET', `/projects/${projectA.id}`)).status, 404);
    assert.equal((await b.req('PATCH', `/projects/${projectA.id}`, { name: 'invadido' })).status, 404);
    assert.equal((await b.req('GET', `/projects/${projectA.id}/tasks`)).status, 404);
    assert.equal((await b.req('POST', '/tasks', { projectId: projectA.id, title: 'invasão' })).status, 400);
    const list = await b.req('GET', '/projects');
    assert.ok(!list.body.some((p: any) => p.id === projectA.id));
    const still = await admin.req('GET', `/projects/${projectA.id}`);
    assert.equal(still.body.name, `Projeto E2E ${run}`);
  });

  test('6. a senha não é armazenada em texto simples (Argon2id)', async () => {
    const u = await prisma.user.findUniqueOrThrow({ where: { username: ADMIN_USER.toLowerCase() } });
    assert.ok(u.passwordHash?.startsWith('$argon2id$'));
    assert.ok(!u.passwordHash?.includes(ADMIN_PASSWORD));
    const logs = await prisma.auditLog.findMany({ where: { action: { startsWith: 'LOGIN' } }, take: 50, orderBy: { createdAt: 'desc' } });
    assert.ok(!JSON.stringify(logs).includes(ADMIN_PASSWORD), 'auditoria não contém a senha');
  });

  test('7. provisionamento é idempotente e não redefine a senha', async () => {
    const r = await provision(prisma, { ...process.env, ADMIN_INITIAL_USERNAME: ADMIN_USER, ADMIN_INITIAL_PASSWORD: 'outra-senha-qualquer-123' });
    assert.equal(r.status, 'JA_PROVISIONADO');
    const c = new Client();
    assert.equal((await c.login(ADMIN_USER, ADMIN_PASSWORD)).status, 200, 'senha original continua valendo');
    assert.equal((await c.login(ADMIN_USER, 'outra-senha-qualquer-123')).status, 401);
  });
});

describe('Fluxos críticos', () => {
  let t1: any;
  let t2: any;

  test('tarefas, dependência sem ciclo, linha de base e EVM', async () => {
    t1 = (await admin.req('POST', '/tasks', { projectId: projectA.id, title: 'T1', wbsCode: '1', startDate: '2026-09-21', endDate: '2026-09-25', budget: '1000.00' })).body;
    t2 = (await admin.req('POST', '/tasks', { projectId: projectA.id, title: 'T2', wbsCode: '2', startDate: '2026-09-28', endDate: '2026-10-02', budget: '2000.00' })).body;
    assert.equal((await admin.req('POST', `/tasks/${t2.id}/dependencies`, { predecessorId: t1.id })).status, 201);
    const cycle = await admin.req('POST', `/tasks/${t1.id}/dependencies`, { predecessorId: t2.id });
    assert.equal(cycle.status, 400);
    const noBaseline = await admin.req('GET', `/projects/${projectA.id}/evm?date=2026-09-29`);
    assert.equal(noBaseline.body.cpi.value, null, 'sem linha de base: indisponível, não zero');
    assert.equal((await admin.req('POST', `/projects/${projectA.id}/baselines`)).status, 201);
    await admin.req('PATCH', `/tasks/${t1.id}`, { progress: 100, status: 'CONCLUIDA' });
    await admin.req('POST', '/financial-entries', { projectId: projectA.id, nature: 'DESPESA', description: 'custo', amount: '1200.00', competenceDate: '2026-09-22', status: 'REALIZADO' });
    const evm = (await admin.req('GET', `/projects/${projectA.id}/evm?date=${new Date().toISOString().slice(0, 10)}`)).body;
    assert.equal(evm.bac, 3000);
    assert.equal(evm.ev, 1000);
    assert.equal(evm.ac, 1200);
    assert.equal(evm.cpi.value, 0.833);
    const sched = (await admin.req('GET', `/projects/${projectA.id}/schedule`)).body;
    assert.deepEqual(sched.criticalPath, [t1.id, t2.id]);
  });

  test('limite WIP exige confirmação explícita', async () => {
    await admin.req('PATCH', `/projects/${projectA.id}`, { wipLimits: { EM_ANDAMENTO: 1 } });
    const t3 = (await admin.req('POST', '/tasks', { projectId: projectA.id, title: 'T3' })).body;
    assert.equal((await admin.req('PATCH', `/tasks/${t2.id}`, { status: 'EM_ANDAMENTO' })).status, 200);
    const blocked = await admin.req('PATCH', `/tasks/${t3.id}`, { status: 'EM_ANDAMENTO' });
    assert.equal(blocked.status, 409);
    assert.equal(blocked.body.code, 'WIP_LIMIT');
    assert.equal((await admin.req('PATCH', `/tasks/${t3.id}`, { status: 'EM_ANDAMENTO', overrideWip: true })).status, 200);
  });

  test('ata → ação ambígua exige revisão; conversão única; conclusão sincroniza', async () => {
    const members = await prisma.membership.findMany({ where: { org: { slug: process.env.ORG_INITIAL_SLUG ?? 'organizacao-inicial' } } });
    const orgId = members[0].orgId;
    // duas pessoas sem acesso com o mesmo primeiro nome
    const m1 = await prisma.user.create({ data: { username: `e2e.marcos1.${run}`, name: `Marcos Um${run}` } });
    const m2 = await prisma.user.create({ data: { username: `e2e.marcos2.${run}`, name: `Marcos Dois${run}` } });
    await prisma.membership.createMany({ data: [m1, m2].map((u) => ({ userId: u.id, orgId, role: 'MEMBRO' as const })) });

    const meeting = (await admin.req('POST', '/meetings', { projectId: projectA.id, title: 'Status', scheduledAt: new Date().toISOString(), notes: 'Marcos deverá validar o contrato até 15/10.' })).body;
    const first = (await admin.req('POST', `/meetings/${meeting.id}/extract-actions`)).body;
    assert.equal(first.created, 1);
    const again = (await admin.req('POST', `/meetings/${meeting.id}/extract-actions`)).body;
    assert.equal(again.created, 0, 'reprocessar não duplica');
    let room = (await admin.req('GET', `/meetings/${meeting.id}/room`)).body;
    const action = room.actions[0];
    assert.equal(action.status, 'EM_REVISAO');
    assert.equal(action.assigneeId, null, 'não escolhe pessoa pelo primeiro nome');
    assert.equal((await admin.req('POST', `/actions/${action.id}/validate`)).status, 400);
    await admin.req('PATCH', `/actions/${action.id}`, { assigneeId: m1.id, dueDate: '2026-10-15' });
    assert.equal((await admin.req('POST', `/actions/${action.id}/validate`)).status, 200);
    const forbidden = await admin.req('POST', `/actions/${action.id}/convert`);
    assert.equal(forbidden.status, 403, 'ata não aprovada e sem política de automação');
    await admin.req('PATCH', `/projects/${projectA.id}`, { autoCreateTasksFromActions: true });
    const conv = await admin.req('POST', `/actions/${action.id}/convert`);
    assert.equal(conv.body.created, true);
    const conv2 = await admin.req('POST', `/actions/${action.id}/convert`);
    assert.equal(conv2.body.created, false);
    assert.equal(conv2.body.task.id, conv.body.task.id, 'uma única tarefa');
    assert.equal(conv.body.task.startDate, null, 'sem início informado: não agendada');
    await admin.req('PATCH', `/tasks/${conv.body.task.id}`, { status: 'CONCLUIDA' });
    room = (await admin.req('GET', `/meetings/${meeting.id}/room`)).body;
    assert.equal(room.actions[0].status, 'CONCLUIDA');
  });

  test('quem submete não aprova o próprio pedido', async () => {
    await admin.req('PUT', `/projects/${projectA.id}/charter`, {
      objectives: 'o', scope: 's', assumptions: 'a', constraints: 'c', sponsor: 'p', stakeholdersText: 'st', budget: '100.00', macroSchedule: 'm',
    });
    const charter = (await admin.req('GET', `/projects/${projectA.id}/charter`)).body.charter;
    const req = await admin.req('POST', '/approvals', { entityType: 'TAP', entityId: charter.id });
    assert.equal(req.status, 201);
    const self = await admin.req('POST', `/approvals/${req.body.id}/decide`, { decision: 'APROVADO' });
    assert.equal(self.status, 403);
    const locked = await admin.req('PUT', `/projects/${projectA.id}/charter`, { objectives: 'mudança' });
    assert.equal(locked.status, 409, 'TAP em aprovação é somente leitura');
  });
});
