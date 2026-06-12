import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { eq } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { DATABASE, SUPABASE_ADMIN } from '@/db/database.module';
import { type Laboratorio, type NewLaboratorio, laboratorio } from '@/db/schema';
import { ASSETS_BUCKET, extFromMime, uploadAssetToBucket } from './asset-storage';
import type { UpdateLabConfigDto } from './dto/update-lab-config.dto';

@Injectable()
export class LabConfigService {
  constructor(
    @Inject(DATABASE) private readonly db: Db,
    @Inject(SUPABASE_ADMIN) private readonly storage: SupabaseClient,
  ) {}

  async get(labId: number): Promise<Laboratorio> {
    const [row] = await this.db
      .select()
      .from(laboratorio)
      .where(eq(laboratorio.id, labId))
      .limit(1);
    if (!row) {
      throw new NotFoundException('Laboratorio no encontrado. Contacte al administrador del sistema.');
    }
    return row;
  }

  async update(labId: number, dto: UpdateLabConfigDto): Promise<Laboratorio> {
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
      updatedAt: new Date(),
    };

    const [row] = await this.db
      .update(laboratorio)
      .set(patch)
      .where(eq(laboratorio.id, current.id))
      .returning();
    return row;
  }

  async uploadAsset(
    labId: number,
    kind: 'logo' | 'signature',
    file: { buffer: Buffer; mimetype: string },
  ): Promise<Laboratorio> {
    const current = await this.get(labId);
    const path = `lab/${labId}/${kind}.${extFromMime(file.mimetype)}`;
    await uploadAssetToBucket(this.storage, path, file.buffer, file.mimetype);
    const column =
      kind === 'logo' ? { logoPath: path } : { signingSignaturePath: path };
    const [row] = await this.db
      .update(laboratorio)
      .set({ ...column, updatedAt: new Date() })
      .where(eq(laboratorio.id, current.id))
      .returning();
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
    const value =
      kind === 'logo' ? (row?.logoPath ?? null) : (row?.signingSignaturePath ?? null);
    if (!value) {
      return { url: null, expiresInSeconds: ttlSeconds };
    }
    if (
      value.startsWith('http://') ||
      value.startsWith('https://') ||
      value.startsWith('data:')
    ) {
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
