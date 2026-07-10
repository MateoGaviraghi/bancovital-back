import type { Db } from '@/db/client';
import { DATABASE, SUPABASE_ADMIN } from '@/db/database.module';
import {
  doctor,
  especie,
  insurer,
  muestraAgua,
  order,
  orderPractice,
  pacienteAnimal,
  patient,
  practice,
  propietario,
  result,
  servicio,
  solicitanteAgua,
  ubValue,
  veterinario,
} from '@/db/schema';
import type { NewOrder, NewOrderPractice, Order, OrderPractice, Servicio } from '@/db/schema';
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
  animalPatient: {
    id: number;
    nombre: string;
    especie: string;
    raza: string | null;
    propietario: string;
  } | null;
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
    const svc = await this.resolveServicio(labId, dto.servicioId);

    let patientId: number | null = null;
    let animalPatientId: number | null = null;
    let veterinarioId: number | null = null;

    if (svc.usaPacienteHumano) {
      if (!dto.patientId) {
        throw new UnprocessableEntityException('patientId es requerido para este servicio');
      }
      const pat = await this.resolvePatient(labId, dto.patientId);
      patientId = pat.id;
    }
    if (svc.usaPacienteAnimal) {
      if (!dto.animalPatientId) {
        throw new UnprocessableEntityException('animalPatientId es requerido para este servicio');
      }
      await this.assertAnimalPatient(labId, dto.animalPatientId);
      animalPatientId = dto.animalPatientId;
    }
    if (svc.usaVeterinario && dto.veterinarioId) {
      await this.assertVeterinario(labId, dto.veterinarioId);
      veterinarioId = dto.veterinarioId;
    }

    let solicitanteAguaId: number | null = null;
    let muestraAguaId: number | null = null;
    if (svc.usaSolicitanteAgua) {
      if (!dto.solicitanteAguaId) {
        throw new UnprocessableEntityException('solicitanteAguaId es requerido para este servicio');
      }
      await this.assertSolicitanteAgua(labId, dto.solicitanteAguaId);
      solicitanteAguaId = dto.solicitanteAguaId;
    }
    if (svc.usaMuestraAgua) {
      if (!dto.muestraAguaId) {
        throw new UnprocessableEntityException('muestraAguaId es requerido para este servicio');
      }
      await this.assertMuestraAgua(labId, dto.muestraAguaId);
      muestraAguaId = dto.muestraAguaId;
    }

    let insurerId = dto.insurerId && dto.insurerId > 0 ? dto.insurerId : undefined;
    if (!insurerId) {
      if (svc.usaPacienteHumano) {
        throw new UnprocessableEntityException('insurerId es requerido para este servicio');
      }
      const [particularRow] = await this.db
        .select({ id: insurer.id })
        .from(insurer)
        .where(eq(insurer.code, PARTICULAR_CODE))
        .limit(1);
      if (!particularRow) {
        throw new ConflictException('No existe la obra social PARTICULAR en el sistema');
      }
      insurerId = particularRow.id;
    }
    const ins = await this.resolveInsurer(insurerId);
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
        servicioId: svc.id,
        patientId,
        animalPatientId,
        veterinarioId,
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
        customData: dto.customData ?? null,
        solicitanteAguaId,
        muestraAguaId,
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

  async list(
    labId: number,
    filters: ListOrdersDto,
  ): Promise<{ data: OrderSummary[]; total: number; page: number; pageSize: number }> {
    const pageSize = Math.min(Math.max(filters.limit ?? 50, 1), 200);
    const page = Math.max(filters.page ?? 1, 1);
    const offset = (page - 1) * pageSize;

    const conds = [eq(order.labId, labId)];
    if (filters.status && filters.status.length > 0) {
      conds.push(inArray(order.status, filters.status));
    }
    if (filters.insurerId) {
      conds.push(eq(order.insurerId, filters.insurerId));
    }
    if (filters.servicioId) {
      conds.push(eq(order.servicioId, filters.servicioId));
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
        ilike(pacienteAnimal.nombre, like),
        ...(protoSearch ? [protoSearch] : []),
      );
      if (searchExpr) conds.push(searchExpr);
    }

    const whereExpr = and(...conds);

    const [rows, countResult] = await Promise.all([
      this.db
        .select({
          order: order,
          patientId: patient.id,
          patientFirstName: patient.firstName,
          patientLastName: patient.lastName,
          patientDni: patient.dni,
          animalNombre: pacienteAnimal.nombre,
          especieNombre: especie.nombre,
          propietarioNombre: propietario.lastName,
          insurerId: insurer.id,
          insurerCode: insurer.code,
          insurerName: insurer.name,
        })
        .from(order)
        .leftJoin(patient, eq(patient.id, order.patientId))
        .leftJoin(pacienteAnimal, eq(pacienteAnimal.id, order.animalPatientId))
        .leftJoin(especie, eq(especie.id, pacienteAnimal.especieId))
        .leftJoin(propietario, eq(propietario.id, pacienteAnimal.propietarioId))
        .innerJoin(insurer, eq(insurer.id, order.insurerId))
        .where(whereExpr)
        .orderBy(desc(order.orderDate))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(order)
        .leftJoin(patient, eq(patient.id, order.patientId))
        .leftJoin(pacienteAnimal, eq(pacienteAnimal.id, order.animalPatientId))
        .innerJoin(insurer, eq(insurer.id, order.insurerId))
        .where(whereExpr),
    ]);

    const data = rows.map((r) => ({
      ...r.order,
      patient: r.patientId
        ? {
            id: r.patientId,
            firstName: r.patientFirstName!,
            lastName: r.patientLastName!,
            dni: r.patientDni!,
          }
        : null,
      animalPatient: r.animalNombre
        ? {
            id: r.order.animalPatientId!,
            nombre: r.animalNombre,
            especie: r.especieNombre ?? '—',
            raza: null as string | null,
            propietario: r.propietarioNombre ?? '—',
          }
        : null,
      insurer: { id: r.insurerId, code: r.insurerCode, name: r.insurerName },
    }));

    return { data, total: countResult[0]?.n ?? 0, page, pageSize };
  }

  async byId(labId: number, id: number): Promise<OrderSummary> {
    const [row] = await this.db
      .select({
        order: order,
        patientId: patient.id,
        patientFirstName: patient.firstName,
        patientLastName: patient.lastName,
        patientDni: patient.dni,
        animalNombre: pacienteAnimal.nombre,
        especieNombre: especie.nombre,
        propietarioNombre: propietario.lastName,
        insurerId: insurer.id,
        insurerCode: insurer.code,
        insurerName: insurer.name,
      })
      .from(order)
      .leftJoin(patient, eq(patient.id, order.patientId))
      .leftJoin(pacienteAnimal, eq(pacienteAnimal.id, order.animalPatientId))
      .leftJoin(especie, eq(especie.id, pacienteAnimal.especieId))
      .leftJoin(propietario, eq(propietario.id, pacienteAnimal.propietarioId))
      .innerJoin(insurer, eq(insurer.id, order.insurerId))
      .where(and(eq(order.id, id), eq(order.labId, labId)))
      .limit(1);
    if (!row) throw new NotFoundException('Orden no encontrada');
    return {
      ...row.order,
      patient: row.patientId
        ? {
            id: row.patientId,
            firstName: row.patientFirstName!,
            lastName: row.patientLastName!,
            dni: row.patientDni!,
          }
        : null,
      animalPatient: row.animalNombre
        ? {
            id: row.order.animalPatientId!,
            nombre: row.animalNombre,
            especie: row.especieNombre ?? '—',
            raza: null as string | null,
            propietario: row.propietarioNombre ?? '—',
          }
        : null,
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
    return this.applyStatus(id, labId, current.status, 'confirmada');
  }

  async start(labId: number, id: number): Promise<Order> {
    const current = await this.requireOrder(labId, id);
    this.assertTransition(current.status, 'en_proceso');
    return this.applyStatus(id, labId, current.status, 'en_proceso');
  }

  async finalize(labId: number, id: number): Promise<Order> {
    const current = await this.requireOrder(labId, id);
    this.assertTransition(current.status, 'resultados_cargados');
    await this.assertHasReportableResults(id);
    return this.applyStatus(id, labId, current.status, 'resultados_cargados');
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
      .where(and(eq(order.id, id), eq(order.labId, labId), eq(order.status, current.status)))
      .returning();
    if (!row) {
      throw new ConflictException('El estado de la orden cambió. Recargá e intentá de nuevo.');
    }
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
      .where(and(eq(order.id, id), eq(order.labId, labId), eq(order.status, current.status)))
      .returning();
    if (!row) {
      throw new ConflictException('El estado de la orden cambió. Recargá e intentá de nuevo.');
    }
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
    return this.applyStatus(id, labId, current.status, 'entregada');
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
      .where(and(eq(order.id, id), eq(order.labId, labId), eq(order.status, current.status)))
      .returning();
    if (!row) {
      throw new ConflictException('El estado de la orden cambió. Recargá e intentá de nuevo.');
    }
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

  // Transición atómica: el UPDATE exige el estado de origen esperado, así dos
  // requests concurrentes (doble-click) no aplican la transición dos veces.
  private async applyStatus(
    id: number,
    labId: number,
    from: OrderStatus,
    to: OrderStatus,
  ): Promise<Order> {
    const [row] = await this.db
      .update(order)
      .set({ status: to, updatedAt: new Date() })
      .where(and(eq(order.id, id), eq(order.labId, labId), eq(order.status, from)))
      .returning();
    if (!row) {
      throw new ConflictException(
        `El estado de la orden cambió (se esperaba "${from}"). Recargá e intentá de nuevo.`,
      );
    }
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

  // Defensa anti-IDOR cross-lab: cada FK del body debe pertenecer al lab de la sesion.
  private async assertAnimalPatient(labId: number, id: number): Promise<void> {
    const [row] = await this.db
      .select({ id: pacienteAnimal.id })
      .from(pacienteAnimal)
      .where(and(eq(pacienteAnimal.id, id), eq(pacienteAnimal.labId, labId)))
      .limit(1);
    if (!row) throw new NotFoundException(`Paciente animal ${id} no encontrado`);
  }

  private async assertVeterinario(labId: number, id: number): Promise<void> {
    const [row] = await this.db
      .select({ id: veterinario.id })
      .from(veterinario)
      .where(and(eq(veterinario.id, id), eq(veterinario.labId, labId)))
      .limit(1);
    if (!row) throw new NotFoundException(`Veterinario ${id} no encontrado`);
  }

  private async assertSolicitanteAgua(labId: number, id: number): Promise<void> {
    const [row] = await this.db
      .select({ id: solicitanteAgua.id })
      .from(solicitanteAgua)
      .where(and(eq(solicitanteAgua.id, id), eq(solicitanteAgua.labId, labId)))
      .limit(1);
    if (!row) throw new NotFoundException(`Solicitante de agua ${id} no encontrado`);
  }

  private async assertMuestraAgua(labId: number, id: number): Promise<void> {
    const [row] = await this.db
      .select({ id: muestraAgua.id })
      .from(muestraAgua)
      .where(and(eq(muestraAgua.id, id), eq(muestraAgua.labId, labId)))
      .limit(1);
    if (!row) throw new NotFoundException(`Muestra de agua ${id} no encontrada`);
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

  private async resolveServicio(labId: number, servicioId: number): Promise<Servicio> {
    const [row] = await this.db
      .select()
      .from(servicio)
      .where(and(eq(servicio.id, servicioId), eq(servicio.labId, labId), eq(servicio.activo, true)))
      .limit(1);
    if (!row) throw new NotFoundException(`Servicio ${servicioId} no encontrado o inactivo`);
    return row;
  }
}
