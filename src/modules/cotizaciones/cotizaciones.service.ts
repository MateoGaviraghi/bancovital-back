import type { Db } from '@/db/client';
import { DATABASE } from '@/db/database.module';
import {
  cotizacion,
  cotizacionItem,
  insurer,
  laboratorio,
  patient,
  practice,
  ubValue,
  type Cotizacion,
  type CotizacionItem,
  type NewCotizacion,
  type NewCotizacionItem,
} from '@/db/schema';
import { pdfAccentPalette } from '@/pdf/render';
import type { CatalogoPdfData, CatalogoPrecioSection } from '@/pdf/templates/catalogo';
import type { CotizacionPdfData } from '@/pdf/templates/cotizacion';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import { and, asc, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import type { CreateCotizacionDto } from './dto/create-cotizacion.dto';
import type { ListCotizacionesDto } from './dto/list-cotizaciones.dto';
import type { UpdateCotizacionDto } from './dto/update-cotizacion.dto';

export interface CotizacionDetalle extends Cotizacion {
  items: CotizacionItem[];
  patientInfo: { id: number; firstName: string; lastName: string; dni: string } | null;
  insurerInfo: { id: number; code: string; name: string } | null;
}

export interface CotizacionSummary extends Cotizacion {
  patientInfo: { id: number; firstName: string; lastName: string; dni: string } | null;
  insurerInfo: { id: number; name: string } | null;
}

@Injectable()
export class CotizacionesService {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  // ─── Cotizaciones ──────────────────────────────────────────────────────────

  async list(labId: number, dto: ListCotizacionesDto): Promise<{ data: CotizacionSummary[]; total: number }> {
    const page = dto.page ?? 1;
    const pageSize = Math.min(dto.pageSize ?? 20, 100);
    const offset = (page - 1) * pageSize;

    const conditions = [eq(cotizacion.labId, labId), isNull(cotizacion.deletedAt)];
    if (dto.estado) conditions.push(eq(cotizacion.estado, dto.estado as any));
    if (dto.tipo) conditions.push(eq(cotizacion.tipo, dto.tipo as any));
    if (dto.search) {
      conditions.push(
        or(
          ilike(cotizacion.empresaNombre, `%${dto.search}%`),
          ilike(cotizacion.empresaCuit, `%${dto.search}%`),
        ) as any,
      );
    }

    const where = and(...conditions);

    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(cotizacion)
      .where(where);

    const rows = await this.db
      .select({
        cot: cotizacion,
        pat: {
          id: patient.id,
          firstName: patient.firstName,
          lastName: patient.lastName,
          dni: patient.dni,
        },
        ins: { id: insurer.id, name: insurer.name },
      })
      .from(cotizacion)
      .leftJoin(patient, eq(patient.id, cotizacion.patientId))
      .leftJoin(insurer, eq(insurer.id, cotizacion.insurerId))
      .where(where)
      .orderBy(desc(cotizacion.createdAt))
      .limit(pageSize)
      .offset(offset);

    const data: CotizacionSummary[] = rows.map((r) => ({
      ...r.cot,
      patientInfo: r.pat?.id ? { id: r.pat.id, firstName: r.pat.firstName!, lastName: r.pat.lastName!, dni: r.pat.dni! } : null,
      insurerInfo: r.ins?.id ? { id: r.ins.id, name: r.ins.name! } : null,
    }));

    return { data, total: count };
  }

  async byId(labId: number, id: number): Promise<CotizacionDetalle> {
    const [row] = await this.db
      .select({
        cot: cotizacion,
        pat: {
          id: patient.id,
          firstName: patient.firstName,
          lastName: patient.lastName,
          dni: patient.dni,
        },
        ins: { id: insurer.id, code: insurer.code, name: insurer.name },
      })
      .from(cotizacion)
      .leftJoin(patient, eq(patient.id, cotizacion.patientId))
      .leftJoin(insurer, eq(insurer.id, cotizacion.insurerId))
      .where(and(eq(cotizacion.id, id), eq(cotizacion.labId, labId), isNull(cotizacion.deletedAt)))
      .limit(1);

    if (!row) throw new NotFoundException('Cotización no encontrada');

    const items = await this.db
      .select()
      .from(cotizacionItem)
      .where(eq(cotizacionItem.cotizacionId, id))
      .orderBy(asc(cotizacionItem.sort), asc(cotizacionItem.id));

    return {
      ...row.cot,
      items,
      patientInfo: row.pat?.id
        ? { id: row.pat.id, firstName: row.pat.firstName!, lastName: row.pat.lastName!, dni: row.pat.dni! }
        : null,
      insurerInfo: row.ins?.id
        ? { id: row.ins.id, code: row.ins.code!, name: row.ins.name! }
        : null,
    };
  }

  async create(labId: number, userId: string, dto: CreateCotizacionDto): Promise<CotizacionDetalle> {
    if (dto.tipo === 'paciente' && !dto.patientId) {
      throw new BadRequestException('patientId es requerido para tipo paciente');
    }
    if (dto.tipo === 'empresa' && !dto.empresaNombre) {
      throw new BadRequestException('empresaNombre es requerido para tipo empresa');
    }
    // tipo 'generica': no requiere paciente ni empresa
    if (!dto.items.length) {
      throw new BadRequestException('La cotización debe tener al menos un ítem');
    }

    const total = dto.items.reduce((acc, item) => {
      const sub = new Decimal(item.precioUnitario).times(item.cantidad);
      return acc.plus(sub);
    }, new Decimal(0));

    const newCot: NewCotizacion = {
      labId,
      tipo: dto.tipo,
      estado: 'borrador',
      patientId: dto.tipo === 'paciente' ? dto.patientId : undefined,
      empresaNombre: dto.tipo === 'empresa' ? dto.empresaNombre : undefined,
      empresaCuit: dto.empresaCuit ?? null,
      empresaEmail: dto.empresaEmail ?? null,
      empresaTelefono: dto.empresaTelefono ?? null,
      empresaContacto: dto.empresaContacto ?? null,
      insurerId: dto.insurerId ?? null,
      totalMonto: total.toFixed(2),
      copagoPorc: dto.copagoPorc != null ? String(dto.copagoPorc) : null,
      validezDias: dto.validezDias ?? 30,
      observaciones: dto.observaciones ?? null,
      createdBy: userId,
    };

    // Pre-fetch UB snapshots for catalog items in parallel
    const insurerIdForUb = dto.insurerId ?? null;
    const snapshotMap = new Map<number, { ubsSnapshot: string | null; ubValueSnapshot: string | null }>();
    await Promise.all(
      dto.items
        .filter((item) => item.practiceId != null)
        .map(async (item) => {
          const { ubsSnapshot, ubValueSnapshot } = await this.precioParaPracticaConInfo(
            item.practiceId!,
            insurerIdForUb,
          );
          snapshotMap.set(item.practiceId!, { ubsSnapshot, ubValueSnapshot });
        }),
    );

    return this.db.transaction(async (tx) => {
      const [cot] = await tx.insert(cotizacion).values(newCot).returning();

      const itemValues: NewCotizacionItem[] = dto.items.map((item, idx) => {
        const snap = item.practiceId != null ? snapshotMap.get(item.practiceId) : undefined;
        return {
          cotizacionId: cot.id,
          practiceId: item.practiceId ?? null,
          practicaNombre: item.practicaNombre,
          ubsSnapshot: snap?.ubsSnapshot ?? null,
          ubValueSnapshot: snap?.ubValueSnapshot ?? null,
          precioUnitario: new Decimal(item.precioUnitario).toFixed(2),
          cantidad: item.cantidad,
          subtotal: new Decimal(item.precioUnitario).times(item.cantidad).toFixed(2),
          sort: item.sort ?? idx,
        };
      });

      const items = await tx.insert(cotizacionItem).values(itemValues).returning();

      return { ...cot, items, patientInfo: null, insurerInfo: null };
    });
  }

  async update(labId: number, id: number, dto: UpdateCotizacionDto): Promise<CotizacionDetalle> {
    const existing = await this.byId(labId, id);

    const patch: Partial<NewCotizacion> = {
      ...(dto.estado !== undefined && { estado: dto.estado }),
      ...(dto.validezDias !== undefined && { validezDias: dto.validezDias }),
      ...(dto.observaciones !== undefined && { observaciones: dto.observaciones }),
      ...(dto.insurerId !== undefined && { insurerId: dto.insurerId > 0 ? dto.insurerId : null }),
      ...(dto.copagoPorc !== undefined && { copagoPorc: dto.copagoPorc != null ? String(dto.copagoPorc) : null }),
      ...(dto.empresaNombre !== undefined && { empresaNombre: dto.empresaNombre }),
      ...(dto.empresaCuit !== undefined && { empresaCuit: dto.empresaCuit || null }),
      ...(dto.empresaEmail !== undefined && { empresaEmail: dto.empresaEmail || null }),
      ...(dto.empresaTelefono !== undefined && { empresaTelefono: dto.empresaTelefono || null }),
      ...(dto.empresaContacto !== undefined && { empresaContacto: dto.empresaContacto || null }),
      updatedAt: new Date(),
    };

    if (dto.items && dto.items.length > 0) {
      const total = dto.items.reduce((acc, item) => {
        return acc.plus(new Decimal(item.precioUnitario).times(item.cantidad));
      }, new Decimal(0));
      patch.totalMonto = total.toFixed(2);
    }

    // Pre-fetch UB snapshots for updated items
    const effectiveInsurerId = dto.insurerId !== undefined
      ? (dto.insurerId > 0 ? dto.insurerId : null)
      : existing.insurerId;

    const snapshotMap = new Map<number, { ubsSnapshot: string | null; ubValueSnapshot: string | null }>();
    if (dto.items && dto.items.length > 0) {
      await Promise.all(
        dto.items
          .filter((item) => item.practiceId != null)
          .map(async (item) => {
            const { ubsSnapshot, ubValueSnapshot } = await this.precioParaPracticaConInfo(
              item.practiceId!,
              effectiveInsurerId,
            );
            snapshotMap.set(item.practiceId!, { ubsSnapshot, ubValueSnapshot });
          }),
      );
    }

    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(cotizacion)
        .set(patch)
        .where(and(eq(cotizacion.id, id), eq(cotizacion.labId, labId)))
        .returning();

      let items = existing.items;

      if (dto.items && dto.items.length > 0) {
        await tx.delete(cotizacionItem).where(eq(cotizacionItem.cotizacionId, id));
        const itemValues: NewCotizacionItem[] = dto.items.map((item, idx) => {
          const snap = item.practiceId != null ? snapshotMap.get(item.practiceId) : undefined;
          return {
            cotizacionId: id,
            practiceId: item.practiceId ?? null,
            practicaNombre: item.practicaNombre,
            ubsSnapshot: snap?.ubsSnapshot ?? null,
            ubValueSnapshot: snap?.ubValueSnapshot ?? null,
            precioUnitario: new Decimal(item.precioUnitario).toFixed(2),
            cantidad: item.cantidad,
            subtotal: new Decimal(item.precioUnitario).times(item.cantidad).toFixed(2),
            sort: item.sort ?? idx,
          };
        });
        items = await tx.insert(cotizacionItem).values(itemValues).returning();
      }

      return {
        ...updated,
        items,
        patientInfo: existing.patientInfo,
        insurerInfo: existing.insurerInfo,
      };
    });
  }

  async remove(labId: number, id: number): Promise<void> {
    await this.byId(labId, id);
    await this.db
      .update(cotizacion)
      .set({ deletedAt: new Date() })
      .where(and(eq(cotizacion.id, id), eq(cotizacion.labId, labId)));
  }

  // ─── Nomenclador UB ────────────────────────────────────────────────────────

  /**
   * Devuelve el precio de una práctica según el tipo de receptor:
   * - Particular (insurerId null): precio_particular de la práctica (campo directo)
   * - Obra social: UBs de la práctica × valor UB vigente de la OS
   */
  async precioParaPracticaConInfo(
    practiceId: number,
    insurerId: number | null,
  ): Promise<{ precio: string | null; ubsSnapshot: string | null; ubValueSnapshot: string | null }> {
    const [pracRow] = await this.db
      .select({ units: practice.units, precioParticular: practice.precioParticular })
      .from(practice)
      .where(eq(practice.id, practiceId))
      .limit(1);

    if (!pracRow) return { precio: null, ubsSnapshot: null, ubValueSnapshot: null };

    // Particular: precio directo de la práctica, sin multiplicar por UBs
    if (insurerId === null) {
      return {
        precio: pracRow.precioParticular ?? null,
        ubsSnapshot: null,
        ubValueSnapshot: null,
      };
    }

    // Obra social: UBs × valor UB vigente
    const [ubRow] = await this.db
      .select({ value: ubValue.value })
      .from(ubValue)
      .where(and(eq(ubValue.insurerId, insurerId), isNull(ubValue.validTo)))
      .limit(1);

    const ubsSnapshot = pracRow.units ?? null;
    const ubValueSnapshot = ubRow?.value ?? null;

    if (!ubsSnapshot || !ubValueSnapshot) {
      return { precio: null, ubsSnapshot, ubValueSnapshot };
    }

    return {
      precio: new Decimal(ubsSnapshot).times(ubValueSnapshot).toFixed(2),
      ubsSnapshot,
      ubValueSnapshot,
    };
  }

  // ─── PDF data ───────────────────────────────────────────────────────────────

  async buildCatalogPdfData(labId: number): Promise<CatalogoPdfData> {
    const [[lab], practices, osRows] = await Promise.all([
      this.db.select().from(laboratorio).where(eq(laboratorio.id, labId)).limit(1),
      // Todas las prácticas raíz activas
      this.db
        .select({
          id: practice.id,
          name: practice.name,
          nbuCode: practice.nbuCode,
          units: practice.units,
          precioParticular: practice.precioParticular,
        })
        .from(practice)
        .where(and(eq(practice.active, true), isNull(practice.parentId)))
        .orderBy(asc(practice.name)),
      // Obras sociales activas con valor UB vigente (excluye PARTICULAR — tiene precio propio)
      this.db
        .select({
          insurerId: insurer.id,
          insurerName: insurer.name,
          insurerCode: insurer.code,
          ubVal: ubValue.value,
          ubFrom: ubValue.validFrom,
        })
        .from(insurer)
        .innerJoin(ubValue, and(eq(ubValue.insurerId, insurer.id), isNull(ubValue.validTo)))
        .where(and(eq(insurer.active, true), sql`${insurer.code} != 'PARTICULAR'`))
        .orderBy(asc(insurer.name)),
    ]);

    if (!lab) throw new NotFoundException('Laboratorio no encontrado');
    if (practices.length === 0) throw new NotFoundException('No hay prácticas activas configuradas');

    const sections: CatalogoPrecioSection[] = [];

    // Sección Particular: precio directo de cada práctica
    const particularItems = practices
      .filter((p) => p.precioParticular != null)
      .map((p) => ({
        practicaNombre: p.name,
        codigoNbu: p.nbuCode ?? null,
        ubs: null,
        precio: p.precioParticular!,
      }));
    if (particularItems.length > 0) {
      sections.push({ insurerName: 'Particular', valorUb: null, valorUbDesde: null, items: particularItems });
    }

    // Secciones por obra social: UBs × valor UB
    for (const row of osRows) {
      const items = practices
        .filter((p) => p.units != null)
        .map((p) => ({
          practicaNombre: p.name,
          codigoNbu: p.nbuCode ?? null,
          ubs: p.units,
          precio: new Decimal(p.units!).times(row.ubVal).toFixed(2),
        }));
      if (items.length === 0) continue;
      sections.push({
        insurerName: row.insurerName,
        valorUb: row.ubVal,
        valorUbDesde: row.ubFrom ? new Date(row.ubFrom as unknown as string).toISOString().slice(0, 10) : null,
        items,
      });
    }

    const { accent, accentSoft } = pdfAccentPalette(lab.primaryColor);
    const fecha = new Date().toLocaleDateString('es-AR', {
      timeZone: 'America/Argentina/Cordoba',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    return {
      fecha,
      lab: {
        legalName: lab.legalName,
        address: lab.streetAddress ?? '',
        cityProvince: [lab.city, lab.province].filter(Boolean).join(', '),
        phone: lab.phone,
        email: lab.email,
        logoSrc: lab.logoPath ?? null,
      },
      sections,
      accent,
      accentSoft,
    };
  }

  async buildPdfData(labId: number, id: number): Promise<CotizacionPdfData> {
    const detalle = await this.byId(labId, id);

    const [lab] = await this.db
      .select()
      .from(laboratorio)
      .where(eq(laboratorio.id, labId))
      .limit(1);

    if (!lab) throw new NotFoundException('Laboratorio no encontrado');

    const { accent, accentSoft } = pdfAccentPalette(lab.primaryColor);

    const fechaEmision = detalle.createdAt.toLocaleDateString('es-AR', {
      timeZone: 'America/Argentina/Cordoba',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    let receptorNombre: string;
    let receptorDni: string | null = null;
    let receptorCuit: string | null = null;
    let receptorEmail: string | null = null;
    let receptorTelefono: string | null = null;
    let receptorContacto: string | null = null;

    if (detalle.tipo === 'paciente' && detalle.patientInfo) {
      receptorNombre = `${detalle.patientInfo.lastName}, ${detalle.patientInfo.firstName}`;
      receptorDni = detalle.patientInfo.dni;
    } else if (detalle.tipo === 'empresa') {
      receptorNombre = detalle.empresaNombre ?? '—';
      receptorCuit = detalle.empresaCuit ?? null;
      receptorEmail = detalle.empresaEmail ?? null;
      receptorTelefono = detalle.empresaTelefono ?? null;
      receptorContacto = detalle.empresaContacto ?? null;
    } else {
      // generica: sin destinatario específico
      receptorNombre = '';
    }

    const totalDecimal = new Decimal(detalle.totalMonto);
    const copagoPorc = detalle.copagoPorc ? new Decimal(detalle.copagoPorc) : null;
    const totalCopago = copagoPorc ? totalDecimal.times(copagoPorc).dividedBy(100).toFixed(2) : null;
    const totalOs = copagoPorc ? totalDecimal.minus(totalCopago!).toFixed(2) : null;

    return {
      cotizacionId: detalle.id,
      fechaEmision,
      validezDias: detalle.validezDias,
      estado: detalle.estado,
      tipo: detalle.tipo,
      receptorNombre,
      receptorDni,
      receptorCuit,
      receptorEmail,
      receptorTelefono,
      receptorContacto,
      obraSocialNombre: detalle.insurerInfo?.name ?? null,
      copagoPorc: detalle.copagoPorc ?? null,
      totalCopago,
      totalOs,
      items: detalle.items.map((item) => ({
        practicaNombre: item.practicaNombre,
        ubsSnapshot: item.ubsSnapshot ?? null,
        ubValueSnapshot: item.ubValueSnapshot ?? null,
        precioUnitario: item.precioUnitario,
        cantidad: item.cantidad,
        subtotal: item.subtotal,
      })),
      totalMonto: detalle.totalMonto,
      observaciones: detalle.observaciones,
      lab: {
        legalName: lab.legalName,
        address: lab.streetAddress ?? '',
        cityProvince: [lab.city, lab.province].filter(Boolean).join(', '),
        phone: lab.phone,
        email: lab.email,
        logoSrc: lab.logoPath ?? null,
      },
      accent,
      accentSoft,
    };
  }
}
