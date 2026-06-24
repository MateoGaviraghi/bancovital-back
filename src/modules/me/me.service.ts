import type { Session } from '@/auth/session';
import type { Db } from '@/db/client';
import { DATABASE, SUPABASE_ADMIN } from '@/db/database.module';
import { laboratorio } from '@/db/schema';
import { ASSETS_BUCKET } from '@/modules/lab-config/asset-storage';
import { Inject, Injectable } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { eq } from 'drizzle-orm';

export interface MeResponse {
  userId: string;
  email: string;
  role: string;
  labId: number | null;
  /** Slug del lab — informativo; ya NO se usa para ruteo (app única bancovital). */
  labSlug: string | null;
  /** Nombre del lab del usuario (para el header de la app). */
  labName: string | null;
  /** URL firmada del logo del lab (para el header). */
  logoUrl: string | null;
  /** Color primario de marca en hex (#rrggbb), o null si no configurado. */
  primaryColor: string | null;
  /** Color de acento de marca en hex (#rrggbb), o null si no configurado. */
  accentColor: string | null;
  /** Opt-in del super: el lab tiene habilitada el área veterinaria. */
  veterinariaHabilitada: boolean;
}

const LOGO_TTL_SECONDS = 3600;

@Injectable()
export class MeService {
  constructor(
    @Inject(DATABASE) private readonly db: Db,
    @Inject(SUPABASE_ADMIN) private readonly storage: SupabaseClient,
  ) {}

  async getMe(session: Session): Promise<MeResponse> {
    if (session.labId === null) {
      // superusuario: no pertenece a ningún laboratorio
      return {
        userId: session.userId,
        email: session.email,
        role: session.role,
        labId: null,
        labSlug: null,
        labName: null,
        logoUrl: null,
        primaryColor: null,
        accentColor: null,
        veterinariaHabilitada: false,
      };
    }

    // Resuelve nombre+logo del lab desde el session.labId EFECTIVO (no el del user),
    // así bajo impersonation /me reporta el lab impersonado (header muestra ese lab).
    const [row] = await this.db
      .select({
        slug: laboratorio.slug,
        legalName: laboratorio.legalName,
        shortName: laboratorio.shortName,
        logoPath: laboratorio.logoPath,
        primaryColor: laboratorio.primaryColor,
        accentColor: laboratorio.accentColor,
        veterinariaHabilitada: laboratorio.veterinariaHabilitada,
      })
      .from(laboratorio)
      .where(eq(laboratorio.id, session.labId))
      .limit(1);

    let logoUrl: string | null = null;
    if (row?.logoPath) {
      const signed = await this.storage.storage
        .from(ASSETS_BUCKET)
        .createSignedUrl(row.logoPath, LOGO_TTL_SECONDS);
      logoUrl = signed.data && !signed.error ? signed.data.signedUrl : null;
    }

    return {
      userId: session.userId,
      email: session.email,
      role: session.role,
      labId: session.labId,
      labSlug: row?.slug ?? null,
      labName: row ? (row.shortName ?? row.legalName) : null,
      logoUrl,
      primaryColor: row?.primaryColor ?? null,
      accentColor: row?.accentColor ?? null,
      veterinariaHabilitada: row?.veterinariaHabilitada ?? false,
    };
  }
}
