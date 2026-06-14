import { AuditService } from '@/common/audit/audit.service';
import type { Db } from '@/db/client';
import { DATABASE } from '@/db/database.module';
import { laboratorio } from '@/db/schema';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';

export interface ImpersonateContext {
  superUserId: string;
  ip?: string | null;
  userAgent?: string | null;
}

export interface ImpersonateEnterResult {
  labId: number;
  slug: string;
  nombre: string;
}

@Injectable()
export class ImpersonationService {
  constructor(
    @Inject(DATABASE) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  /**
   * Valida que el lab exista y no esté inactivo, audita el ingreso y devuelve
   * los datos mínimos para el banner del front. El header x-impersonate-lab
   * NO se envía a este endpoint: el super lo empieza a mandar recién después.
   */
  async enter(labId: number, ctx: ImpersonateContext): Promise<ImpersonateEnterResult> {
    const [lab] = await this.db
      .select({
        id: laboratorio.id,
        slug: laboratorio.slug,
        nombre: laboratorio.legalName,
        estado: laboratorio.estado,
      })
      .from(laboratorio)
      .where(eq(laboratorio.id, labId))
      .limit(1);

    if (!lab) throw new NotFoundException(`Laboratorio ${labId} no encontrado`);
    if (lab.estado === 'inactivo') {
      throw new ConflictException('No se puede impersonar un laboratorio inactivo.');
    }

    await this.audit.log({
      labId: lab.id,
      actorId: ctx.superUserId,
      action: 'impersonate_enter',
      entity: 'laboratorio',
      entityId: lab.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return { labId: lab.id, slug: lab.slug, nombre: lab.nombre };
  }

  /**
   * Registra la salida de la impersonation. Se llama SIN el header
   * x-impersonate-lab, por lo que el super opera como super (labId real null).
   * El labId a auditar viaja en el body.
   */
  async exit(labId: number, ctx: ImpersonateContext): Promise<{ ok: true }> {
    await this.audit.log({
      labId,
      actorId: ctx.superUserId,
      action: 'impersonate_exit',
      entity: 'laboratorio',
      entityId: labId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return { ok: true };
  }
}
