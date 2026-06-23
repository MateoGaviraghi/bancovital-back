import type { Db } from '@/db/client';
import { DATABASE } from '@/db/database.module';
import {
  type OrderPractice,
  type OrderPracticeUnidadValue,
  type Practice,
  type Result,
  order,
  orderPractice,
  orderPracticeUnidadValue,
  patient,
  practice,
  practiceUnidad,
  result,
  unidadMedida,
} from '@/db/schema';
import { type RangeRule, classifyResult, pickRangeRule } from '@/domain/validation/validation';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { UpsertResultDto } from './dto/upsert-result.dto';

const LOADABLE_STATUSES = new Set(['borrador', 'confirmada', 'en_proceso', 'resultados_cargados']);

export interface HydratedUnidadEntry {
  associationId: number;
  unidadId: number;
  nombre: string;
  simbolo: string | null;
  sortOrder: number;
  value: OrderPracticeUnidadValue | null;
}

export interface HydratedLine {
  orderPractice: OrderPractice;
  result: Result | null;
  referenceRule: RangeRule | null;
  unidades: HydratedUnidadEntry[];
}

@Injectable()
export class ResultsService {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  async byOrder(labId: number, orderId: number): Promise<HydratedLine[]> {
    const [ord] = await this.db
      .select()
      .from(order)
      .where(and(eq(order.id, orderId), eq(order.labId, labId)))
      .limit(1);
    if (!ord) throw new NotFoundException('Orden no encontrada');

    const [pat] = await this.db
      .select({ sex: patient.sex, birthDate: patient.birthDate })
      .from(patient)
      .where(eq(patient.id, ord.patientId!))
      .limit(1);
    if (!pat) throw new NotFoundException('Paciente de la orden no encontrado');

    const rows = await this.db
      .select({
        orderPractice: orderPractice,
        result: result,
        practice: practice,
      })
      .from(orderPractice)
      .leftJoin(result, eq(result.orderPracticeId, orderPractice.id))
      .leftJoin(practice, eq(practice.id, orderPractice.practiceId))
      .where(eq(orderPractice.orderId, orderId))
      .orderBy(asc(orderPractice.sortOrder), asc(orderPractice.id));

    const opIds = rows.map((r) => r.orderPractice.id);
    const practiceIds = rows
      .map((r) => r.orderPractice.practiceId)
      .filter((p): p is number => p !== null);

    // Asociaciones práctica → unidad (definidas per-lab), y valores cargados por línea.
    const [associations, values] = await Promise.all([
      practiceIds.length === 0
        ? Promise.resolve(
            [] as Array<{
              practiceId: number;
              associationId: number;
              sortOrder: number;
              unidad: typeof unidadMedida.$inferSelect;
            }>,
          )
        : this.db
            .select({
              practiceId: practiceUnidad.practiceId,
              associationId: practiceUnidad.id,
              sortOrder: practiceUnidad.sortOrder,
              unidad: unidadMedida,
            })
            .from(practiceUnidad)
            .innerJoin(unidadMedida, eq(unidadMedida.id, practiceUnidad.unidadId))
            .where(
              and(eq(practiceUnidad.labId, labId), inArray(practiceUnidad.practiceId, practiceIds)),
            )
            .orderBy(asc(practiceUnidad.sortOrder), asc(practiceUnidad.id)),
      opIds.length === 0
        ? Promise.resolve([] as OrderPracticeUnidadValue[])
        : this.db
            .select()
            .from(orderPracticeUnidadValue)
            .where(inArray(orderPracticeUnidadValue.orderPracticeId, opIds)),
    ]);

    const assocByPractice = new Map<
      number,
      Array<{
        associationId: number;
        sortOrder: number;
        unidad: typeof unidadMedida.$inferSelect;
      }>
    >();
    for (const a of associations) {
      const list = assocByPractice.get(a.practiceId) ?? [];
      list.push({ associationId: a.associationId, sortOrder: a.sortOrder, unidad: a.unidad });
      assocByPractice.set(a.practiceId, list);
    }

    const valueByOpAndUnidad = new Map<string, OrderPracticeUnidadValue>();
    for (const v of values) {
      valueByOpAndUnidad.set(`${v.orderPracticeId}:${v.unidadId}`, v);
    }

    return rows.map((r) => {
      const template = r.practice?.referenceValueTemplate ?? null;
      const rule = template
        ? pickRangeRule(template, {
            sex: pat.sex,
            birthDate:
              pat.birthDate == null
                ? null
                : pat.birthDate instanceof Date
                  ? pat.birthDate
                  : new Date(pat.birthDate),
          })
        : null;

      const assocs =
        r.orderPractice.practiceId !== null
          ? (assocByPractice.get(r.orderPractice.practiceId) ?? [])
          : [];
      const unidades: HydratedUnidadEntry[] = assocs.map((a) => ({
        associationId: a.associationId,
        unidadId: a.unidad.id,
        nombre: a.unidad.nombre,
        simbolo: a.unidad.simbolo,
        sortOrder: a.sortOrder,
        value: valueByOpAndUnidad.get(`${r.orderPractice.id}:${a.unidad.id}`) ?? null,
      }));

      return {
        orderPractice: r.orderPractice,
        result: r.result,
        referenceRule: rule,
        unidades,
      };
    });
  }

  async upsert(labId: number, dto: UpsertResultDto, enteredBy: string): Promise<Result> {
    if (!dto.valueNumeric && !dto.valueText) {
      throw new BadRequestException('Debe enviar valueNumeric o valueText (al menos uno)');
    }

    const [line] = await this.db
      .select()
      .from(orderPractice)
      .where(eq(orderPractice.id, dto.orderPracticeId))
      .limit(1);
    if (!line) throw new NotFoundException(`Linea ${dto.orderPracticeId} no encontrada`);
    if (line.practiceId === null) {
      throw new ConflictException(
        'Las lineas sinteticas (acto bioquimico, urgencia, ABC) no tienen resultado',
      );
    }

    const [ord] = await this.db
      .select({
        id: order.id,
        status: order.status,
        patientId: order.patientId,
        labId: order.labId,
      })
      .from(order)
      .where(and(eq(order.id, line.orderId), eq(order.labId, labId)))
      .limit(1);
    if (!ord) throw new NotFoundException('Orden de la linea no encontrada');
    if (!LOADABLE_STATUSES.has(ord.status)) {
      throw new ConflictException(
        `No se pueden cargar resultados en orden con estado "${ord.status}". Estados validos: ${[...LOADABLE_STATUSES].join(', ')}.`,
      );
    }

    let flag: Result['flag'] = null;
    let referenceRangeLow: string | null = null;
    let referenceRangeHigh: string | null = null;

    if (dto.valueNumeric) {
      const pract = await this.getPractice(line.practiceId);
      const pat = await this.getPatient(ord.patientId!);
      const template = pract.referenceValueTemplate ?? null;
      const rule = template ? pickRangeRule(template, pat) : null;
      if (rule) {
        referenceRangeLow = rule.band.low ?? null;
        referenceRangeHigh = rule.band.high ?? null;
        flag = classifyResult(dto.valueNumeric, rule);
      }
    }

    const [existing] = await this.db
      .select()
      .from(result)
      .where(eq(result.orderPracticeId, dto.orderPracticeId))
      .limit(1);

    if (existing) {
      const [row] = await this.db
        .update(result)
        .set({
          valueNumeric: dto.valueNumeric ?? null,
          valueText: dto.valueText ?? null,
          unit: dto.unit ?? null,
          methodology: dto.methodology ?? null,
          notes: dto.notes ?? null,
          flag,
          referenceRangeLow,
          referenceRangeHigh,
          enteredBy,
          enteredAt: new Date(),
        })
        .where(eq(result.orderPracticeId, dto.orderPracticeId))
        .returning();
      return row;
    }

    const [row] = await this.db
      .insert(result)
      .values({
        orderPracticeId: dto.orderPracticeId,
        valueNumeric: dto.valueNumeric ?? null,
        valueText: dto.valueText ?? null,
        unit: dto.unit ?? null,
        methodology: dto.methodology ?? null,
        notes: dto.notes ?? null,
        flag,
        referenceRangeLow,
        referenceRangeHigh,
        enteredBy,
      })
      .returning();
    return row;
  }

  private async getPractice(id: number): Promise<Practice> {
    const [row] = await this.db.select().from(practice).where(eq(practice.id, id)).limit(1);
    if (!row) throw new NotFoundException(`Practica ${id} no encontrada`);
    return row;
  }

  private async getPatient(
    id: number,
  ): Promise<{ sex: 'F' | 'M' | 'X' | null; birthDate: Date | null }> {
    const [row] = await this.db
      .select({ sex: patient.sex, birthDate: patient.birthDate })
      .from(patient)
      .where(and(eq(patient.id, id)))
      .limit(1);
    if (!row) throw new NotFoundException('Paciente no encontrado');
    return {
      sex: row.sex,
      birthDate:
        row.birthDate == null
          ? null
          : row.birthDate instanceof Date
            ? row.birthDate
            : new Date(row.birthDate),
    };
  }
}
