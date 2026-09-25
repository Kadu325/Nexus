import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Type,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Role } from '@prisma/client';
import { z, ZodObject, ZodRawShape } from 'zod';
import { PrismaService } from './prisma.service';
import { AuditService } from './audit.service';
import { Auth, AuthCtx, R, Roles } from './auth-context';
import { parseOrThrow } from './validation';
import { assertRefs, findInOrg, RefKind } from './org-scope';

export interface CrudHookCtx {
  prisma: PrismaService;
  auth: AuthCtx;
  existing?: any;
}

export interface CrudConfig {
  /** Rota relativa a /api */
  path: string;
  /** Nome do delegate Prisma (ex.: 'portfolio') */
  model: string;
  /** Nome exibido na auditoria e na documentação */
  entity: string;
  tag: string;
  create: ZodObject<ZodRawShape>;
  update?: ZodObject<ZodRawShape>;
  refs?: Record<string, RefKind>;
  readRoles?: Role[];
  writeRoles?: Role[];
  deleteRoles?: Role[];
  /** Parâmetros de consulta aceitos como filtro de igualdade */
  filters?: string[];
  orderBy?: object | object[];
  include?: object;
  deletable?: boolean;
  /** Regras adicionais antes de gravar; pode transformar os dados ou lançar erro. */
  beforeWrite?: (data: Record<string, any>, ctx: CrudHookCtx) => Promise<Record<string, any>> | Record<string, any>;
  beforeDelete?: (existing: any, ctx: CrudHookCtx) => Promise<void> | void;
  /** Campos calculados na leitura */
  decorate?: (row: any) => any;
}

/**
 * Fábrica de controladores CRUD com isolamento por organização, validação, verificação de referências,
 * papéis por operação e auditoria. Regras específicas ficam nos hooks ou em controladores próprios.
 */
export function crudController(cfg: CrudConfig): Type<unknown> {
  const read = cfg.readRoles ?? R.ALL;
  const write = cfg.writeRoles ?? R.MANAGE;
  const del = cfg.deleteRoles ?? write;
  const updateSchema = cfg.update ?? cfg.create.partial();
  const decorate = cfg.decorate ?? ((r: any) => r);

  @ApiTags(cfg.tag)
  @Controller(cfg.path)
  class CrudController {
    constructor(
      @Inject(PrismaService) readonly prisma: PrismaService,
      @Inject(AuditService) readonly audit: AuditService,
    ) {}

    get delegate(): any {
      return (this.prisma as any)[cfg.model];
    }

    @Get()
    @Roles(...read)
    async list(@Auth() auth: AuthCtx, @Query() query: Record<string, string>) {
      const where: Record<string, unknown> = { orgId: auth.orgId };
      for (const f of cfg.filters ?? []) {
        const v = query[f];
        if (typeof v !== 'string' || v === '') continue;
        where[f] = v === 'null' ? null : v === 'true' ? true : v === 'false' ? false : v;
      }
      const rows = await this.delegate.findMany({ where, orderBy: cfg.orderBy ?? { createdAt: 'desc' }, include: cfg.include, take: 1000 });
      return rows.map(decorate);
    }

    @Get(':id')
    @Roles(...read)
    async get(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) id: string) {
      return decorate(await findInOrg(this.prisma, cfg.model, id, auth.orgId, cfg.include ? { include: cfg.include } : {}));
    }

    @Post()
    @Roles(...write)
    async create(@Auth() auth: AuthCtx, @Body() body: unknown) {
      let data = parseOrThrow(cfg.create, body) as Record<string, any>;
      if (cfg.refs) await assertRefs(this.prisma, auth.orgId, data, cfg.refs);
      if (cfg.beforeWrite) data = await cfg.beforeWrite(data, { prisma: this.prisma, auth });
      const row = await this.delegate.create({ data: { ...data, orgId: auth.orgId } });
      await this.audit.log(auth, 'CRIAR', cfg.entity, row.id, data);
      return decorate(row);
    }

    @Patch(':id')
    @Roles(...write)
    async update(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
      const existing = await findInOrg(this.prisma, cfg.model, id, auth.orgId);
      let data = parseOrThrow(updateSchema, body) as Record<string, any>;
      if (cfg.refs) await assertRefs(this.prisma, auth.orgId, data, cfg.refs);
      if (cfg.beforeWrite) data = await cfg.beforeWrite(data, { prisma: this.prisma, auth, existing });
      const row = await this.delegate.update({ where: { id }, data });
      await this.audit.log(auth, 'ALTERAR', cfg.entity, id, data);
      return decorate(row);
    }

    @Delete(':id')
    @HttpCode(204)
    @Roles(...del)
    async remove(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) id: string) {
      if (cfg.deletable === false) throw new ConflictException('Este registro não pode ser excluído.');
      const existing = await findInOrg(this.prisma, cfg.model, id, auth.orgId);
      if (cfg.beforeDelete) await cfg.beforeDelete(existing, { prisma: this.prisma, auth, existing });
      await this.delegate.delete({ where: { id } });
      await this.audit.log(auth, 'EXCLUIR', cfg.entity, id, existing);
    }
  }

  Object.defineProperty(CrudController, 'name', { value: `${cfg.entity.replace(/\W/g, '')}CrudController` });
  return CrudController;
}

export { z };
