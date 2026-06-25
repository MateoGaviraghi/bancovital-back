import type { Db } from '@/db/client';
import { DATABASE } from '@/db/database.module';
import { type PacienteAnimal, type NewPacienteAnimal, pacienteAnimal, propietario, especie, raza } from '@/db/schema';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike, isNull } from 'drizzle-orm';
import type { CreatePacienteAnimalDto } from './dto/create-paciente-animal.dto';
import type { UpdatePacienteAnimalDto } from './dto/update-paciente-animal.dto';

@Injectable()
export class PacientesAnimalesService {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  async search(
    labId: number,
    query: string,
    limit = 50,
    propietarioId?: number,
  ) {
    const conds = [
      eq(pacienteAnimal.labId, labId),
      isNull(pacienteAnimal.deletedAt),
      ...(propietarioId ? [eq(pacienteAnimal.propietarioId, propietarioId)] : []),
      ...(query ? [ilike(pacienteAnimal.nombre, `%${query}%`)] : []),
    ];

    const rows = await this.db
      .select({
        animal: pacienteAnimal,
        especie,
        raza,
        propietario,
      })
      .from(pacienteAnimal)
      .leftJoin(especie, eq(especie.id, pacienteAnimal.especieId))
      .leftJoin(raza, eq(raza.id, pacienteAnimal.razaId))
      .leftJoin(propietario, eq(propietario.id, pacienteAnimal.propietarioId))
      .where(and(...conds))
      .orderBy(desc(pacienteAnimal.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      ...r.animal,
      especie: r.especie ?? undefined,
      raza: r.raza ?? undefined,
      propietario: r.propietario ?? undefined,
    }));
  }

  async byId(labId: number, id: number) {
    const [row] = await this.db
      .select({
        animal: pacienteAnimal,
        especie,
        raza,
        propietario,
      })
      .from(pacienteAnimal)
      .leftJoin(especie, eq(especie.id, pacienteAnimal.especieId))
      .leftJoin(raza, eq(raza.id, pacienteAnimal.razaId))
      .leftJoin(propietario, eq(propietario.id, pacienteAnimal.propietarioId))
      .where(and(eq(pacienteAnimal.id, id), eq(pacienteAnimal.labId, labId), isNull(pacienteAnimal.deletedAt)))
      .limit(1);
    if (!row) throw new NotFoundException('Paciente animal no encontrado');
    return {
      ...row.animal,
      especie: row.especie ?? undefined,
      raza: row.raza ?? undefined,
      propietario: row.propietario ?? undefined,
    };
  }

  async create(dto: CreatePacienteAnimalDto, labId: number, createdBy: string): Promise<PacienteAnimal> {
    const values: NewPacienteAnimal = {
      labId,
      propietarioId: dto.propietarioId,
      especieId: dto.especieId,
      razaId: dto.razaId ?? null,
      nombre: dto.nombre,
      sexo: dto.sexo ?? null,
      birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
      peso: dto.peso ?? null,
      color: dto.color ?? null,
      tamanio: dto.tamanio ?? null,
      estadoReproductivo: dto.estadoReproductivo ?? null,
      microchip: dto.microchip ?? null,
      notes: dto.notes ?? null,
      createdBy,
    };
    const [row] = await this.db.insert(pacienteAnimal).values(values).returning();
    return row;
  }

  async update(labId: number, id: number, dto: UpdatePacienteAnimalDto): Promise<PacienteAnimal> {
    await this.byId(labId, id);

    const patch: Partial<NewPacienteAnimal> = {
      ...(dto.propietarioId !== undefined && { propietarioId: dto.propietarioId }),
      ...(dto.especieId !== undefined && { especieId: dto.especieId }),
      ...(dto.razaId !== undefined && { razaId: dto.razaId }),
      ...(dto.nombre !== undefined && { nombre: dto.nombre }),
      ...(dto.sexo !== undefined && { sexo: dto.sexo }),
      ...(dto.birthDate !== undefined && { birthDate: dto.birthDate ? new Date(dto.birthDate) : null }),
      ...(dto.peso !== undefined && { peso: dto.peso }),
      ...(dto.color !== undefined && { color: dto.color }),
      ...(dto.tamanio !== undefined && { tamanio: dto.tamanio }),
      ...(dto.estadoReproductivo !== undefined && { estadoReproductivo: dto.estadoReproductivo }),
      ...(dto.microchip !== undefined && { microchip: dto.microchip }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
      updatedAt: new Date(),
    };

    const [row] = await this.db
      .update(pacienteAnimal)
      .set(patch)
      .where(and(eq(pacienteAnimal.id, id), eq(pacienteAnimal.labId, labId), isNull(pacienteAnimal.deletedAt)))
      .returning();
    return row;
  }

  async softDelete(labId: number, id: number): Promise<void> {
    await this.byId(labId, id);
    await this.db
      .update(pacienteAnimal)
      .set({ deletedAt: new Date() })
      .where(and(eq(pacienteAnimal.id, id), eq(pacienteAnimal.labId, labId)));
  }
}
