import { AuditService } from '@/common/audit/audit.service';
import { isUniqueViolation } from '@/common/db-errors';
import { AppConfig } from '@/config';
import type { Db } from '@/db/client';
import { DATABASE, SUPABASE_ADMIN } from '@/db/database.module';
import {
  attachment,
  auditLog,
  cicloConsumo,
  doctor,
  labMovimiento,
  laboratorio,
  order,
  orderPractice,
  patient,
  payment,
  plan,
  practiceUnidad,
  preferenciaPdf,
  result,
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
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { CreateLaboratorioDto, UpdateLaboratorioDto } from './dto/create-laboratorio.dto';
import type { SetAdminPasswordDto } from './dto/set-admin-password.dto';

/** Contexto del super que ejecuta la acción, para auditar. */
export interface SuperActionContext {
  actorId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export interface SuperMetrics {
  labs: { activos: number; suspendidos: number; inactivos: number };
  mrr: number;
  ordenesPorMes: Array<{ periodo: string; total: number; excedentes: number }>;
  topLabsUso: Array<{
    labId: number;
    nombre: string;
    usadas: number;
    cupoEfectivo: number;
    excedentes: number;
    porcentaje: number;
  }>;
}

export interface AuditListItem {
  id: number;
  labId: number;
  labNombre: string | null;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  entity: string;
  entityId: string;
  before: unknown;
  after: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
}

@Injectable()
export class SuperService {
  private readonly logger = new Logger(SuperService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Db,
    @Inject(SUPABASE_ADMIN) private readonly admin: SupabaseClient,
    private readonly audit: AuditService,
    private readonly appConfig: AppConfig,
  ) {}

  list() {
    return this.db.select().from(laboratorio).orderBy(laboratorio.legalName);
  }

  async findOne(id: number) {
    const [row] = await this.db.select().from(laboratorio).where(eq(laboratorio.id, id)).limit(1);
    if (!row) throw new NotFoundException(`Laboratorio ${id} no encontrado`);
    return row;
  }

  /**
   * Define la contraseña del admin de un laboratorio (el super la genera y se la
   * pasa al cliente manualmente). Devuelve el email = usuario de acceso.
   */
  async setAdminPassword(
    labId: number,
    dto: SetAdminPasswordDto,
  ): Promise<{ ok: true; email: string }> {
    const [lab] = await this.db
      .select({ id: laboratorio.id, email: laboratorio.email })
      .from(laboratorio)
      .where(eq(laboratorio.id, labId))
      .limit(1);
    if (!lab) throw new NotFoundException(`Laboratorio ${labId} no encontrado`);

    let [adminUser] = await this.db
      .select({ id: user.id, email: user.email })
      .from(user)
      .where(and(eq(user.labId, labId), eq(user.role, 'admin'), eq(user.active, true)))
      .limit(1);

    // Auto-reparar: labs viejos (firma con el flujo previo) o creados a mano pueden no
    // tener el usuario admin en la DB. Lo provisionamos a partir del email del lab.
    if (!adminUser) {
      if (!lab.email) {
        throw new BadRequestException(
          `El laboratorio ${labId} no tiene usuario admin ni email de contacto. Cargá un email en "Editar" y reintentá.`,
        );
      }
      const userId = await this.resolveOrCreateAuthUser(lab.email);
      await this.admin.auth.admin.updateUserById(userId, { app_metadata: { role: 'admin' } });
      await this.db
        .insert(user)
        .values({ id: userId, labId, email: lab.email, role: 'admin', active: true })
        .onConflictDoUpdate({
          target: user.id,
          set: { labId, email: lab.email, role: 'admin', active: true },
        });
      adminUser = { id: userId, email: lab.email };
    }

    const { error } = await this.admin.auth.admin.updateUserById(adminUser.id, {
      password: dto.password,
    });
    if (error) {
      throw new InternalServerErrorException(
        `No se pudo actualizar la contraseña: ${error.message}`,
      );
    }

    return { ok: true, email: adminUser.email };
  }

  /** Devuelve el id del usuario de Auth para un email; lo crea si no existe (sin enviar mail). */
  private async resolveOrCreateAuthUser(email: string): Promise<string> {
    const created = await this.admin.auth.admin.createUser({
      email,
      email_confirm: true,
      app_metadata: { role: 'admin' },
    });
    if (created.data?.user?.id) return created.data.user.id;
    if (created.error && !/registered|already|exists/i.test(created.error.message)) {
      throw new InternalServerErrorException(
        `No se pudo crear el usuario ${email}: ${created.error.message}`,
      );
    }
    // Ya existía en Auth: resolvemos su id. generateLink no envía ningún mail.
    const { data: link } = await this.admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: this.appConfig.env.APP_URL },
    });
    const id = link?.user?.id;
    if (!id) throw new InternalServerErrorException(`No se pudo resolver el usuario ${email}`);
    return id;
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
          veterinariaHabilitada: dto.veterinariaHabilitada ?? false,
        })
        .returning();
      return row;
    } catch (err: unknown) {
      if (isUniqueViolation(err)) throw new ConflictException(`El slug '${dto.slug}' ya existe`);
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
      if (isUniqueViolation(err)) throw new ConflictException(`El slug '${dto.slug}' ya existe`);
      throw err;
    }
  }

  /** Desactiva el laboratorio (soft-delete). No borra datos. */
  async remove(id: number, ctx?: SuperActionContext) {
    const before = await this.findOne(id);
    const [row] = await this.db
      .update(laboratorio)
      .set({ estado: 'inactivo', updatedAt: new Date() })
      .where(eq(laboratorio.id, id))
      .returning();
    await this.audit.log({
      labId: id,
      actorId: ctx?.actorId,
      action: 'lab_deactivate',
      entity: 'laboratorio',
      entityId: id,
      before: { estado: before.estado },
      after: { estado: 'inactivo' },
      ip: ctx?.ip,
      userAgent: ctx?.userAgent,
    });
    return row;
  }

  /** Reactiva un laboratorio previamente desactivado. */
  async reactivate(id: number, ctx?: SuperActionContext) {
    const before = await this.findOne(id);
    const [row] = await this.db
      .update(laboratorio)
      .set({ estado: 'activo', updatedAt: new Date() })
      .where(eq(laboratorio.id, id))
      .returning();
    await this.audit.log({
      labId: id,
      actorId: ctx?.actorId,
      action: 'lab_reactivate',
      entity: 'laboratorio',
      entityId: id,
      before: { estado: before.estado },
      after: { estado: 'activo' },
      ip: ctx?.ip,
      userAgent: ctx?.userAgent,
    });
    return row;
  }

  /** Suspende un laboratorio (estado='suspendido'). Reversible vía reactivate. */
  async suspend(id: number, ctx?: SuperActionContext) {
    const before = await this.findOne(id);
    const [row] = await this.db
      .update(laboratorio)
      .set({ estado: 'suspendido', updatedAt: new Date() })
      .where(eq(laboratorio.id, id))
      .returning();
    await this.audit.log({
      labId: id,
      actorId: ctx?.actorId,
      action: 'lab_suspend',
      entity: 'laboratorio',
      entityId: id,
      before: { estado: before.estado },
      after: { estado: 'suspendido' },
      ip: ctx?.ip,
      userAgent: ctx?.userAgent,
    });
    return row;
  }

  /**
   * Borrado físico total de un laboratorio y TODOS sus datos.
   * Solo se puede ejecutar sobre labs con estado='inactivo'.
   * Los usuarios de Supabase Auth se borran después del commit (fire-and-forget con warn).
   */
  async purge(id: number, ctx?: SuperActionContext) {
    const lab = await this.findOne(id);
    if (lab.estado !== 'inactivo') {
      throw new ConflictException(
        'Solo se puede borrar definitivamente un laboratorio desactivado.',
      );
    }

    // Auditar ANTES de la transacción: la propia transacción borra el audit_log
    // del lab y la fila de laboratorio, por lo que un insert posterior con
    // labId=id violaría la FK (restrict) contra una fila inexistente.
    await this.audit.log({
      labId: id,
      actorId: ctx?.actorId,
      action: 'lab_purge',
      entity: 'laboratorio',
      entityId: id,
      before: { slug: lab.slug, legalName: lab.legalName, estado: lab.estado },
      ip: ctx?.ip,
      userAgent: ctx?.userAgent,
    });

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

      // 9b. lab_movimiento (restrict hacia laboratorio — F5b)
      await tx.delete(labMovimiento).where(eq(labMovimiento.labId, id));

      // 10. laboratorio (preferencia_pdf y anuncio caen por cascade; contrato.lab_creado_id queda null por set-null)
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

  /** Devuelve el período actual como 'YYYY-MM' (TZ anclada en tz.ts). */
  private periodoActual(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  /** Métricas agregadas de la plataforma (solo super). */
  async metrics(): Promise<SuperMetrics> {
    // 1. Conteo de labs por estado
    const estadoRows = await this.db
      .select({ estado: laboratorio.estado, total: sql<number>`count(*)::int` })
      .from(laboratorio)
      .groupBy(laboratorio.estado);

    const labs = { activos: 0, suspendidos: 0, inactivos: 0 };
    for (const r of estadoRows) {
      if (r.estado === 'activo') labs.activos = r.total;
      else if (r.estado === 'suspendido') labs.suspendidos = r.total;
      else if (r.estado === 'inactivo') labs.inactivos = r.total;
    }

    // 2. MRR: suma de plan.precioMensual de suscripciones activas
    const [mrrRow] = await this.db
      .select({ mrr: sql<string>`coalesce(sum(${plan.precioMensual}), 0)` })
      .from(suscripcion)
      .innerJoin(plan, eq(suscripcion.planId, plan.id))
      .where(eq(suscripcion.estado, 'activa'));
    const mrr = Number(mrrRow?.mrr ?? 0);

    // 3. Órdenes por mes (últimos 6 meses), con excedentes
    const ordenesRows = await this.db
      .select({
        periodo: sql<string>`to_char(date_trunc('month', ${order.orderDate}), 'YYYY-MM')`,
        total: sql<number>`count(*)::int`,
        excedentes: sql<number>`count(*) filter (where ${order.esExcedente})::int`,
      })
      .from(order)
      .where(sql`${order.orderDate} >= date_trunc('month', now()) - interval '5 months'`)
      .groupBy(sql`date_trunc('month', ${order.orderDate})`)
      .orderBy(sql`date_trunc('month', ${order.orderDate})`);

    const ordenesPorMes = ordenesRows.map((r) => ({
      periodo: r.periodo,
      total: r.total,
      excedentes: r.excedentes,
    }));

    // 4. Top labs por % de uso del período actual
    const periodo = this.periodoActual();
    const usoRows = await this.db
      .select({
        labId: cicloConsumo.labId,
        nombre: laboratorio.legalName,
        usadas: cicloConsumo.usadas,
        excedentes: cicloConsumo.excedentes,
        cupoBase: cicloConsumo.cupoBase,
        rollover: cicloConsumo.rollover,
      })
      .from(cicloConsumo)
      .innerJoin(laboratorio, eq(cicloConsumo.labId, laboratorio.id))
      .where(eq(cicloConsumo.periodo, periodo));

    const topLabsUso = usoRows
      .map((r) => {
        const cupoEfectivo = (r.cupoBase ?? 0) + r.rollover;
        const porcentaje = cupoEfectivo > 0 ? Math.round((r.usadas / cupoEfectivo) * 100) : 0;
        return {
          labId: r.labId,
          nombre: r.nombre,
          usadas: r.usadas,
          cupoEfectivo,
          excedentes: r.excedentes,
          porcentaje,
        };
      })
      .sort((a, b) => b.porcentaje - a.porcentaje)
      .slice(0, 8);

    return { labs, mrr, ordenesPorMes, topLabsUso };
  }

  /**
   * Export completo de un laboratorio para backup / offboarding.
   * Devuelve TODOS los datos del lab (sin secretos de usuarios).
   * v1: en memoria. TODO: para labs muy grandes, paginar/streamear órdenes,
   * resultados y attachments en lugar de cargarlos todos a la vez.
   */
  async exportLab(id: number, ctx?: SuperActionContext) {
    const lab = await this.findOne(id);

    const orders = await this.db.select().from(order).where(eq(order.labId, id));
    const orderIds = orders.map((o) => o.id);

    const [
      users,
      patients,
      doctors,
      orderPractices,
      results,
      payments,
      attachments,
      suscripciones,
      ciclos,
      practiceUnidades,
      unidades,
      preferencias,
      auditTrail,
    ] = await Promise.all([
      this.db
        .select({
          id: user.id,
          email: user.email,
          role: user.role,
          displayName: user.displayName,
          active: user.active,
        })
        .from(user)
        .where(eq(user.labId, id)),
      this.db.select().from(patient).where(eq(patient.labId, id)),
      this.db.select().from(doctor).where(eq(doctor.labId, id)),
      orderIds.length
        ? this.db.select().from(orderPractice).where(inArray(orderPractice.orderId, orderIds))
        : Promise.resolve([]),
      orderIds.length
        ? this.db
            .select()
            .from(result)
            .innerJoin(orderPractice, eq(result.orderPracticeId, orderPractice.id))
            .where(inArray(orderPractice.orderId, orderIds))
            .then((rows) => rows.map((r) => r.result))
        : Promise.resolve([]),
      orderIds.length
        ? this.db.select().from(payment).where(inArray(payment.orderId, orderIds))
        : Promise.resolve([]),
      orderIds.length
        ? this.db.select().from(attachment).where(inArray(attachment.orderId, orderIds))
        : Promise.resolve([]),
      this.db.select().from(suscripcion).where(eq(suscripcion.labId, id)),
      this.db.select().from(cicloConsumo).where(eq(cicloConsumo.labId, id)),
      this.db.select().from(practiceUnidad).where(eq(practiceUnidad.labId, id)),
      this.db.select().from(unidadMedida).where(eq(unidadMedida.labId, id)),
      this.db.select().from(preferenciaPdf).where(eq(preferenciaPdf.labId, id)),
      this.db
        .select()
        .from(auditLog)
        .where(eq(auditLog.labId, id))
        .orderBy(desc(auditLog.createdAt)),
    ]);

    await this.audit.log({
      labId: id,
      actorId: ctx?.actorId,
      action: 'lab_export',
      entity: 'laboratorio',
      entityId: id,
      ip: ctx?.ip,
      userAgent: ctx?.userAgent,
    });

    return {
      exportedAt: new Date().toISOString(),
      laboratorio: lab,
      users,
      patients,
      doctors,
      orders,
      orderPractices,
      results,
      payments,
      attachments,
      suscripciones,
      ciclosConsumo: ciclos,
      practiceUnidad: practiceUnidades,
      unidadMedida: unidades,
      preferenciaPdf: preferencias,
      auditLog: auditTrail,
    };
  }

  /** Visor de auditoría paginado (solo super). Filtro opcional por labId. */
  async auditList(params: {
    labId?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ data: AuditListItem[]; total: number }> {
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
    const offset = Math.max(params.offset ?? 0, 0);
    const where = params.labId !== undefined ? eq(auditLog.labId, params.labId) : undefined;

    const data = await this.db
      .select({
        id: auditLog.id,
        labId: auditLog.labId,
        labNombre: laboratorio.legalName,
        actorId: auditLog.actorId,
        actorEmail: user.email,
        action: auditLog.action,
        entity: auditLog.entity,
        entityId: auditLog.entityId,
        before: auditLog.before,
        after: auditLog.after,
        ip: auditLog.ip,
        userAgent: auditLog.userAgent,
        createdAt: auditLog.createdAt,
      })
      .from(auditLog)
      .leftJoin(laboratorio, eq(auditLog.labId, laboratorio.id))
      .leftJoin(user, eq(auditLog.actorId, user.id))
      .where(where)
      .orderBy(desc(auditLog.createdAt))
      .limit(limit)
      .offset(offset);

    const [countRow] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(auditLog)
      .where(where);

    return { data: data as AuditListItem[], total: countRow?.total ?? 0 };
  }

  /**
   * Checklist de onboarding de un laboratorio.
   * Items computados sobre el estado real del lab (logo, color, plan, usuarios, primera orden).
   */
  async onboarding(id: number): Promise<{
    items: Array<{ key: string; label: string; done: boolean }>;
    completados: number;
    total: number;
  }> {
    const lab = await this.findOne(id);

    const [planRow] = await this.db
      .select({ id: suscripcion.id })
      .from(suscripcion)
      .where(and(eq(suscripcion.labId, id), eq(suscripcion.estado, 'activa')))
      .limit(1);

    const [usuariosRow] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(user)
      .where(and(eq(user.labId, id), eq(user.active, true)));

    const [ordenesRow] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(order)
      .where(eq(order.labId, id));

    const items = [
      { key: 'logo', label: 'Logo cargado', done: lab.logoPath != null },
      { key: 'color', label: 'Color de marca definido', done: lab.primaryColor != null },
      { key: 'plan', label: 'Plan / suscripción activa', done: planRow != null },
      {
        key: 'usuarios',
        label: 'Al menos un usuario activo',
        done: (usuariosRow?.total ?? 0) >= 1,
      },
      {
        key: 'primera_orden',
        label: 'Primera orden registrada',
        done: (ordenesRow?.total ?? 0) >= 1,
      },
    ];

    const completados = items.filter((i) => i.done).length;
    return { items, completados, total: items.length };
  }

  private assertSlugNotReserved(slug: string): void {
    if ((RESERVED_SLUGS as readonly string[]).includes(slug)) {
      throw new BadRequestException(
        `El slug '${slug}' está reservado por el sistema y no puede ser usado`,
      );
    }
  }
}
