import { isUniqueViolation } from '@/common/db-errors';
import type { Db } from '@/db/client';
import { DATABASE } from '@/db/database.module';
import {
  type NewPracticeReferenciaEspecie,
  type Practice,
  type PracticeComposition,
  type PracticeReferenciaEspecie,
  practice,
  practiceComposition,
  practiceReferenciaEspecie,
} from '@/db/schema';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { type SQL, and, asc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import type { AddComponentDto } from './dto/add-component.dto';
import type { CatalogQueryDto } from './dto/catalog-query.dto';
import type { CreatePracticeDto } from './dto/create-practice.dto';
import type { UpdatePracticeDto } from './dto/update-practice.dto';

export interface PracticeWithChildren extends Practice {
  children: Pick<Practice, 'id' | 'nbuCode' | 'name'>[];
}

export interface CatalogResult {
  data: PracticeWithChildren[];
  total: number;
  page: number;
  pageSize: number;
  sections: string[];
}

@Injectable()
export class PracticesService {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  async search(query: string, limit = 50, section?: string): Promise<PracticeWithChildren[]> {
    const filters = [eq(practice.active, true), eq(practice.standalone, true)];
    if (section) filters.push(eq(practice.section, section));
    if (query) {
      const like = `%${query}%`;
      const orExpr = or(ilike(practice.name, like), ilike(practice.nbuCode, like));
      if (orExpr) filters.push(orExpr);
    }
    const rows = await this.db
      .select()
      .from(practice)
      .where(and(...filters))
      .orderBy(asc(practice.name))
      .limit(limit);
    return this.hydrateChildren(rows);
  }

  /**
   * Paginated catalog view: searches the FULL catalog (active + inactive),
   * filterable by section and status. Distinct from search() which only
   * serves the active subset for the order builder.
   */
  async catalog(params: CatalogQueryDto): Promise<CatalogResult> {
    const page = Math.max(params.page ?? 1, 1);
    const pageSize = Math.min(Math.max(params.pageSize ?? 50, 1), 100);
    const status = params.status ?? 'all';

    const filters: SQL[] = [];
    if (status === 'active') filters.push(eq(practice.active, true));
    else if (status === 'inactive') filters.push(eq(practice.active, false));
    const section = params.section?.trim();
    if (section) filters.push(eq(practice.section, section));
    const q = params.q?.trim();
    if (q) {
      const like = `%${q}%`;
      const orExpr = or(ilike(practice.name, like), ilike(practice.nbuCode, like));
      if (orExpr) filters.push(orExpr);
    }
    const where = filters.length ? and(...filters) : undefined;

    const [rows, totalRows, sectionRows] = await Promise.all([
      this.db
        .select()
        .from(practice)
        .where(where)
        .orderBy(asc(practice.name))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.select({ n: sql<number>`count(*)::int` }).from(practice).where(where),
      this.db
        .selectDistinct({ section: practice.section })
        .from(practice)
        .orderBy(asc(practice.section)),
    ]);

    const sections = sectionRows.map((r) => r.section).filter((s): s is string => Boolean(s));

    const data = await this.hydrateChildren(rows);
    return { data, total: totalRows[0]?.n ?? 0, page, pageSize, sections };
  }

  async list(limit = 200): Promise<Practice[]> {
    return this.db
      .select()
      .from(practice)
      .where(eq(practice.active, true))
      .orderBy(asc(practice.name))
      .limit(limit);
  }

  async byIds(ids: number[]): Promise<Practice[]> {
    if (ids.length === 0) return [];
    return this.db.select().from(practice).where(inArray(practice.id, ids));
  }

  async byNbuCode(code: string): Promise<Practice> {
    const [row] = await this.db.select().from(practice).where(eq(practice.nbuCode, code)).limit(1);
    if (!row) throw new NotFoundException(`No existe la practica con codigo NBU ${code}`);
    return row;
  }

  async create(dto: CreatePracticeDto): Promise<Practice> {
    try {
      const [row] = await this.db
        .insert(practice)
        .values({
          nbuCode: dto.nbuCode.trim(),
          name: dto.name.trim(),
          shortName: dto.shortName?.trim() || null,
          category: dto.category?.trim() || null,
          section: dto.section?.trim() || null,
          units: dto.units ?? null,
          precioParticular: dto.precioParticular ?? null,
          notes: dto.notes?.trim() || null,
          requiresAuthorization: dto.requiresAuthorization ?? false,
          isSpecialAct: dto.isSpecialAct ?? false,
          active: dto.active ?? true,
          referenceValue: dto.referenceValue ?? null,
          methodology: dto.methodology?.trim() || null,
          defaultUnit: dto.defaultUnit?.trim() || null,
          isElaborated: dto.isElaborated ?? false,
        })
        .returning();
      return row;
    } catch (err: unknown) {
      if (isUniqueViolation(err)) {
        throw new ConflictException(`Ya existe una práctica con código NBU "${dto.nbuCode}".`);
      }
      throw err;
    }
  }

  async update(id: number, dto: UpdatePracticeDto): Promise<Practice> {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.nbuCode !== undefined) set.nbuCode = dto.nbuCode.trim();
    if (dto.name !== undefined) set.name = dto.name.trim();
    if (dto.shortName !== undefined) set.shortName = dto.shortName?.trim() || null;
    if (dto.category !== undefined) set.category = dto.category?.trim() || null;
    if (dto.section !== undefined) set.section = dto.section?.trim() || null;
    if (dto.units !== undefined) set.units = dto.units ?? null;
    if (dto.precioParticular !== undefined) set.precioParticular = dto.precioParticular ?? null;
    if (dto.notes !== undefined) set.notes = dto.notes?.trim() || null;
    if (dto.requiresAuthorization !== undefined)
      set.requiresAuthorization = dto.requiresAuthorization;
    if (dto.isSpecialAct !== undefined) set.isSpecialAct = dto.isSpecialAct;
    if (dto.active !== undefined) set.active = dto.active;
    if (dto.parentId !== undefined) set.parentId = dto.parentId ?? null;
    if (dto.referenceValue !== undefined) set.referenceValue = dto.referenceValue ?? null;
    if (dto.methodology !== undefined) set.methodology = dto.methodology?.trim() || null;
    if (dto.defaultUnit !== undefined) set.defaultUnit = dto.defaultUnit?.trim() || null;
    if (dto.isElaborated !== undefined) set.isElaborated = dto.isElaborated;
    if (dto.standalone !== undefined) set.standalone = dto.standalone;

    try {
      const [row] = await this.db.update(practice).set(set).where(eq(practice.id, id)).returning();
      if (!row) throw new NotFoundException(`Práctica ${id} no encontrada.`);
      return row;
    } catch (err: unknown) {
      if (isUniqueViolation(err)) {
        throw new ConflictException('Ya existe una práctica con ese código NBU.');
      }
      throw err;
    }
  }

  // ── Valores de referencia por especie ──────────────────────────────

  async referenciasByPractice(practiceId: number): Promise<PracticeReferenciaEspecie[]> {
    return this.db
      .select()
      .from(practiceReferenciaEspecie)
      .where(eq(practiceReferenciaEspecie.practiceId, practiceId))
      .orderBy(asc(practiceReferenciaEspecie.especieId));
  }

  async upsertReferencia(
    practiceId: number,
    especieId: number,
    dto: {
      rangeLow?: string | null;
      rangeHigh?: string | null;
      unit?: string | null;
      referenceText?: string | null;
      notes?: string | null;
    },
  ): Promise<PracticeReferenciaEspecie> {
    const values: NewPracticeReferenciaEspecie = {
      practiceId,
      especieId,
      rangeLow: dto.rangeLow ?? null,
      rangeHigh: dto.rangeHigh ?? null,
      unit: dto.unit ?? null,
      referenceText: dto.referenceText ?? null,
      notes: dto.notes ?? null,
    };
    const [row] = await this.db
      .insert(practiceReferenciaEspecie)
      .values(values)
      .onConflictDoUpdate({
        target: [practiceReferenciaEspecie.practiceId, practiceReferenciaEspecie.especieId],
        set: { ...values, updatedAt: new Date() },
      })
      .returning();
    return row;
  }

  async deleteReferencia(practiceId: number, especieId: number): Promise<void> {
    const [row] = await this.db
      .delete(practiceReferenciaEspecie)
      .where(
        and(
          eq(practiceReferenciaEspecie.practiceId, practiceId),
          eq(practiceReferenciaEspecie.especieId, especieId),
        ),
      )
      .returning();
    if (!row) throw new NotFoundException('Referencia no encontrada');
  }

  // ── Composition (M:N) ────────────────────────────────────────────────

  async getComponents(parentId: number): Promise<Pick<Practice, 'id' | 'nbuCode' | 'name'>[]> {
    const rows = await this.db
      .select({
        id: practice.id,
        nbuCode: practice.nbuCode,
        name: practice.name,
        sortOrder: practiceComposition.sortOrder,
      })
      .from(practiceComposition)
      .innerJoin(practice, eq(practice.id, practiceComposition.componentPracticeId))
      .where(eq(practiceComposition.parentPracticeId, parentId))
      .orderBy(asc(practiceComposition.sortOrder), asc(practice.name));
    return rows.map(({ id, nbuCode, name }) => ({ id, nbuCode, name }));
  }

  async getParents(componentId: number): Promise<Pick<Practice, 'id' | 'nbuCode' | 'name'>[]> {
    const rows = await this.db
      .select({ id: practice.id, nbuCode: practice.nbuCode, name: practice.name })
      .from(practiceComposition)
      .innerJoin(practice, eq(practice.id, practiceComposition.parentPracticeId))
      .where(eq(practiceComposition.componentPracticeId, componentId))
      .orderBy(asc(practice.name));
    return rows;
  }

  async addComponent(parentId: number, dto: AddComponentDto): Promise<PracticeComposition> {
    if (parentId === dto.componentId) {
      throw new ConflictException('Una práctica no puede ser componente de sí misma.');
    }
    const [parent, component] = await Promise.all([
      this.byIds([parentId]),
      this.byIds([dto.componentId]),
    ]);
    if (!parent[0]) throw new NotFoundException(`Práctica padre ${parentId} no encontrada.`);
    if (!component[0]) throw new NotFoundException(`Práctica componente ${dto.componentId} no encontrada.`);

    try {
      const [row] = await this.db
        .insert(practiceComposition)
        .values({ parentPracticeId: parentId, componentPracticeId: dto.componentId, sortOrder: dto.sortOrder ?? 0 })
        .returning();
      return row;
    } catch (err: unknown) {
      if (isUniqueViolation(err)) {
        throw new ConflictException(`La práctica ${dto.componentId} ya es componente de ${parentId}.`);
      }
      throw err;
    }
  }

  async removeComponent(parentId: number, componentId: number): Promise<void> {
    const [row] = await this.db
      .delete(practiceComposition)
      .where(
        and(
          eq(practiceComposition.parentPracticeId, parentId),
          eq(practiceComposition.componentPracticeId, componentId),
        ),
      )
      .returning();
    if (!row) throw new NotFoundException('Relación de componente no encontrada.');
  }

  private async hydrateChildren(parents: Practice[]): Promise<PracticeWithChildren[]> {
    if (parents.length === 0) return [];
    const parentIds = parents.map((p) => p.id);

    const rows = await this.db
      .select({
        parentPracticeId: practiceComposition.parentPracticeId,
        id: practice.id,
        nbuCode: practice.nbuCode,
        name: practice.name,
      })
      .from(practiceComposition)
      .innerJoin(practice, eq(practice.id, practiceComposition.componentPracticeId))
      .where(inArray(practiceComposition.parentPracticeId, parentIds))
      .orderBy(asc(practiceComposition.sortOrder), asc(practice.name));

    const childrenByParentId = new Map<number, Pick<Practice, 'id' | 'nbuCode' | 'name'>[]>();
    for (const r of rows) {
      const list = childrenByParentId.get(r.parentPracticeId) ?? [];
      list.push({ id: r.id, nbuCode: r.nbuCode, name: r.name });
      childrenByParentId.set(r.parentPracticeId, list);
    }

    return parents.map((p) => ({ ...p, children: childrenByParentId.get(p.id) ?? [] }));
  }
}
