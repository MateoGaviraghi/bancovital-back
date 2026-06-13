import type { Db } from '@/db/client';
import { DATABASE, SUPABASE_ADMIN } from '@/db/database.module';
import {
  auditLog,
  cicloConsumo,
  doctor,
  laboratorio,
  order,
  patient,
  practiceUnidad,
  suscripcion,
  unidadMedida,
  user,
} from '@/db/schema';
import { RESERVED_SLUGS } from '@/domain/slug/reserved-slugs';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { eq } from 'drizzle-orm';
import type { CreateLaboratorioDto, UpdateLaboratorioDto } from './dto/create-laboratorio.dto';

@Injectable()
export class SuperService {
  private readonly logger = new Logger(SuperService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Db,
    @Inject(SUPABASE_ADMIN) private readonly admin: SupabaseClient,
  ) {}

  list() {
    return this.db.select().from(laboratorio).orderBy(laboratorio.legalName);
  }

  async findOne(id: number) {
    const [row] = await this.db.select().from(laboratorio).where(eq(laboratorio.id, id)).limit(1);
    if (!row) throw new NotFoundException(`Laboratorio ${id} no encontrado`);
    return row;
  }

  async create(dto: CreateLaboratorioDto) {
    this.assertSlugNotReserved(dto.slug);
    try {
      const [row] = await this.db
        .insert(laboratorio)
        .values({
          slug: dto.slug,
          legalName: dto.legalName,
          shortName: dto.shortName ?? null,
          cuit: dto.cuit ?? null,
          streetAddress: dto.streetAddress ?? null,
          city: dto.city ?? 'Santa Fe',
          province: dto.province ?? 'Santa Fe',
          phone: dto.phone ?? null,
          email: dto.email ?? null,
          signingProfessionalName: dto.signingProfessionalName ?? null,
          signingProfessionalMp: dto.signingProfessionalMp ?? null,
        })
        .returning();
      return row;
    } catch (err: unknown) {
      const pg = err as { code?: string };
      if (pg.code === '23505') throw new ConflictException(`El slug '${dto.slug}' ya existe`);
      throw err;
    }
  }

  async update(id: number, dto: UpdateLaboratorioDto) {
    if (dto.slug !== undefined) this.assertSlugNotReserved(dto.slug);
    await this.findOne(id);
    const patch = {
      ...dto,
      ...(dto.primaryColor !== undefined && dto.primaryColor !== null
        ? { primaryColor: dto.primaryColor.toLowerCase() }
        : {}),
      updatedAt: new Date(),
    };
    try {
      const [row] = await this.db
        .update(laboratorio)
        .set(patch)
        .where(eq(laboratorio.id, id))
        .returning();
      return row;
    } catch (err: unknown) {
      const pg = err as { code?: string };
      if (pg.code === '23505') throw new ConflictException(`El slug '${dto.slug}' ya existe`);
      throw err;
    }
  }

  /** Desactiva el laboratorio (soft-delete). No borra datos. */
  async remove(id: number) {
    await this.findOne(id);
    const [row] = await this.db
      .update(laboratorio)
      .set({ estado: 'inactivo', updatedAt: new Date() })
      .where(eq(laboratorio.id, id))
      .returning();
    return row;
  }

  /** Reactiva un laboratorio previamente desactivado. */
  async reactivate(id: number) {
    await this.findOne(id);
    const [row] = await this.db
      .update(laboratorio)
      .set({ estado: 'activo', updatedAt: new Date() })
      .where(eq(laboratorio.id, id))
      .returning();
    return row;
  }

  /**
   * Borrado físico total de un laboratorio y TODOS sus datos.
   * Solo se puede ejecutar sobre labs con estado='inactivo'.
   * Los usuarios de Supabase Auth se borran después del commit (fire-and-forget con warn).
   */
  async purge(id: number) {
    const lab = await this.findOne(id);
    if (lab.estado !== 'inactivo') {
      throw new ConflictException(
        'Solo se puede borrar definitivamente un laboratorio desactivado.',
      );
    }

    // Recopilar IDs de Auth ANTES de la transacción
    const userRows = await this.db.select({ id: user.id }).from(user).where(eq(user.labId, id));
    const authUserIds = userRows.map((r) => r.id);

    // Borrado en cascada FK-seguro en una sola transacción
    await this.db.transaction(async (tx) => {
      // 1. audit_log (restrict hacia laboratorio)
      await tx.delete(auditLog).where(eq(auditLog.labId, id));

      // 2. order (hijos caen por cascade: order_practice → order_practice_unidad_value, result; payment; attachment)
      await tx.delete(order).where(eq(order.labId, id));

      // 3. practice_unidad (restrict hacia unidad_medida — borrar ANTES que unidad_medida)
      await tx.delete(practiceUnidad).where(eq(practiceUnidad.labId, id));

      // 4. unidad_medida (restrict hacia laboratorio)
      await tx.delete(unidadMedida).where(eq(unidadMedida.labId, id));

      // 5. suscripcion (restrict hacia laboratorio)
      await tx.delete(suscripcion).where(eq(suscripcion.labId, id));

      // 6. ciclo_consumo (restrict hacia laboratorio)
      await tx.delete(cicloConsumo).where(eq(cicloConsumo.labId, id));

      // 7. patient (restrict hacia laboratorio)
      await tx.delete(patient).where(eq(patient.labId, id));

      // 8. doctor (restrict hacia laboratorio)
      await tx.delete(doctor).where(eq(doctor.labId, id));

      // 9. public.user (restrict hacia laboratorio)
      await tx.delete(user).where(eq(user.labId, id));

      // 10. laboratorio (preferencia_pdf cae por cascade; contrato.lab_creado_id queda null por set-null)
      await tx.delete(laboratorio).where(eq(laboratorio.id, id));
    });

    // Post-commit: borrar usuarios de Supabase Auth (fire-and-forget con warn)
    for (const authId of authUserIds) {
      try {
        const { error } = await this.admin.auth.admin.deleteUser(authId);
        if (error) {
          this.logger.warn(
            `purge lab ${id}: no se pudo borrar auth user ${authId}: ${error.message}`,
          );
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`purge lab ${id}: excepción borrando auth user ${authId}: ${msg}`);
      }
    }
  }

  private assertSlugNotReserved(slug: string): void {
    if ((RESERVED_SLUGS as readonly string[]).includes(slug)) {
      throw new BadRequestException(
        `El slug '${slug}' está reservado por el sistema y no puede ser usado`,
      );
    }
  }
}
