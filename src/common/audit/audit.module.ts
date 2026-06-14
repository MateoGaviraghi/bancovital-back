import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';

/**
 * Módulo global de auditoría. Expone AuditService para que cualquier módulo
 * pueda registrar acciones sensibles en audit_log sin re-importarlo.
 */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
