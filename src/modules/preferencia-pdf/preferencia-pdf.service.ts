import type { Db } from '@/db/client';
import { DATABASE, SUPABASE_ADMIN } from '@/db/database.module';
import {
  type NewPreferenciaPdf,
  type PreferenciaPdf,
  laboratorio,
  preferenciaPdf,
  sede,
} from '@/db/schema';
import type { PdfLayoutConfig } from '@/db/schema/preferencia-pdf';
import {
  ASSETS_BUCKET,
  extFromMime,
  resolveAssetDataUri,
  uploadAssetToBucket,
} from '@/modules/lab-config/asset-storage';
import { buildSampleInformeData, renderInformeFromData } from '@/pdf/render';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { and, eq, isNull } from 'drizzle-orm';
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

    // Merge: preserva campos/usarFondo previos cuando el dto no los trae.
    const existingLayout = (existing?.layoutConfig as PdfLayoutConfig | null) ?? {};
    const layoutConfig: PdfLayoutConfig = {
      campos: (dto.campos as PdfLayoutConfig['campos']) ?? existingLayout.campos ?? {},
      usarFondo: dto.usarFondo ?? existingLayout.usarFondo,
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

  /** Quita la imagen de fondo: borra el blob (best-effort) y limpia el path. */
  async removeFondo(labId: number): Promise<PreferenciaPdf> {
    const existing = await this.get(labId);
    if (!existing) {
      throw new NotFoundException('No hay preferencias de PDF para este laboratorio.');
    }
    if (existing.fondoPath) {
      const { error } = await this.storage.storage.from(ASSETS_BUCKET).remove([existing.fondoPath]);
      if (error) {
        // No rompe la operación: el path se limpia igual.
      }
    }
    const [row] = await this.db
      .update(preferenciaPdf)
      .set({ fondoPath: null, updatedAt: new Date() })
      .where(eq(preferenciaPdf.labId, labId))
      .returning();
    return row;
  }

  /**
   * Renderiza un PDF de informe de MUESTRA con la marca real del lab (logo, firma,
   * fondo, márgenes, acento, sede principal) y datos de paciente/resultados ficticios.
   * Sirve al editor de PDF para previsualizar el resultado sin una orden cargada.
   */
  async renderSample(labId: number): Promise<Buffer> {
    const [lab] = await this.db
      .select()
      .from(laboratorio)
      .where(eq(laboratorio.id, labId))
      .limit(1);
    if (!lab) {
      throw new NotFoundException('Laboratorio no encontrado.');
    }
    const pref = await this.get(labId);
    const [logoSrc, signatureSrc, fondoSrc] = await Promise.all([
      resolveAssetDataUri(this.storage, lab.logoPath),
      resolveAssetDataUri(this.storage, lab.signingSignaturePath),
      resolveAssetDataUri(this.storage, pref?.fondoPath ?? null),
    ]);
    const [principalSede] = await this.db
      .select()
      .from(sede)
      .where(and(eq(sede.labId, labId), eq(sede.principal, true), isNull(sede.deletedAt)))
      .limit(1);

    const data = buildSampleInformeData({
      lab,
      preferenciaPdf: pref,
      logoSrc,
      signatureSrc,
      fondoSrc,
      sede: principalSede ?? null,
    });
    return renderInformeFromData(data);
  }
}
