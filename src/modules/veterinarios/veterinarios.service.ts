import type { Db } from '@/db/client';
import { DATABASE } from '@/db/database.module';
import { type Veterinario, type NewVeterinario, veterinario } from '@/db/schema';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import type { CreateVeterinarioDto } from './dto/create-veterinario.dto';
import type { UpdateVeterinarioDto } from './dto/update-veterinario.dto';

@Injectable()
export class VeterinariosService {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  async search(labId: number, query: string, limit = 50): Promise<Veterinario[]> {
    const baseWhere = and(eq(veterinario.labId, labId), isNull(veterinario.deletedAt));
    if (!query) {
      return this.db
        .select()
        .from(veterinario)
        .where(baseWhere)
        .orderBy(desc(veterinario.createdAt))
        .limit(limit);
    }
    const like = `%${query}%`;
    return this.db
      .select()
      .from(veterinario)
      .where(
        and(
          baseWhere,
          or(
            ilike(veterinario.matricula, like),
            ilike(veterinario.lastName, like),
            ilike(veterinario.firstName, like),
          ),
        ),
      )
      .orderBy(desc(veterinario.createdAt))
      .limit(limit);
  }

  async byId(labId: number, id: number): Promise<Veterinario> {
    const [row] = await this.db
      .select()
      .from(veterinario)
      .where(and(eq(veterinario.id, id), eq(veterinario.labId, labId), isNull(veterinario.deletedAt)))
      .limit(1);
    if (!row) throw new NotFoundException('Veterinario no encontrado');
    return row;
  }

  async create(dto: CreateVeterinarioDto, labId: number, createdBy: string): Promise<Veterinario> {
    const [existing] = await this.db
      .select({ id: veterinario.id })
      .from(veterinario)
      .where(
        and(eq(veterinario.labId, labId), eq(veterinario.matricula, dto.matricula), isNull(veterinario.deletedAt)),
      )
      .limit(1);
    if (existing) throw new ConflictException('Ya existe un veterinario activo con esa matricula');

    const values: NewVeterinario = {
      labId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      matricula: dto.matricula,
      clinica: dto.clinica ?? null,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      notes: dto.notes ?? null,
      createdBy,
    };
    const [row] = await this.db.insert(veterinario).values(values).returning();
    return row;
  }

  async update(labId: number, id: number, dto: UpdateVeterinarioDto): Promise<Veterinario> {
    await this.byId(labId, id);

    if (dto.matricula) {
      const [conflict] = await this.db
        .select({ id: veterinario.id })
        .from(veterinario)
        .where(
          and(
            eq(veterinario.labId, labId),
            eq(veterinario.matricula, dto.matricula),
            isNull(veterinario.deletedAt),
            sql`${veterinario.id} <> ${id}`,
          ),
        )
        .limit(1);
      if (conflict) throw new ConflictException('Ya existe un veterinario activo con esa matricula');
    }

    const patch: Partial<NewVeterinario> = {
      ...(dto.firstName !== undefined && { firstName: dto.firstName }),
      ...(dto.lastName !== undefined && { lastName: dto.lastName }),
      ...(dto.matricula !== undefined && { matricula: dto.matricula }),
      ...(dto.clinica !== undefined && { clinica: dto.clinica }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.email !== undefined && { email: dto.email }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
      updatedAt: new Date(),
    };

    const [row] = await this.db
      .update(veterinario)
      .set(patch)
      .where(and(eq(veterinario.id, id), eq(veterinario.labId, labId), isNull(veterinario.deletedAt)))
      .returning();
    return row;
  }

  async softDelete(labId: number, id: number): Promise<void> {
    await this.byId(labId, id);
    await this.db
      .update(veterinario)
      .set({ deletedAt: new Date() })
      .where(and(eq(veterinario.id, id), eq(veterinario.labId, labId)));
  }
}
