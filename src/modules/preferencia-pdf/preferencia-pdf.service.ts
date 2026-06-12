import type { Db } from '@/db/client';
import { DATABASE, SUPABASE_ADMIN } from '@/db/database.module';
import { type NewPreferenciaPdf, type PreferenciaPdf, preferenciaPdf } from '@/db/schema';
import type { PdfLayoutConfig } from '@/db/schema/preferencia-pdf';
import {
  ASSETS_BUCKET,
  extFromMime,
  uploadAssetToBucket,
} from '@/modules/lab-config/asset-storage';
import { Inject, Injectable } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { eq } from 'drizzle-orm';
import type { UpdatePreferenciaPdfDto } from './dto/update-preferencia-pdf.dto';

@Injectable()
export class PreferenciaPdfService {
  constructor(
    @Inject(DATABASE) private readonly db: Db,
    @Inject(SUPABASE_ADMIN) private readonly storage: SupabaseClient,
  ) {}

  async get(labId: number): Promise<PreferenciaPdf | null> {
    const [row] = await this.db
      .select()
      .from(preferenciaPdf)
      .where(eq(preferenciaPdf.labId, labId))
      .limit(1);
    return row ?? null;
  }

  async upsert(labId: number, dto: UpdatePreferenciaPdfDto): Promise<PreferenciaPdf> {
    const existing = await this.get(labId);

    const layoutConfig: PdfLayoutConfig = {
      campos: (dto.campos as PdfLayoutConfig['campos']) ?? {},
    };

    if (existing) {
      const [row] = await this.db
        .update(preferenciaPdf)
        .set({
          layoutConfig,
          ...(dto.marginTop !== undefined && { marginTop: dto.marginTop }),
          ...(dto.marginBottom !== undefined && { marginBottom: dto.marginBottom }),
          ...(dto.marginLeft !== undefined && { marginLeft: dto.marginLeft }),
          ...(dto.marginRight !== undefined && { marginRight: dto.marginRight }),
          updatedAt: new Date(),
        })
        .where(eq(preferenciaPdf.labId, labId))
        .returning();
      return row;
    }

    const values: NewPreferenciaPdf = {
      labId,
      layoutConfig,
      marginTop: dto.marginTop ?? 20,
      marginBottom: dto.marginBottom ?? 20,
      marginLeft: dto.marginLeft ?? 20,
      marginRight: dto.marginRight ?? 20,
    };
    const [row] = await this.db.insert(preferenciaPdf).values(values).returning();
    return row;
  }

  async uploadFondo(
    labId: number,
    file: { buffer: Buffer; mimetype: string },
  ): Promise<PreferenciaPdf> {
    const path = `lab/${labId}/fondo.${extFromMime(file.mimetype)}`;
    await uploadAssetToBucket(this.storage, path, file.buffer, file.mimetype);

    const existing = await this.get(labId);
    if (existing) {
      const [row] = await this.db
        .update(preferenciaPdf)
        .set({ fondoPath: path, updatedAt: new Date() })
        .where(eq(preferenciaPdf.labId, labId))
        .returning();
      return row;
    }

    const [row] = await this.db
      .insert(preferenciaPdf)
      .values({ labId, fondoPath: path })
      .returning();
    return row;
  }

  async fondoSignedUrl(
    labId: number,
    ttlSeconds: number,
  ): Promise<{ url: string | null; expiresInSeconds: number }> {
    const pref = await this.get(labId);
    if (!pref?.fondoPath) {
      return { url: null, expiresInSeconds: ttlSeconds };
    }
    const signed = await this.storage.storage
      .from(ASSETS_BUCKET)
      .createSignedUrl(pref.fondoPath, ttlSeconds);
    return {
      url: signed.data && !signed.error ? signed.data.signedUrl : null,
      expiresInSeconds: ttlSeconds,
    };
  }
}
