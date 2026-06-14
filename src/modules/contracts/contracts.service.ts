import { createHash, randomBytes, randomInt } from 'node:crypto';
import { AppConfig } from '@/config';
import type { Db } from '@/db/client';
import { DATABASE, SUPABASE_ADMIN } from '@/db/database.module';
import { contrato, laboratorio, plan, suscripcion } from '@/db/schema';
import { RESERVED_SLUGS } from '@/domain/slug/reserved-slugs';
import { MailService } from '@/mail/mail.service';
import { renderContratoFirmadoPdf, renderContratoPdf } from '@/pdf/render';
import type { ContratoData, ContratoFirmadoData } from '@/pdf/render';
import type { PlanRow } from '@/pdf/templates/contrato';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { and, desc, eq, isNull, lt, ne } from 'drizzle-orm';
import type { CreateContractDto, DatosFacturacionDto } from './dto/contracts.dto';

export const CONTRACTS_BUCKET = 'contracts';
const CONTRACT_TTL_DAYS = 15;
const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_VERIFIED_WINDOW_MINUTES = 20;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const PDF_TTL_SIGNED_URL = 900;

const ACCENT_MAP: Record<string, string> = {
  á: 'a',
  é: 'e',
  í: 'i',
  ó: 'o',
  ú: 'u',
  à: 'a',
  è: 'e',
  ì: 'i',
  ò: 'o',
  ù: 'u',
  ä: 'a',
  ë: 'e',
  ï: 'i',
  ö: 'o',
  ü: 'u',
  â: 'a',
  ê: 'e',
  î: 'i',
  ô: 'o',
  û: 'u',
  ã: 'a',
  ñ: 'n',
  ç: 'c',
  ý: 'y',
};

function slugify(input: string): string {
  const normalized = input
    .toLowerCase()
    .split('')
    .map((c) => ACCENT_MAP[c] ?? c)
    .join('');
  return normalized
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function obfuscateEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***@***';
  const visible = local[0];
  return `${visible}***@${domain}`;
}

function sha256(data: string | Buffer): string {
  // Buffers must be hashed as raw bytes — re-encoding through a string would
  // produce a digest that doesn't match the actual file (legally useless).
  return createHash('sha256').update(data).digest('hex');
}

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

function generateOtp(): string {
  // crypto-secure: this code is the identity proof behind a legally binding signature
  return String(randomInt(100000, 1000000));
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

function addMinutes(d: Date, mins: number): Date {
  return new Date(d.getTime() + mins * 60_000);
}

@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Db,
    @Inject(SUPABASE_ADMIN) private readonly storage: SupabaseClient,
    private readonly mailService: MailService,
    private readonly appConfig: AppConfig,
  ) {}

  // ── Helpers de storage ─────────────────────────────────────────────────────

  private async ensureBucket(): Promise<void> {
    try {
      await this.storage.storage.createBucket(CONTRACTS_BUCKET, { public: false });
    } catch {
      // Bucket ya existe — ignorar
    }
  }

  private async uploadToContracts(
    path: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.ensureBucket();
    const { error } = await this.storage.storage
      .from(CONTRACTS_BUCKET)
      .upload(path, buffer, { contentType, upsert: true });
    if (error) throw new Error(`Upload failed: ${error.message}`);
  }

  private async signedUrl(path: string): Promise<string | null> {
    const { data, error } = await this.storage.storage
      .from(CONTRACTS_BUCKET)
      .createSignedUrl(path, PDF_TTL_SIGNED_URL);
    if (error || !data) return null;
    return data.signedUrl;
  }

  // ── Helpers de planes ──────────────────────────────────────────────────────

  private async getActivePlans(): Promise<PlanRow[]> {
    const rows = await this.db
      .select()
      .from(plan)
      .where(isNull(plan.deletedAt))
      .orderBy(plan.nombre);
    return rows.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      cupoOrdenesMes: p.cupoOrdenesMes,
      precioMensual: p.precioMensual,
      precioOrdenExcedente: p.precioOrdenExcedente,
    }));
  }

  private async getPlan(id: number): Promise<PlanRow> {
    const [row] = await this.db
      .select()
      .from(plan)
      .where(and(eq(plan.id, id), isNull(plan.deletedAt)))
      .limit(1);
    if (!row) throw new NotFoundException(`Plan ${id} no encontrado`);
    return {
      id: row.id,
      nombre: row.nombre,
      cupoOrdenesMes: row.cupoOrdenesMes,
      precioMensual: row.precioMensual,
      precioOrdenExcedente: row.precioOrdenExcedente,
    };
  }

  // ── Lazy vencimiento ───────────────────────────────────────────────────────

  private async lazyExpireIfNeeded(
    row: typeof contrato.$inferSelect,
  ): Promise<typeof contrato.$inferSelect> {
    if (row.estado === 'enviado' && row.expiraAt < new Date()) {
      const [updated] = await this.db
        .update(contrato)
        .set({ estado: 'vencido', updatedAt: new Date() })
        .where(eq(contrato.id, row.id))
        .returning();
      return updated ?? row;
    }
    return row;
  }

  // ── Super: crear ───────────────────────────────────────────────────────────

  async create(
    dto: CreateContractDto,
  ): Promise<{ contrato: typeof contrato.$inferSelect; contractUrl: string }> {
    const token = generateToken();
    const now = new Date();
    const expiraAt = addDays(now, CONTRACT_TTL_DAYS);

    const planes = await this.getActivePlans();

    const [row] = await this.db
      .insert(contrato)
      .values({
        token,
        estado: 'enviado',
        razonSocial: dto.razonSocial,
        nombreContacto: dto.nombreContacto,
        cuit: dto.cuit ?? null,
        emailFirmante: dto.emailFirmante,
        telefono: dto.telefono ?? null,
        propuesta: dto.propuesta as unknown as Record<string, unknown>,
        planSugeridoId: dto.planSugeridoId ?? null,
        expiraAt,
      })
      .returning();

    // Render PDF
    const data: ContratoData = {
      id: row.id,
      razonSocial: row.razonSocial,
      nombreContacto: row.nombreContacto,
      cuit: row.cuit,
      emailFirmante: row.emailFirmante,
      telefono: row.telefono,
      propuesta: dto.propuesta,
      planSugeridoId: row.planSugeridoId,
      createdAt: row.createdAt,
      expiraAt: row.expiraAt,
      token: row.token,
      planes,
      appUrl: this.appConfig.env.APP_URL,
    };

    const buffer = await renderContratoPdf(data);
    const pdfHash = sha256(buffer);
    const pdfPath = `${row.id}/original.pdf`;

    await this.uploadToContracts(pdfPath, buffer, 'application/pdf');

    const [updated] = await this.db
      .update(contrato)
      .set({ pdfOriginalPath: pdfPath, pdfHashSha256: pdfHash, updatedAt: new Date() })
      .where(eq(contrato.id, row.id))
      .returning();

    const contractUrl = `${this.appConfig.env.APP_URL}/contratar/${token}`;
    return { contrato: updated, contractUrl };
  }

  // ── Super: listar ──────────────────────────────────────────────────────────

  async list(): Promise<Array<Partial<typeof contrato.$inferSelect> & { contractUrl: string }>> {
    const rows = await this.db
      .select({
        id: contrato.id,
        token: contrato.token,
        estado: contrato.estado,
        razonSocial: contrato.razonSocial,
        nombreContacto: contrato.nombreContacto,
        emailFirmante: contrato.emailFirmante,
        planSugeridoId: contrato.planSugeridoId,
        planElegidoId: contrato.planElegidoId,
        labCreadoId: contrato.labCreadoId,
        expiraAt: contrato.expiraAt,
        firmadoAt: contrato.firmadoAt,
        createdAt: contrato.createdAt,
      })
      .from(contrato)
      .where(isNull(contrato.deletedAt))
      .orderBy(desc(contrato.createdAt));

    // Lazy vencimiento masivo
    const now = new Date();
    const toExpire = rows
      .filter((r) => r.estado === 'enviado' && r.expiraAt < now)
      .map((r) => r.id);
    if (toExpire.length > 0) {
      for (const id of toExpire) {
        await this.db
          .update(contrato)
          .set({ estado: 'vencido', updatedAt: new Date() })
          .where(eq(contrato.id, id));
      }
    }

    const appUrl = this.appConfig.env.APP_URL;
    return rows.map((r) => ({
      ...r,
      estado: toExpire.includes(r.id) ? 'vencido' : r.estado,
      contractUrl: `${appUrl}/contratar/${r.token}`,
    }));
  }

  // ── Super: detalle ─────────────────────────────────────────────────────────

  async findOne(id: number): Promise<{
    contrato: typeof contrato.$inferSelect;
    pdfOriginalUrl: string | null;
    pdfFirmadoUrl: string | null;
  }> {
    const [row] = await this.db
      .select()
      .from(contrato)
      .where(and(eq(contrato.id, id), isNull(contrato.deletedAt)))
      .limit(1);
    if (!row) throw new NotFoundException(`Contrato ${id} no encontrado`);

    const updated = await this.lazyExpireIfNeeded(row);

    const [pdfOriginalUrl, pdfFirmadoUrl] = await Promise.all([
      updated.pdfOriginalPath ? this.signedUrl(updated.pdfOriginalPath) : null,
      updated.pdfFirmadoPath ? this.signedUrl(updated.pdfFirmadoPath) : null,
    ]);

    return { contrato: updated, pdfOriginalUrl, pdfFirmadoUrl };
  }

  // ── Super: reenviar ────────────────────────────────────────────────────────

  async resend(
    id: number,
  ): Promise<{ contrato: typeof contrato.$inferSelect; contractUrl: string }> {
    const [row] = await this.db
      .select()
      .from(contrato)
      .where(and(eq(contrato.id, id), isNull(contrato.deletedAt)))
      .limit(1);
    if (!row) throw new NotFoundException(`Contrato ${id} no encontrado`);
    if (row.estado === 'firmado' || row.estado === 'anulado') {
      throw new ConflictException(`No se puede reenviar un contrato en estado "${row.estado}"`);
    }

    const token = generateToken();
    const expiraAt = addDays(new Date(), CONTRACT_TTL_DAYS);

    const [updated] = await this.db
      .update(contrato)
      .set({ token, estado: 'enviado', expiraAt, updatedAt: new Date() })
      .where(eq(contrato.id, id))
      .returning();

    const contractUrl = `${this.appConfig.env.APP_URL}/contratar/${token}`;
    return { contrato: updated, contractUrl };
  }

  // ── Super: anular ──────────────────────────────────────────────────────────

  async anular(id: number): Promise<typeof contrato.$inferSelect> {
    const [row] = await this.db
      .select()
      .from(contrato)
      .where(and(eq(contrato.id, id), isNull(contrato.deletedAt)))
      .limit(1);
    if (!row) throw new NotFoundException(`Contrato ${id} no encontrado`);
    if (row.estado === 'firmado') {
      throw new ConflictException('No se puede anular un contrato ya firmado');
    }

    const [updated] = await this.db
      .update(contrato)
      .set({ estado: 'anulado', updatedAt: new Date() })
      .where(eq(contrato.id, id))
      .returning();

    return updated;
  }

  // ── Público: ver contrato ──────────────────────────────────────────────────

  async getByToken(token: string): Promise<{
    estado: string;
    expiraAt: Date;
    razonSocial: string;
    nombreContacto: string;
    emailFirmanteOfuscado: string;
    propuesta: unknown;
    planSugeridoId: number | null;
    planes: PlanRow[];
    pdfUrl: string | null;
  }> {
    const [row] = await this.db.select().from(contrato).where(eq(contrato.token, token)).limit(1);

    if (!row || row.deletedAt || row.estado === 'anulado') {
      throw new NotFoundException({ statusCode: 404, message: 'Not found' });
    }

    const updated = await this.lazyExpireIfNeeded(row);
    const planes = await this.getActivePlans();

    // El PDF original contiene PII completa (email, CUIT, teléfono en claro).
    // No exponerlo hasta que el firmante haya verificado su identidad por OTP.
    const otpVerificado = updated.otpVerificadoAt != null;
    const pdfUrl =
      otpVerificado && updated.pdfOriginalPath
        ? await this.signedUrl(updated.pdfOriginalPath)
        : null;

    return {
      estado: updated.estado,
      expiraAt: updated.expiraAt,
      razonSocial: updated.razonSocial,
      nombreContacto: updated.nombreContacto,
      emailFirmanteOfuscado: obfuscateEmail(updated.emailFirmante),
      propuesta: updated.propuesta,
      planSugeridoId: updated.planSugeridoId,
      planes,
      pdfUrl,
    };
  }

  // ── Público: solicitar OTP ─────────────────────────────────────────────────

  async requestOtp(token: string): Promise<void> {
    const [row] = await this.db.select().from(contrato).where(eq(contrato.token, token)).limit(1);

    if (!row || row.deletedAt || row.estado === 'anulado') {
      throw new NotFoundException({ statusCode: 404, message: 'Not found' });
    }

    if (row.estado !== 'enviado' || row.expiraAt < new Date()) {
      throw new BadRequestException('El contrato no está activo o ya venció');
    }

    const now = new Date();

    // Cooldown anti email-bombing: rechazar reenvíos demasiado seguidos SIN
    // reenviar el email ni tocar el OTP vigente.
    if (
      row.otpUltimoEnvioAt &&
      now.getTime() - row.otpUltimoEnvioAt.getTime() < OTP_RESEND_COOLDOWN_SECONDS * 1000
    ) {
      throw new HttpException(
        'Esperá unos segundos antes de solicitar otro código.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const codigo = generateOtp();
    const otpHash = sha256(codigo);
    const otpExpiraAt = addMinutes(now, OTP_TTL_MINUTES);

    // Generamos un OTP nuevo permitido → reseteamos intentos y verificación.
    await this.db
      .update(contrato)
      .set({
        otpHash,
        otpExpiraAt,
        otpIntentos: 0,
        otpVerificadoAt: null,
        otpUltimoEnvioAt: now,
        updatedAt: now,
      })
      .where(eq(contrato.id, row.id));

    await this.mailService.sendOtp(row.emailFirmante, codigo, row.id);
  }

  // ── Público: verificar OTP ─────────────────────────────────────────────────

  async verifyOtp(token: string, codigo: string): Promise<void> {
    const [row] = await this.db.select().from(contrato).where(eq(contrato.token, token)).limit(1);

    if (!row || row.deletedAt || row.estado === 'anulado') {
      throw new NotFoundException({ statusCode: 404, message: 'Not found' });
    }

    if (row.estado !== 'enviado' || row.expiraAt < new Date()) {
      throw new BadRequestException('El contrato no está activo o ya venció');
    }

    if (!row.otpHash || !row.otpExpiraAt) {
      throw new BadRequestException('No hay OTP activo. Solicite uno primero.');
    }

    if (row.otpIntentos >= OTP_MAX_ATTEMPTS) {
      throw new HttpException(
        'Demasiados intentos. Solicite un nuevo OTP.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Incrementar intentos
    await this.db
      .update(contrato)
      .set({ otpIntentos: row.otpIntentos + 1, updatedAt: new Date() })
      .where(eq(contrato.id, row.id));

    if (row.otpExpiraAt < new Date()) {
      throw new BadRequestException('El OTP expiró. Solicite uno nuevo.');
    }

    if (sha256(codigo) !== row.otpHash) {
      const newIntentos = row.otpIntentos + 1;
      if (newIntentos >= OTP_MAX_ATTEMPTS) {
        throw new HttpException(
          'Demasiados intentos. Solicite un nuevo OTP.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw new BadRequestException('Código incorrecto');
    }

    await this.db
      .update(contrato)
      .set({ otpVerificadoAt: new Date(), updatedAt: new Date() })
      .where(eq(contrato.id, row.id));
  }

  // ── Público: firmar ────────────────────────────────────────────────────────

  async sign(
    token: string,
    dto: {
      planId: number;
      firmaDataUrl: string;
      datosFacturacion: DatosFacturacionDto;
    },
    requestMeta: { ip: string; userAgent: string },
  ): Promise<{ ok: true; labSlug: string }> {
    const [row] = await this.db.select().from(contrato).where(eq(contrato.token, token)).limit(1);

    if (!row || row.deletedAt || row.estado === 'anulado') {
      throw new NotFoundException({ statusCode: 404, message: 'Not found' });
    }

    if (row.estado !== 'enviado' || row.expiraAt < new Date()) {
      throw new BadRequestException('El contrato no está activo o ya venció');
    }

    // Validar firma base64
    if (!dto.firmaDataUrl.startsWith('data:image/png;base64,')) {
      throw new BadRequestException('La firma debe ser una imagen PNG en formato data URI');
    }
    const base64Data = dto.firmaDataUrl.replace('data:image/png;base64,', '');
    const firmaBuffer = Buffer.from(base64Data, 'base64');
    const MAX_FIRMA_BYTES = 500 * 1024;
    if (firmaBuffer.length > MAX_FIRMA_BYTES) {
      throw new BadRequestException('La imagen de firma supera el máximo de 500 KB');
    }

    // Validar OTP verificado dentro de los últimos 20 minutos
    if (!row.otpVerificadoAt) {
      throw new BadRequestException('Debe verificar su identidad con OTP antes de firmar');
    }
    const otpValidUntil = addMinutes(row.otpVerificadoAt, OTP_VERIFIED_WINDOW_MINUTES);
    if (otpValidUntil < new Date()) {
      throw new BadRequestException(
        'La verificación OTP expiró. Vuelva a solicitar y verificar el código.',
      );
    }

    // Validar plan existe
    const planRow = await this.getPlan(dto.planId);

    // Generar slug para laboratorio
    const slug = await this.generateUniqueSlug(row.razonSocial);

    const firmadoAt = new Date();
    const evidenciaBase = {
      ip: requestMeta.ip,
      userAgent: requestMeta.userAgent,
      timestamp: firmadoAt.toISOString(),
      otpEmail: row.emailFirmante,
      pdfHashSha256: row.pdfHashSha256 ?? '',
    };

    // TRANSACCIÓN: crear lab + suscripción + update contrato
    let labId: number;
    let contratoActualizado: typeof contrato.$inferSelect;

    await this.db.transaction(async (tx) => {
      // Crear laboratorio
      const [lab] = await tx
        .insert(laboratorio)
        .values({
          slug,
          legalName: row.razonSocial,
          shortName: row.razonSocial.substring(0, 40),
          email: row.emailFirmante,
          estado: 'activo',
        })
        .returning();

      labId = lab.id;

      // Crear suscripción
      await tx.insert(suscripcion).values({
        labId: lab.id,
        planId: dto.planId,
        estado: 'activa',
        desde: new Date(),
      });

      // Update contrato
      const [updated] = await tx
        .update(contrato)
        .set({
          estado: 'firmado',
          planElegidoId: dto.planId,
          labCreadoId: lab.id,
          firmadoAt,
          datosFacturacion: dto.datosFacturacion as unknown as Record<string, unknown>,
          evidencia: evidenciaBase as unknown as Record<string, unknown>,
          updatedAt: new Date(),
        })
        .where(eq(contrato.id, row.id))
        .returning();

      contratoActualizado = updated;
    });

    // POST-COMMIT: operaciones no críticas

    // Subir firma
    try {
      const firmaPath = `${row.id}/firma.png`;
      await this.uploadToContracts(firmaPath, firmaBuffer, 'image/png');
    } catch (err) {
      this.logger.warn(`No se pudo subir la firma para contrato ${row.id}: ${String(err)}`);
    }

    // Renderizar y subir PDF firmado
    try {
      const planes = await this.getActivePlans();
      const firmadoData: ContratoFirmadoData = {
        id: row.id,
        razonSocial: row.razonSocial,
        nombreContacto: row.nombreContacto,
        cuit: row.cuit,
        emailFirmante: row.emailFirmante,
        telefono: row.telefono,
        propuesta: row.propuesta as { descripcion: string; notas?: string },
        planSugeridoId: row.planSugeridoId,
        createdAt: row.createdAt,
        expiraAt: row.expiraAt,
        token: row.token,
        planes,
        appUrl: this.appConfig.env.APP_URL,
        planElegidoId: dto.planId,
        firmaDataUrl: dto.firmaDataUrl,
        evidencia: evidenciaBase,
        planElegidoNombre: planRow.nombre,
        firmadoAt,
      };

      const pdfFirmadoBuffer = await renderContratoFirmadoPdf(firmadoData);
      const pdfFirmadoPath = `${row.id}/firmado.pdf`;
      await this.uploadToContracts(pdfFirmadoPath, pdfFirmadoBuffer, 'application/pdf');

      await this.db
        .update(contrato)
        .set({ pdfFirmadoPath, updatedAt: new Date() })
        .where(eq(contrato.id, row.id));
    } catch (err) {
      this.logger.warn(`No se pudo generar PDF firmado para contrato ${row.id}: ${String(err)}`);
    }

    // Invitar admin al laboratorio
    try {
      const redirectTo = `${this.appConfig.env.APP_URL}/auth/set-password`;
      await this.inviteAdmin(labId!, row.emailFirmante, redirectTo);
    } catch (err) {
      this.logger.warn(`No se pudo invitar al admin del laboratorio ${labId!}: ${String(err)}`);
    }

    // Notificar a Nodo
    const notifyTo = this.appConfig.env.MAIL_NOTIFY_TO;
    if (notifyTo) {
      try {
        await this.mailService.sendContractSignedNotice(notifyTo, {
          id: row.id,
          razonSocial: row.razonSocial,
          emailFirmante: row.emailFirmante,
          firmadoAt,
        });
      } catch (err) {
        this.logger.warn(`No se pudo notificar firma a Nodo: ${String(err)}`);
      }
    }

    return { ok: true, labSlug: slug };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async inviteAdmin(labId: number, email: string, redirectTo: string): Promise<void> {
    const { data, error: inviteError } = await this.storage.auth.admin.inviteUserByEmail(email, {
      redirectTo,
    });

    if (inviteError || !data?.user) {
      throw new Error(`No se pudo invitar a ${email}: ${inviteError?.message ?? 'unknown'}`);
    }

    const userId = data.user.id;

    await this.storage.auth.admin.updateUserById(userId, {
      app_metadata: { role: 'admin' },
    });

    const { user: userSchema } = await import('@/db/schema');
    await this.db
      .insert(userSchema)
      .values({
        id: userId,
        labId,
        email,
        role: 'admin',
        active: true,
      })
      .onConflictDoUpdate({
        target: userSchema.id,
        set: { labId, email, role: 'admin', active: true },
      });
  }

  private async generateUniqueSlug(razonSocial: string): Promise<string> {
    let base = slugify(razonSocial);
    if (!base) base = 'laboratorio';
    if (base.length > 60) base = base.substring(0, 60);

    // Si está reservado, forzar sufijo
    const candidate = (RESERVED_SLUGS as readonly string[]).includes(base) ? `${base}-lab` : base;

    let attempt = 0;
    while (true) {
      const current = attempt === 0 ? candidate : `${candidate}-${attempt + 1}`;
      const [existing] = await this.db
        .select({ id: laboratorio.id })
        .from(laboratorio)
        .where(eq(laboratorio.slug, current))
        .limit(1);

      if (!existing) return current;
      attempt++;
    }
  }

  // ── Utilidad exportada ─────────────────────────────────────────────────────

  static slugify = slugify;
  static obfuscateEmail = obfuscateEmail;
  static sha256 = sha256;
}
