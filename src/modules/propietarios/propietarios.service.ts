import type { Db } from '@/db/client';
import { DATABASE } from '@/db/database.module';
import { type Propietario, type NewPropietario, propietario } from '@/db/schema';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import type { CreatePropietarioDto } from './dto/create-propietario.dto';
import type { UpdatePropietarioDto } from './dto/update-propietario.dto';

@Injectable()
export class PropietariosService {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  async search(labId: number, query: string, limit = 50): Promise<Propietario[]> {
    const baseWhere = and(eq(propietario.labId, labId), isNull(propietario.deletedAt));
    if (!query) {
      return this.db
        .select()
        .from(propietario)
        .where(baseWhere)
        .orderBy(desc(propietario.createdAt))
        .limit(limit);
    }
    const like = `%${query}%`;
    return this.db
      .select()
      .from(propietario)
      .where(
        and(
          baseWhere,
          or(
            ilike(propietario.dni, like),
            ilike(propietario.lastName, like),
            ilike(propietario.firstName, like),
          ),
        ),
      )
      .orderBy(desc(propietario.createdAt))
      .limit(limit);
  }

  async byId(labId: number, id: number): Promise<Propietario> {
    const [row] = await this.db
      .select()
      .from(propietario)
      .where(and(eq(propietario.id, id), eq(propietario.labId, labId), isNull(propietario.deletedAt)))
      .limit(1);
    if (!row) throw new NotFoundException('Propietario no encontrado');
    return row;
  }

  async create(dto: CreatePropietarioDto, labId: number, createdBy: string): Promise<Propietario> {
    const [existing] = await this.db
      .select({ id: propietario.id })
      .from(propietario)
      .where(
        and(eq(propietario.labId, labId), eq(propietario.dni, dto.dni), isNull(propietario.deletedAt)),
      )
      .limit(1);
    if (existing) throw new ConflictException('Ya existe un propietario activo con ese DNI');

    const values: NewPropietario = {
      labId,
      dni: dto.dni,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      streetAddress: dto.streetAddress ?? null,
      city: dto.city ?? null,
      notes: dto.notes ?? null,
      createdBy,
    };
    const [row] = await this.db.insert(propietario).values(values).returning();
    return row;
  }

  async update(labId: number, id: number, dto: UpdatePropietarioDto): Promise<Propietario> {
    await this.byId(labId, id);

    if (dto.dni) {
      const [conflict] = await this.db
        .select({ id: propietario.id })
        .from(propietario)
        .where(
          and(
            eq(propietario.labId, labId),
            eq(propietario.dni, dto.dni),
            isNull(propietario.deletedAt),
            sql`${propietario.id} <> ${id}`,
          ),
        )
        .limit(1);
      if (conflict) throw new ConflictException('Ya existe un propietario activo con ese DNI');
    }

    const patch: Partial<NewPropietario> = {
      ...(dto.dni !== undefined && { dni: dto.dni }),
      ...(dto.firstName !== undefined && { firstName: dto.firstName }),
      ...(dto.lastName !== undefined && { lastName: dto.lastName }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.email !== undefined && { email: dto.email }),
      ...(dto.streetAddress !== undefined && { streetAddress: dto.streetAddress }),
      ...(dto.city !== undefined && { city: dto.city }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
      updatedAt: new Date(),
    };

    const [row] = await this.db
      .update(propietario)
      .set(patch)
      .where(and(eq(propietario.id, id), eq(propietario.labId, labId), isNull(propietario.deletedAt)))
      .returning();
    return row;
  }

  async softDelete(labId: number, id: number): Promise<void> {
    await this.byId(labId, id);
    await this.db
      .update(propietario)
      .set({ deletedAt: new Date() })
      .where(and(eq(propietario.id, id), eq(propietario.labId, labId)));
  }
}
