import { config } from '../common/config';

interface Bucket {
  failures: number;
  firstAt: number;
  lockedUntil: number;
}

/**
 * Limite de tentativas de login por usuário e por IP, em memória (uma instância de API na etapa 1).
 * Com mais de uma instância, mover para Redis (sistema.md, Arquitetura).
 */
export class LoginLimiter {
  private readonly buckets = new Map<string, Bucket>();

  private window() {
    return config.login.windowMinutes * 60_000;
  }

  isLocked(keys: string[], now = Date.now()): boolean {
    return keys.some((k) => (this.buckets.get(k)?.lockedUntil ?? 0) > now);
  }

  registerFailure(userKey: string, ipKey: string, now = Date.now()) {
    this.bump(userKey, config.login.maxFailuresPerUser, now);
    this.bump(ipKey, config.login.maxFailuresPerIp, now);
  }

  reset(key: string) {
    this.buckets.delete(key);
  }

  private bump(key: string, max: number, now: number) {
    let b = this.buckets.get(key);
    if (!b || now - b.firstAt > this.window()) b = { failures: 0, firstAt: now, lockedUntil: 0 };
    b.failures++;
    if (b.failures >= max) b.lockedUntil = now + this.window();
    this.buckets.set(key, b);
    if (this.buckets.size > 50_000) this.prune(now);
  }

  private prune(now: number) {
    for (const [k, b] of this.buckets) if (b.lockedUntil < now && now - b.firstAt > this.window()) this.buckets.delete(k);
  }
}
