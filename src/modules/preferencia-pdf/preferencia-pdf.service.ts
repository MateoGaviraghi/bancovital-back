import type { Db } from '@/db/client';
import { DATABASE, SUPABASE_ADMIN } from '@/db/database.module';
import { laboratorio, preferenciaPdf, sede } from '@/db/schema';
import type { PreferenciaPdf } from '@/db/schema';
import type { PdfLayoutConfig } from '@/db/schema/preferencia-pdf';
import {
  ASSETS_BUCKET,
  extFromMime,
  resolveAssetDataUri,
  uploadAssetToBucket,
} from '@/modules/lab-config/asset-storage';
import { buildSampleInformeData, renderInformeFromData } from '@/pdf/render';
import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { CreatePreferenciaPdfDto } from './dto/create-preferencia-pdf.dto';
import type { UpdatePreferenciaPdfDto } from './dto/update-preferencia-pdf.dto';

@Injectable()
export class PreferenciaPdfService {
  constructor(
    @Inject(DATABASE) private readonly db: Db,
    @Inject(SUPABASE_ADMIN) private readonly storage: SupabaseClient,
  ) {}

  /** Lista todos los formatos activos (no eliminados) del laboratorio. */
  async list(labId: number): Promise<PreferenciaPdf[]> {
    return this.db
      .select()
      .from(preferenciaPdf)
      .where(and(eq(preferenciaPdf.labId, labId), isNull(preferenciaPdf.deletedAt)))
      .orderBy(desc(preferenciaPdf.updatedAt));
  }

  /** Crea un nuevo formato de PDF para el laboratorio. */
  async create(labId: number, dto: CreatePreferenciaPdfDto): Promise<PreferenciaPdf> {
    const [row] = await this.db
      .insert(preferenciaPdf)
      .values({
        labId,
        nombre: dto.nombre,
        tipo: dto.tipo ?? 'informe',
        servicioId: dto.servicioId ?? null,
      })
      .returning();
    return row;
  }

  /** Obtiene un formato por ID, verificando que pertenezca al lab. */
  async findById(labId: number, id: number): Promise<PreferenciaPdf> {
    const [row] = await this.db
      .select()
      .from(preferenciaPdf)
      .where(and(eq(preferenciaPdf.id, id), isNull(preferenciaPdf.deletedAt)))
      .limit(1);
    if (!row) throw new NotFoundException(`Formato PDF ${id} no encontrado.`);
    if (row.labId !== labId) throw new ForbiddenException('Acceso denegado.');
    return row;
  }

  /** Actualiza los campos de un formato existente. */
  async update(labId: number, id: number, dto: UpdatePreferenciaPdfDto): Promise<PreferenciaPdf> {
    const existing = await this.findById(labId, id);

    const existingLayout = (existing.layoutConfig as PdfLayoutConfig | null) ?? {};
    const layoutConfig: PdfLayoutConfig = {
      campos: (dto.campos as PdfLayoutConfig['campos']) ?? existingLayout.campos ?? {},
      usarFondo: dto.usarFondo ?? existingLayout.usarFondo,
    };

    const [row] = await this.db
      .update(preferenciaPdf)
      .set({
        ...(dto.nombre !== undefined && { nombre: dto.nombre }),
        ...(dto.tipo !== undefined && { tipo: dto.tipo }),
        layoutConfig,
        ...(dto.marginTop !== undefined && { marginTop: dto.marginTop }),
        ...(dto.marginBottom !== undefined && { marginBottom: dto.marginBottom }),
        ...(dto.marginLeft !== undefined && { marginLeft: dto.marginLeft }),
        ...(dto.marginRight !== undefined && { marginRight: dto.marginRight }),
        updatedAt: new Date(),
      })
      .where(eq(preferenciaPdf.id, id))
      .returning();
    return row;
  }

  /** Soft-delete de un formato. */
  async softDelete(labId: number, id: number): Promise<void> {
    await this.findById(labId, id);
    await this.db
      .update(preferenciaPdf)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(preferenciaPdf.id, id));
  }

  /** Sube (o reemplaza) la imagen de fondo para un formato específico. */
  async uploadFondo(
    labId: number,
    id: number,
    file: { buffer: Buffer; mimetype: string },
  ): Promise<PreferenciaPdf> {
    await this.findById(labId, id);
    const path = `lab/${labId}/preferencia-pdf/${id}/fondo.${extFromMime(file.mimetype)}`;
    await uploadAssetToBucket(this.storage, path, file.buffer, file.mimetype);

    const [row] = await this.db
      .update(preferenciaPdf)
      .set({ fondoPath: path, updatedAt: new Date() })
      .where(eq(preferenciaPdf.id, id))
      .returning();
    return row;
  }

  /** Quita la imagen de fondo de un formato (borra blob + limpia path). */
  async removeFondo(labId: number, id: number): Promise<PreferenciaPdf> {
    const existing = await this.findById(labId, id);
    if (existing.fondoPath) {
      await this.storage.storage.from(ASSETS_BUCKET).remove([existing.fondoPath]);
    }
    const [row] = await this.db
      .update(preferenciaPdf)
      .set({ fondoPath: null, updatedAt: new Date() })
      .where(eq(preferenciaPdf.id, id))
      .returning();
    return row;
  }

  /** URL firmada temporal del fondo de un formato específico. */
  async fondoSignedUrl(
    labId: number,
    id: number,
    ttlSeconds: number,
  ): Promise<{ url: string | null; expiresInSeconds: number }> {
    const pref = await this.findById(labId, id);
    if (!pref.fondoPath) {
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

  /**
   * Renderiza un PDF de muestra usando un formato específico (o el más
   * reciente de tipo 'informe' si no se especifica id).
   */
  async renderSample(labId: number, id?: number): Promise<Buffer> {
    const [lab] = await this.db
      .select()
      .from(laboratorio)
      .where(eq(laboratorio.id, labId))
      .limit(1);
    if (!lab) throw new NotFoundException('Laboratorio no encontrado.');

    let pref: PreferenciaPdf | null = null;
    if (id !== undefined) {
      pref = await this.findById(labId, id);
    } else {
      const [row] = await this.db
        .select()
        .from(preferenciaPdf)
        .where(
          and(
            eq(preferenciaPdf.labId, labId),
            eq(preferenciaPdf.tipo, 'informe'),
            isNull(preferenciaPdf.deletedAt),
          ),
        )
        .orderBy(desc(preferenciaPdf.updatedAt))
        .limit(1);
      pref = row ?? null;
    }

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

  /**
   * Devuelve el formato más reciente para un tipo dado (usado internamente
   * al renderizar informes/órdenes reales).
   */
  async findLatestByTipo(labId: number, tipo: string): Promise<PreferenciaPdf | null> {
    const [row] = await this.db
      .select()
      .from(preferenciaPdf)
      .where(
        and(
          eq(preferenciaPdf.labId, labId),
          eq(preferenciaPdf.tipo, tipo),
          isNull(preferenciaPdf.deletedAt),
        ),
      )
      .orderBy(desc(preferenciaPdf.updatedAt))
      .limit(1);
    return row ?? null;
  }
}
