import type { Db } from '@/db/client';
import { DATABASE } from '@/db/database.module';
import { type Especie, type NewEspecie, especie, type Raza, type NewRaza, raza } from '@/db/schema';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import type { CreateEspecieDto } from './dto/create-especie.dto';
import type { UpdateEspecieDto } from './dto/update-especie.dto';
import type { CreateRazaDto } from './dto/create-raza.dto';
import type { UpdateRazaDto } from './dto/update-raza.dto';

@Injectable()
export class EspeciesService {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  async list(): Promise<Especie[]> {
    return this.db
      .select()
      .from(especie)
      .where(eq(especie.active, true))
      .orderBy(asc(especie.nombre));
  }

  async byId(id: number): Promise<Especie> {
    const [row] = await this.db
      .select()
      .from(especie)
      .where(eq(especie.id, id))
      .limit(1);
    if (!row) throw new NotFoundException('Especie no encontrada');
    return row;
  }

  async create(dto: CreateEspecieDto): Promise<Especie> {
    const values: NewEspecie = {
      nombre: dto.nombre,
      nombreCientifico: dto.nombreCientifico ?? null,
    };
    const [row] = await this.db.insert(especie).values(values).returning();
    return row;
  }

  async update(id: number, dto: UpdateEspecieDto): Promise<Especie> {
    await this.byId(id);

    const patch: Partial<NewEspecie> = {
      ...(dto.nombre !== undefined && { nombre: dto.nombre }),
      ...(dto.nombreCientifico !== undefined && { nombreCientifico: dto.nombreCientifico }),
    };

    const [row] = await this.db
      .update(especie)
      .set(patch)
      .where(eq(especie.id, id))
      .returning();
    return row;
  }

  async setActive(id: number, active: boolean): Promise<Especie> {
    await this.byId(id);
    const [row] = await this.db
      .update(especie)
      .set({ active })
      .where(eq(especie.id, id))
      .returning();
    return row;
  }

  async razasByEspecie(especieId: number): Promise<Raza[]> {
    return this.db
      .select()
      .from(raza)
      .where(eq(raza.especieId, especieId))
      .orderBy(asc(raza.nombre));
  }

  async createRaza(especieId: number, dto: CreateRazaDto): Promise<Raza> {
    await this.byId(especieId);
    const values: NewRaza = {
      especieId,
      nombre: dto.nombre,
    };
    const [row] = await this.db.insert(raza).values(values).returning();
    return row;
  }

  async updateRaza(razaId: number, dto: UpdateRazaDto): Promise<Raza> {
    const [existing] = await this.db
      .select()
      .from(raza)
      .where(eq(raza.id, razaId))
      .limit(1);
    if (!existing) throw new NotFoundException('Raza no encontrada');

    const patch: Partial<NewRaza> = {
      ...(dto.nombre !== undefined && { nombre: dto.nombre }),
    };

    const [row] = await this.db
      .update(raza)
      .set(patch)
      .where(eq(raza.id, razaId))
      .returning();
    return row;
  }

  async setRazaActive(razaId: number, active: boolean): Promise<Raza> {
    const [existing] = await this.db
      .select()
      .from(raza)
      .where(eq(raza.id, razaId))
      .limit(1);
    if (!existing) throw new NotFoundException('Raza no encontrada');

    const [row] = await this.db
      .update(raza)
      .set({ active })
      .where(eq(raza.id, razaId))
      .returning();
    return row;
  }
}
