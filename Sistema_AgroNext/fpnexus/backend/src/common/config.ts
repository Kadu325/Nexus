/** Configuração lida do ambiente do backend. Segredos nunca são registrados em log. */
function int(name: string, def: number) {
  const v = process.env[name];
  const n = v === undefined || v === '' ? def : Number(v);
  if (!Number.isFinite(n)) throw new Error(`Variável ${name} inválida`);
  return n;
}

export const config = {
  port: int('PORT', 3001),
  cookieSecure: (process.env.COOKIE_SECURE ?? 'false') === 'true',
  sessionTtlHours: int('SESSION_TTL_HOURS', 12),
  sessionIdleMinutes: int('SESSION_IDLE_MINUTES', 120),
  passwordMinLength: int('PASSWORD_MIN_LENGTH', 12),
  argon2: {
    memoryCost: int('ARGON2_MEMORY_KIB', 19456),
    timeCost: int('ARGON2_TIME_COST', 2),
    parallelism: int('ARGON2_PARALLELISM', 1),
  },
  login: {
    maxFailuresPerUser: int('LOGIN_MAX_FAILURES', 5),
    maxFailuresPerIp: int('LOGIN_MAX_FAILURES_IP', 30),
    windowMinutes: int('LOGIN_WINDOW_MINUTES', 15),
  },
  apiDocs: (process.env.API_DOCS ?? 'true') === 'true',
  ai: {
    baseUrl: process.env.AI_API_BASE_URL || 'https://api.openai.com/v1',
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || '',
    timeoutMs: int('AI_TIMEOUT_MS', 60000),
  },
};

export const SESSION_COOKIE = 'fpx_session';
export const CSRF_COOKIE = 'fpx_csrf';
export const CSRF_HEADER = 'x-csrf-token';
