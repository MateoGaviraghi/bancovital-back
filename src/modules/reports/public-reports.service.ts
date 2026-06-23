import { AuditService } from '@/common/audit/audit.service';
import type { Db } from '@/db/client';
import { DATABASE, SUPABASE_ADMIN } from '@/db/database.module';
import { laboratorio, order, patient } from '@/db/schema';
import { ASSETS_BUCKET } from '@/modules/lab-config/asset-storage';
import { HttpException, HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { and, eq } from 'drizzle-orm';
import { REPORTS_BUCKET } from './reports.service';

/** Tras este número de DNI fallidos, el acceso por ese token se bloquea un rato. */
const MAX_DNI_ATTEMPTS = 10;
const LOCK_MS = 60 * 60_000; // 1 hora
const LOGO_TTL_SECONDS = 3600;

export interface PublicInformeMeta {
  labName: string;
  shortName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  tagline: string | null;
  protocolNumber: string;
  emitidaAt: string | null;
}

export interface PublicInformeFile {
  buffer: Buffer;
  filename: string;
}

export interface PublicAccessCtx {
  ip: string | null;
  userAgent: string | null;
}

/** Normaliza un DNI a solo dígitos para comparar (tolera puntos/espacios). */
function normalizeDni(s: string): string {
  return s.replace(/\D/g, '');
}

/**
 * Acceso PÚBLICO al informe vía el token del QR (F7). La seguridad primaria es el
 * token de 256 bits (unguessable); el DNI es un segundo factor liviano contra fuga
 * de la sola URL. No revela PII antes de validar el DNI y nunca confirma si un DNI
 * "existe" (mensajes genéricos).
 */
@Injectable()
export class PublicReportsService {
  constructor(
    @Inject(DATABASE) private readonly db: Db,
    @Inject(SUPABASE_ADMIN) private readonly storage: SupabaseClient,
    private readonly audit: AuditService,
  ) {}

  /** Busca la orden por token, exigiendo que el informe esté emitido. */
  private async findEmittedByToken(token: string) {
    if (!token || token.length > 64) throw new NotFoundException('Informe no encontrado');
    const [row] = await this.db
      .select()
      .from(order)
      .where(eq(order.publicReportToken, token))
      .limit(1);
    if (!row || (row.status !== 'emitida' && row.status !== 'entregada')) {
      throw new NotFoundException('Informe no encontrado');
    }
    return row;
  }

  /** Metadata mínima para tematizar la página pública. CERO PII del paciente. */
  async getMeta(token: string): Promise<PublicInformeMeta> {
    const ord = await this.findEmittedByToken(token);
    const [lab] = await this.db
      .select()
      .from(laboratorio)
      .where(eq(laboratorio.id, ord.labId))
      .limit(1);
    if (!lab) throw new NotFoundException('Informe no encontrado');

    let logoUrl: string | null = null;
    if (lab.logoPath) {
      const signed = await this.storage.storage
        .from(ASSETS_BUCKET)
        .createSignedUrl(lab.logoPath, LOGO_TTL_SECONDS);
      logoUrl = signed.data && !signed.error ? signed.data.signedUrl : null;
    }

    return {
      labName: lab.legalName,
      shortName: lab.shortName,
      logoUrl,
      primaryColor: lab.primaryColor,
      accentColor: lab.accentColor,
      tagline: lab.tagline,
      protocolNumber: String(ord.protocolNumber).padStart(8, '0'),
      emitidaAt: ord.pdfReportIssuedAt ? ord.pdfReportIssuedAt.toISOString() : null,
    };
  }

  /** Valida el DNI y, si coincide, devuelve el PDF del informe. */
  async download(token: string, dniRaw: string, ctx: PublicAccessCtx): Promise<PublicInformeFile> {
    const ord = await this.findEmittedByToken(token);

    // Bloqueo temporal por demasiados intentos fallidos.
    if (ord.publicAccessLockedUntil && ord.publicAccessLockedUntil.getTime() > Date.now()) {
      throw new HttpException(
        'Demasiados intentos fallidos. Volvé a intentar más tarde.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const [pat] = await this.db
      .select({ dni: patient.dni })
      .from(patient)
      .where(eq(patient.id, ord.patientId!))
      .limit(1);
    if (!pat) throw new NotFoundException('Informe no encontrado');

    const matches = normalizeDni(pat.dni) === normalizeDni(dniRaw) && normalizeDni(dniRaw) !== '';

    if (!matches) {
      const attempts = ord.publicAccessAttempts + 1;
      const locked = attempts >= MAX_DNI_ATTEMPTS;
      await this.db
        .update(order)
        .set({
          publicAccessAttempts: locked ? 0 : attempts,
          publicAccessLockedUntil: locked ? new Date(Date.now() + LOCK_MS) : null,
          updatedAt: new Date(),
        })
        .where(and(eq(order.id, ord.id), eq(order.labId, ord.labId)));

      await this.audit.log({
        labId: ord.labId,
        actorId: null,
        action: 'portal_dni_fallido',
        entity: 'order',
        entityId: ord.id,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });

      throw new HttpException('DNI incorrecto.', HttpStatus.BAD_REQUEST);
    }

    // Éxito: reset de intentos + descarga del PDF almacenado.
    if (ord.publicAccessAttempts !== 0 || ord.publicAccessLockedUntil) {
      await this.db
        .update(order)
        .set({ publicAccessAttempts: 0, publicAccessLockedUntil: null, updatedAt: new Date() })
        .where(and(eq(order.id, ord.id), eq(order.labId, ord.labId)));
    }

    if (!ord.pdfReportPath) throw new NotFoundException('Informe no disponible');
    const { data, error } = await this.storage.storage
      .from(REPORTS_BUCKET)
      .download(ord.pdfReportPath);
    if (error || !data) throw new NotFoundException('Informe no disponible');
    const buffer = Buffer.from(await data.arrayBuffer());

    await this.audit.log({
      labId: ord.labId,
      actorId: null,
      action: 'portal_descarga_informe',
      entity: 'order',
      entityId: ord.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return { buffer, filename: `informe-${String(ord.protocolNumber).padStart(8, '0')}.pdf` };
  }
}
