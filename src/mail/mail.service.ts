import { AppConfig } from '@/config';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { Resend } from 'resend';

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
    return this.appConfig.env.MAIL_FROM ?? 'Nodo <onboarding@resend.dev>';
  }

  async sendOtp(to: string, codigo: string, contratoId: number): Promise<void> {
    if (this.resend) {
      const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Código de verificación</title></head>
<body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background:#f7f7f7; margin:0; padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7; padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff; border:1px solid #e0e0e0; border-radius:4px;">
        <tr>
          <td style="padding:32px 40px; border-bottom:3px solid #8b2fef;">
            <p style="margin:0; font-size:13px; letter-spacing:2px; text-transform:uppercase; color:#8b2fef; font-weight:600;">NODO</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <h1 style="margin:0 0 16px; font-size:20px; color:#1a1a1a; font-weight:600;">Código de verificación</h1>
            <p style="margin:0 0 24px; font-size:14px; color:#444; line-height:1.6;">
              Utilice el siguiente código para verificar su identidad y continuar con la firma del contrato.
              El código tiene una vigencia de 10 minutos.
            </p>
            <div style="background:#f4f4f4; border-left:4px solid #8b2fef; padding:20px 24px; margin:0 0 24px;">
              <span style="font-size:32px; font-weight:700; letter-spacing:8px; color:#1a1a1a; font-family:monospace;">${codigo}</span>
            </div>
            <p style="margin:0; font-size:12px; color:#888; line-height:1.6;">
              Si no solicitó este código, ignore este mensaje. Por razones de seguridad, no comparta este código con terceros.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px; background:#f9f9f9; border-top:1px solid #ececec;">
            <p style="margin:0; font-size:11px; color:#aaa;">
              NODO · nodotech.dev · Mateo Gaviraghi +54 9 3425 16-2081 · Justo González Viescas +54 9 3425 26-7005
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

      const { error } = await this.resend.emails.send({
        from: this.mailFrom,
        to,
        subject: 'Código de verificación — Contrato Nodo',
        html,
      });

      if (error) {
        throw new InternalServerErrorException(`Error al enviar email OTP: ${error.message}`);
      }
      return;
    }

    // Sin API key
    if (process.env.OTP_DEV_LOG === '1') {
      this.logger.warn(`[OTP DEV] contrato=${contratoId} codigo=${codigo} destinatario=${to}`);
      return;
    }

    throw new InternalServerErrorException(
      'Servicio de email no configurado. Configure RESEND_API_KEY o active OTP_DEV_LOG=1 para desarrollo.',
    );
  }

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
    const fechaStr = data.slotInicio.toLocaleString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const horaInicio = data.slotInicio.toLocaleTimeString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      hour: '2-digit',
      minute: '2-digit',
    });
    const horaFin = data.slotFin.toLocaleTimeString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      hour: '2-digit',
      minute: '2-digit',
    });

    const appUrl = this.appConfig.env.APP_URL;
    const confirmarUrl = `${appUrl}/reunion/${data.token}?accion=confirmar`;
    const cancelarUrl = `${appUrl}/reunion/${data.token}?accion=cancelar`;

    const meetBlock = data.meetLink
      ? `<p style="margin:0 0 24px; font-size:14px; color:#444; line-height:1.6;">
           Enlace de videoconferencia: <a href="${data.meetLink}" style="color:#8b2fef; text-decoration:none;">${data.meetLink}</a>
         </p>`
      : `<p style="margin:0 0 24px; font-size:14px; color:#444; line-height:1.6;">
           Te enviaremos el enlace de la reunión por este medio a la brevedad.
         </p>`;

    const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Reunión confirmada</title></head>
<body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background:#f7f7f7; margin:0; padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7; padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff; border:1px solid #e0e0e0; border-radius:4px;">
        <tr>
          <td style="padding:32px 40px; border-bottom:3px solid #8b2fef;">
            <p style="margin:0; font-size:13px; letter-spacing:2px; text-transform:uppercase; color:#8b2fef; font-weight:600;">NODO</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <h1 style="margin:0 0 16px; font-size:20px; color:#1a1a1a; font-weight:600;">Tu reunión está confirmada</h1>
            <p style="margin:0 0 16px; font-size:14px; color:#444; line-height:1.6;">
              Hola <strong>${data.nombre}</strong>, tu reunión con Nodo ha sido agendada exitosamente.
            </p>
            <div style="background:#f4f4f4; border-left:4px solid #8b2fef; padding:20px 24px; margin:0 0 24px;">
              <p style="margin:0 0 8px; font-size:14px; color:#1a1a1a; font-weight:600;">${fechaStr}</p>
              <p style="margin:0; font-size:14px; color:#444;">${horaInicio} – ${horaFin} (hora Argentina)</p>
            </div>
            ${meetBlock}
            <p style="margin:0 0 16px; font-size:14px; color:#444; line-height:1.6; font-weight:600;">Avisanos si vas a asistir:</p>
            <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
              <tr>
                <td style="padding-right:12px;">
                  <a href="${confirmarUrl}"
                     style="display:inline-block; padding:12px 24px; background:#8b2fef; color:#ffffff; font-size:14px; font-weight:600; text-decoration:none; border-radius:4px;">
                    Confirmar asistencia
                  </a>
                </td>
                <td>
                  <a href="${cancelarUrl}"
                     style="display:inline-block; padding:12px 24px; background:#ffffff; color:#444444; font-size:14px; font-weight:600; text-decoration:none; border-radius:4px; border:1px solid #cccccc;">
                    No podré asistir
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0; font-size:12px; color:#888; line-height:1.6;">
              Si necesitás reprogramar, respondé este email con anticipación.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px; background:#f9f9f9; border-top:1px solid #ececec;">
            <p style="margin:0; font-size:11px; color:#aaa;">
              NODO · nodotech.dev · Mateo Gaviraghi +54 9 3425 16-2081 · Justo González Viescas +54 9 3425 26-7005
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    if (this.resend) {
      const { error } = await this.resend.emails.send({
        from: this.mailFrom,
        to,
        subject: `Reunión confirmada — ${fechaStr} ${horaInicio}`,
        html,
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

  async sendAsistenciaConfirmada(
    to: string,
    reunion: { id: number; nombre: string; email: string; slotInicio: Date; slotFin: Date },
  ): Promise<void> {
    if (!to) return;

    const fechaStr = reunion.slotInicio.toLocaleString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const horaInicio = reunion.slotInicio.toLocaleTimeString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      hour: '2-digit',
      minute: '2-digit',
    });

    const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Asistencia confirmada</title></head>
<body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background:#f7f7f7; margin:0; padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7; padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff; border:1px solid #e0e0e0; border-radius:4px;">
        <tr>
          <td style="padding:32px 40px; border-bottom:3px solid #8b2fef;">
            <p style="margin:0; font-size:13px; letter-spacing:2px; text-transform:uppercase; color:#8b2fef; font-weight:600;">NODO — Asistencia confirmada</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <h1 style="margin:0 0 16px; font-size:20px; color:#1a1a1a; font-weight:600;">REU-${String(reunion.id).padStart(5, '0')} — Asistencia confirmada</h1>
            <div style="background:#f4f4f4; border-left:4px solid #8b2fef; padding:20px 24px; margin:0 0 24px;">
              <p style="margin:0 0 4px; font-size:14px; color:#1a1a1a; font-weight:600;">${fechaStr}</p>
              <p style="margin:0; font-size:14px; color:#444;">${horaInicio}</p>
            </div>
            <table cellpadding="0" cellspacing="0" style="width:100%; font-size:14px; color:#444; line-height:2;">
              <tr><td style="font-weight:600; width:120px;">Nombre</td><td>${reunion.nombre}</td></tr>
              <tr><td style="font-weight:600;">Email</td><td>${reunion.email}</td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px; background:#f9f9f9; border-top:1px solid #ececec;">
            <p style="margin:0; font-size:11px; color:#aaa;">
              NODO · nodotech.dev · Mateo Gaviraghi +54 9 3425 16-2081 · Justo González Viescas +54 9 3425 26-7005
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    if (this.resend) {
      const { error } = await this.resend.emails.send({
        from: this.mailFrom,
        to,
        subject: `REU-${String(reunion.id).padStart(5, '0')} — ${reunion.nombre} confirmó asistencia`,
        html,
      });
      if (error) {
        this.logger.warn(`No se pudo enviar notificación de asistencia: ${error.message}`);
      }
      return;
    }

    if (process.env.OTP_DEV_LOG === '1') {
      this.logger.warn(`[REUNION DEV] Asistencia confirmada: REU-${reunion.id} ${reunion.nombre}`);
    }
  }

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

    const fechaStr = reunion.slotInicio.toLocaleString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const horaInicio = reunion.slotInicio.toLocaleTimeString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      hour: '2-digit',
      minute: '2-digit',
    });
    const horaFin = reunion.slotFin.toLocaleTimeString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      hour: '2-digit',
      minute: '2-digit',
    });

    const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Nueva reunión solicitada</title></head>
<body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background:#f7f7f7; margin:0; padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7; padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff; border:1px solid #e0e0e0; border-radius:4px;">
        <tr>
          <td style="padding:32px 40px; border-bottom:3px solid #8b2fef;">
            <p style="margin:0; font-size:13px; letter-spacing:2px; text-transform:uppercase; color:#8b2fef; font-weight:600;">NODO — Nueva reunión</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <h1 style="margin:0 0 16px; font-size:20px; color:#1a1a1a; font-weight:600;">Reunión REU-${String(reunion.id).padStart(5, '0')}</h1>
            <div style="background:#f4f4f4; border-left:4px solid #8b2fef; padding:20px 24px; margin:0 0 24px;">
              <p style="margin:0 0 4px; font-size:14px; color:#1a1a1a; font-weight:600;">${fechaStr}</p>
              <p style="margin:0; font-size:14px; color:#444;">${horaInicio} – ${horaFin}</p>
            </div>
            <table cellpadding="0" cellspacing="0" style="width:100%; font-size:14px; color:#444; line-height:2;">
              <tr><td style="font-weight:600; width:120px;">Nombre</td><td>${reunion.nombre}</td></tr>
              <tr><td style="font-weight:600;">Email</td><td>${reunion.email}</td></tr>
              ${reunion.empresa ? `<tr><td style="font-weight:600;">Empresa</td><td>${reunion.empresa}</td></tr>` : ''}
              ${reunion.telefono ? `<tr><td style="font-weight:600;">Teléfono</td><td>${reunion.telefono}</td></tr>` : ''}
              ${reunion.mensaje ? `<tr><td style="font-weight:600; vertical-align:top;">Mensaje</td><td>${reunion.mensaje}</td></tr>` : ''}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px; background:#f9f9f9; border-top:1px solid #ececec;">
            <p style="margin:0; font-size:11px; color:#aaa;">
              NODO · nodotech.dev · Mateo Gaviraghi +54 9 3425 16-2081 · Justo González Viescas +54 9 3425 26-7005
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    if (this.resend) {
      const { error } = await this.resend.emails.send({
        from: this.mailFrom,
        to: notifyTo,
        subject: `Nueva reunión — ${reunion.nombre} · ${fechaStr} ${horaInicio}`,
        html,
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

  async sendContractSignedNotice(
    to: string,
    contrato: { id: number; razonSocial: string; emailFirmante: string; firmadoAt: Date | null },
  ): Promise<void> {
    if (!this.resend) {
      // No key configurada — solo log si dev
      if (process.env.OTP_DEV_LOG === '1') {
        this.logger.warn(
          `[CONTRATO DEV] Contrato ${contrato.id} firmado por ${contrato.emailFirmante}`,
        );
      }
      return;
    }

    const fechaStr = (contrato.firmadoAt ?? new Date()).toLocaleString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      dateStyle: 'full',
      timeStyle: 'short',
    });

    const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Contrato firmado</title></head>
<body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background:#f7f7f7; margin:0; padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7; padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff; border:1px solid #e0e0e0; border-radius:4px;">
        <tr>
          <td style="padding:32px 40px; border-bottom:3px solid #8b2fef;">
            <p style="margin:0; font-size:13px; letter-spacing:2px; text-transform:uppercase; color:#8b2fef; font-weight:600;">NODO</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <h1 style="margin:0 0 16px; font-size:20px; color:#1a1a1a; font-weight:600;">Contrato firmado</h1>
            <p style="margin:0 0 16px; font-size:14px; color:#444; line-height:1.6;">
              Se ha completado la firma electrónica del contrato <strong>CON-${String(contrato.id).padStart(6, '0')}</strong>
              correspondiente a <strong>${contrato.razonSocial}</strong>.
            </p>
            <p style="margin:0 0 24px; font-size:14px; color:#444; line-height:1.6;">
              Firmante: ${contrato.emailFirmante}<br>
              Fecha: ${fechaStr}
            </p>
            <p style="margin:0; font-size:12px; color:#888; line-height:1.6;">
              El laboratorio ha sido dado de alta automáticamente. Ingrese al panel de administración para verificar la configuración.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px; background:#f9f9f9; border-top:1px solid #ececec;">
            <p style="margin:0; font-size:11px; color:#aaa;">
              NODO · nodotech.dev · Mateo Gaviraghi +54 9 3425 16-2081 · Justo González Viescas +54 9 3425 26-7005
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const { error } = await this.resend.emails.send({
      from: this.mailFrom,
      to,
      subject: `Contrato CON-${String(contrato.id).padStart(6, '0')} firmado — ${contrato.razonSocial}`,
      html,
    });

    if (error) {
      this.logger.warn(`No se pudo enviar notificación de firma: ${error.message}`);
    }
  }
}
