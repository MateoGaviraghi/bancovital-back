import { AppConfig } from '@/config';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { Resend } from 'resend';

// ── Paleta de marca Banco Vital ──────────────────────────────────────────────
const NAVY = '#1f2b5b';
const RED = '#cd0f0f';
const INK = '#1a2138';
const MUTED = '#525a76';
const SUBTLE = '#8a90a6';
const BORDER = '#e2e5ee';
const BORDER_STRONG = '#c7ccdb';
const BG = '#f6f7fb';
const SOFT = '#eaeef6';
const SUCCESS = '#15803d';
const SUCCESS_SOFT = '#dcfce7';

const TZ_AR = 'America/Argentina/Buenos_Aires';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private resend: Resend | null = null;

  constructor(private readonly appConfig: AppConfig) {
    const key = this.appConfig.env.RESEND_API_KEY;
    if (key) {
      this.resend = new Resend(key);
    }
  }

  private get mailFrom(): string {
    return this.appConfig.env.MAIL_FROM ?? 'Banco Vital <onboarding@resend.dev>';
  }

  /**
   * Shell de marca compartido por todos los emails transaccionales.
   * Header navy con logo blanco + regla roja, cuerpo blanco, footer sobrio.
   * Layout en tablas + estilos inline (compatibilidad con clientes de correo).
   */
  private wrap(opts: { title: string; preheader?: string; content: string }): string {
    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${opts.title}</title></head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  ${opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${BG};">${opts.preheader}</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:92%;background:#ffffff;border:1px solid ${BORDER};">
        <tr><td style="background:${NAVY};padding:22px 32px;border-bottom:3px solid ${RED};">
          <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.01em;">Banco Vital</span>
        </td></tr>
        <tr><td style="padding:32px;">${opts.content}</td></tr>
        <tr><td style="padding:18px 32px;background:${BG};border-top:1px solid ${BORDER};">
          <p style="margin:0;font-size:11px;color:${SUBTLE};line-height:1.6;">
            <strong style="color:${MUTED};">Banco Vital</strong> &middot; por Nodo &middot; nodotech.dev
          </p>
        </td></tr>
      </table>
      <p style="margin:14px 0 0;font-size:10px;color:#9aa0b4;">Correo automático — no respondas a esta dirección.</p>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private eyebrow(text: string): string {
    return `<p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:${RED};">${text}</p>`;
  }

  private h1(text: string): string {
    return `<h1 style="margin:0 0 10px;font-size:21px;color:${INK};font-weight:700;letter-spacing:-0.01em;">${text}</h1>`;
  }

  private p(text: string): string {
    return `<p style="margin:0 0 16px;font-size:14px;color:${MUTED};line-height:1.65;">${text}</p>`;
  }

  private infoBox(rows: string): string {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SOFT};border-left:3px solid ${NAVY};margin:0 0 20px;"><tr><td style="padding:16px 20px;">${rows}</td></tr></table>`;
  }

  private fmtFecha(d: Date): string {
    const s = d.toLocaleDateString('es-AR', {
      timeZone: TZ_AR,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  private fmtHora(d: Date): string {
    return d.toLocaleTimeString('es-AR', { timeZone: TZ_AR, hour: '2-digit', minute: '2-digit' });
  }

  // ── OTP ────────────────────────────────────────────────────────────────────

  async sendOtp(to: string, codigo: string, contratoId: number): Promise<void> {
    if (this.resend) {
      const content = `
        ${this.eyebrow('Verificación de identidad')}
        ${this.h1('Tu código de verificación')}
        ${this.p('Usá este código para verificar tu identidad y continuar con la firma del contrato. Vence en 10 minutos.')}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SOFT};border-left:3px solid ${RED};margin:0 0 22px;">
          <tr><td style="padding:18px 24px;text-align:center;">
            <span style="font-size:34px;font-weight:700;letter-spacing:10px;color:${NAVY};font-family:'SF Mono',Menlo,Consolas,monospace;">${codigo}</span>
          </td></tr>
        </table>
        <p style="margin:0;font-size:12px;color:${SUBTLE};line-height:1.6;">Si no solicitaste este código, ignorá este mensaje. Por seguridad, no lo compartas con nadie.</p>`;

      const { error } = await this.resend.emails.send({
        from: this.mailFrom,
        to,
        subject: 'Tu código de verificación — Banco Vital',
        html: this.wrap({
          title: 'Código de verificación',
          preheader: `Tu código: ${codigo}`,
          content,
        }),
      });

      if (error) {
        throw new InternalServerErrorException(`Error al enviar email OTP: ${error.message}`);
      }
      return;
    }

    if (process.env.OTP_DEV_LOG === '1') {
      this.logger.warn(`[OTP DEV] contrato=${contratoId} codigo=${codigo} destinatario=${to}`);
      return;
    }

    throw new InternalServerErrorException(
      'Servicio de email no configurado. Configure RESEND_API_KEY o active OTP_DEV_LOG=1 para desarrollo.',
    );
  }

  // ── Confirmación de reunión (al cliente) ─────────────────────────────────────

  async sendReunionConfirmacion(
    to: string,
    data: {
      nombre: string;
      slotInicio: Date;
      slotFin: Date;
      meetLink: string | null;
      token: string;
    },
  ): Promise<void> {
    const fechaStr = this.fmtFecha(data.slotInicio);
    const horaInicio = this.fmtHora(data.slotInicio);
    const horaFin = this.fmtHora(data.slotFin);
    const appUrl = this.appConfig.env.APP_URL;
    const confirmarUrl = `${appUrl}/reunion/${data.token}?accion=confirmar`;
    const cancelarUrl = `${appUrl}/reunion/${data.token}?accion=cancelar`;

    const meetBlock = data.meetLink
      ? this.p(
          `Enlace de videollamada: <a href="${data.meetLink}" style="color:${NAVY};font-weight:600;text-decoration:none;">${data.meetLink}</a>`,
        )
      : this.p('Te enviaremos el enlace de la reunión por este medio antes del encuentro.');

    const content = `
      ${this.eyebrow('Reunión agendada')}
      ${this.h1('Tu reunión está confirmada')}
      ${this.p(`Hola <strong style="color:${INK};">${data.nombre}</strong>, agendamos tu reunión con Banco Vital.`)}
      ${this.infoBox(
        `<p style="margin:0 0 4px;font-size:14px;color:${INK};font-weight:700;">${fechaStr}</p>
         <p style="margin:0;font-size:14px;color:${MUTED};">${horaInicio} – ${horaFin} (hora Argentina)</p>`,
      )}
      ${meetBlock}
      <p style="margin:0 0 14px;font-size:14px;color:${INK};font-weight:600;">Avisanos si vas a asistir:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr>
        <td style="padding-right:10px;">
          <a href="${confirmarUrl}" style="display:inline-block;padding:12px 22px;background:${NAVY};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">Confirmar asistencia</a>
        </td>
        <td>
          <a href="${cancelarUrl}" style="display:inline-block;padding:12px 22px;background:#ffffff;color:${MUTED};font-size:14px;font-weight:600;text-decoration:none;border:1px solid ${BORDER_STRONG};">No podré asistir</a>
        </td>
      </tr></table>
      <p style="margin:0;font-size:12px;color:${SUBTLE};line-height:1.6;">Si necesitás reprogramar, escribinos con anticipación.</p>`;

    if (this.resend) {
      const { error } = await this.resend.emails.send({
        from: this.mailFrom,
        to,
        subject: `Reunión confirmada — ${fechaStr} ${horaInicio}`,
        html: this.wrap({
          title: 'Reunión confirmada',
          preheader: `${fechaStr} · ${horaInicio} hs`,
          content,
        }),
      });
      if (error) {
        this.logger.warn(`No se pudo enviar confirmación de reunión: ${error.message}`);
      }
      return;
    }

    if (process.env.OTP_DEV_LOG === '1') {
      this.logger.warn(`[REUNION DEV] Confirmación a ${to} — ${fechaStr} ${horaInicio}`);
    }
  }

  // ── Asistencia confirmada (a Nodo) ───────────────────────────────────────────

  async sendAsistenciaConfirmada(
    to: string,
    reunion: { id: number; nombre: string; email: string; slotInicio: Date; slotFin: Date },
  ): Promise<void> {
    if (!to) return;

    const fechaStr = this.fmtFecha(reunion.slotInicio);
    const horaInicio = this.fmtHora(reunion.slotInicio);
    const id = `REU-${String(reunion.id).padStart(5, '0')}`;

    const content = `
      ${this.eyebrow(`${id} · Asistencia confirmada`)}
      ${this.h1('El invitado confirmó asistencia')}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SUCCESS_SOFT};border-left:3px solid ${SUCCESS};margin:0 0 20px;">
        <tr><td style="padding:16px 20px;">
          <p style="margin:0 0 4px;font-size:14px;color:${INK};font-weight:700;">${fechaStr}</p>
          <p style="margin:0;font-size:14px;color:${MUTED};">${horaInicio} hs</p>
        </td></tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:${MUTED};">
        <tr><td style="font-weight:600;color:${INK};width:110px;padding:3px 0;">Nombre</td><td style="padding:3px 0;">${reunion.nombre}</td></tr>
        <tr><td style="font-weight:600;color:${INK};padding:3px 0;">Email</td><td style="padding:3px 0;">${reunion.email}</td></tr>
      </table>`;

    if (this.resend) {
      const { error } = await this.resend.emails.send({
        from: this.mailFrom,
        to,
        subject: `${id} — ${reunion.nombre} confirmó asistencia`,
        html: this.wrap({ title: 'Asistencia confirmada', content }),
      });
      if (error) {
        this.logger.warn(`No se pudo enviar notificación de asistencia: ${error.message}`);
      }
      return;
    }

    if (process.env.OTP_DEV_LOG === '1') {
      this.logger.warn(`[REUNION DEV] Asistencia confirmada: ${id} ${reunion.nombre}`);
    }
  }

  // ── Nueva reunión (a Nodo) ───────────────────────────────────────────────────

  async sendReunionNotice(reunion: {
    id: number;
    nombre: string;
    email: string;
    empresa: string | null;
    telefono: string | null;
    mensaje: string | null;
    slotInicio: Date;
    slotFin: Date;
  }): Promise<void> {
    const notifyTo = this.appConfig.env.MAIL_NOTIFY_TO;
    if (!notifyTo) {
      if (process.env.OTP_DEV_LOG === '1') {
        this.logger.warn(`[REUNION DEV] Notificación Nodo: ${reunion.nombre} (${reunion.email})`);
      }
      return;
    }

    const fechaStr = this.fmtFecha(reunion.slotInicio);
    const horaInicio = this.fmtHora(reunion.slotInicio);
    const horaFin = this.fmtHora(reunion.slotFin);
    const id = `REU-${String(reunion.id).padStart(5, '0')}`;
    const row = (label: string, value: string) =>
      `<tr><td style="font-weight:600;color:${INK};width:110px;padding:3px 0;vertical-align:top;">${label}</td><td style="padding:3px 0;">${value}</td></tr>`;

    const content = `
      ${this.eyebrow(`${id} · Nueva reunión`)}
      ${this.h1('Nueva reunión solicitada')}
      ${this.infoBox(
        `<p style="margin:0 0 4px;font-size:14px;color:${INK};font-weight:700;">${fechaStr}</p>
         <p style="margin:0;font-size:14px;color:${MUTED};">${horaInicio} – ${horaFin} hs</p>`,
      )}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:${MUTED};">
        ${row('Nombre', reunion.nombre)}
        ${row('Email', reunion.email)}
        ${reunion.empresa ? row('Empresa', reunion.empresa) : ''}
        ${reunion.telefono ? row('Teléfono', reunion.telefono) : ''}
        ${reunion.mensaje ? row('Mensaje', reunion.mensaje) : ''}
      </table>`;

    if (this.resend) {
      const { error } = await this.resend.emails.send({
        from: this.mailFrom,
        to: notifyTo,
        subject: `Nueva reunión — ${reunion.nombre} · ${fechaStr} ${horaInicio}`,
        html: this.wrap({ title: 'Nueva reunión', content }),
      });
      if (error) {
        this.logger.warn(`No se pudo enviar notificación de reunión a Nodo: ${error.message}`);
      }
      return;
    }

    if (process.env.OTP_DEV_LOG === '1') {
      this.logger.warn(`[REUNION DEV] Notificación Nodo: ${reunion.nombre} (${reunion.email})`);
    }
  }

  // ── Contrato firmado (a Nodo) ────────────────────────────────────────────────

  async sendContractSignedNotice(
    to: string,
    contrato: { id: number; razonSocial: string; emailFirmante: string; firmadoAt: Date | null },
  ): Promise<void> {
    if (!this.resend) {
      if (process.env.OTP_DEV_LOG === '1') {
        this.logger.warn(
          `[CONTRATO DEV] Contrato ${contrato.id} firmado por ${contrato.emailFirmante}`,
        );
      }
      return;
    }

    const id = `CON-${String(contrato.id).padStart(6, '0')}`;
    const fechaStr = (contrato.firmadoAt ?? new Date()).toLocaleString('es-AR', {
      timeZone: TZ_AR,
      dateStyle: 'full',
      timeStyle: 'short',
    });

    const content = `
      ${this.eyebrow(`${id} · Firmado`)}
      ${this.h1('Contrato firmado')}
      ${this.p(`Se completó la firma electrónica del contrato <strong style="color:${INK};">${id}</strong> de <strong style="color:${INK};">${contrato.razonSocial}</strong>.`)}
      ${this.infoBox(
        `<p style="margin:0 0 3px;font-size:14px;color:${MUTED};">Firmante: <span style="color:${INK};font-weight:600;">${contrato.emailFirmante}</span></p>
         <p style="margin:0;font-size:14px;color:${MUTED};">Fecha: <span style="color:${INK};font-weight:600;">${fechaStr}</span></p>`,
      )}
      <p style="margin:0;font-size:12px;color:${SUBTLE};line-height:1.6;">El laboratorio fue dado de alta automáticamente. Ingresá al panel para verificar la configuración.</p>`;

    const { error } = await this.resend.emails.send({
      from: this.mailFrom,
      to,
      subject: `${id} firmado — ${contrato.razonSocial}`,
      html: this.wrap({ title: 'Contrato firmado', content }),
    });

    if (error) {
      this.logger.warn(`No se pudo enviar notificación de firma: ${error.message}`);
    }
  }
}
