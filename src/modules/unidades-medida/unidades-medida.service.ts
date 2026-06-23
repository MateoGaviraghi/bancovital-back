import type { Db } from '@/db/client';
import { DATABASE } from '@/db/database.module';
import {
  type OrderPracticeUnidadValue,
  type PracticeUnidad,
  type UnidadMedida,
  order,
  orderPractice,
  orderPracticeUnidadValue,
  practice,
  practiceUnidad,
  unidadMedida,
} from '@/db/schema';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type SQL, and, asc, eq, ilike, inArray, sql } from 'drizzle-orm';
import type { AssociateUnidadDto } from './dto/associate-unidad.dto';
import type { CreateUnidadMedidaDto } from './dto/create-unidad-medida.dto';
import type { ListUnidadesMedidaDto } from './dto/list-unidades-medida.dto';
import type { UpdateUnidadMedidaDto } from './dto/update-unidad-medida.dto';
import type { UpsertUnidadValueDto } from './dto/upsert-unidad-value.dto';

const LOADABLE_STATUSES = new Set(['borrador', 'confirmada', 'en_proceso', 'resultados_cargados']);

export interface UnidadCatalogResult {
  data: UnidadMedida[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PracticeUnidadRow {
  associationId: number;
  unidad: UnidadMedida;
  sortOrder: number;
}

export interface OrderPracticeUnidadRow {
  associationId: number;
  unidad: UnidadMedida;
  sortOrder: number;
  value: OrderPracticeUnidadValue | null;
}

@Injectable()
export class UnidadesMedidaService {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  // ─────────────────────────────── Catálogo ───────────────────────────────

  async search(labId: number, q: string, limit: number): Promise<UnidadMedida[]> {
    const filters: SQL[] = [eq(unidadMedida.labId, labId), eq(unidadMedida.active, true)];
    if (q) filters.push(ilike(unidadMedida.nombre, `%${q}%`));
    return this.db
      .select()
      .from(unidadMedida)
      .where(and(...filters))
      .orderBy(asc(unidadMedida.nombre))
      .limit(Math.min(Math.max(limit, 1), 200));
  }

  async catalog(labId: number, params: ListUnidadesMedidaDto): Promise<UnidadCatalogResult> {
    const page = Math.max(params.page ?? 1, 1);
    const pageSize = Math.min(Math.max(params.pageSize ?? 50, 1), 100);
    const status = params.status ?? 'active';

    const filters: SQL[] = [eq(unidadMedida.labId, labId)];
    if (status === 'active') filters.push(eq(unidadMedida.active, true));
    else if (status === 'inactive') filters.push(eq(unidadMedida.active, false));
    if (params.q?.trim()) filters.push(ilike(unidadMedida.nombre, `%${params.q.trim()}%`));

    const where = and(...filters);

    const [rows, totalRows] = await Promise.all([
      this.db
        .select()
        .from(unidadMedida)
        .where(where)
        .orderBy(asc(unidadMedida.nombre))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.select({ n: sql<number>`count(*)::int` }).from(unidadMedida).where(where),
    ]);

    return { data: rows, total: totalRows[0]?.n ?? 0, page, pageSize };
  }

  async byId(labId: number, id: number): Promise<UnidadMedida> {
    const [row] = await this.db
      .select()
      .from(unidadMedida)
      .where(and(eq(unidadMedida.id, id), eq(unidadMedida.labId, labId)))
      .limit(1);
    if (!row) throw new NotFoundException(`Unidad ${id} no encontrada`);
    return row;
  }

  async create(
    labId: number,
    dto: CreateUnidadMedidaDto,
    createdBy: string,
  ): Promise<UnidadMedida> {
    const nombre = dto.nombre.trim();
    if (!nombre) throw new BadRequestException('nombre es requerido');

    const [dup] = await this.db
      .select({ id: unidadMedida.id })
      .from(unidadMedida)
      .where(
        and(eq(unidadMedida.labId, labId), sql`lower(${unidadMedida.nombre}) = lower(${nombre})`),
      )
      .limit(1);
    if (dup) {
      throw new ConflictException(
        `Ya existe una unidad con nombre "${nombre}" en este laboratorio`,
      );
    }

    const [row] = await this.db
      .insert(unidadMedida)
      .values({
        labId,
        nombre,
        simbolo: dto.simbolo?.trim() || null,
        opcionesPredeterminadas: dto.opcionesPredeterminadas ?? null,
        createdBy,
      })
      .returning();
    return row;
  }

  async update(labId: number, id: number, dto: UpdateUnidadMedidaDto): Promise<UnidadMedida> {
    const current = await this.byId(labId, id);

    if (
      dto.nombre !== undefined &&
      dto.nombre.trim().toLowerCase() !== current.nombre.toLowerCase()
    ) {
      const nombre = dto.nombre.trim();
      const [dup] = await this.db
        .select({ id: unidadMedida.id })
        .from(unidadMedida)
        .where(
          and(eq(unidadMedida.labId, labId), sql`lower(${unidadMedida.nombre}) = lower(${nombre})`),
        )
        .limit(1);
      if (dup && dup.id !== id) {
        throw new ConflictException(`Ya existe una unidad con nombre "${nombre}"`);
      }
    }

    const patch: Partial<UnidadMedida> = {
      ...(dto.nombre !== undefined && { nombre: dto.nombre.trim() }),
      ...(dto.simbolo !== undefined && { simbolo: dto.simbolo }),
      ...('opcionesPredeterminadas' in dto && {
        opcionesPredeterminadas: (dto.opcionesPredeterminadas as string[] | null) ?? null,
      }),
      updatedAt: new Date(),
    };

    const [row] = await this.db
      .update(unidadMedida)
      .set(patch)
      .where(and(eq(unidadMedida.id, id), eq(unidadMedida.labId, labId)))
      .returning();
    return row;
  }

  async deactivate(labId: number, id: number): Promise<UnidadMedida> {
    const current = await this.byId(labId, id);
    if (!current.active) return current;

    // Bloquear si está siendo usada actualmente (asociaciones a prácticas o valores cargados).
    const [assoc] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(practiceUnidad)
      .where(and(eq(practiceUnidad.labId, labId), eq(practiceUnidad.unidadId, id)));
    if ((assoc?.n ?? 0) > 0) {
      throw new ConflictException(
        `No se puede desactivar: la unidad está asociada a ${assoc?.n} práctica(s). Desasocialas primero.`,
      );
    }

    const [row] = await this.db
      .update(unidadMedida)
      .set({ active: false, updatedAt: new Date() })
      .where(and(eq(unidadMedida.id, id), eq(unidadMedida.labId, labId)))
      .returning();
    return row;
  }

  // ──────────────────────── Asociación con práctica ────────────────────────

  async listForPractice(labId: number, practiceId: number): Promise<PracticeUnidadRow[]> {
    await this.requirePractice(practiceId);
    const rows = await this.db
      .select({
        associationId: practiceUnidad.id,
        sortOrder: practiceUnidad.sortOrder,
        unidad: unidadMedida,
      })
      .from(practiceUnidad)
      .innerJoin(unidadMedida, eq(unidadMedida.id, practiceUnidad.unidadId))
      .where(and(eq(practiceUnidad.labId, labId), eq(practiceUnidad.practiceId, practiceId)))
      .orderBy(asc(practiceUnidad.sortOrder), asc(practiceUnidad.id));
    return rows;
  }

  async associate(
    labId: number,
    practiceId: number,
    dto: AssociateUnidadDto,
  ): Promise<PracticeUnidad> {
    await this.requirePractice(practiceId);
    const unidad = await this.byId(labId, dto.unidadId);
    if (!unidad.active) {
      throw new ConflictException(`La unidad ${unidad.nombre} está inactiva`);
    }

    const [existing] = await this.db
      .select()
      .from(practiceUnidad)
      .where(
        and(
          eq(practiceUnidad.labId, labId),
          eq(practiceUnidad.practiceId, practiceId),
          eq(practiceUnidad.unidadId, dto.unidadId),
        ),
      )
      .limit(1);
    if (existing) {
      throw new ConflictException('La unidad ya está asociada a esta práctica');
    }

    const [row] = await this.db
      .insert(practiceUnidad)
      .values({
        labId,
        practiceId,
        unidadId: dto.unidadId,
        sortOrder: dto.sortOrder ?? 0,
      })
      .returning();
    return row;
  }

  async dissociate(labId: number, practiceId: number, unidadId: number): Promise<void> {
    const [assoc] = await this.db
      .select()
      .from(practiceUnidad)
      .where(
        and(
          eq(practiceUnidad.labId, labId),
          eq(practiceUnidad.practiceId, practiceId),
          eq(practiceUnidad.unidadId, unidadId),
        ),
      )
      .limit(1);
    if (!assoc) {
      throw new NotFoundException('La unidad no está asociada a esa práctica');
    }

    // Eliminar en cascada los valores cargados en órdenes del lab para esta práctica/unidad,
    // luego eliminar la asociación. No bloqueamos aunque haya órdenes emitidas.
    const affectedOpIds = await this.db
      .select({ id: orderPractice.id })
      .from(orderPractice)
      .innerJoin(order, eq(order.id, orderPractice.orderId))
      .where(and(eq(order.labId, labId), eq(orderPractice.practiceId, practiceId)));

    if (affectedOpIds.length > 0) {
      await this.db.delete(orderPracticeUnidadValue).where(
        and(
          inArray(
            orderPracticeUnidadValue.orderPracticeId,
            affectedOpIds.map((r) => r.id),
          ),
          eq(orderPracticeUnidadValue.unidadId, unidadId),
        ),
      );
    }

    await this.db.delete(practiceUnidad).where(eq(practiceUnidad.id, assoc.id));
  }

  // ────────────────────── Valores en order-practice ──────────────────────

  async listValuesForOrderPractice(
    labId: number,
    orderPracticeId: number,
  ): Promise<OrderPracticeUnidadRow[]> {
    const op = await this.requireOrderPractice(labId, orderPracticeId);
    if (op.practiceId === null) return [];

    // 1. unidades configuradas para esta práctica en el lab
    const associations = await this.db
      .select({
        associationId: practiceUnidad.id,
        sortOrder: practiceUnidad.sortOrder,
        unidad: unidadMedida,
      })
      .from(practiceUnidad)
      .innerJoin(unidadMedida, eq(unidadMedida.id, practiceUnidad.unidadId))
      .where(and(eq(practiceUnidad.labId, labId), eq(practiceUnidad.practiceId, op.practiceId)))
      .orderBy(asc(practiceUnidad.sortOrder), asc(practiceUnidad.id));

    if (associations.length === 0) return [];

    // 2. valores ya cargados para este order_practice
    const values = await this.db
      .select()
      .from(orderPracticeUnidadValue)
      .where(eq(orderPracticeUnidadValue.orderPracticeId, orderPracticeId));
    const byUnidad = new Map(values.map((v) => [v.unidadId, v]));

    return associations.map((a) => ({
      associationId: a.associationId,
      sortOrder: a.sortOrder,
      unidad: a.unidad,
      value: byUnidad.get(a.unidad.id) ?? null,
    }));
  }

  async upsertValue(
    labId: number,
    orderPracticeId: number,
    dto: UpsertUnidadValueDto,
    enteredBy: string,
  ): Promise<OrderPracticeUnidadValue> {
    if (!dto.valueNumeric && !dto.valueText) {
      throw new BadRequestException('Debe enviar valueNumeric o valueText (al menos uno)');
    }

    const op = await this.requireOrderPractice(labId, orderPracticeId);
    if (op.practiceId === null) {
      throw new ConflictException('Las líneas sintéticas no admiten unidades');
    }

    const [ord] = await this.db
      .select({ status: order.status })
      .from(order)
      .where(and(eq(order.id, op.orderId), eq(order.labId, labId)))
      .limit(1);
    if (!ord) throw new NotFoundException('Orden no encontrada');
    if (!LOADABLE_STATUSES.has(ord.status)) {
      throw new ConflictException(
        `No se pueden cargar valores en orden con estado "${ord.status}".`,
      );
    }

    // La unidad debe estar asociada a la práctica en este lab.
    const [assoc] = await this.db
      .select({ unidad: unidadMedida })
      .from(practiceUnidad)
      .innerJoin(unidadMedida, eq(unidadMedida.id, practiceUnidad.unidadId))
      .where(
        and(
          eq(practiceUnidad.labId, labId),
          eq(practiceUnidad.practiceId, op.practiceId),
          eq(practiceUnidad.unidadId, dto.unidadId),
        ),
      )
      .limit(1);
    if (!assoc) {
      throw new ConflictException(
        `La unidad ${dto.unidadId} no está asociada a la práctica de esta línea`,
      );
    }

    const [existing] = await this.db
      .select()
      .from(orderPracticeUnidadValue)
      .where(
        and(
          eq(orderPracticeUnidadValue.orderPracticeId, orderPracticeId),
          eq(orderPracticeUnidadValue.unidadId, dto.unidadId),
        ),
      )
      .limit(1);

    if (existing) {
      const [row] = await this.db
        .update(orderPracticeUnidadValue)
        .set({
          valueNumeric: dto.valueNumeric ?? null,
          valueText: dto.valueText ?? null,
          notes: dto.notes ?? null,
          enteredBy,
          updatedAt: new Date(),
        })
        .where(eq(orderPracticeUnidadValue.id, existing.id))
        .returning();
      return row;
    }

    const [row] = await this.db
      .insert(orderPracticeUnidadValue)
      .values({
        orderPracticeId,
        unidadId: dto.unidadId,
        unidadNombreSnapshot: assoc.unidad.nombre,
        unidadSimboloSnapshot: assoc.unidad.simbolo,
        valueNumeric: dto.valueNumeric ?? null,
        valueText: dto.valueText ?? null,
        notes: dto.notes ?? null,
        enteredBy,
      })
      .returning();
    return row;
  }

  async deleteValue(labId: number, orderPracticeId: number, unidadId: number): Promise<void> {
    const op = await this.requireOrderPractice(labId, orderPracticeId);
    const [ord] = await this.db
      .select({ status: order.status })
      .from(order)
      .where(and(eq(order.id, op.orderId), eq(order.labId, labId)))
      .limit(1);
    if (!ord) throw new NotFoundException('Orden no encontrada');
    if (!LOADABLE_STATUSES.has(ord.status)) {
      throw new ConflictException(
        `No se pueden modificar valores en orden con estado "${ord.status}".`,
      );
    }
    await this.db
      .delete(orderPracticeUnidadValue)
      .where(
        and(
          eq(orderPracticeUnidadValue.orderPracticeId, orderPracticeId),
          eq(orderPracticeUnidadValue.unidadId, unidadId),
        ),
      );
  }

  // ───────────────────────────── helpers ─────────────────────────────

  private async requirePractice(id: number) {
    const [row] = await this.db.select().from(practice).where(eq(practice.id, id)).limit(1);
    if (!row) throw new NotFoundException(`Práctica ${id} no encontrada`);
    return row;
  }

  private async requireOrderPractice(labId: number, id: number) {
    const [row] = await this.db
      .select({
        id: orderPractice.id,
        orderId: orderPractice.orderId,
        practiceId: orderPractice.practiceId,
      })
      .from(orderPractice)
      .innerJoin(order, eq(order.id, orderPractice.orderId))
      .where(and(eq(orderPractice.id, id), eq(order.labId, labId)))
      .limit(1);
    if (!row) throw new NotFoundException(`Línea de orden ${id} no encontrada`);
    return row;
  }
}
