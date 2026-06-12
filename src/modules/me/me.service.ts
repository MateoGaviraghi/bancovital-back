import type { Session } from '@/auth/session';
import type { Db } from '@/db/client';
import { DATABASE } from '@/db/database.module';
import { laboratorio, user } from '@/db/schema';
import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

export interface MeResponse {
  userId: string;
  email: string;
  role: string;
  labId: number | null;
  labSlug: string | null;
}

@Injectable()
export class MeService {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  async getMe(session: Session): Promise<MeResponse> {
    if (session.labId === null) {
      // superusuario: no pertenece a ningún laboratorio
      return {
        userId: session.userId,
        email: session.email,
        role: session.role,
        labId: null,
        labSlug: null,
      };
    }

    const [row] = await this.db
      .select({ slug: laboratorio.slug })
      .from(user)
      .innerJoin(laboratorio, eq(user.labId, laboratorio.id))
      .where(eq(user.id, session.userId))
      .limit(1);

    return {
      userId: session.userId,
      email: session.email,
      role: session.role,
      labId: session.labId,
      labSlug: row?.slug ?? null,
    };
  }
}
