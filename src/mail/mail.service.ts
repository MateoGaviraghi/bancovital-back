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
