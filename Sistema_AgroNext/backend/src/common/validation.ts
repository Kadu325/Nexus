import { BadRequestException, PipeTransform } from '@nestjs/common';
import { z, ZodType } from 'zod';

/** Valida o corpo/consulta com Zod e devolve mensagens em português. */
export class ZodPipe<T extends ZodType> implements PipeTransform {
  constructor(private readonly schema: T) {}
  transform(value: unknown): z.infer<T> {
    const r = this.schema.safeParse(value);
    if (!r.success) {
      throw new BadRequestException({
        message: 'Dados inválidos.',
        issues: r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    return r.data;
  }
}

export const zId = z.string().uuid('Identificador inválido.');
export const zOptId = z.string().uuid('Identificador inválido.').nullable().optional();
export const zText = (max = 200) => z.string().trim().min(1, 'Campo obrigatório.').max(max);
export const zOptText = (max = 5000) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v));
/** Data AAAA-MM-DD, armazenada como meia-noite UTC. */
export const zDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato AAAA-MM-DD.')
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), 'Data inválida.')
  .transform((s) => new Date(`${s}T00:00:00Z`));
export const zOptDate = zDate.nullable().optional();
export const zDateTime = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), 'Data e hora inválidas.')
  .transform((s) => new Date(s));
/** Valor monetário como string decimal com até 2 casas (evita ponto flutuante). */
export const zMoney = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim().replace(',', '.'))
  .refine((s) => /^-?\d{1,16}(\.\d{1,2})?$/.test(s), 'Valor monetário inválido (use até 2 casas decimais).');
export const zPosMoney = zMoney.refine((s) => !s.startsWith('-'), 'O valor deve ser positivo.');
export const zDecimal = (maxInt = 12, scale = 4) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim().replace(',', '.'))
    .refine((s) => new RegExp(`^-?\\d{1,${maxInt}}(\\.\\d{1,${scale}})?$`).test(s), 'Número inválido.');
export const zScale5 = z.coerce.number().int().min(1, 'Use de 1 a 5.').max(5, 'Use de 1 a 5.');
export const zTags = z.array(z.string().trim().min(1).max(40)).max(20).optional();

export function parseOrThrow<T extends ZodType>(schema: T, value: unknown): z.infer<T> {
  return new ZodPipe(schema).transform(value);
}
