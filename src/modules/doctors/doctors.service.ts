import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { DATABASE } from '@/db/database.module';
import { type Doctor, type NewDoctor, doctor } from '@/db/schema';
import type { CreateDoctorDto } from './dto/create-doctor.dto';
import type { UpdateDoctorDto } from './dto/update-doctor.dto';

@Injectable()
export class DoctorsService {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  async search(labId: number, query: string, limit = 50): Promise<Doctor[]> {
    const baseWhere = and(eq(doctor.labId, labId), isNull(doctor.deletedAt));
    if (!query) {
      return this.db
        .select()
        .from(doctor)
        .where(baseWhere)
        .orderBy(desc(doctor.createdAt))
        .limit(limit);
    }
    const like = `%${query}%`;
    return this.db
      .select()
      .from(doctor)
      .where(
        and(
          baseWhere,
          or(
            ilike(doctor.matricula, like),
            ilike(doctor.lastName, like),
            ilike(doctor.firstName, like),
          ),
        ),
      )
      .orderBy(desc(doctor.createdAt))
      .limit(limit);
  }

  async byId(labId: number, id: number): Promise<Doctor> {
    const [row] = await this.db
      .select()
      .from(doctor)
      .where(and(eq(doctor.id, id), eq(doctor.labId, labId), isNull(doctor.deletedAt)))
      .limit(1);
    if (!row) throw new NotFoundException('Medico no encontrado');
    return row;
  }

  async create(dto: CreateDoctorDto, labId: number, createdBy: string): Promise<Doctor> {
    const [existing] = await this.db
      .select({ id: doctor.id })
      .from(doctor)
      .where(and(eq(doctor.labId, labId), eq(doctor.matricula, dto.matricula), isNull(doctor.deletedAt)))
      .limit(1);
    if (existing) throw new ConflictException('Ya existe un medico activo con esa matricula');

    const values: NewDoctor = {
      labId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      matricula: dto.matricula,
      specialty: dto.specialty ?? null,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      notes: dto.notes ?? null,
      createdBy,
    };
    const [row] = await this.db.insert(doctor).values(values).returning();
    return row;
  }

  async update(labId: number, id: number, dto: UpdateDoctorDto): Promise<Doctor> {
    await this.byId(labId, id);

    if (dto.matricula) {
      const [conflict] = await this.db
        .select({ id: doctor.id })
        .from(doctor)
        .where(
          and(
            eq(doctor.labId, labId),
            eq(doctor.matricula, dto.matricula),
            isNull(doctor.deletedAt),
            sql`${doctor.id} <> ${id}`,
          ),
        )
        .limit(1);
      if (conflict) throw new ConflictException('Ya existe un medico activo con esa matricula');
    }

    const patch: Partial<NewDoctor> = {
      ...(dto.firstName !== undefined && { firstName: dto.firstName }),
      ...(dto.lastName !== undefined && { lastName: dto.lastName }),
      ...(dto.matricula !== undefined && { matricula: dto.matricula }),
      ...(dto.specialty !== undefined && { specialty: dto.specialty }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.email !== undefined && { email: dto.email }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
      updatedAt: new Date(),
    };

    const [row] = await this.db
      .update(doctor)
      .set(patch)
      .where(and(eq(doctor.id, id), eq(doctor.labId, labId), isNull(doctor.deletedAt)))
      .returning();
    return row;
  }

  async softDelete(labId: number, id: number): Promise<void> {
    await this.byId(labId, id);
    await this.db
      .update(doctor)
      .set({ deletedAt: new Date() })
      .where(and(eq(doctor.id, id), eq(doctor.labId, labId)));
  }
}
