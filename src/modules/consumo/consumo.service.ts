import type { Db } from '@/db/client';
import { DATABASE } from '@/db/database.module';
import { cicloConsumo, laboratorio, plan, suscripcion } from '@/db/schema';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';

export interface RegistrarOrdenResult {
  esExcedente: boolean;
}

export interface ConsumoCicloDto {
  labId: number;
  periodo: string;
  cupoBase: number | null;
  rollover: number;
  cupoEfectivo: number | null;
  usadas: number;
  excedentes: number;
  restantes: number | null;
  porcentaje: number | null;
  plan: {
    id: number;
    nombre: string;
    cupoOrdenesMes: number;
    precioOrdenExcedente: string;
  } | null;
}

export interface ConsumoResumenItem {
  labId: number;
  slug: string;
  nombre: string;
  plan: { id: number; nombre: string } | null;
  periodo: string;
  cupoEfectivo: number | null;
  usadas: number;
  excedentes: number;
  porcentaje: number | null;
}

@Injectable()
export class ConsumoService {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  /**
   * Devuelve el período actual como 'YYYY-MM'.
   * La TZ ya está anclada a America/Argentina/Buenos_Aires en tz.ts.
   */
  periodoActual(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  /**
   * Calcula el rollover desde el ciclo anterior.
   * rollover = max(0, cupoBaseAnterior - max(0, usadasAnterior - rolloverAnterior))
   * Si el ciclo anterior no existe o cupo_base es null → rollover 0.
   * El rollover NO se encadena (vigencia 1 mes exacta).
   */
  private calcularRollover(
    anterior: { cupoBase: number | null; usadas: number; rollover: number } | undefined,
  ): number {
    if (!anterior || anterior.cupoBase === null) return 0;
    const sobrante = anterior.cupoBase - Math.max(0, anterior.usadas - anterior.rollover);
    return Math.max(0, sobrante);
  }

  /**
   * Resuelve la suscripción activa de un lab y devuelve el cupo_ordenes_mes del plan.
   * Retorna null si no hay suscripción activa.
   */
  private async cupoDelPlanActivo(
    labId: number,
    tx?: Parameters<Parameters<Db['transaction']>[0]>[0],
  ): Promise<{ cupo: number | null; planRow: typeof plan.$inferSelect | null }> {
    const db = tx ?? this.db;
    const [sus] = await db
      .select({ planId: suscripcion.planId })
      .from(suscripcion)
      .where(and(eq(suscripcion.labId, labId), eq(suscripcion.estado, 'activa')))
      .limit(1);

    if (!sus) return { cupo: null, planRow: null };

    const [planRow] = await db
      .select()
      .from(plan)
      .where(and(eq(plan.id, sus.planId), isNull(plan.deletedAt)))
      .limit(1);

    if (!planRow) return { cupo: null, planRow: null };
    return { cupo: planRow.cupoOrdenesMes, planRow };
  }

  /**
   * Obtiene el ciclo del período actual, creándolo si no existe.
   * Acepta una transacción opcional para llamarse desde dentro de otra tx.
   */
  async getOrCreateCiclo(
    labId: number,
    tx?: Parameters<Parameters<Db['transaction']>[0]>[0],
  ): Promise<typeof cicloConsumo.$inferSelect> {
    const db = tx ?? this.db;
    const periodo = this.periodoActual();

    // Buscar ciclo existente
    const [existente] = await db
      .select()
      .from(cicloConsumo)
      .where(and(eq(cicloConsumo.labId, labId), eq(cicloConsumo.periodo, periodo)))
      .limit(1);

    if (existente) return existente;

    // Calcular período anterior
    const [y, m] = periodo.split('-').map(Number) as [number, number];
    const fechaAnterior = new Date(y, m - 2, 1); // m-1 es el mes actual (0-indexed), m-2 es el anterior
    const periodoAnterior = `${fechaAnterior.getFullYear()}-${String(fechaAnterior.getMonth() + 1).padStart(2, '0')}`;

    // Leer ciclo anterior para rollover
    const [anterior] = await db
      .select()
      .from(cicloConsumo)
      .where(and(eq(cicloConsumo.labId, labId), eq(cicloConsumo.periodo, periodoAnterior)))
      .limit(1);

    const rollover = this.calcularRollover(
      anterior
        ? { cupoBase: anterior.cupoBase, usadas: anterior.usadas, rollover: anterior.rollover }
        : undefined,
    );

    const { cupo } = await this.cupoDelPlanActivo(labId, tx);

    const [nuevo] = await db
      .insert(cicloConsumo)
      .values({
        labId,
        periodo,
        cupoBase: cupo,
        rollover,
        usadas: 0,
        excedentes: 0,
      })
      .onConflictDoNothing()
      .returning();

    // Si hubo conflicto (race condition), releer
    if (!nuevo) {
      const [reciente] = await db
        .select()
        .from(cicloConsumo)
        .where(and(eq(cicloConsumo.labId, labId), eq(cicloConsumo.periodo, periodo)))
        .limit(1);
      return reciente!;
    }

    return nuevo;
  }

  /**
   * Registra una orden dentro de la misma transacción que crea la orden.
   * Nunca lanza error por cupo (soft-block).
   * Devuelve { esExcedente: true } si superó cupo+rollover.
   */
  async registrarOrden(
    labId: number,
    tx: Parameters<Parameters<Db['transaction']>[0]>[0],
  ): Promise<RegistrarOrdenResult> {
    const periodo = this.periodoActual();

    // UPDATE atómico con RETURNING
    const [updated] = await tx
      .update(cicloConsumo)
      .set({
        usadas: sql`${cicloConsumo.usadas} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(cicloConsumo.labId, labId), eq(cicloConsumo.periodo, periodo)))
      .returning();

    // Si no existía el ciclo, crearlo y luego registrar (puede pasar en primera orden del mes)
    if (!updated) {
      await this.getOrCreateCiclo(labId, tx);
      const [updated2] = await tx
        .update(cicloConsumo)
        .set({
          usadas: sql`${cicloConsumo.usadas} + 1`,
          updatedAt: new Date(),
        })
        .where(and(eq(cicloConsumo.labId, labId), eq(cicloConsumo.periodo, periodo)))
        .returning();
      return this.evaluarExcedente(labId, updated2!, tx);
    }

    return this.evaluarExcedente(labId, updated, tx);
  }

  private async evaluarExcedente(
    labId: number,
    ciclo: typeof cicloConsumo.$inferSelect,
    tx: Parameters<Parameters<Db['transaction']>[0]>[0],
  ): Promise<RegistrarOrdenResult> {
    // Sin plan => sin límite, nunca excedente
    if (ciclo.cupoBase === null) return { esExcedente: false };

    const cupoEfectivo = ciclo.cupoBase + ciclo.rollover;
    const esExcedente = ciclo.usadas > cupoEfectivo;

    if (esExcedente) {
      await tx
        .update(cicloConsumo)
        .set({
          excedentes: sql`${cicloConsumo.excedentes} + 1`,
          updatedAt: new Date(),
        })
        .where(and(eq(cicloConsumo.labId, labId), eq(cicloConsumo.periodo, ciclo.periodo)));
    }

    return { esExcedente };
  }

  /**
   * Devuelve el resumen de consumo del ciclo actual para un lab.
   */
  async getConsumo(labId: number): Promise<ConsumoCicloDto> {
    const periodo = this.periodoActual();
    const ciclo = await this.getOrCreateCiclo(labId);

    const { planRow } = await this.cupoDelPlanActivo(labId);

    const cupoEfectivo = ciclo.cupoBase !== null ? ciclo.cupoBase + ciclo.rollover : null;

    const porcentaje =
      cupoEfectivo !== null && cupoEfectivo > 0
        ? Math.round((ciclo.usadas / cupoEfectivo) * 100)
        : null;

    return {
      labId,
      periodo,
      cupoBase: ciclo.cupoBase,
      rollover: ciclo.rollover,
      cupoEfectivo,
      usadas: ciclo.usadas,
      excedentes: ciclo.excedentes,
      restantes: cupoEfectivo !== null ? Math.max(0, cupoEfectivo - ciclo.usadas) : null,
      porcentaje,
      plan: planRow
        ? {
            id: planRow.id,
            nombre: planRow.nombre,
            cupoOrdenesMes: planRow.cupoOrdenesMes,
            precioOrdenExcedente: planRow.precioOrdenExcedente,
          }
        : null,
    };
  }

  /**
   * Resumen de consumo de TODOS los labs activos (para super admin).
   */
  async getConsumoResumen(): Promise<ConsumoResumenItem[]> {
    const periodo = this.periodoActual();

    const labs = await this.db.select().from(laboratorio).where(eq(laboratorio.estado, 'activo'));

    const result: ConsumoResumenItem[] = [];

    for (const lab of labs) {
      const ciclo = await this.getOrCreateCiclo(lab.id);

      const [sus] = await this.db
        .select({ planId: suscripcion.planId })
        .from(suscripcion)
        .where(and(eq(suscripcion.labId, lab.id), eq(suscripcion.estado, 'activa')))
        .limit(1);

      let planResumen: { id: number; nombre: string } | null = null;
      if (sus) {
        const [planRow] = await this.db
          .select({ id: plan.id, nombre: plan.nombre })
          .from(plan)
          .where(and(eq(plan.id, sus.planId), isNull(plan.deletedAt)))
          .limit(1);
        if (planRow) planResumen = planRow;
      }

      const cupoEfectivo = ciclo.cupoBase !== null ? ciclo.cupoBase + ciclo.rollover : null;
      const porcentaje =
        cupoEfectivo !== null && cupoEfectivo > 0
          ? Math.round((ciclo.usadas / cupoEfectivo) * 100)
          : null;

      result.push({
        labId: lab.id,
        slug: lab.slug,
        nombre: lab.legalName,
        plan: planResumen,
        periodo,
        cupoEfectivo,
        usadas: ciclo.usadas,
        excedentes: ciclo.excedentes,
        porcentaje,
      });
    }

    return result;
  }
}
