import { AuditService } from '@/common/audit/audit.service';
import type { Db } from '@/db/client';
import { DATABASE, SUPABASE_ADMIN } from '@/db/database.module';
import { type Laboratorio, type NewLaboratorio, laboratorio } from '@/db/schema';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { eq } from 'drizzle-orm';
import { ASSETS_BUCKET, extFromMime, uploadAssetToBucket } from './asset-storage';
// Import de VALOR (no `import type`): el DTO se usa en @Body() del controller y
// debe existir en runtime para que el ValidationPipe lo valide (whitelist/forbid).
import { UpdateLabConfigDto } from './dto/update-lab-config.dto';

/** Metadatos del request para el audit trail (best-effort). */
export interface LabConfigAuditCtx {
  actorId: string | null;
  ip: string | null;
  userAgent: string | null;
}

/** Campos editables relevantes para el diff de auditoría (sin timestamps/ids ruidosos). */
function brandingSnapshot(lab: Laboratorio) {
  return {
    legalName: lab.legalName,
    shortName: lab.shortName,
    cuit: lab.cuit,
    streetAddress: lab.streetAddress,
    city: lab.city,
    province: lab.province,
    phone: lab.phone,
    email: lab.email,
    signingProfessionalName: lab.signingProfessionalName,
    signingProfessionalMp: lab.signingProfessionalMp,
    primaryColor: lab.primaryColor,
    accentColor: lab.accentColor,
    tagline: lab.tagline,
    logoPath: lab.logoPath,
  };
}

@Injectable()
export class LabConfigService {
  constructor(
    @Inject(DATABASE) private readonly db: Db,
    @Inject(SUPABASE_ADMIN) private readonly storage: SupabaseClient,
    private readonly audit: AuditService,
  ) {}

  async get(labId: number): Promise<Laboratorio> {
    const [row] = await this.db
      .select()
      .from(laboratorio)
      .where(eq(laboratorio.id, labId))
      .limit(1);
    if (!row) {
      throw new NotFoundException(
        'Laboratorio no encontrado. Contacte al administrador del sistema.',
      );
    }
    return row;
  }

  async update(
    labId: number,
    dto: UpdateLabConfigDto,
    ctx?: LabConfigAuditCtx,
  ): Promise<Laboratorio> {
    const current = await this.get(labId);

    const patch: Partial<NewLaboratorio> = {
      ...(dto.legalName !== undefined && { legalName: dto.legalName }),
      ...(dto.cuit !== undefined && { cuit: dto.cuit }),
      ...(dto.streetAddress !== undefined && { streetAddress: dto.streetAddress }),
      ...(dto.city !== undefined && { city: dto.city }),
      ...(dto.province !== undefined && { province: dto.province }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.email !== undefined && { email: dto.email }),
      ...(dto.signingProfessionalName !== undefined && {
        signingProfessionalName: dto.signingProfessionalName,
      }),
      ...(dto.signingProfessionalMp !== undefined && {
        signingProfessionalMp: dto.signingProfessionalMp,
      }),
      ...(dto.shortName !== undefined && { shortName: dto.shortName }),
      ...(dto.primaryColor !== undefined && { primaryColor: dto.primaryColor }),
      ...(dto.accentColor !== undefined && { accentColor: dto.accentColor }),
      ...(dto.tagline !== undefined && { tagline: dto.tagline }),
      updatedAt: new Date(),
    };

    const [row] = await this.db
      .update(laboratorio)
      .set(patch)
      .where(eq(laboratorio.id, current.id))
      .returning();

    await this.audit.log({
      labId: current.id,
      actorId: ctx?.actorId ?? null,
      action: 'update_lab_config',
      entity: 'laboratorio',
      entityId: current.id,
      before: brandingSnapshot(current),
      after: brandingSnapshot(row),
      ip: ctx?.ip ?? null,
      userAgent: ctx?.userAgent ?? null,
    });

    return row;
  }

  async uploadAsset(
    labId: number,
    kind: 'logo' | 'signature',
    file: { buffer: Buffer; mimetype: string },
    ctx?: LabConfigAuditCtx,
  ): Promise<Laboratorio> {
    const current = await this.get(labId);
    const path = `lab/${labId}/${kind}.${extFromMime(file.mimetype)}`;
    await uploadAssetToBucket(this.storage, path, file.buffer, file.mimetype);
    const column = kind === 'logo' ? { logoPath: path } : { signingSignaturePath: path };
    const [row] = await this.db
      .update(laboratorio)
      .set({ ...column, updatedAt: new Date() })
      .where(eq(laboratorio.id, current.id))
      .returning();

    await this.audit.log({
      labId: current.id,
      actorId: ctx?.actorId ?? null,
      action: kind === 'logo' ? 'update_lab_logo' : 'update_lab_signature',
      entity: 'laboratorio',
      entityId: current.id,
      before: { path: kind === 'logo' ? current.logoPath : current.signingSignaturePath },
      after: { path },
      ip: ctx?.ip ?? null,
      userAgent: ctx?.userAgent ?? null,
    });

    return row;
  }

  async assetSignedUrl(
    labId: number,
    kind: 'logo' | 'signature',
    ttlSeconds: number,
  ): Promise<{ url: string | null; expiresInSeconds: number }> {
    const [row] = await this.db
      .select()
      .from(laboratorio)
      .where(eq(laboratorio.id, labId))
      .limit(1);
    const value = kind === 'logo' ? (row?.logoPath ?? null) : (row?.signingSignaturePath ?? null);
    if (!value) {
      return { url: null, expiresInSeconds: ttlSeconds };
    }
    if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:')) {
      return { url: value, expiresInSeconds: ttlSeconds };
    }
    const signed = await this.storage.storage
      .from(ASSETS_BUCKET)
      .createSignedUrl(value, ttlSeconds);
    return {
      url: signed.data && !signed.error ? signed.data.signedUrl : null,
      expiresInSeconds: ttlSeconds,
    };
  }
}
