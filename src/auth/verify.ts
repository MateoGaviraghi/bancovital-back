import { UnauthorizedException } from '@nestjs/common';
import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { USER_ROLES, type UserRole } from './session';

/** JWT-only partial session — labId is resolved separately by TenantService. */
export type PartialSession = { userId: string; email: string; role: UserRole };

export interface VerifierOptions {
  /** TTL of the in-memory token→session cache. Defaults to 60s. */
  cacheTtlMs?: number;
  /** Max cache size before lazy eviction kicks in. Defaults to 5000. */
  cacheMaxEntries?: number;
}

interface CachedEntry {
  session: PartialSession;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 60_000;
const DEFAULT_MAX_ENTRIES = 5000;

/**
 * Stateful verifier that holds a single Supabase anon client and an
 * in-memory cache of validated tokens. Lives for the lifetime of the
 * Nest application. The cache key is the raw JWT, which is reasonably
 * safe given the cache is process-local and short-lived; we still
 * truncate when logging.
 */
export class JwtVerifier {
  private readonly anonClient: SupabaseClient;
  private readonly cache = new Map<string, CachedEntry>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(supabaseUrl: string, supabaseAnonKey: string, options: VerifierOptions = {}) {
    this.anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    this.ttlMs = options.cacheTtlMs ?? DEFAULT_TTL_MS;
    this.maxEntries = options.cacheMaxEntries ?? DEFAULT_MAX_ENTRIES;
  }

  async verifyAuthHeader(authHeader: string | undefined): Promise<PartialSession> {
    const token = parseBearer(authHeader);
    return this.verifyToken(token);
  }

  async verifyToken(token: string): Promise<PartialSession> {
    const cached = this.cache.get(token);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.session;
    }
    if (cached) this.cache.delete(token);

    const { data, error } = await this.anonClient.auth.getUser(token);
    if (error || !data.user) {
      throw new UnauthorizedException('Invalid token');
    }

    const rawRole = (data.user.app_metadata as { role?: unknown } | null)?.role;
    if (!isUserRole(rawRole)) {
      throw new UnauthorizedException('User has no role assigned');
    }

    const session: PartialSession = {
      userId: data.user.id,
      email: data.user.email ?? '',
      role: rawRole,
    };

    this.cacheSet(token, session);
    return session;
  }

  clearCache(): void {
    this.cache.clear();
  }

  private cacheSet(token: string, session: PartialSession): void {
    if (this.cache.size >= this.maxEntries) {
      const now = Date.now();
      for (const [k, v] of this.cache) {
        if (v.expiresAt <= now) this.cache.delete(k);
      }
      if (this.cache.size >= this.maxEntries) {
        const oldest = this.cache.keys().next().value;
        if (oldest) this.cache.delete(oldest);
      }
    }
    this.cache.set(token, { session, expiresAt: Date.now() + this.ttlMs });
  }
}

export function parseBearer(authHeader: string | undefined): string {
  if (!authHeader) {
    throw new UnauthorizedException('Missing Authorization header');
  }
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!match || !match[1]) {
    throw new UnauthorizedException('Malformed Authorization header');
  }
  return match[1].trim();
}

function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);
}
