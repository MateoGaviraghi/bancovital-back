import { AppConfig } from '@/config';
import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';

export interface BusyInterval {
  start: Date;
  end: Date;
}

export interface CreateEventParams {
  summary: string;
  description: string;
  start: Date;
  end: Date;
  attendeeEmail: string;
}

export interface CreateEventResult {
  eventId: string;
  meetLink: string | null;
}

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);

  constructor(private readonly appConfig: AppConfig) {}

  /** True si las 4 variables de Google Calendar están configuradas. */
  get isConfigured(): boolean {
    const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_CALENDAR_ID } =
      this.appConfig.env;
    return !!(
      GOOGLE_CLIENT_ID &&
      GOOGLE_CLIENT_SECRET &&
      GOOGLE_REFRESH_TOKEN &&
      GOOGLE_CALENDAR_ID
    );
  }

  private buildOAuth2Client() {
    const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = this.appConfig.env;
    const auth = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
    auth.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
    return auth;
  }

  /**
   * Devuelve los intervalos ocupados en el rango [fechaInicio, fechaFin].
   * Si no está configurado o falla, devuelve [] (nunca tira).
   */
  async getBusy(fechaInicio: Date, fechaFin: Date): Promise<BusyInterval[]> {
    if (!this.isConfigured) return [];

    try {
      const auth = this.buildOAuth2Client();
      const calendar = google.calendar({ version: 'v3', auth });
      const calendarId = this.appConfig.env.GOOGLE_CALENDAR_ID!;

      const res = await calendar.freebusy.query({
        requestBody: {
          timeMin: fechaInicio.toISOString(),
          timeMax: fechaFin.toISOString(),
          items: [{ id: calendarId }],
        },
      });

      const calendars = res.data.calendars ?? {};
      const busy = calendars[calendarId]?.busy ?? [];

      return busy
        .filter((b) => b.start && b.end)
        .map((b) => ({
          start: new Date(b.start as string),
          end: new Date(b.end as string),
        }));
    } catch (err) {
      this.logger.warn(`[GoogleCalendar] getBusy falló: ${String(err)}`);
      return [];
    }
  }

  /**
   * Elimina un evento de Google Calendar por eventId.
   * Si no está configurado o falla, no hace nada (never throws).
   */
  async deleteEvent(eventId: string): Promise<void> {
    if (!this.isConfigured) return;

    try {
      const auth = this.buildOAuth2Client();
      const calendar = google.calendar({ version: 'v3', auth });
      const calendarId = this.appConfig.env.GOOGLE_CALENDAR_ID!;
      await calendar.events.delete({ calendarId, eventId });
    } catch (err) {
      this.logger.warn(`[GoogleCalendar] deleteEvent falló: ${String(err)}`);
    }
  }

  /**
   * Crea un evento con Google Meet en el calendario configurado.
   * Si no está configurado o falla, devuelve null (nunca tira).
   */
  async createEvent(params: CreateEventParams): Promise<CreateEventResult | null> {
    if (!this.isConfigured) return null;

    try {
      const auth = this.buildOAuth2Client();
      const calendar = google.calendar({ version: 'v3', auth });
      const calendarId = this.appConfig.env.GOOGLE_CALENDAR_ID!;

      const res = await calendar.events.insert({
        calendarId,
        conferenceDataVersion: 1,
        sendUpdates: 'all',
        requestBody: {
          summary: params.summary,
          description: params.description,
          start: {
            dateTime: params.start.toISOString(),
            timeZone: 'America/Argentina/Buenos_Aires',
          },
          end: {
            dateTime: params.end.toISOString(),
            timeZone: 'America/Argentina/Buenos_Aires',
          },
          attendees: [{ email: params.attendeeEmail }],
          conferenceData: {
            createRequest: {
              requestId: `nodo-reunion-${Date.now()}`,
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          },
        },
      });

      const eventId = res.data.id ?? null;
      const meetLink =
        res.data.conferenceData?.entryPoints?.find((ep) => ep.entryPointType === 'video')?.uri ??
        null;

      if (!eventId) return null;

      return { eventId, meetLink: meetLink ?? null };
    } catch (err) {
      this.logger.warn(`[GoogleCalendar] createEvent falló: ${String(err)}`);
      return null;
    }
  }
}
