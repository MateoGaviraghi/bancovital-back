import type { Db } from '@/db/client';
import { DATABASE, SUPABASE_ADMIN } from '@/db/database.module';
import {
  doctor,
  insurer,
  order,
  orderPractice,
  patient,
  practice,
  result,
  ubValue,
} from '@/db/schema';
import type { NewOrder, NewOrderPractice, Order, OrderPractice } from '@/db/schema';
import {
  type PriceablePractice,
  type PricedLine,
  calculateOrderPricing,
} from '@/domain/pricing/pricing';
import { type OrderStatus, canTransition } from '@/domain/status/status';
import { ConsumoService } from '@/modules/consumo/consumo.service';
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from 'drizzle-orm';
import type { CancelOrderDto } from './dto/cancel-order.dto';
import type { CreateOrderDto, OrderPracticeInputDto } from './dto/create-order.dto';
import type { ListOrdersDto } from './dto/list-orders.dto';
import type { UpdateOrderDto } from './dto/update-order.dto';

const PARTICULAR_CODE = 'PARTICULAR';
const REPORTS_BUCKET = 'reports';

export interface OrderSummary extends Order {
  patient: { id: number; firstName: string; lastName: string; dni: string } | null;
  insurer: { id: number; code: string; name: string } | null;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Db,
    @Inject(SUPABASE_ADMIN) private readonly storage: SupabaseClient,
    private readonly consumo: ConsumoService,
  ) {}

  async create(
    labId: number,
    dto: CreateOrderDto,
    createdBy: string,
  ): Promise<{ order: Order; lines: OrderPractice[] }> {
    const pat = await this.resolvePatient(labId, dto.patientId);
    const ins = await this.resolveInsurer(dto.insurerId);
    const effectivePractices = await this.expandWithChildren(dto.practices);
    const practices = await this.resolvePractices(effectivePractices);
    const ubInsurer = await this.resolveCurrentUb(ins.id, ins.code);
    const ubParticular =
      ins.code === PARTICULAR_CODE ? ubInsurer : await this.resolveCurrentUbByCode(PARTICULAR_CODE);

    const referringDoctorSnapshot = await this.resolveDoctorSnapshot(labId, dto);

    const priceableInputs: PriceablePractice[] = effectivePractices.map((line) => {
      const p = practices.get(line.practiceId)!;
      if (p.units === null) {
        throw new UnprocessableEntityException(
          `La practica ${p.nbuCode} (${p.name}) no tiene U.B. asignada en el nomenclador y no puede facturarse`,
        );
      }
      return {
        practiceId: p.id,
        nbuCode: p.nbuCode,
        name: p.name,
        units: p.units,
        isSpecialAct: p.isSpecialAct,
      };
    });

    const pricing = calculateOrderPricing({
      insurerCode: ins.code,
      ubInsurer: ubInsurer.value,
      ubParticular: ubParticular.value,
      isUrgent: dto.isUrgent,
      practices: priceableInputs,
    });

    const userInputByPracticeId = new Map<number, OrderPracticeInputDto>(
      effectivePractices.map((l) => [l.practiceId, l]),
    );

    return this.db.transaction(async (tx) => {
      // Registrar consumo ANTES de insertar la orden para tener el flag correcto
      const { esExcedente } = await this.consumo.registrarOrden(labId, tx);

      const orderValues: NewOrder = {
        labId,
        patientId: pat.id,
        insurerId: ins.id,
        insuranceAffiliateNumber: dto.insuranceAffiliateNumber ?? null,
        referringDoctorId: referringDoctorSnapshot.id,
        referringDoctorName: referringDoctorSnapshot.name,
        referringDoctorMp: referringDoctorSnapshot.mp,
        diagnosis: dto.diagnosis ?? null,
        origin: dto.origin,
        isUrgent: dto.isUrgent,
        notes: dto.notes ?? null,
        status: 'borrador',
        totalParticular: pricing.totals.particular,
        totalInsurer: pricing.totals.insurer,
        totalPatientCopay: pricing.totals.patientCopay,
        ubValueUsed: pricing.ubValueUsed,
        createdBy,
        esExcedente,
      };
      const [insertedOrder] = await tx.insert(order).values(orderValues).returning();

      const lineRows: NewOrderPractice[] = pricing.lines.map((l: PricedLine, idx: number) => {
        const userInput =
          l.practiceId !== null ? userInputByPracticeId.get(l.practiceId) : undefined;
        return {
          orderId: insertedOrder.id,
          practiceId: l.practiceId,
          nbuCodeSnapshot: l.nbuCode,
          nameSnapshot: l.name,
          unitsSnapshot: l.units,
          ubValueSnapshot: l.ubValue,
          priceParticular: l.priceParticular,
          priceInsurer: l.priceInsurer,
          patientCopay: l.patientCopay,
          authorizationCode: userInput?.authorizationCode ?? null,
          includeInReport: userInput?.includeInReport ?? true,
          sortOrder: userInput?.sortOrder ?? idx,
          authorizationStatus: 'no_aplica',
        };
      });

      const insertedLines = await tx.insert(orderPractice).values(lineRows).returning();
      return { order: insertedOrder, lines: insertedLines };
    });
  }

  async update(
    labId: number,
    id: number,
    dto: UpdateOrderDto,
  ): Promise<{ order: Order; lines: OrderPractice[] }> {
    const current = await this.requireOrder(labId, id);
    if (current.status !== 'borrador') {
      throw new ConflictException(
        `Solo se pueden editar ordenes en estado "borrador" (estado actual: ${current.status})`,
      );
    }

    // Defensa anti-IDOR cross-lab: si se reasigna el paciente, validar que
    // pertenezca a este lab (filtra por patient.labId + deletedAt) ANTES de
    // persistir, igual que create(). Aplica a ambas ramas del update.
    if (dto.patientId !== undefined) {
      await this.resolvePatient(labId, dto.patientId);
    }

    const effectiveInsurerId = dto.insurerId ?? current.insurerId;
    const effectiveIsUrgent = dto.isUrgent ?? current.isUrgent;

    const ins = await this.resolveInsurer(effectiveInsurerId);

    const doctorSnapshot =
      dto.referringDoctorId !== undefined || dto.referringDoctorName !== undefined
        ? await this.resolveDoctorSnapshot(labId, {
            referringDoctorId: dto.referringDoctorId,
            referringDoctorName: dto.referringDoctorName,
            referringDoctorMp: dto.referringDoctorMp,
          } as CreateOrderDto)
        : undefined;

    if (dto.practices) {
      const effectivePractices = await this.expandWithChildren(dto.practices);
      const practices = await this.resolvePractices(effectivePractices);
      const ubInsurer = await this.resolveCurrentUb(ins.id, ins.code);
      const ubParticular =
        ins.code === PARTICULAR_CODE
          ? ubInsurer
          : await this.resolveCurrentUbByCode(PARTICULAR_CODE);

      const priceableInputs: PriceablePractice[] = effectivePractices.map((line) => {
        const p = practices.get(line.practiceId)!;
        if (p.units === null) {
          throw new UnprocessableEntityException(
            `La practica ${p.nbuCode} (${p.name}) no tiene U.B. asignada`,
          );
        }
        return {
          practiceId: p.id,
          nbuCode: p.nbuCode,
          name: p.name,
          units: p.units,
          isSpecialAct: p.isSpecialAct,
        };
      });

      const pricing = calculateOrderPricing({
        insurerCode: ins.code,
        ubInsurer: ubInsurer.value,
        ubParticular: ubParticular.value,
        isUrgent: effectiveIsUrgent,
        practices: priceableInputs,
      });

      const userInputByPracticeId = new Map<number, OrderPracticeInputDto>(
        effectivePractices.map((l) => [l.practiceId, l]),
      );

      return this.db.transaction(async (tx) => {
        await tx.delete(orderPractice).where(eq(orderPractice.orderId, id));

        const [updatedOrder] = await tx
          .update(order)
          .set({
            ...(dto.patientId !== undefined && { patientId: dto.patientId }),
            insurerId: ins.id,
            ...(dto.insuranceAffiliateNumber !== undefined && {
              insuranceAffiliateNumber: dto.insuranceAffiliateNumber ?? null,
            }),
            ...(doctorSnapshot && {
              referringDoctorId: doctorSnapshot.id,
              referringDoctorName: doctorSnapshot.name,
              referringDoctorMp: doctorSnapshot.mp,
            }),
            ...(dto.diagnosis !== undefined && { diagnosis: dto.diagnosis ?? null }),
            ...(dto.origin !== undefined && { origin: dto.origin }),
            isUrgent: effectiveIsUrgent,
            ...(dto.notes !== undefined && { notes: dto.notes ?? null }),
            totalParticular: pricing.totals.particular,
            totalInsurer: pricing.totals.insurer,
            totalPatientCopay: pricing.totals.patientCopay,
            ubValueUsed: pricing.ubValueUsed,
            updatedAt: new Date(),
          })
          .where(and(eq(order.id, id), eq(order.labId, labId)))
          .returning();

        const lineRows: NewOrderPractice[] = pricing.lines.map((l: PricedLine, idx: number) => {
          const userInput =
            l.practiceId !== null ? userInputByPracticeId.get(l.practiceId) : undefined;
          return {
            orderId: id,
            practiceId: l.practiceId,
            nbuCodeSnapshot: l.nbuCode,
            nameSnapshot: l.name,
            unitsSnapshot: l.units,
            ubValueSnapshot: l.ubValue,
            priceParticular: l.priceParticular,
            priceInsurer: l.priceInsurer,
            patientCopay: l.patientCopay,
            authorizationCode: userInput?.authorizationCode ?? null,
            includeInReport: userInput?.includeInReport ?? true,
            sortOrder: userInput?.sortOrder ?? idx,
            authorizationStatus: 'no_aplica',
          };
        });

        const insertedLines = await tx.insert(orderPractice).values(lineRows).returning();
        return { order: updatedOrder, lines: insertedLines };
      });
    }

    // Sin cambio de prácticas en el DTO. Pero si cambian insurerId o isUrgent,
    // el pricing snapshoteado queda stale: hay que recalcular precios/totales y
    // re-emitir las líneas (incluida la línea sintética de Urgencia 661200)
    // releyendo las prácticas existentes de la orden.
    const insurerChanged = dto.insurerId !== undefined && dto.insurerId !== current.insurerId;
    const urgentChanged = dto.isUrgent !== undefined && dto.isUrgent !== current.isUrgent;
    const pricingAffected = insurerChanged || urgentChanged;

    if (pricingAffected) {
      // Reconstruir el input de prácticas desde las líneas reales (no sintéticas)
      // de la orden, preservando authorizationCode / includeInReport / sortOrder.
      const existingLines = await this.db
        .select()
        .from(orderPractice)
        .where(eq(orderPractice.orderId, id))
        .orderBy(asc(orderPractice.sortOrder), asc(orderPractice.id));

      const practiceInputs: OrderPracticeInputDto[] = existingLines
        .filter((l) => l.practiceId !== null)
        .map((l) => ({
          practiceId: l.practiceId as number,
          authorizationCode: l.authorizationCode ?? undefined,
          includeInReport: l.includeInReport,
          sortOrder: l.sortOrder,
        }));

      const practices = await this.resolvePractices(practiceInputs);
      const ubInsurer = await this.resolveCurrentUb(ins.id, ins.code);
      const ubParticular =
        ins.code === PARTICULAR_CODE
          ? ubInsurer
          : await this.resolveCurrentUbByCode(PARTICULAR_CODE);

      const priceableInputs: PriceablePractice[] = practiceInputs.map((line) => {
        const p = practices.get(line.practiceId)!;
        if (p.units === null) {
          throw new UnprocessableEntityException(
            `La practica ${p.nbuCode} (${p.name}) no tiene U.B. asignada`,
          );
        }
        return {
          practiceId: p.id,
          nbuCode: p.nbuCode,
          name: p.name,
          units: p.units,
          isSpecialAct: p.isSpecialAct,
        };
      });

      const pricing = calculateOrderPricing({
        insurerCode: ins.code,
        ubInsurer: ubInsurer.value,
        ubParticular: ubParticular.value,
        isUrgent: effectiveIsUrgent,
        practices: priceableInputs,
      });

      const userInputByPracticeId = new Map<number, OrderPracticeInputDto>(
        practiceInputs.map((l) => [l.practiceId, l]),
      );

      return this.db.transaction(async (tx) => {
        await tx.delete(orderPractice).where(eq(orderPractice.orderId, id));

        const [updatedOrder] = await tx
          .update(order)
          .set({
            ...(dto.patientId !== undefined && { patientId: dto.patientId }),
            insurerId: ins.id,
            ...(dto.insuranceAffiliateNumber !== undefined && {
              insuranceAffiliateNumber: dto.insuranceAffiliateNumber ?? null,
            }),
            ...(doctorSnapshot && {
              referringDoctorId: doctorSnapshot.id,
              referringDoctorName: doctorSnapshot.name,
              referringDoctorMp: doctorSnapshot.mp,
            }),
            ...(dto.diagnosis !== undefined && { diagnosis: dto.diagnosis ?? null }),
            ...(dto.origin !== undefined && { origin: dto.origin }),
            isUrgent: effectiveIsUrgent,
            ...(dto.notes !== undefined && { notes: dto.notes ?? null }),
            totalParticular: pricing.totals.particular,
            totalInsurer: pricing.totals.insurer,
            totalPatientCopay: pricing.totals.patientCopay,
            ubValueUsed: pricing.ubValueUsed,
            updatedAt: new Date(),
          })
          .where(and(eq(order.id, id), eq(order.labId, labId)))
          .returning();

        const lineRows: NewOrderPractice[] = pricing.lines.map((l: PricedLine, idx: number) => {
          const userInput =
            l.practiceId !== null ? userInputByPracticeId.get(l.practiceId) : undefined;
          return {
            orderId: id,
            practiceId: l.practiceId,
            nbuCodeSnapshot: l.nbuCode,
            nameSnapshot: l.name,
            unitsSnapshot: l.units,
            ubValueSnapshot: l.ubValue,
            priceParticular: l.priceParticular,
            priceInsurer: l.priceInsurer,
            patientCopay: l.patientCopay,
            authorizationCode: userInput?.authorizationCode ?? null,
            includeInReport: userInput?.includeInReport ?? true,
            sortOrder: userInput?.sortOrder ?? idx,
            authorizationStatus: 'no_aplica',
          };
        });

        const insertedLines = await tx.insert(orderPractice).values(lineRows).returning();
        return { order: updatedOrder, lines: insertedLines };
      });
    }

    // Sin cambio de prácticas ni de pricing: solo actualiza campos de cabecera
    const [updatedOrder] = await this.db
      .update(order)
      .set({
        ...(dto.patientId !== undefined && { patientId: dto.patientId }),
        ...(dto.insurerId !== undefined && { insurerId: ins.id }),
        ...(dto.insuranceAffiliateNumber !== undefined && {
          insuranceAffiliateNumber: dto.insuranceAffiliateNumber ?? null,
        }),
        ...(doctorSnapshot && {
          referringDoctorId: doctorSnapshot.id,
          referringDoctorName: doctorSnapshot.name,
          referringDoctorMp: doctorSnapshot.mp,
        }),
        ...(dto.diagnosis !== undefined && { diagnosis: dto.diagnosis ?? null }),
        ...(dto.origin !== undefined && { origin: dto.origin }),
        ...(dto.isUrgent !== undefined && { isUrgent: dto.isUrgent }),
        ...(dto.notes !== undefined && { notes: dto.notes ?? null }),
        updatedAt: new Date(),
      })
      .where(and(eq(order.id, id), eq(order.labId, labId)))
      .returning();

    const lines = await this.db
      .select()
      .from(orderPractice)
      .where(eq(orderPractice.orderId, id))
      .orderBy(asc(orderPractice.sortOrder), asc(orderPractice.id));

    return { order: updatedOrder, lines };
  }

  async list(labId: number, filters: ListOrdersDto): Promise<OrderSummary[]> {
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);

    const conds = [eq(order.labId, labId)];
    if (filters.status && filters.status.length > 0) {
      conds.push(inArray(order.status, filters.status));
    }
    if (filters.insurerId) {
      conds.push(eq(order.insurerId, filters.insurerId));
    }
    if (filters.dateFrom) {
      conds.push(gte(order.orderDate, new Date(filters.dateFrom)));
    }
    if (filters.dateTo) {
      conds.push(lte(order.orderDate, new Date(filters.dateTo)));
    }
    if (filters.search?.trim()) {
      const like = `%${filters.search.trim()}%`;
      const protoSearch = Number.isFinite(Number(filters.search))
        ? eq(order.protocolNumber, Number(filters.search))
        : undefined;
      const searchExpr = or(
        ilike(patient.lastName, like),
        ilike(patient.firstName, like),
        ilike(patient.dni, like),
        ...(protoSearch ? [protoSearch] : []),
      );
      if (searchExpr) conds.push(searchExpr);
    }

    const rows = await this.db
      .select({
        order: order,
        patientId: patient.id,
        patientFirstName: patient.firstName,
        patientLastName: patient.lastName,
        patientDni: patient.dni,
        insurerId: insurer.id,
        insurerCode: insurer.code,
        insurerName: insurer.name,
      })
      .from(order)
      .innerJoin(patient, and(eq(patient.id, order.patientId), eq(patient.labId, labId)))
      .innerJoin(insurer, eq(insurer.id, order.insurerId))
      .where(and(...conds))
      .orderBy(desc(order.orderDate))
      .limit(limit);

    return rows.map((r) => ({
      ...r.order,
      patient: {
        id: r.patientId,
        firstName: r.patientFirstName,
        lastName: r.patientLastName,
        dni: r.patientDni,
      },
      insurer: { id: r.insurerId, code: r.insurerCode, name: r.insurerName },
    }));
  }

  async byId(labId: number, id: number): Promise<OrderSummary> {
    const [row] = await this.db
      .select({
        order: order,
        patientId: patient.id,
        patientFirstName: patient.firstName,
        patientLastName: patient.lastName,
        patientDni: patient.dni,
        insurerId: insurer.id,
        insurerCode: insurer.code,
        insurerName: insurer.name,
      })
      .from(order)
      .innerJoin(patient, and(eq(patient.id, order.patientId), eq(patient.labId, labId)))
      .innerJoin(insurer, eq(insurer.id, order.insurerId))
      .where(and(eq(order.id, id), eq(order.labId, labId)))
      .limit(1);
    if (!row) throw new NotFoundException('Orden no encontrada');
    return {
      ...row.order,
      patient: {
        id: row.patientId,
        firstName: row.patientFirstName,
        lastName: row.patientLastName,
        dni: row.patientDni,
      },
      insurer: { id: row.insurerId, code: row.insurerCode, name: row.insurerName },
    };
  }

  async lines(labId: number, orderId: number): Promise<OrderPractice[]> {
    await this.ensureExists(labId, orderId);
    return this.db
      .select()
      .from(orderPractice)
      .where(eq(orderPractice.orderId, orderId))
      .orderBy(asc(orderPractice.sortOrder), asc(orderPractice.id));
  }

  async confirm(labId: number, id: number): Promise<Order> {
    const current = await this.requireOrder(labId, id);
    this.assertTransition(current.status, 'confirmada');
    const [{ lineCount }] = await this.db
      .select({ lineCount: sql<number>`count(*)::int` })
      .from(orderPractice)
      .where(eq(orderPractice.orderId, id));
    if (lineCount === 0) {
      throw new UnprocessableEntityException('La orden no tiene practicas, no se puede confirmar');
    }
    return this.applyStatus(id, 'confirmada');
  }

  async start(labId: number, id: number): Promise<Order> {
    const current = await this.requireOrder(labId, id);
    this.assertTransition(current.status, 'en_proceso');
    return this.applyStatus(id, 'en_proceso');
  }

  async finalize(labId: number, id: number): Promise<Order> {
    const current = await this.requireOrder(labId, id);
    this.assertTransition(current.status, 'resultados_cargados');
    await this.assertHasReportableResults(id);
    return this.applyStatus(id, 'resultados_cargados');
  }

  async cancel(labId: number, id: number, dto: CancelOrderDto): Promise<Order> {
    const current = await this.requireOrder(labId, id);
    this.assertTransition(current.status, 'anulada');
    const [row] = await this.db
      .update(order)
      .set({
        status: 'anulada',
        cancellationReason: dto.reason ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(order.id, id), eq(order.labId, labId)))
      .returning();
    // El informe emitido ya no es válido para una orden anulada: borrar el blob.
    await this.removeReportBlobBestEffort(current.pdfReportPath);
    return row;
  }

  async markEmitted(
    labId: number,
    id: number,
    pdfReportPath: string,
    signedBy: string,
  ): Promise<Order> {
    const current = await this.requireOrder(labId, id);
    this.assertTransition(current.status, 'emitida');
    const [row] = await this.db
      .update(order)
      .set({
        status: 'emitida',
        pdfReportPath,
        pdfReportIssuedAt: new Date(),
        pdfReportRenderedAt: new Date(),
        pdfReportSignedBy: signedBy,
        updatedAt: new Date(),
      })
      .where(and(eq(order.id, id), eq(order.labId, labId)))
      .returning();
    return row;
  }

  async setPdfPath(labId: number, id: number, pdfReportPath: string): Promise<Order> {
    await this.requireOrder(labId, id);
    const [row] = await this.db
      .update(order)
      .set({ pdfReportPath, pdfReportRenderedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(order.id, id), eq(order.labId, labId)))
      .returning();
    return row;
  }

  async markDelivered(labId: number, id: number): Promise<Order> {
    const current = await this.requireOrder(labId, id);
    this.assertTransition(current.status, 'entregada');
    return this.applyStatus(id, 'entregada');
  }

  async revertToBorrador(labId: number, id: number): Promise<Order> {
    const current = await this.requireOrder(labId, id);
    const REVERTIBLE: OrderStatus[] = [
      'confirmada',
      'en_proceso',
      'resultados_cargados',
      'emitida',
    ];
    if (!REVERTIBLE.includes(current.status)) {
      throw new ConflictException(
        `No se puede revertir a borrador desde el estado "${current.status}"`,
      );
    }
    const previousPdfPath = current.pdfReportPath;
    const [row] = await this.db
      .update(order)
      .set({
        status: 'borrador',
        pdfReportPath: null,
        pdfReportIssuedAt: null,
        pdfReportRenderedAt: null,
        pdfReportSignedBy: null,
        updatedAt: new Date(),
      })
      .where(and(eq(order.id, id), eq(order.labId, labId)))
      .returning();
    // El PDF emitido ya no corresponde tras volver a borrador: borrar el blob.
    await this.removeReportBlobBestEffort(previousPdfPath);
    return row;
  }

  // ----- helpers -----

  /**
   * Borra el PDF del informe del bucket 'reports' de forma best-effort. No
   * rompe la transición si el borrado falla (solo loguea). No-op si no hay path.
   */
  private async removeReportBlobBestEffort(pdfReportPath: string | null): Promise<void> {
    if (!pdfReportPath) return;
    try {
      const { error } = await this.storage.storage.from(REPORTS_BUCKET).remove([pdfReportPath]);
      if (error) {
        this.logger.warn(
          `No se pudo borrar el PDF del informe (${pdfReportPath}): ${error.message}`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Error inesperado al borrar el PDF del informe (${pdfReportPath}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /**
   * Garantiza que la orden tenga al menos un resultado cargado para alguna de
   * sus líneas reportables (practiceId no nulo e includeInReport=true) antes de
   * permitir la transición a "resultados_cargados" / emisión. Evita informes
   * clínicamente vacíos. Espejo del guard lineCount>0 de confirm().
   */
  async assertHasReportableResults(orderId: number): Promise<void> {
    const [{ resultCount }] = await this.db
      .select({ resultCount: sql<number>`count(*)::int` })
      .from(result)
      .innerJoin(orderPractice, eq(orderPractice.id, result.orderPracticeId))
      .where(
        and(
          eq(orderPractice.orderId, orderId),
          isNotNull(orderPractice.practiceId),
          eq(orderPractice.includeInReport, true),
        ),
      );
    if (resultCount === 0) {
      throw new UnprocessableEntityException(
        'La orden no tiene resultados cargados en sus practicas reportables; no se puede finalizar ni emitir el informe',
      );
    }
  }

  private async applyStatus(id: number, status: OrderStatus): Promise<Order> {
    const [row] = await this.db
      .update(order)
      .set({ status, updatedAt: new Date() })
      .where(eq(order.id, id))
      .returning();
    return row;
  }

  private assertTransition(from: OrderStatus, to: OrderStatus): void {
    if (!canTransition(from, to)) {
      throw new ConflictException(`No se puede pasar de ${from} a ${to}`);
    }
  }

  private async requireOrder(labId: number, id: number): Promise<Order> {
    const [row] = await this.db
      .select()
      .from(order)
      .where(and(eq(order.id, id), eq(order.labId, labId)))
      .limit(1);
    if (!row) throw new NotFoundException('Orden no encontrada');
    return row;
  }

  private async ensureExists(labId: number, id: number): Promise<void> {
    await this.requireOrder(labId, id);
  }

  private async resolvePatient(labId: number, id: number) {
    const [row] = await this.db
      .select()
      .from(patient)
      .where(and(eq(patient.id, id), eq(patient.labId, labId), isNull(patient.deletedAt)))
      .limit(1);
    if (!row) throw new NotFoundException(`Paciente ${id} no encontrado`);
    return row;
  }

  private async resolveInsurer(id: number) {
    const [row] = await this.db.select().from(insurer).where(eq(insurer.id, id)).limit(1);
    if (!row) throw new NotFoundException(`Obra social ${id} no encontrada`);
    if (!row.active) throw new ConflictException(`Obra social ${row.code} esta inactiva`);
    return row;
  }

  private async resolvePractices(
    dtoPractices: OrderPracticeInputDto[],
  ): Promise<Map<number, typeof practice.$inferSelect>> {
    const ids = dtoPractices.map((p) => p.practiceId);
    const rows = await this.db
      .select()
      .from(practice)
      .where(and(inArray(practice.id, ids), eq(practice.active, true)));
    const map = new Map(rows.map((r) => [r.id, r]));
    const missing = ids.filter((id) => !map.has(id));
    if (missing.length > 0) {
      throw new NotFoundException(`Practicas inexistentes o inactivas: ${missing.join(', ')}`);
    }
    return map;
  }

  /**
   * Expande la lista de practicas incluyendo los hijos de cualquier padre seleccionado.
   * Solo expande un nivel (no recursivo). Retorna la lista final deduplicada.
   */
  async expandWithChildren(
    dtoPractices: OrderPracticeInputDto[],
  ): Promise<OrderPracticeInputDto[]> {
    const parentIds = dtoPractices.map((p) => p.practiceId);
    const children = await this.db
      .select()
      .from(practice)
      .where(and(inArray(practice.parentId, parentIds), eq(practice.active, true)));

    const alreadyIncluded = new Set(parentIds);
    const extra: OrderPracticeInputDto[] = [];
    let sortIdx = dtoPractices.length;

    for (const child of children) {
      if (!alreadyIncluded.has(child.id)) {
        alreadyIncluded.add(child.id);
        extra.push({ practiceId: child.id, sortOrder: sortIdx++, includeInReport: true });
      }
    }

    return [...dtoPractices, ...extra];
  }

  private async resolveCurrentUb(insurerId: number, insurerCode: string) {
    const [row] = await this.db
      .select()
      .from(ubValue)
      .where(and(eq(ubValue.insurerId, insurerId), isNull(ubValue.validTo)))
      .limit(1);
    if (!row) {
      throw new ConflictException(
        `La obra social ${insurerCode} no tiene un valor UB vigente. Cargalo via POST /insurers/ub-values.`,
      );
    }
    return row;
  }

  private async resolveCurrentUbByCode(code: string) {
    const [row] = await this.db
      .select({ value: ubValue.value })
      .from(ubValue)
      .innerJoin(insurer, eq(insurer.id, ubValue.insurerId))
      .where(and(eq(insurer.code, code), isNull(ubValue.validTo)))
      .limit(1);
    if (!row) {
      throw new ConflictException(
        `No hay UB vigente para "${code}". Cargalo via POST /insurers/ub-values.`,
      );
    }
    return row;
  }

  private async resolveDoctorSnapshot(
    labId: number,
    dto: CreateOrderDto,
  ): Promise<{ id: number | null; name: string | null; mp: string | null }> {
    if (dto.referringDoctorId) {
      const [d] = await this.db
        .select()
        .from(doctor)
        .where(
          and(
            eq(doctor.id, dto.referringDoctorId),
            eq(doctor.labId, labId),
            isNull(doctor.deletedAt),
          ),
        )
        .limit(1);
      if (!d) throw new NotFoundException(`Medico ${dto.referringDoctorId} no encontrado`);
      return {
        id: d.id,
        name: `${d.lastName}, ${d.firstName}`,
        mp: d.matricula,
      };
    }
    return {
      id: null,
      name: dto.referringDoctorName ?? null,
      mp: dto.referringDoctorMp ?? null,
    };
  }
}
