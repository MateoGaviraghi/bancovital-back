import { AuditService } from '@/common/audit/audit.service';
import { isUniqueViolation } from '@/common/db-errors';
import type { Db } from '@/db/client';
import { DATABASE } from '@/db/database.module';
import { type NewSede, type Sede, sede } from '@/db/schema';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { CreateSedeDto } from './dto/create-sede.dto';
import type { UpdateSedeDto } from './dto/update-sede.dto';

export interface SedeActionContext {
  actorId: string | null;
  ip: string | null;
  userAgent: string | null;
}

@Injectable()
export class SedesService {
  constructor(
    @Inject(DATABASE) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  async list(labId: number): Promise<Sede[]> {
    return this.db
      .select()
      .from(sede)
      .where(and(eq(sede.labId, labId), isNull(sede.deletedAt)))
      .orderBy(asc(sede.orden), asc(sede.id));
  }

  async byId(labId: number, id: number): Promise<Sede> {
    const [row] = await this.db
      .select()
      .from(sede)
      .where(and(eq(sede.id, id), eq(sede.labId, labId), isNull(sede.deletedAt)))
      .limit(1);
    if (!row) throw new NotFoundException('Sede no encontrada');
    return row;
  }

  async create(dto: CreateSedeDto, labId: number, ctx?: SedeActionContext): Promise<Sede> {
    const values: NewSede = {
      labId,
      nombre: dto.nombre,
      direccion: dto.direccion,
      localidad: dto.localidad ?? null,
      telefono: dto.telefono ?? null,
      email: dto.email ?? null,
      horarios: dto.horarios ?? null,
      principal: dto.principal ?? false,
      orden: dto.orden ?? 0,
    };

    let row: Sede;

    try {
      if (dto.principal === true) {
        [row] = await this.db.transaction(async (tx) => {
          await tx
            .update(sede)
            .set({ principal: false })
            .where(and(eq(sede.labId, labId), eq(sede.principal, true), isNull(sede.deletedAt)));
          return tx.insert(sede).values(values).returning();
        });
      } else {
        [row] = await this.db.insert(sede).values(values).returning();
      }
    } catch (err: unknown) {
      if (isUniqueViolation(err)) {
        throw new ConflictException('Ya existe una sede principal activa');
      }
      throw err;
    }

    await this.audit.log({
      labId,
      actorId: ctx?.actorId,
      action: 'create_sede',
      entity: 'sede',
      entityId: row.id,
      after: row,
      ip: ctx?.ip,
      userAgent: ctx?.userAgent,
    });

    return row;
  }

  async update(
    labId: number,
    id: number,
    dto: UpdateSedeDto,
    ctx?: SedeActionContext,
  ): Promise<Sede> {
    const before = await this.byId(labId, id);

    const patch: Partial<NewSede> = {
      ...(dto.nombre !== undefined && { nombre: dto.nombre }),
      ...(dto.direccion !== undefined && { direccion: dto.direccion }),
      ...(dto.localidad !== undefined && { localidad: dto.localidad }),
      ...(dto.telefono !== undefined && { telefono: dto.telefono }),
      ...(dto.email !== undefined && { email: dto.email }),
      ...(dto.horarios !== undefined && { horarios: dto.horarios }),
      ...(dto.principal !== undefined && { principal: dto.principal }),
      ...(dto.orden !== undefined && { orden: dto.orden }),
      updatedAt: new Date(),
    };

    let row: Sede;

    try {
      if (dto.principal === true) {
        [row] = await this.db.transaction(async (tx) => {
          await tx
            .update(sede)
            .set({ principal: false })
            .where(and(eq(sede.labId, labId), eq(sede.principal, true), isNull(sede.deletedAt)));
          return tx
            .update(sede)
            .set(patch)
            .where(and(eq(sede.id, id), eq(sede.labId, labId), isNull(sede.deletedAt)))
            .returning();
        });
      } else {
        [row] = await this.db
          .update(sede)
          .set(patch)
          .where(and(eq(sede.id, id), eq(sede.labId, labId), isNull(sede.deletedAt)))
          .returning();
      }
    } catch (err: unknown) {
      if (isUniqueViolation(err)) {
        throw new ConflictException('Ya existe una sede principal activa');
      }
      throw err;
    }

    await this.audit.log({
      labId,
      actorId: ctx?.actorId,
      action: 'update_sede',
      entity: 'sede',
      entityId: id,
      before,
      after: row,
      ip: ctx?.ip,
      userAgent: ctx?.userAgent,
    });

    return row;
  }

  async softDelete(labId: number, id: number, ctx?: SedeActionContext): Promise<void> {
    const before = await this.byId(labId, id);

    await this.db
      .update(sede)
      .set({ deletedAt: new Date() })
      .where(and(eq(sede.id, id), eq(sede.labId, labId)));

    await this.audit.log({
      labId,
      actorId: ctx?.actorId,
      action: 'delete_sede',
      entity: 'sede',
      entityId: id,
      before,
      ip: ctx?.ip,
      userAgent: ctx?.userAgent,
    });
  }
}
