import type { Db } from '@/db/client';
import { DATABASE } from '@/db/database.module';
import { user } from '@/db/schema';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { UserRole } from './session';

interface CachedTenant {
  labId: number | null;
  role: UserRole;
  exp: number;
}

const CACHE_TTL_MS = 60_000;
const CACHE_MAX = 5_000;

@Injectable()
export class TenantService {
  private readonly cache = new Map<string, CachedTenant>();

  constructor(@Inject(DATABASE) private readonly db: Db) {}

  async resolve(userId: string): Promise<{ labId: number | null; role: UserRole }> {
    const cached = this.cache.get(userId);
    if (cached && cached.exp > Date.now()) {
      return { labId: cached.labId, role: cached.role };
    }

    const [row] = await this.db
      .select({ labId: user.labId, role: user.role, active: user.active })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!row) throw new UnauthorizedException('Usuario no registrado en el sistema');
    if (!row.active) throw new UnauthorizedException('Usuario desactivado');

    // Defensa en profundidad: un super nunca opera dentro de un lab.
    const labId = row.role === 'super' ? null : row.labId;

    this.cacheSet(userId, { labId, role: row.role, exp: Date.now() + CACHE_TTL_MS });
    return { labId, role: row.role };
  }

  invalidate(userId: string): void {
    this.cache.delete(userId);
  }

  private cacheSet(userId: string, entry: CachedTenant): void {
    if (this.cache.size >= CACHE_MAX) {
      const now = Date.now();
      for (const [k, v] of this.cache) {
        if (v.exp <= now) this.cache.delete(k);
      }
      if (this.cache.size >= CACHE_MAX) {
        const oldest = this.cache.keys().next().value;
        if (oldest) this.cache.delete(oldest);
      }
    }
    this.cache.set(userId, entry);
  }
}
