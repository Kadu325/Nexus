import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import * as argon2 from 'argon2';
import { config } from './config';

export function newToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Argon2id com parâmetros configuráveis (padrão: mínimo recomendado pela OWASP, 19 MiB, t=2, p=1). */
export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: config.argon2.memoryCost,
    timeCost: config.argon2.timeCost,
    parallelism: config.argon2.parallelism,
  });
}

let dummyHash: Promise<string> | null = null;

/** Verifica a senha; quando o usuário não existe, compara com um hash fictício para uniformizar o tempo de resposta. */
export async function verifyPassword(hash: string | null | undefined, password: string): Promise<boolean> {
  if (!hash) {
    dummyHash ??= hashPassword(newToken());
    await argon2.verify(await dummyHash, password).catch(() => false);
    return false;
  }
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export function validateNewPassword(password: string): string | null {
  if (typeof password !== 'string' || password.length < config.passwordMinLength) {
    return `A senha deve ter pelo menos ${config.passwordMinLength} caracteres.`;
  }
  if (password.length > 128) return 'A senha deve ter no máximo 128 caracteres.';
  return null;
}
