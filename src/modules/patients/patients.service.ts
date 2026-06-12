import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import { DATABASE } from '@/db/database.module';
import type { Db } from '@/db/client';
import { type NewPatient, type Patient, patient } from '@/db/schema';
import type { CreatePatientDto } from './dto/create-patient.dto';
import type { UpdatePatientDto } from './dto/update-patient.dto';

@Injectable()
export class PatientsService {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  async search(labId: number, query: string, limit = 50): Promise<Patient[]> {
    const baseWhere = and(eq(patient.labId, labId), isNull(patient.deletedAt));
    if (!query) {
      return this.db
        .select()
        .from(patient)
        .where(baseWhere)
        .orderBy(desc(patient.createdAt))
        .limit(limit);
    }
    const like = `%${query}%`;
    return this.db
      .select()
      .from(patient)
      .where(
        and(
          baseWhere,
          or(ilike(patient.dni, like), ilike(patient.lastName, like), ilike(patient.firstName, like)),
        ),
      )
      .orderBy(desc(patient.createdAt))
      .limit(limit);
  }

  async byId(labId: number, id: number): Promise<Patient> {
    const [row] = await this.db
      .select()
      .from(patient)
      .where(and(eq(patient.id, id), eq(patient.labId, labId), isNull(patient.deletedAt)))
      .limit(1);
    if (!row) throw new NotFoundException('Paciente no encontrado');
    return row;
  }

  async create(dto: CreatePatientDto, labId: number, createdBy: string): Promise<Patient> {
    const [existing] = await this.db
      .select({ id: patient.id })
      .from(patient)
      .where(and(eq(patient.labId, labId), eq(patient.dni, dto.dni), isNull(patient.deletedAt)))
      .limit(1);
    if (existing) throw new ConflictException('Ya existe un paciente activo con ese DNI');

    const values: NewPatient = {
      labId,
      dni: dto.dni,
      firstName: dto.firstName,
      lastName: dto.lastName,
      sex: dto.sex ?? null,
      birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      streetAddress: dto.streetAddress ?? null,
      city: dto.city ?? null,
      notes: dto.notes ?? null,
      createdBy,
    };
    const [row] = await this.db.insert(patient).values(values).returning();
    return row;
  }

  async update(labId: number, id: number, dto: UpdatePatientDto): Promise<Patient> {
    await this.byId(labId, id);

    if (dto.dni) {
      const [conflict] = await this.db
        .select({ id: patient.id })
        .from(patient)
        .where(
          and(
            eq(patient.labId, labId),
            eq(patient.dni, dto.dni),
            isNull(patient.deletedAt),
            sql`${patient.id} <> ${id}`,
          ),
        )
        .limit(1);
      if (conflict) throw new ConflictException('Ya existe un paciente activo con ese DNI');
    }

    const patch: Partial<NewPatient> = {
      ...(dto.dni !== undefined && { dni: dto.dni }),
      ...(dto.firstName !== undefined && { firstName: dto.firstName }),
      ...(dto.lastName !== undefined && { lastName: dto.lastName }),
      ...(dto.sex !== undefined && { sex: dto.sex }),
      ...(dto.birthDate !== undefined && {
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
      }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.email !== undefined && { email: dto.email }),
      ...(dto.streetAddress !== undefined && { streetAddress: dto.streetAddress }),
      ...(dto.city !== undefined && { city: dto.city }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
      updatedAt: new Date(),
    };

    const [row] = await this.db
      .update(patient)
      .set(patch)
      .where(and(eq(patient.id, id), eq(patient.labId, labId), isNull(patient.deletedAt)))
      .returning();
    return row;
  }
}
