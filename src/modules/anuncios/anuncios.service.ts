import { AuditService } from '@/common/audit/audit.service';
import type { Db } from '@/db/client';
import { DATABASE } from '@/db/database.module';
import { anuncio } from '@/db/schema';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { type SQL, and, desc, eq, gte, isNull, lte, or } from 'drizzle-orm';
import type { CreateAnuncioDto, UpdateAnuncioDto } from './dto/anuncio.dto';

/** Contexto del actor para auditar acciones de super. */
export interface AnuncioActionContext {
  actorId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AnunciosService {
  constructor(
    @Inject(DATABASE) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  // ─── Super CRUD ────────────────────────────────────────────────

  /** Lista todos los anuncios no borrados (panel super). */
  listAll() {
    return this.db
      .select()
      .from(anuncio)
      .where(isNull(anuncio.deletedAt))
      .orderBy(desc(anuncio.createdAt));
  }

  async create(dto: CreateAnuncioDto, ctx?: AnuncioActionContext) {
    const [row] = await this.db
      .insert(anuncio)
      .values({
        mensaje: dto.mensaje,
        tipo: dto.tipo ?? 'info',
        labId: dto.labId ?? null,
        activo: dto.activo ?? true,
        desde: dto.desde ? new Date(dto.desde) : null,
        hasta: dto.hasta ? new Date(dto.hasta) : null,
        createdBy: ctx?.actorId ?? null,
      })
      .returning();

    await this.audit.log({
      // labId destino, o 0 para anuncios globales (no pertenecen a un lab).
      labId: row.labId ?? 0,
      actorId: ctx?.actorId,
      action: 'anuncio_create',
      entity: 'anuncio',
      entityId: row.id,
      after: { tipo: row.tipo, labId: row.labId, mensaje: row.mensaje },
      ip: ctx?.ip,
      userAgent: ctx?.userAgent,
    });

    return row;
  }

  async update(id: number, dto: UpdateAnuncioDto) {
    await this.findOneOrThrow(id);
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.mensaje !== undefined) patch.mensaje = dto.mensaje;
    if (dto.tipo !== undefined) patch.tipo = dto.tipo;
    if (dto.labId !== undefined) patch.labId = dto.labId;
    if (dto.activo !== undefined) patch.activo = dto.activo;
    if (dto.desde !== undefined) patch.desde = dto.desde ? new Date(dto.desde) : null;
    if (dto.hasta !== undefined) patch.hasta = dto.hasta ? new Date(dto.hasta) : null;

    const [row] = await this.db
      .update(anuncio)
      .set(patch)
      .where(and(eq(anuncio.id, id), isNull(anuncio.deletedAt)))
      .returning();
    return row;
  }

  async remove(id: number, ctx?: AnuncioActionContext) {
    const before = await this.findOneOrThrow(id);
    await this.db
      .update(anuncio)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(anuncio.id, id));

    await this.audit.log({
      labId: before.labId ?? 0,
      actorId: ctx?.actorId,
      action: 'anuncio_delete',
      entity: 'anuncio',
      entityId: id,
      before: { tipo: before.tipo, labId: before.labId, mensaje: before.mensaje },
      ip: ctx?.ip,
      userAgent: ctx?.userAgent,
    });
  }

  private async findOneOrThrow(id: number) {
    const [row] = await this.db
      .select()
      .from(anuncio)
      .where(and(eq(anuncio.id, id), isNull(anuncio.deletedAt)))
      .limit(1);
    if (!row) throw new NotFoundException(`Anuncio ${id} no encontrado`);
    return row;
  }

  // ─── Lab-facing (SCOPEADO) ─────────────────────────────────────

  /**
   * Anuncios activos y vigentes que aplican al caller.
   * SEGURIDAD: un usuario de lab solo ve globales (labId IS NULL) o los de SU lab.
   * Un super (labId === null) ve únicamente los globales. Nunca anuncios de otro lab.
   */
  async forCaller(
    callerLabId: number | null,
  ): Promise<Array<{ id: number; mensaje: string; tipo: string }>> {
    const rows = await this.db
      .select({ id: anuncio.id, mensaje: anuncio.mensaje, tipo: anuncio.tipo })
      .from(anuncio)
      .where(AnunciosService.scopeWhere(callerLabId, new Date()))
      .orderBy(desc(anuncio.createdAt));
    return rows;
  }

  /**
   * Filtro de scope (extraído para poder testearlo aislado).
   * activo=true Y vigente (desde<=now, hasta>=now) Y aplica al caller:
   *  - super (labId null): solo globales (anuncio.labId IS NULL)
   *  - lab:               globales OR los del propio lab
   */
  static scopeWhere(callerLabId: number | null, now: Date): SQL {
    const target =
      callerLabId === null
        ? isNull(anuncio.labId)
        : or(isNull(anuncio.labId), eq(anuncio.labId, callerLabId));

    return and(
      isNull(anuncio.deletedAt),
      eq(anuncio.activo, true),
      or(isNull(anuncio.desde), lte(anuncio.desde, now)),
      or(isNull(anuncio.hasta), gte(anuncio.hasta, now)),
      target,
    ) as SQL;
  }
}
