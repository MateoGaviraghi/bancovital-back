import { isUniqueViolation } from '@/common/db-errors';
import type { Db } from '@/db/client';
import { DATABASE } from '@/db/database.module';
import { cicloConsumo, plan, suscripcion } from '@/db/schema';
import { ConsumoService } from '@/modules/consumo/consumo.service';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import type { CreatePlanDto, SetSubscriptionDto, UpdatePlanDto } from './dto/plan.dto';

@Injectable()
export class PlansService {
  constructor(
    @Inject(DATABASE) private readonly db: Db,
    private readonly consumo: ConsumoService,
  ) {}

  list() {
    return this.db.select().from(plan).where(isNull(plan.deletedAt)).orderBy(plan.nombre);
  }

  async findOne(id: number) {
    const [row] = await this.db
      .select()
      .from(plan)
      .where(and(eq(plan.id, id), isNull(plan.deletedAt)))
      .limit(1);
    if (!row) throw new NotFoundException(`Plan ${id} no encontrado`);
    return row;
  }

  async create(dto: CreatePlanDto) {
    try {
      const [row] = await this.db
        .insert(plan)
        .values({
          nombre: dto.nombre,
          cupoOrdenesMes: dto.cupoOrdenesMes,
          precioMensual: dto.precioMensual,
          precioOrdenExcedente: dto.precioOrdenExcedente,
        })
        .returning();
      return row;
    } catch (err: unknown) {
      if (isUniqueViolation(err))
        throw new ConflictException(`El nombre '${dto.nombre}' ya existe`);
      throw err;
    }
  }

  async update(id: number, dto: UpdatePlanDto) {
    await this.findOne(id);
    try {
      const [row] = await this.db
        .update(plan)
        .set({
          ...(dto.nombre !== undefined && { nombre: dto.nombre }),
          ...(dto.cupoOrdenesMes !== undefined && { cupoOrdenesMes: dto.cupoOrdenesMes }),
          ...(dto.precioMensual !== undefined && { precioMensual: dto.precioMensual }),
          ...(dto.precioOrdenExcedente !== undefined && {
            precioOrdenExcedente: dto.precioOrdenExcedente,
          }),
          updatedAt: new Date(),
        })
        .where(and(eq(plan.id, id), isNull(plan.deletedAt)))
        .returning();
      return row;
    } catch (err: unknown) {
      if (isUniqueViolation(err))
        throw new ConflictException(`El nombre '${dto.nombre}' ya existe`);
      throw err;
    }
  }

  async remove(id: number) {
    await this.findOne(id);

    // Verificar que no tenga suscripciones activas
    const [susActiva] = await this.db
      .select({ id: suscripcion.id })
      .from(suscripcion)
      .where(and(eq(suscripcion.planId, id), eq(suscripcion.estado, 'activa')))
      .limit(1);

    if (susActiva) {
      throw new ConflictException(
        'No se puede eliminar el plan: tiene suscripciones activas. Cancelá la suscripción primero.',
      );
    }

    await this.db
      .update(plan)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(plan.id, id));
  }

  /**
   * PUT /super/labs/:id/subscription
   * Cancela la suscripción activa anterior (si existe) y crea una nueva.
   * Actualiza cupo_base del ciclo corriente al cupo del plan nuevo.
   */
  async setSubscription(labId: number, dto: SetSubscriptionDto) {
    const planRow = await this.findOne(dto.planId);

    await this.db.transaction(async (tx) => {
      // Cancelar suscripción activa anterior
      await tx
        .update(suscripcion)
        .set({ estado: 'cancelada', hasta: new Date(), updatedAt: new Date() })
        .where(and(eq(suscripcion.labId, labId), eq(suscripcion.estado, 'activa')));

      // Crear nueva suscripción
      await tx.insert(suscripcion).values({
        labId,
        planId: dto.planId,
        estado: 'activa',
        desde: new Date(),
      });

      // Actualizar cupo_base del ciclo corriente (si existe)
      const periodo = this.consumo.periodoActual();
      await tx
        .update(cicloConsumo)
        .set({ cupoBase: planRow.cupoOrdenesMes, updatedAt: new Date() })
        .where(and(eq(cicloConsumo.labId, labId), eq(cicloConsumo.periodo, periodo)));
    });

    return this.getSuscripcionActiva(labId);
  }

  /**
   * DELETE /super/labs/:id/subscription
   * Cancela la suscripción activa. El ciclo corriente queda con cupo_base=null.
   */
  async cancelSubscription(labId: number) {
    const [sus] = await this.db
      .select()
      .from(suscripcion)
      .where(and(eq(suscripcion.labId, labId), eq(suscripcion.estado, 'activa')))
      .limit(1);

    if (!sus) throw new NotFoundException(`El laboratorio ${labId} no tiene suscripción activa`);

    await this.db.transaction(async (tx) => {
      await tx
        .update(suscripcion)
        .set({ estado: 'cancelada', hasta: new Date(), updatedAt: new Date() })
        .where(and(eq(suscripcion.labId, labId), eq(suscripcion.estado, 'activa')));

      // Ciclo corriente sin plan
      const periodo = this.consumo.periodoActual();
      await tx
        .update(cicloConsumo)
        .set({ cupoBase: null, updatedAt: new Date() })
        .where(and(eq(cicloConsumo.labId, labId), eq(cicloConsumo.periodo, periodo)));
    });
  }

  private async getSuscripcionActiva(labId: number) {
    const [row] = await this.db
      .select()
      .from(suscripcion)
      .where(and(eq(suscripcion.labId, labId), eq(suscripcion.estado, 'activa')))
      .limit(1);
    return row ?? null;
  }
}
