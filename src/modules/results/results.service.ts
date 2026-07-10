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
  pacienteAnimal,
  patient,
  practice,
  practiceReferenciaEspecie,
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
  opcionesPredeterminadas: string[] | null;
  rangeLow: string | null;
  rangeHigh: string | null;
  referenceText: string | null;
}

export interface HydratedLine {
  orderPractice: OrderPractice;
  result: Result | null;
  referenceRule: RangeRule | null;
  unidades: HydratedUnidadEntry[];
  parentId: number | null;
  condicionVisibilidad: Practice['condicionVisibilidad'];
  defaultUnit: string | null;
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

    const pat = ord.patientId
      ? await this.db
          .select({ sex: patient.sex, birthDate: patient.birthDate })
          .from(patient)
          .where(eq(patient.id, ord.patientId))
          .limit(1)
          .then((r) => r[0] ?? null)
      : null;

    let animalEspecieId: number | null = null;
    if (ord.animalPatientId) {
      const [animal] = await this.db
        .select({ especieId: pacienteAnimal.especieId })
        .from(pacienteAnimal)
        .where(eq(pacienteAnimal.id, ord.animalPatientId))
        .limit(1);
      animalEspecieId = animal?.especieId ?? null;
    }

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
              rangeLow: string | null;
              rangeHigh: string | null;
              referenceText: string | null;
              unidad: typeof unidadMedida.$inferSelect;
            }>,
          )
        : this.db
            .select({
              practiceId: practiceUnidad.practiceId,
              associationId: practiceUnidad.id,
              sortOrder: practiceUnidad.sortOrder,
              rangeLow: practiceUnidad.rangeLow,
              rangeHigh: practiceUnidad.rangeHigh,
              referenceText: practiceUnidad.referenceText,
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
        rangeLow: string | null;
        rangeHigh: string | null;
        referenceText: string | null;
        unidad: typeof unidadMedida.$inferSelect;
      }>
    >();
    for (const a of associations) {
      const list = assocByPractice.get(a.practiceId) ?? [];
      list.push({
        associationId: a.associationId,
        sortOrder: a.sortOrder,
        rangeLow: a.rangeLow,
        rangeHigh: a.rangeHigh,
        referenceText: a.referenceText,
        unidad: a.unidad,
      });
      assocByPractice.set(a.practiceId, list);
    }

    const valueByOpAndUnidad = new Map<string, OrderPracticeUnidadValue>();
    for (const v of values) {
      valueByOpAndUnidad.set(`${v.orderPracticeId}:${v.unidadId}`, v);
    }

    const especieRefByPractice = new Map<number, { low: string | null; high: string | null; unit: string | null }>();
    if (animalEspecieId && practiceIds.length > 0) {
      const refs = await this.db
        .select()
        .from(practiceReferenciaEspecie)
        .where(
          and(
            inArray(practiceReferenciaEspecie.practiceId, practiceIds),
            eq(practiceReferenciaEspecie.especieId, animalEspecieId),
          ),
        );
      for (const ref of refs) {
        especieRefByPractice.set(ref.practiceId, {
          low: ref.rangeLow,
          high: ref.rangeHigh,
          unit: ref.unit,
        });
      }
    }

    return rows.map((r) => {
      const template = r.practice?.referenceValueTemplate ?? null;
      const especieRef = r.orderPractice.practiceId
        ? especieRefByPractice.get(r.orderPractice.practiceId) ?? null
        : null;
      const rule: RangeRule | null = especieRef
        ? { band: { low: especieRef.low ?? undefined, high: especieRef.high ?? undefined }, unit: especieRef.unit ?? undefined }
        : template && pat
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
        opcionesPredeterminadas: a.unidad.opcionesPredeterminadas ?? null,
        rangeLow: a.rangeLow,
        rangeHigh: a.rangeHigh,
        referenceText: a.referenceText,
      }));

      return {
        orderPractice: r.orderPractice,
        result: r.result,
        referenceRule: rule,
        unidades,
        parentId: r.practice?.parentId ?? null,
        condicionVisibilidad: r.practice?.condicionVisibilidad ?? null,
        defaultUnit: r.practice?.defaultUnit ?? null,
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
        animalPatientId: order.animalPatientId,
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
      if (ord.patientId) {
        const pract = await this.getPractice(line.practiceId);
        const pat = await this.getPatient(ord.patientId);
        const template = pract.referenceValueTemplate ?? null;
        const rule = template ? pickRangeRule(template, pat) : null;
        if (rule) {
          referenceRangeLow = rule.band.low ?? null;
          referenceRangeHigh = rule.band.high ?? null;
          flag = classifyResult(dto.valueNumeric, rule);
        }
      } else if (ord.animalPatientId) {
        const [animal] = await this.db
          .select({ especieId: pacienteAnimal.especieId })
          .from(pacienteAnimal)
          .where(eq(pacienteAnimal.id, ord.animalPatientId))
          .limit(1);
        if (animal) {
          const [ref] = await this.db
            .select()
            .from(practiceReferenciaEspecie)
            .where(
              and(
                eq(practiceReferenciaEspecie.practiceId, line.practiceId),
                eq(practiceReferenciaEspecie.especieId, animal.especieId),
              ),
            )
            .limit(1);
          if (ref) {
            referenceRangeLow = ref.rangeLow;
            referenceRangeHigh = ref.rangeHigh;
            const rule: RangeRule = {
              band: { low: ref.rangeLow ?? undefined, high: ref.rangeHigh ?? undefined },
              unit: ref.unit ?? undefined,
            };
            flag = classifyResult(dto.valueNumeric, rule);
          }
        }
      }
    }

    // Upsert real (result.orderPracticeId tiene unique constraint): evita el
    // race de check-then-insert donde dos requests concurrentes leen "no existe"
    // y ambas intentan INSERT, disparando una unique violation.
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
      .onConflictDoUpdate({
        target: result.orderPracticeId,
        set: {
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
        },
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
