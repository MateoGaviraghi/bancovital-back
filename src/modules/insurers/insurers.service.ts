import type { Db } from '@/db/client';
import { DATABASE } from '@/db/database.module';
import {
  type Insurer,
  type NewInsurer,
  type NewUbValue,
  type UbValue,
  insurer,
  ubValue,
} from '@/db/schema';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import type { CreateInsurerDto } from './dto/create-insurer.dto';
import type { SetUbValueDto } from './dto/set-ub-value.dto';
import type { UpdateInsurerDto } from './dto/update-insurer.dto';

export interface InsurerWithCurrentUb extends Insurer {
  currentUbValue: string | null;
  currentUbValidFrom: Date | null;
}

@Injectable()
export class InsurersService {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  // ---- Obras sociales (catalogo global) ----

  async list(onlyActive = false): Promise<Insurer[]> {
    const where = onlyActive ? eq(insurer.active, true) : undefined;
    return this.db.select().from(insurer).where(where).orderBy(asc(insurer.name));
  }

  async listWithCurrentUb(): Promise<InsurerWithCurrentUb[]> {
    const rows = await this.db
      .select({
        insurer: insurer,
        ubVal: ubValue.value,
        ubValidFrom: ubValue.validFrom,
      })
      .from(insurer)
      .leftJoin(ubValue, and(eq(ubValue.insurerId, insurer.id), isNull(ubValue.validTo)))
      .orderBy(asc(insurer.name));

    return rows.map((r) => ({
      ...r.insurer,
      currentUbValue: r.ubVal ?? null,
      currentUbValidFrom: r.ubValidFrom ? new Date(r.ubValidFrom) : null,
    }));
  }

  async byId(id: number): Promise<Insurer> {
    const [row] = await this.db.select().from(insurer).where(eq(insurer.id, id)).limit(1);
    if (!row) throw new NotFoundException('Obra social no encontrada');
    return row;
  }

  async byCode(code: string): Promise<Insurer> {
    const [row] = await this.db.select().from(insurer).where(eq(insurer.code, code)).limit(1);
    if (!row) throw new NotFoundException('Obra social no encontrada');
    return row;
  }

  async create(dto: CreateInsurerDto): Promise<Insurer> {
    const [existing] = await this.db
      .select({ id: insurer.id })
      .from(insurer)
      .where(eq(insurer.code, dto.code))
      .limit(1);
    if (existing) throw new ConflictException('Ya existe una obra social con ese codigo');

    const values: NewInsurer = {
      code: dto.code,
      name: dto.name,
      requiresAuthorization: dto.requiresAuthorization ?? true,
      active: dto.active ?? true,
    };
    const [row] = await this.db.insert(insurer).values(values).returning();
    return row;
  }

  async update(id: number, dto: UpdateInsurerDto): Promise<Insurer> {
    await this.byId(id);

    if (dto.code) {
      const [conflict] = await this.db
        .select({ id: insurer.id })
        .from(insurer)
        .where(and(eq(insurer.code, dto.code), sql`${insurer.id} <> ${id}`))
        .limit(1);
      if (conflict) throw new ConflictException('Ya existe una obra social con ese codigo');
    }

    const patch: Partial<NewInsurer> = {
      ...(dto.code !== undefined && { code: dto.code }),
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.requiresAuthorization !== undefined && {
        requiresAuthorization: dto.requiresAuthorization,
      }),
      ...(dto.active !== undefined && { active: dto.active }),
      updatedAt: new Date(),
    };
    const [row] = await this.db.update(insurer).set(patch).where(eq(insurer.id, id)).returning();
    return row;
  }

  async setActive(id: number, active: boolean): Promise<Insurer> {
    await this.byId(id);
    const [row] = await this.db
      .update(insurer)
      .set({ active, updatedAt: new Date() })
      .where(eq(insurer.id, id))
      .returning();
    return row;
  }

  // ---- Valores UB (tenant-scoped) ----

  async ubHistory(insurerId: number): Promise<UbValue[]> {
    await this.byId(insurerId);
    return this.db
      .select()
      .from(ubValue)
      .where(eq(ubValue.insurerId, insurerId))
      .orderBy(desc(ubValue.validFrom));
  }

  async currentUb(insurerId: number): Promise<UbValue | null> {
    await this.byId(insurerId);
    const [row] = await this.db
      .select()
      .from(ubValue)
      .where(and(eq(ubValue.insurerId, insurerId), isNull(ubValue.validTo)))
      .limit(1);
    return row ?? null;
  }

  async setUbValue(dto: SetUbValueDto, createdBy: string): Promise<UbValue> {
    await this.byId(dto.insurerId);
    const validFromDate = new Date(dto.validFrom);

    return this.db.transaction(async (tx) => {
      await tx
        .update(ubValue)
        .set({ validTo: validFromDate })
        .where(and(eq(ubValue.insurerId, dto.insurerId), isNull(ubValue.validTo)));

      const newRow: NewUbValue = {
        insurerId: dto.insurerId,
        value: dto.value,
        validFrom: validFromDate,
        validTo: null,
        notes: dto.notes ?? null,
        createdBy,
      };
      const [inserted] = await tx.insert(ubValue).values(newRow).returning();
      return inserted;
    });
  }
}
