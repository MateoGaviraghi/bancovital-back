import type { Db } from '@/db/client';
import { DATABASE } from '@/db/database.module';
import { reunion } from '@/db/schema/reunion';
import { MailService } from '@/mail/mail.service';
import { BadRequestException, ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import {
  DIAS_HABILES,
  DURACION_MIN,
  HORA_FIN,
  HORA_INICIO,
  HORIZONTE_DIAS,
  LEAD_TIME_MS,
  generarSlotsDelDia,
} from './booking-config';
import { CreateReunionDto } from './dto/reuniones.dto';
import { GoogleCalendarService } from './google-calendar.service';

@Injectable()
export class ReunionesService {
  private readonly logger = new Logger(ReunionesService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Db,
    private readonly googleCalendar: GoogleCalendarService,
    private readonly mail: MailService,
  ) {}

  /**
   * Devuelve los slots disponibles para una fecha dada.
   * Filtra: fin de semana, reservados en DB, ocupados en Google, lead time.
   */
  async getDisponibilidad(fecha: string): Promise<{ inicio: string; fin: string }[]> {
    // 1. Validar formato básico
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return [];

    // 2. Generar slots brutos del día
    const slotsDelDia = generarSlotsDelDia(fecha);
    if (slotsDelDia.length === 0) return [];

    const inicioDia = slotsDelDia[0]!.inicio;
    const finDia = slotsDelDia[slotsDelDia.length - 1]!.fin;
    const ahora = new Date();

    // 3. Cargar reservas confirmadas del día desde DB
    const reservadas = await this.db
      .select({ slotInicio: reunion.slotInicio })
      .from(reunion)
      .where(
        and(
          eq(reunion.estado, 'confirmada'),
          gte(reunion.slotInicio, inicioDia),
          lte(reunion.slotInicio, finDia),
        ),
      );

    const reservadasSet = new Set(
      reservadas.map((r: { slotInicio: Date }) => r.slotInicio.getTime()),
    );

    // 4. Obtener ocupados de Google Calendar
    const busyIntervals = await this.googleCalendar.getBusy(inicioDia, finDia);

    const pisaGoogle = (slotInicio: Date, slotFin: Date): boolean => {
      for (const b of busyIntervals) {
        if (slotInicio < b.end && slotFin > b.start) return true;
      }
      return false;
    };

    // 5. Filtrar
    const disponibles = slotsDelDia.filter(({ inicio, fin }) => {
      if (inicio.getTime() < ahora.getTime() + LEAD_TIME_MS) return false;
      if (reservadasSet.has(inicio.getTime())) return false;
      if (pisaGoogle(inicio, fin)) return false;
      return true;
    });

    return disponibles.map(({ inicio, fin }) => ({
      inicio: inicio.toISOString(),
      fin: fin.toISOString(),
    }));
  }

  /**
   * Crea una reserva de reunión.
   * Valida que el slot sea válido (grilla, día hábil, horario, lead time, horizonte).
   */
  async crear(dto: CreateReunionDto) {
    const slotInicio = new Date(dto.slotInicio);
    if (Number.isNaN(slotInicio.getTime())) {
      throw new BadRequestException('slotInicio inválido');
    }

    // Validar día hábil (en hora AR — TZ ya anclada)
    const diaSemana = slotInicio.getDay();
    if (!DIAS_HABILES.has(diaSemana)) {
      throw new BadRequestException('El slot debe ser en un día hábil (lunes a viernes)');
    }

    // Validar horario
    const hora = slotInicio.getHours();
    const minuto = slotInicio.getMinutes();
    const [hInicioH, hInicioM] = HORA_INICIO.split(':').map(Number);
    const [hFinH, hFinM] = HORA_FIN.split(':').map(Number);
    const slotMin = hora * 60 + minuto;
    const inicioMin = (hInicioH ?? 0) * 60 + (hInicioM ?? 0);
    const finMin = (hFinH ?? 0) * 60 + (hFinM ?? 0);

    if (slotMin < inicioMin || slotMin + DURACION_MIN > finMin) {
      throw new BadRequestException('El slot está fuera del horario de atención (10:00–18:00)');
    }

    // Validar alineación a la grilla
    if ((slotMin - inicioMin) % DURACION_MIN !== 0) {
      throw new BadRequestException('El slot no está alineado a la grilla de 30 minutos');
    }

    // Validar segundos/ms = 0
    if (slotInicio.getSeconds() !== 0 || slotInicio.getMilliseconds() !== 0) {
      throw new BadRequestException('slotInicio debe tener segundos y milisegundos en cero');
    }

    const ahora = new Date();

    // Validar lead time
    if (slotInicio.getTime() < ahora.getTime() + LEAD_TIME_MS) {
      throw new BadRequestException('No se puede reservar con menos de 2 horas de anticipación');
    }

    // Validar horizonte máximo
    const horizonteMax = new Date(ahora.getTime() + HORIZONTE_DIAS * 24 * 60 * 60 * 1000);
    if (slotInicio > horizonteMax) {
      throw new BadRequestException(
        `No se puede reservar con más de ${HORIZONTE_DIAS} días de anticipación`,
      );
    }

    const slotFin = new Date(slotInicio.getTime() + DURACION_MIN * 60 * 1000);

    // Insertar (índice único DB previene doble-reserva)
    let reunionId: number;
    try {
      const [creada] = await this.db
        .insert(reunion)
        .values({
          nombre: dto.nombre,
          email: dto.email,
          empresa: dto.empresa ?? null,
          telefono: dto.telefono ?? null,
          mensaje: dto.mensaje ?? null,
          slotInicio,
          slotFin,
          estado: 'confirmada',
        })
        .returning({ id: reunion.id });

      if (!creada) throw new Error('No se obtuvo id de la reunión creada');
      reunionId = creada.id;
    } catch (err: unknown) {
      // 23505 = unique_violation (the slot's partial unique index). Same pattern
      // as plans/super services. The only unique constraint on this insert is the
      // slot index, so a 23505 here always means the slot was just taken.
      const pg = err as { code?: string };
      if (pg.code === '23505') {
        throw new ConflictException('Ese horario ya fue reservado, elegí otro');
      }
      throw err;
    }

    // Google Calendar (best-effort)
    let meetLink: string | null = null;
    try {
      const gcResult = await this.googleCalendar.createEvent({
        summary: `Reunión con ${dto.nombre}${dto.empresa ? ` — ${dto.empresa}` : ''}`,
        description: dto.mensaje ?? '',
        start: slotInicio,
        end: slotFin,
        attendeeEmail: dto.email,
      });
      if (gcResult) {
        meetLink = gcResult.meetLink;
        await this.db
          .update(reunion)
          .set({
            googleEventId: gcResult.eventId,
            meetLink: gcResult.meetLink,
            updatedAt: new Date(),
          })
          .where(eq(reunion.id, reunionId));
      }
    } catch (err) {
      this.logger.warn(
        `[Reuniones] Google Calendar falló para reunión ${reunionId}: ${String(err)}`,
      );
    }

    // Email al cliente (best-effort)
    try {
      await this.mail.sendReunionConfirmacion(dto.email, {
        nombre: dto.nombre,
        slotInicio,
        slotFin,
        meetLink,
      });
    } catch (err) {
      this.logger.warn(
        `[Reuniones] Email confirmación falló para reunión ${reunionId}: ${String(err)}`,
      );
    }

    // Notificación a Nodo (best-effort)
    try {
      await this.mail.sendReunionNotice({
        id: reunionId,
        nombre: dto.nombre,
        email: dto.email,
        empresa: dto.empresa ?? null,
        telefono: dto.telefono ?? null,
        mensaje: dto.mensaje ?? null,
        slotInicio,
        slotFin,
      });
    } catch (err) {
      this.logger.warn(
        `[Reuniones] Notificación Nodo falló para reunión ${reunionId}: ${String(err)}`,
      );
    }

    return {
      ok: true,
      reunionId,
      slotInicio: slotInicio.toISOString(),
      slotFin: slotFin.toISOString(),
      meetLink,
    };
  }

  /** Lista de reuniones para el panel super, ordenadas por slot_inicio desc. */
  async listar() {
    return this.db.select().from(reunion).orderBy(desc(reunion.slotInicio));
  }

  /** Cancela una reunión y borra el evento de Google Calendar (best-effort). */
  async cancelar(id: number) {
    const [existing] = await this.db.select().from(reunion).where(eq(reunion.id, id));

    if (!existing) {
      throw new BadRequestException(`Reunión ${id} no encontrada`);
    }

    await this.db
      .update(reunion)
      .set({ estado: 'cancelada', updatedAt: new Date() })
      .where(eq(reunion.id, id));

    // Borrar evento Google best-effort
    if (existing.googleEventId) {
      await this.googleCalendar.deleteEvent(existing.googleEventId);
    }

    return { ok: true };
  }
}
