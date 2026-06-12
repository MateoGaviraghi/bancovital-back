import type { Db } from '@/db/client';
import { DATABASE, SUPABASE_ADMIN } from '@/db/database.module';
import { laboratorio } from '@/db/schema';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { eq } from 'drizzle-orm';
import { ASSETS_BUCKET } from '../lab-config/asset-storage';

export interface BrandingResponse {
  slug: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  tagline: string | null;
}

const LOGO_TTL_SECONDS = 3600;

@Injectable()
export class PublicLabsService {
  constructor(
    @Inject(DATABASE) private readonly db: Db,
    @Inject(SUPABASE_ADMIN) private readonly storage: SupabaseClient,
  ) {}

  async getBranding(slug: string): Promise<BrandingResponse> {
    const [row] = await this.db
      .select({
        slug: laboratorio.slug,
        legalName: laboratorio.legalName,
        shortName: laboratorio.shortName,
        logoPath: laboratorio.logoPath,
        primaryColor: laboratorio.primaryColor,
        tagline: laboratorio.tagline,
        estado: laboratorio.estado,
      })
      .from(laboratorio)
      .where(eq(laboratorio.slug, slug))
      .limit(1);

    if (!row || row.estado === 'inactivo') {
      throw new NotFoundException({ statusCode: 404, message: 'Not found' });
    }

    const logoUrl = await this.resolveLogoUrl(row.logoPath);

    return {
      slug: row.slug,
      name: row.shortName ?? row.legalName,
      shortName: row.shortName ?? null,
      logoUrl,
      primaryColor: row.primaryColor ?? null,
      tagline: row.tagline ?? null,
    };
  }

  private async resolveLogoUrl(logoPath: string | null | undefined): Promise<string | null> {
    if (!logoPath) return null;

    if (
      logoPath.startsWith('http://') ||
      logoPath.startsWith('https://') ||
      logoPath.startsWith('data:')
    ) {
      return logoPath;
    }

    const { data, error } = await this.storage.storage
      .from(ASSETS_BUCKET)
      .createSignedUrl(logoPath, LOGO_TTL_SECONDS);

    if (error || !data) return null;
    return data.signedUrl;
  }
}
