import type { Db } from '@/db/client';
import { DATABASE } from '@/db/database.module';
import { solicitanteAgua } from '@/db/schema';
import type { SolicitanteAgua } from '@/db/schema';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import type { CreateSolicitanteAguaDto } from './dto/create-solicitante-agua.dto';
import type { UpdateSolicitanteAguaDto } from './dto/update-solicitante-agua.dto';

@Injectable()
export class SolicitantesAguaService {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  async list(labId: number, search?: string): Promise<SolicitanteAgua[]> {
    const conds = [eq(solicitanteAgua.labId, labId), isNull(solicitanteAgua.deletedAt)];
    if (search?.trim()) {
      const like = `%${search.trim()}%`;
      conds.push(
        or(
          ilike(solicitanteAgua.nombreApellido, like),
          ilike(solicitanteAgua.razonSocial, like),
          ilike(solicitanteAgua.cuit, like),
        )!,
      );
    }
    return this.db
      .select()
      .from(solicitanteAgua)
      .where(and(...conds))
      .orderBy(desc(solicitanteAgua.createdAt))
      .limit(500);
  }

  async findById(labId: number, id: number): Promise<SolicitanteAgua> {
    const [row] = await this.db
      .select()
      .from(solicitanteAgua)
      .where(and(eq(solicitanteAgua.id, id), eq(solicitanteAgua.labId, labId), isNull(solicitanteAgua.deletedAt)))
      .limit(1);
    if (!row) throw new NotFoundException(`Solicitante ${id} no encontrado`);
    return row;
  }

  async create(labId: number, dto: CreateSolicitanteAguaDto): Promise<SolicitanteAgua> {
    const [row] = await this.db
      .insert(solicitanteAgua)
      .values({
        labId,
        nombreApellido: dto.nombreApellido,
        razonSocial: dto.razonSocial ?? null,
        cuit: dto.cuit ?? null,
        domicilio: dto.domicilio ?? null,
        localidad: dto.localidad ?? null,
        provincia: dto.provincia ?? null,
        telefono: dto.telefono ?? null,
        email: dto.email ?? null,
      })
      .returning();
    return row;
  }

  async update(labId: number, id: number, dto: UpdateSolicitanteAguaDto): Promise<SolicitanteAgua> {
    await this.findById(labId, id);
    const [row] = await this.db
      .update(solicitanteAgua)
      .set({
        ...(dto.nombreApellido !== undefined && { nombreApellido: dto.nombreApellido }),
        ...(dto.razonSocial !== undefined && { razonSocial: dto.razonSocial ?? null }),
        ...(dto.cuit !== undefined && { cuit: dto.cuit ?? null }),
        ...(dto.domicilio !== undefined && { domicilio: dto.domicilio ?? null }),
        ...(dto.localidad !== undefined && { localidad: dto.localidad ?? null }),
        ...(dto.provincia !== undefined && { provincia: dto.provincia ?? null }),
        ...(dto.telefono !== undefined && { telefono: dto.telefono ?? null }),
        ...(dto.email !== undefined && { email: dto.email ?? null }),
        updatedAt: new Date(),
      })
      .where(and(eq(solicitanteAgua.id, id), eq(solicitanteAgua.labId, labId)))
      .returning();
    return row;
  }

  async softDelete(labId: number, id: number): Promise<void> {
    await this.findById(labId, id);
    await this.db
      .update(solicitanteAgua)
      .set({ deletedAt: new Date() })
      .where(and(eq(solicitanteAgua.id, id), eq(solicitanteAgua.labId, labId)));
  }
}
