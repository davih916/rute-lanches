import "server-only";

/**
 * Limitador de tentativas de login em memória — suficiente para uma única
 * instância (VPS). Se o sistema rodar em múltiplas instâncias no futuro,
 * troque por um store compartilhado (Redis) usando a mesma interface.
 */
interface Attempt {
  count: number;
  firstAttemptAt: number;
  lockedUntil?: number;
}

const attempts = new Map<string, Attempt>();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

export interface RateLimitResult {
  blocked: boolean;
  retryAfterSeconds?: number;
}

export function checkLoginRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry) return { blocked: false };

  if (entry.lockedUntil) {
    if (entry.lockedUntil > now) {
      return { blocked: true, retryAfterSeconds: Math.ceil((entry.lockedUntil - now) / 1000) };
    }
    attempts.delete(key);
    return { blocked: false };
  }

  if (now - entry.firstAttemptAt > WINDOW_MS) {
    attempts.delete(key);
    return { blocked: false };
  }

  return { blocked: false };
}

export function registerFailedLoginAttempt(key: string): void {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now - entry.firstAttemptAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAttemptAt: now });
    return;
  }

  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCK_MS;
  }
}

export function clearLoginAttempts(key: string): void {
  attempts.delete(key);
}
