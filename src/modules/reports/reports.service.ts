import { randomBytes } from 'node:crypto';
import { AppConfig } from '@/config';
import type { Db } from '@/db/client';
import { DATABASE, SUPABASE_ADMIN } from '@/db/database.module';
import {
  especie,
  insurer,
  laboratorio,
  muestraAgua,
  order,
  orderPractice,
  orderPracticeUnidadValue,
  pacienteAnimal,
  patient,
  practice,
  practiceReferenciaEspecie,
  practiceUnidad,
  practiceUnidadRefEspecie,
  preferenciaPdf,
  propietario,
  result,
  sede,
  solicitanteAgua,
  veterinario,
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
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import QRCode from 'qrcode';

export const REPORTS_BUCKET = 'reports';

/** Genera el QR (PNG data-URI) que apunta al portal público del informe. */
async function buildInformeQr(appUrl: string, token: string): Promise<string> {
  return QRCode.toDataURL(`${appUrl}/informe/${token}`, {
    margin: 1,
    width: 240,
    errorCorrectionLevel: 'M',
  });
}

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
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Db,
    @Inject(SUPABASE_ADMIN) private readonly storage: SupabaseClient,
    private readonly orders: OrdersService,
    private readonly appConfig: AppConfig,
  ) {}

  /**
   * Devuelve el token público del informe, generándolo (256-bit) y persistiéndolo
   * si la orden todavía no lo tiene. Idempotente: una vez asignado, no cambia
   * (así un QR ya impreso sigue siendo válido tras regenerar el PDF).
   */
  private async ensurePublicToken(ord: Order): Promise<string> {
    if (ord.publicReportToken) return ord.publicReportToken;
    const token = randomBytes(32).toString('hex');
    await this.db
      .update(order)
      .set({ publicReportToken: token, updatedAt: new Date() })
      .where(and(eq(order.id, ord.id), eq(order.labId, ord.labId)));
    ord.publicReportToken = token;
    return token;
  }

  async emit(
    labId: number,
    orderId: number,
    signedBy: string,
  ): Promise<{ ok: true; path: string }> {
    // Validar la precondición FSM (estado + resultados) ANTES de renderizar y
    // subir el PDF: fallar barato sin dejar trabajo a medias.
    const ord = await this.requireOrderForEmit(labId, orderId);
    const path = await this.renderAndUpload(ord);
    try {
      await this.orders.markEmitted(labId, orderId, path, signedBy);
    } catch (err) {
      // markEmitted re-valida la transición FSM y puede fallar (carrera de
      // estado, etc.). Limpiar el blob recién subido para no dejarlo huérfano.
      await this.removeReportBlob(path);
      throw err;
    }
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

    // Paraleliza en lotes chicos para no serializar render+upload+update orden
    // por orden. La escritura de pdfPath sigue siendo incremental (por orden,
    // apenas se resuelve su render), no se espera a que termine todo el lote.
    const CHUNK_SIZE = 8;
    for (let i = 0; i < ords.length; i += CHUNK_SIZE) {
      const chunk = ords.slice(i, i + CHUNK_SIZE);
      const settled = await Promise.allSettled(
        chunk.map(async (ord) => {
          const path = await this.renderAndUpload(ord);
          await this.orders.setPdfPath(labId, ord.id, path);
          return ord.id;
        }),
      );
      for (let j = 0; j < settled.length; j++) {
        const outcome = settled[j];
        if (outcome.status === 'fulfilled') {
          regenerated++;
        } else {
          failures.push({
            orderId: chunk[j].id,
            error: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
          });
        }
      }
    }

    return { total: ords.length, regenerated, failures };
  }

  async ficha(labId: number, orderId: number): Promise<Buffer> {
    const ord = await this.requireOrder(labId, orderId);

    const [lab, ins, lines] = await Promise.all([
      this.db
        .select()
        .from(laboratorio)
        .where(eq(laboratorio.id, labId))
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
    if (!ins) throw new NotFoundException('Obra social no encontrada');

    let pat: typeof patient.$inferSelect | null = null;
    if (ord.patientId) {
      const [row] = await this.db.select().from(patient).where(eq(patient.id, ord.patientId)).limit(1);
      pat = row ?? null;
    }

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

  /**
   * Borra un PDF de informe del bucket 'reports' de forma best-effort. No lanza
   * si el borrado falla: solo loguea. Acepta un path directo o la orden (usando
   * su pdfReportPath). No-op si no hay path.
   */
  async removeReportBlob(target: string | Order | null): Promise<void> {
    const path = typeof target === 'string' ? target : (target?.pdfReportPath ?? null);
    if (!path) return;
    try {
      const { error } = await this.storage.storage.from(REPORTS_BUCKET).remove([path]);
      if (error) {
        this.logger.warn(`No se pudo borrar el PDF del informe (${path}): ${error.message}`);
      }
    } catch (err) {
      this.logger.warn(
        `Error inesperado al borrar el PDF del informe (${path}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

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
        .where(
          and(
            eq(preferenciaPdf.labId, labId),
            eq(preferenciaPdf.tipo, 'informe'),
            isNull(preferenciaPdf.deletedAt),
          ),
        )
        .orderBy(desc(preferenciaPdf.updatedAt))
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
    // No emitir informes clínicamente vacíos: exigir resultados en las líneas
    // reportables de la orden (mismo guard que finalize()).
    await this.orders.assertHasReportableResults(orderId);
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

    // Buscar formato PDF específico del servicio; fallback al genérico (servicioId IS NULL)
    let [pref] = await this.db
      .select()
      .from(preferenciaPdf)
      .where(
        and(
          eq(preferenciaPdf.labId, ord.labId),
          eq(preferenciaPdf.servicioId, ord.servicioId),
          eq(preferenciaPdf.tipo, 'informe'),
          isNull(preferenciaPdf.deletedAt),
        ),
      )
      .orderBy(desc(preferenciaPdf.updatedAt))
      .limit(1);
    if (!pref) {
      [pref] = await this.db
        .select()
        .from(preferenciaPdf)
        .where(
          and(
            eq(preferenciaPdf.labId, ord.labId),
            isNull(preferenciaPdf.servicioId),
            eq(preferenciaPdf.tipo, 'informe'),
            isNull(preferenciaPdf.deletedAt),
          ),
        )
        .orderBy(desc(preferenciaPdf.updatedAt))
        .limit(1);
    }

    let pat: typeof patient.$inferSelect | null = null;
    let animalData: {
      nombre: string;
      especie: string;
      raza: string | null;
      propietario: string;
      propietarioDni: string;
    } | null = null;
    let vetData: { name: string; matricula: string } | null = null;

    if (ord.patientId) {
      const [row] = await this.db
        .select()
        .from(patient)
        .where(eq(patient.id, ord.patientId))
        .limit(1);
      if (!row) throw new NotFoundException('Paciente de la orden no encontrado');
      pat = row;
    } else if (ord.animalPatientId) {
      const [row] = await this.db
        .select({
          nombre: pacienteAnimal.nombre,
          especieNombre: especie.nombre,
          razaNombre: pacienteAnimal.nombre,
          propNombre: propietario.firstName,
          propApellido: propietario.lastName,
          propDni: propietario.dni,
        })
        .from(pacienteAnimal)
        .leftJoin(especie, eq(especie.id, pacienteAnimal.especieId))
        .leftJoin(propietario, eq(propietario.id, pacienteAnimal.propietarioId))
        .where(eq(pacienteAnimal.id, ord.animalPatientId))
        .limit(1);
      if (row) {
        animalData = {
          nombre: row.nombre,
          especie: row.especieNombre ?? '—',
          raza: null,
          propietario: `${row.propApellido}, ${row.propNombre}`,
          propietarioDni: row.propDni ?? '',
        };
      }
      if (ord.veterinarioId) {
        const [vet] = await this.db
          .select({ firstName: veterinario.firstName, lastName: veterinario.lastName, matricula: veterinario.matricula })
          .from(veterinario)
          .where(eq(veterinario.id, ord.veterinarioId))
          .limit(1);
        if (vet) vetData = { name: `${vet.lastName}, ${vet.firstName}`, matricula: vet.matricula };
      }
    }

    let solicitanteData: {
      nombreApellido: string;
      razonSocial: string | null;
      cuit: string | null;
      domicilio: string | null;
      localidad: string | null;
      telefono: string | null;
    } | null = null;
    let muestraData: {
      tipoMuestra: string;
      fechaToma: string;
      fechaRecepcion: string;
      lugarToma: string | null;
      descripcionPunto: string | null;
      direccionPunto: string | null;
      motivoAnalisis: string;
      analisisFisicoquimico: boolean;
      analisisMicrobiologico: boolean;
      observaciones: string | null;
    } | null = null;

    if (ord.solicitanteAguaId) {
      const [row] = await this.db
        .select()
        .from(solicitanteAgua)
        .where(eq(solicitanteAgua.id, ord.solicitanteAguaId))
        .limit(1);
      if (row) {
        solicitanteData = {
          nombreApellido: row.nombreApellido,
          razonSocial: row.razonSocial,
          cuit: row.cuit,
          domicilio: row.domicilio,
          localidad: row.localidad,
          telefono: row.telefono,
        };
      }
    }
    if (ord.muestraAguaId) {
      const [row] = await this.db
        .select()
        .from(muestraAgua)
        .where(eq(muestraAgua.id, ord.muestraAguaId))
        .limit(1);
      if (row) {
        muestraData = {
          tipoMuestra: row.tipoMuestra,
          fechaToma: row.fechaToma.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Cordoba' }),
          fechaRecepcion: row.fechaRecepcion.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Cordoba' }),
          lugarToma: row.lugarToma,
          descripcionPunto: row.descripcionPunto,
          direccionPunto: row.direccionPunto,
          motivoAnalisis: row.motivoAnalisis,
          analisisFisicoquimico: row.analisisFisicoquimico,
          analisisMicrobiologico: row.analisisMicrobiologico,
          observaciones: row.observaciones,
        };
      }
    }

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
      { methodology: string | null; referenceValue: string | null; defaultUnit: string | null }
    >();
    if (practiceIds.length > 0) {
      const practiceRows = await this.db
        .select({
          id: practice.id,
          methodology: practice.methodology,
          referenceValue: practice.referenceValue,
          defaultUnit: practice.defaultUnit,
        })
        .from(practice)
        .where(inArray(practice.id, practiceIds));
      for (const p of practiceRows)
        practiceDataById.set(p.id, {
          methodology: p.methodology,
          referenceValue: p.referenceValue,
          defaultUnit: p.defaultUnit,
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

    const unidadRefsByKey = new Map<string, { rangeLow: string | null; rangeHigh: string | null; referenceText: string | null }>();
    if (practiceIds.length > 0) {
      const puRows = await this.db
        .select({
          practiceId: practiceUnidad.practiceId,
          unidadId: practiceUnidad.unidadId,
          rangeLow: practiceUnidad.rangeLow,
          rangeHigh: practiceUnidad.rangeHigh,
          referenceText: practiceUnidad.referenceText,
        })
        .from(practiceUnidad)
        .where(and(eq(practiceUnidad.labId, ord.labId), inArray(practiceUnidad.practiceId, practiceIds)));
      for (const pu of puRows) {
        unidadRefsByKey.set(`${pu.practiceId}:${pu.unidadId}`, {
          rangeLow: pu.rangeLow,
          rangeHigh: pu.rangeHigh,
          referenceText: pu.referenceText,
        });
      }
    }

    const especieRefsByPractice = new Map<number, { rangeLow: string | null; rangeHigh: string | null; unit: string | null }>();
    if (ord.animalPatientId && practiceIds.length > 0) {
      const [animal] = await this.db
        .select({ especieId: pacienteAnimal.especieId })
        .from(pacienteAnimal)
        .where(eq(pacienteAnimal.id, ord.animalPatientId))
        .limit(1);
      if (animal) {
        const refs = await this.db
          .select()
          .from(practiceReferenciaEspecie)
          .where(
            and(
              inArray(practiceReferenciaEspecie.practiceId, practiceIds),
              eq(practiceReferenciaEspecie.especieId, animal.especieId),
            ),
          );
        for (const ref of refs) {
          especieRefsByPractice.set(ref.practiceId, {
            rangeLow: ref.rangeLow,
            rangeHigh: ref.rangeHigh,
            unit: ref.unit,
          });
        }

        const puIds = await this.db
          .select({ id: practiceUnidad.id, practiceId: practiceUnidad.practiceId, unidadId: practiceUnidad.unidadId })
          .from(practiceUnidad)
          .where(and(eq(practiceUnidad.labId, ord.labId), inArray(practiceUnidad.practiceId, practiceIds)));
        if (puIds.length > 0) {
          const speciesUnitRefs = await this.db
            .select()
            .from(practiceUnidadRefEspecie)
            .where(
              and(
                inArray(practiceUnidadRefEspecie.practiceUnidadId, puIds.map((p) => p.id)),
                eq(practiceUnidadRefEspecie.especieId, animal.especieId),
              ),
            );
          const puById = new Map(puIds.map((p) => [p.id, p]));
          for (const sr of speciesUnitRefs) {
            const pu = puById.get(sr.practiceUnidadId);
            if (pu) {
              unidadRefsByKey.set(`${pu.practiceId}:${pu.unidadId}`, {
                rangeLow: sr.rangeLow,
                rangeHigh: sr.rangeHigh,
                referenceText: sr.referenceText,
              });
            }
          }
        }
      }
    }

    const [logoDataUri, signatureDataUri, fondoDataUri] = await Promise.all([
      resolveAssetDataUri(this.storage, lab.logoPath),
      resolveAssetDataUri(this.storage, lab.signingSignaturePath),
      resolveAssetDataUri(this.storage, pref?.fondoPath ?? null),
    ]);

    const [principalSede] = await this.db
      .select()
      .from(sede)
      .where(and(eq(sede.labId, ord.labId), eq(sede.principal, true), isNull(sede.deletedAt)))
      .limit(1);

    // F7: token + QR del portal público (se embebe en el informe).
    const publicToken = await this.ensurePublicToken(ord);
    const qrCodeDataUri = await buildInformeQr(this.appConfig.env.APP_URL, publicToken);

    const buffer = await renderInformePdf({
      order: ord,
      patient: pat ?? undefined,
      animalPatient: animalData ?? undefined,
      veterinario: vetData ?? undefined,
      solicitanteAgua: solicitanteData ?? undefined,
      muestraAgua: muestraData ?? undefined,
      insurer: ins,
      lines,
      resultsByLineId,
      unidadValuesByLineId,
      practiceDataById,
      unidadRefsByKey,
      especieRefsByPractice,
      lab,
      logoDataUri,
      signatureDataUri,
      fondoDataUri: fondoDataUri ?? undefined,
      preferenciaPdf: pref ?? undefined,
      sede: principalSede ?? null,
      qrCodeDataUri,
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
