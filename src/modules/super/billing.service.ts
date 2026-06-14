import { AuditService } from '@/common/audit/audit.service';
import type { Db } from '@/db/client';
import { DATABASE } from '@/db/database.module';
import { labMovimiento, laboratorio } from '@/db/schema';
import { toDecimal } from '@/domain/money/money';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { CreateMovimientoDto } from './dto/movimiento.dto';
import type { SuperActionContext } from './super.service';

export interface EstadoCuenta {
  movimientos: Array<{
    id: number;
    tipo: 'cargo' | 'pago';
    monto: string;
    concepto: string;
    notas: string | null;
    fecha: Date;
    createdBy: string | null;
    createdAt: Date;
  }>;
  balance: number;
  totalPagos: number;
  totalCargos: number;
}

@Injectable()
export class BillingService {
  constructor(
    @Inject(DATABASE) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  private async assertLabExists(labId: number): Promise<void> {
    const [row] = await this.db
      .select({ id: laboratorio.id })
      .from(laboratorio)
      .where(eq(laboratorio.id, labId))
      .limit(1);
    if (!row) throw new NotFoundException(`Laboratorio ${labId} no encontrado`);
  }

  async createMovimiento(labId: number, dto: CreateMovimientoDto, ctx?: SuperActionContext) {
    await this.assertLabExists(labId);
    const [row] = await this.db
      .insert(labMovimiento)
      .values({
        labId,
        tipo: dto.tipo,
        monto: dto.monto,
        concepto: dto.concepto,
        notas: dto.notas ?? null,
        fecha: dto.fecha ? new Date(dto.fecha) : new Date(),
        createdBy: ctx?.actorId ?? null,
      })
      .returning();

    await this.audit.log({
      labId,
      actorId: ctx?.actorId,
      action: 'movimiento_create',
      entity: 'lab_movimiento',
      entityId: row.id,
      after: { tipo: row.tipo, monto: row.monto, concepto: row.concepto },
      ip: ctx?.ip,
      userAgent: ctx?.userAgent,
    });

    return row;
  }

  /** Estado de cuenta del lab: movimientos vigentes (desc por fecha) + balance con Decimal. */
  async getEstadoCuenta(labId: number): Promise<EstadoCuenta> {
    await this.assertLabExists(labId);
    const rows = await this.db
      .select()
      .from(labMovimiento)
      .where(and(eq(labMovimiento.labId, labId), isNull(labMovimiento.deletedAt)))
      .orderBy(desc(labMovimiento.fecha), desc(labMovimiento.id));

    let pagos = toDecimal('0');
    let cargos = toDecimal('0');
    for (const r of rows) {
      if (r.tipo === 'pago') pagos = pagos.plus(toDecimal(r.monto));
      else cargos = cargos.plus(toDecimal(r.monto));
    }
    // balance = pagos − cargos (positivo = a favor del lab; negativo = adeuda)
    const balance = pagos.minus(cargos);

    return {
      movimientos: rows.map((r) => ({
        id: r.id,
        tipo: r.tipo,
        monto: r.monto,
        concepto: r.concepto,
        notas: r.notas,
        fecha: r.fecha,
        createdBy: r.createdBy,
        createdAt: r.createdAt,
      })),
      balance: balance.toNumber(),
      totalPagos: pagos.toNumber(),
      totalCargos: cargos.toNumber(),
    };
  }

  /** Soft-delete de un movimiento (corrección). */
  async removeMovimiento(id: number, ctx?: SuperActionContext) {
    const [before] = await this.db
      .select()
      .from(labMovimiento)
      .where(and(eq(labMovimiento.id, id), isNull(labMovimiento.deletedAt)))
      .limit(1);
    if (!before) throw new NotFoundException(`Movimiento ${id} no encontrado`);

    await this.db
      .update(labMovimiento)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(labMovimiento.id, id));

    await this.audit.log({
      labId: before.labId,
      actorId: ctx?.actorId,
      action: 'movimiento_delete',
      entity: 'lab_movimiento',
      entityId: id,
      before: { tipo: before.tipo, monto: before.monto, concepto: before.concepto },
      ip: ctx?.ip,
      userAgent: ctx?.userAgent,
    });
  }

  /** Marca/desmarca el lab como moroso. */
  async setMoroso(labId: number, moroso: boolean, ctx?: SuperActionContext) {
    const [before] = await this.db
      .select({ id: laboratorio.id, moroso: laboratorio.moroso })
      .from(laboratorio)
      .where(eq(laboratorio.id, labId))
      .limit(1);
    if (!before) throw new NotFoundException(`Laboratorio ${labId} no encontrado`);

    const [row] = await this.db
      .update(laboratorio)
      .set({ moroso, updatedAt: new Date() })
      .where(eq(laboratorio.id, labId))
      .returning();

    await this.audit.log({
      labId,
      actorId: ctx?.actorId,
      action: 'lab_moroso_toggle',
      entity: 'laboratorio',
      entityId: labId,
      before: { moroso: before.moroso },
      after: { moroso },
      ip: ctx?.ip,
      userAgent: ctx?.userAgent,
    });

    return row;
  }
}
