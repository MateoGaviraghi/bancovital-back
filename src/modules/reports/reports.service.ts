import type { Db } from '@/db/client';
import { DATABASE, SUPABASE_ADMIN } from '@/db/database.module';
import {
  insurer,
  laboratorio,
  order,
  orderPractice,
  orderPracticeUnidadValue,
  patient,
  practice,
  practiceUnidad,
  preferenciaPdf,
  result,
} from '@/db/schema';
import type { Order, OrderPracticeUnidadValue, Result } from '@/db/schema';
import { resolveAssetDataUri } from '@/modules/lab-config/asset-storage';
import { OrdersService } from '@/modules/orders/orders.service';
import { renderFichaPdf, renderInformePdf } from '@/pdf/render';
import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { and, asc, eq, inArray } from 'drizzle-orm';

export const REPORTS_BUCKET = 'reports';

export interface SignedUrlResponse {
  url: string;
  expiresInSeconds: number;
  regenerated: boolean;
  stale: boolean;
}

export interface RegenerateOneResponse {
  ok: true;
  path: string;
  stale: false;
}

export interface RegenerateSummary {
  total: number;
  regenerated: number;
  failures: Array<{ orderId: number; error: string }>;
}

@Injectable()
export class ReportsService {
  constructor(
    @Inject(DATABASE) private readonly db: Db,
    @Inject(SUPABASE_ADMIN) private readonly storage: SupabaseClient,
    private readonly orders: OrdersService,
  ) {}

  async emit(
    labId: number,
    orderId: number,
    signedBy: string,
  ): Promise<{ ok: true; path: string }> {
    const ord = await this.requireOrderForEmit(labId, orderId);
    const path = await this.renderAndUpload(ord);
    await this.orders.markEmitted(labId, orderId, path, signedBy);
    return { ok: true, path };
  }

  async signedUrl(labId: number, orderId: number, ttlSeconds: number): Promise<SignedUrlResponse> {
    const ord = await this.requireOrder(labId, orderId);
    if (ord.status !== 'emitida' && ord.status !== 'entregada') {
      throw new ConflictException(
        `La orden ${orderId} aun no fue emitida (estado actual: ${ord.status})`,
      );
    }

    const configUpdatedAt = await this.getConfigUpdatedAt(labId);
    const stale = this.isStale(ord, configUpdatedAt);

    if (ord.pdfReportPath && !stale) {
      const signed = await this.storage.storage
        .from(REPORTS_BUCKET)
        .createSignedUrl(ord.pdfReportPath, ttlSeconds);
      if (signed.data && !signed.error) {
        return {
          url: signed.data.signedUrl,
          expiresInSeconds: ttlSeconds,
          regenerated: false,
          stale: false,
        };
      }
    }

    const newPath = await this.renderAndUpload(ord);
    await this.orders.setPdfPath(labId, orderId, newPath);
    const signed = await this.storage.storage
      .from(REPORTS_BUCKET)
      .createSignedUrl(newPath, ttlSeconds);
    if (!signed.data || signed.error) {
      throw new InternalServerErrorException(
        `No se pudo generar la URL firmada: ${signed.error?.message ?? 'unknown'}`,
      );
    }
    return {
      url: signed.data.signedUrl,
      expiresInSeconds: ttlSeconds,
      regenerated: true,
      stale: false,
    };
  }

  async regenerateOne(labId: number, orderId: number): Promise<RegenerateOneResponse> {
    const ord = await this.requireOrder(labId, orderId);
    if (ord.status !== 'emitida' && ord.status !== 'entregada') {
      throw new ConflictException(
        `La orden ${orderId} no tiene PDF emitido (estado actual: ${ord.status})`,
      );
    }
    const path = await this.renderAndUpload(ord);
    await this.orders.setPdfPath(labId, orderId, path);
    return { ok: true, path, stale: false };
  }

  async regenerateAll(labId: number): Promise<RegenerateSummary> {
    const ords = await this.db
      .select()
      .from(order)
      .where(and(eq(order.labId, labId), eq(order.status, 'emitida')));

    const failures: Array<{ orderId: number; error: string }> = [];
    let regenerated = 0;
    for (const ord of ords) {
      try {
        const path = await this.renderAndUpload(ord);
        await this.orders.setPdfPath(labId, ord.id, path);
        regenerated++;
      } catch (err) {
        failures.push({
          orderId: ord.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return { total: ords.length, regenerated, failures };
  }

  async ficha(labId: number, orderId: number): Promise<Buffer> {
    const ord = await this.requireOrder(labId, orderId);

    const [lab, pat, ins, lines] = await Promise.all([
      this.db
        .select()
        .from(laboratorio)
        .where(eq(laboratorio.id, labId))
        .limit(1)
        .then((r) => r[0]),
      this.db
        .select()
        .from(patient)
        .where(eq(patient.id, ord.patientId))
        .limit(1)
        .then((r) => r[0]),
      this.db
        .select({ name: insurer.name })
        .from(insurer)
        .where(eq(insurer.id, ord.insurerId))
        .limit(1)
        .then((r) => r[0]),
      this.db
        .select()
        .from(orderPractice)
        .where(eq(orderPractice.orderId, orderId))
        .orderBy(orderPractice.sortOrder, orderPractice.id),
    ]);

    if (!lab) throw new InternalServerErrorException('Laboratorio no configurado');
    if (!pat) throw new NotFoundException('Paciente no encontrado');
    if (!ins) throw new NotFoundException('Obra social no encontrada');

    // Enrich each line with section and isElaborated from the practice catalog
    const practiceIds = lines.map((l) => l.practiceId).filter((id): id is number => id !== null);
    const practiceMap = new Map<number, { section: string | null; isElaborated: boolean }>();
    if (practiceIds.length > 0) {
      const practices = await this.db
        .select({ id: practice.id, section: practice.section, isElaborated: practice.isElaborated })
        .from(practice)
        .where(inArray(practice.id, practiceIds));
      for (const p of practices)
        practiceMap.set(p.id, { section: p.section, isElaborated: p.isElaborated });
    }

    const enrichedLines = lines.map((l) => {
      const p = l.practiceId ? practiceMap.get(l.practiceId) : undefined;
      return {
        nbuCodeSnapshot: l.nbuCodeSnapshot,
        nameSnapshot: l.nameSnapshot,
        authorizationStatus: l.authorizationStatus as
          | 'no_aplica'
          | 'pendiente'
          | 'autorizada'
          | 'rechazada',
        authorizationCode: l.authorizationCode,
        section: p?.section ?? null,
        isElaborated: p?.isElaborated ?? false,
      };
    });

    const logoDataUri = await resolveAssetDataUri(this.storage, lab.logoPath);

    return renderFichaPdf({
      order: ord,
      patient: pat,
      insurer: ins,
      lines: enrichedLines,
      lab,
      logoDataUri,
    });
  }

  // ----- helpers -----

  private async getConfigUpdatedAt(labId: number): Promise<Date> {
    const [[lab], [pref]] = await Promise.all([
      this.db
        .select({ updatedAt: laboratorio.updatedAt })
        .from(laboratorio)
        .where(eq(laboratorio.id, labId))
        .limit(1),
      this.db
        .select({ updatedAt: preferenciaPdf.updatedAt })
        .from(preferenciaPdf)
        .where(eq(preferenciaPdf.labId, labId))
        .limit(1),
    ]);
    const labTs = lab?.updatedAt?.getTime() ?? 0;
    const prefTs = pref?.updatedAt?.getTime() ?? 0;
    return new Date(Math.max(labTs, prefTs));
  }

  private isStale(ord: Order, configUpdatedAt: Date): boolean {
    if (!ord.pdfReportPath) return false;
    const renderedAt = ord.pdfReportRenderedAt ?? ord.pdfReportIssuedAt;
    if (!renderedAt) return true;
    return configUpdatedAt.getTime() > renderedAt.getTime();
  }

  private async requireOrder(labId: number, orderId: number): Promise<Order> {
    const [row] = await this.db
      .select()
      .from(order)
      .where(and(eq(order.id, orderId), eq(order.labId, labId)))
      .limit(1);
    if (!row) throw new NotFoundException(`Orden ${orderId} no encontrada`);
    return row;
  }

  private async requireOrderForEmit(labId: number, orderId: number): Promise<Order> {
    const ord = await this.requireOrder(labId, orderId);
    if (ord.status !== 'resultados_cargados') {
      throw new ConflictException(
        `No se puede emitir orden en estado "${ord.status}". Solo "resultados_cargados".`,
      );
    }
    return ord;
  }

  private async renderAndUpload(ord: Order): Promise<string> {
    const [lab] = await this.db
      .select()
      .from(laboratorio)
      .where(eq(laboratorio.id, ord.labId))
      .limit(1);
    if (!lab) {
      throw new InternalServerErrorException(
        'Laboratorio no configurado. Carga via PATCH /lab-config.',
      );
    }

    const [pref] = await this.db
      .select()
      .from(preferenciaPdf)
      .where(eq(preferenciaPdf.labId, ord.labId))
      .limit(1);

    const [pat] = await this.db
      .select()
      .from(patient)
      .where(eq(patient.id, ord.patientId))
      .limit(1);
    if (!pat) throw new NotFoundException('Paciente de la orden no encontrado');

    const [ins] = await this.db
      .select({ name: insurer.name })
      .from(insurer)
      .where(eq(insurer.id, ord.insurerId))
      .limit(1);
    if (!ins) throw new NotFoundException('Obra social de la orden no encontrada');

    const lines = await this.db
      .select()
      .from(orderPractice)
      .where(eq(orderPractice.orderId, ord.id))
      .orderBy(orderPractice.sortOrder, orderPractice.id);

    const practiceIds = lines.map((l) => l.practiceId).filter((id): id is number => id !== null);
    const practiceDataById = new Map<
      number,
      { methodology: string | null; referenceValue: string | null }
    >();
    if (practiceIds.length > 0) {
      const practiceRows = await this.db
        .select({
          id: practice.id,
          methodology: practice.methodology,
          referenceValue: practice.referenceValue,
        })
        .from(practice)
        .where(inArray(practice.id, practiceIds));
      for (const p of practiceRows)
        practiceDataById.set(p.id, {
          methodology: p.methodology,
          referenceValue: p.referenceValue,
        });
    }

    const resultRows = await this.db
      .select()
      .from(result)
      .innerJoin(orderPractice, eq(orderPractice.id, result.orderPracticeId))
      .where(eq(orderPractice.orderId, ord.id));

    const resultsByLineId = new Map<number, Result>();
    for (const r of resultRows) resultsByLineId.set(r.order_practice.id, r.result);

    // Valores de unidades dinámicas por línea, ordenados según el sort_order
    // configurado en practice_unidad para este lab.
    const lineIds = lines.map((l) => l.id);
    const unidadValuesByLineId = new Map<number, OrderPracticeUnidadValue[]>();
    if (lineIds.length > 0) {
      const unidadRows = await this.db
        .select({
          value: orderPracticeUnidadValue,
          sortOrder: practiceUnidad.sortOrder,
        })
        .from(orderPracticeUnidadValue)
        .innerJoin(orderPractice, eq(orderPractice.id, orderPracticeUnidadValue.orderPracticeId))
        .leftJoin(
          practiceUnidad,
          and(
            eq(practiceUnidad.labId, ord.labId),
            eq(practiceUnidad.practiceId, orderPractice.practiceId),
            eq(practiceUnidad.unidadId, orderPracticeUnidadValue.unidadId),
          ),
        )
        .where(inArray(orderPracticeUnidadValue.orderPracticeId, lineIds))
        .orderBy(asc(practiceUnidad.sortOrder), asc(orderPracticeUnidadValue.id));
      for (const r of unidadRows) {
        const list = unidadValuesByLineId.get(r.value.orderPracticeId) ?? [];
        list.push(r.value);
        unidadValuesByLineId.set(r.value.orderPracticeId, list);
      }
    }

    const [logoDataUri, signatureDataUri, fondoDataUri] = await Promise.all([
      resolveAssetDataUri(this.storage, lab.logoPath),
      resolveAssetDataUri(this.storage, lab.signingSignaturePath),
      resolveAssetDataUri(this.storage, pref?.fondoPath ?? null),
    ]);

    const buffer = await renderInformePdf({
      order: ord,
      patient: pat,
      insurer: ins,
      lines,
      resultsByLineId,
      unidadValuesByLineId,
      practiceDataById,
      lab,
      logoDataUri,
      signatureDataUri,
      fondoDataUri: fondoDataUri ?? undefined,
      preferenciaPdf: pref ?? undefined,
    });

    const path = buildPdfPath(ord.labId, ord.id, ord.protocolNumber);
    const upload = await this.storage.storage.from(REPORTS_BUCKET).upload(path, buffer, {
      contentType: 'application/pdf',
      upsert: true,
    });
    if (upload.error) {
      throw new InternalServerErrorException(`No se pudo guardar el PDF: ${upload.error.message}`);
    }
    return path;
  }
}

export function buildPdfPath(labId: number, orderId: number, protocolNumber: number): string {
  return `${labId}/${orderId}/${String(protocolNumber).padStart(8, '0')}.pdf`;
}
