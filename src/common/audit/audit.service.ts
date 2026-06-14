import type { Db } from '@/db/client';
import { DATABASE } from '@/db/database.module';
import { auditLog } from '@/db/schema';
import { Inject, Injectable, Logger } from '@nestjs/common';

export interface AuditLogInput {
  labId: number;
  /** uuid del usuario que ejecuta la acción; null para acciones del sistema. */
  actorId?: string | null;
  action: string;
  entity: string;
  entityId: string | number;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Escritura best-effort en audit_log.
 *
 * NUNCA rompe el flujo de negocio: cualquier fallo al persistir la auditoría
 * se captura y se loguea como warning. El audit trail es importante pero no
 * debe tumbar la operación que lo originó.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@Inject(DATABASE) private readonly db: Db) {}

  async log(input: AuditLogInput): Promise<void> {
    try {
      await this.db.insert(auditLog).values({
        labId: input.labId,
        actorId: input.actorId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: String(input.entityId),
        before: input.before ?? null,
        after: input.after ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `audit_log fallido (action=${input.action}, entity=${input.entity}, entityId=${input.entityId}): ${msg}`,
      );
    }
  }
}
