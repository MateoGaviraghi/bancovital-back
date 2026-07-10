import type { Db } from '@/db/client';
import { DATABASE } from '@/db/database.module';
import {
  cotizacion,
  cotizacionItem,
  cotizacionPrecio,
  insurer,
  laboratorio,
  patient,
  practice,
  ubValue,
  type Cotizacion,
  type CotizacionItem,
  type CotizacionPrecio,
  type NewCotizacion,
  type NewCotizacionItem,
  type NewCotizacionPrecio,
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
import type { UpsertPrecioDto } from './dto/upsert-precio.dto';

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
      validezDias: dto.validezDias ?? 30,
      observaciones: dto.observaciones ?? null,
      createdBy: userId,
    };

    return this.db.transaction(async (tx) => {
      const [cot] = await tx.insert(cotizacion).values(newCot).returning();

      const itemValues: NewCotizacionItem[] = dto.items.map((item, idx) => ({
        cotizacionId: cot.id,
        practiceId: item.practiceId ?? null,
        practicaNombre: item.practicaNombre,
        precioUnitario: new Decimal(item.precioUnitario).toFixed(2),
        cantidad: item.cantidad,
        subtotal: new Decimal(item.precioUnitario).times(item.cantidad).toFixed(2),
        sort: item.sort ?? idx,
      }));

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

    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(cotizacion)
        .set(patch)
        .where(and(eq(cotizacion.id, id), eq(cotizacion.labId, labId)))
        .returning();

      let items = existing.items;

      if (dto.items && dto.items.length > 0) {
        await tx.delete(cotizacionItem).where(eq(cotizacionItem.cotizacionId, id));
        const itemValues: NewCotizacionItem[] = dto.items.map((item, idx) => ({
          cotizacionId: id,
          practiceId: item.practiceId ?? null,
          practicaNombre: item.practicaNombre,
          precioUnitario: new Decimal(item.precioUnitario).toFixed(2),
          cantidad: item.cantidad,
          subtotal: new Decimal(item.precioUnitario).times(item.cantidad).toFixed(2),
          sort: item.sort ?? idx,
        }));
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

  // ─── Catálogo de precios ────────────────────────────────────────────────────

  async listPrecios(labId: number, insurerId?: number): Promise<Array<CotizacionPrecio & { practicaNombre: string }>> {
    const conditions = [eq(cotizacionPrecio.labId, labId)];
    if (insurerId !== undefined) {
      if (insurerId === 0) {
        conditions.push(isNull(cotizacionPrecio.insurerId));
      } else {
        conditions.push(eq(cotizacionPrecio.insurerId, insurerId));
      }
    }

    const rows = await this.db
      .select({ cp: cotizacionPrecio, practicaNombre: practice.name })
      .from(cotizacionPrecio)
      .innerJoin(practice, eq(practice.id, cotizacionPrecio.practiceId))
      .where(and(...conditions))
      .orderBy(asc(practice.name));

    return rows.map((r) => ({ ...r.cp, practicaNombre: r.practicaNombre }));
  }

  async upsertPrecio(labId: number, dto: UpsertPrecioDto): Promise<CotizacionPrecio> {
    const values: NewCotizacionPrecio = {
      labId,
      practiceId: dto.practiceId,
      insurerId: dto.insurerId ?? null,
      precio: new Decimal(dto.precio).toFixed(2),
    };

    const [existing] = await this.db
      .select({ id: cotizacionPrecio.id })
      .from(cotizacionPrecio)
      .where(
        and(
          eq(cotizacionPrecio.labId, labId),
          eq(cotizacionPrecio.practiceId, dto.practiceId),
          dto.insurerId
            ? eq(cotizacionPrecio.insurerId, dto.insurerId)
            : isNull(cotizacionPrecio.insurerId),
        ),
      )
      .limit(1);

    if (existing) {
      const [row] = await this.db
        .update(cotizacionPrecio)
        .set({ precio: values.precio, updatedAt: new Date() })
        .where(eq(cotizacionPrecio.id, existing.id))
        .returning();
      return row;
    }

    const [row] = await this.db.insert(cotizacionPrecio).values(values).returning();
    return row;
  }

  async deletePrecio(labId: number, id: number): Promise<void> {
    const [row] = await this.db
      .select({ id: cotizacionPrecio.id })
      .from(cotizacionPrecio)
      .where(and(eq(cotizacionPrecio.id, id), eq(cotizacionPrecio.labId, labId)))
      .limit(1);
    if (!row) throw new NotFoundException('Precio no encontrado');
    await this.db.delete(cotizacionPrecio).where(eq(cotizacionPrecio.id, id));
  }

  /** Precio de una práctica para una obra social (o particular si insurerId = null).
   *  Si no hay precio en el catálogo y la obra social es Particular, cae en UB × valor UB PARTICULAR. */
  async precioParaPractica(labId: number, practiceId: number, insurerId: number | null): Promise<string | null> {
    // 1. Buscar precio explícito en catálogo
    const [row] = await this.db
      .select({ precio: cotizacionPrecio.precio })
      .from(cotizacionPrecio)
      .where(
        and(
          eq(cotizacionPrecio.labId, labId),
          eq(cotizacionPrecio.practiceId, practiceId),
          insurerId ? eq(cotizacionPrecio.insurerId, insurerId) : isNull(cotizacionPrecio.insurerId),
        ),
      )
      .limit(1);

    if (row) return row.precio;

    // 2. Fallback: si es Particular, calcular UB × valorUB PARTICULAR
    if (insurerId !== null) return null;

    const [pracRow] = await this.db
      .select({ units: practice.units })
      .from(practice)
      .where(eq(practice.id, practiceId))
      .limit(1);

    if (!pracRow?.units) return null;

    const [ubRow] = await this.db
      .select({ value: ubValue.value })
      .from(ubValue)
      .innerJoin(insurer, eq(insurer.id, ubValue.insurerId))
      .where(and(eq(insurer.code, 'PARTICULAR'), isNull(ubValue.validTo)))
      .limit(1);

    if (!ubRow) return null;

    return new Decimal(pracRow.units).times(ubRow.value).toFixed(2);
  }

  // ─── PDF data ───────────────────────────────────────────────────────────────

  async buildCatalogPdfData(labId: number): Promise<CatalogoPdfData> {
    const [lab] = await this.db.select().from(laboratorio).where(eq(laboratorio.id, labId)).limit(1);
    if (!lab) throw new NotFoundException('Laboratorio no encontrado');

    const rows = await this.db
      .select({
        cp: cotizacionPrecio,
        practicaNombre: practice.name,
        insurerName: insurer.name,
      })
      .from(cotizacionPrecio)
      .innerJoin(practice, eq(practice.id, cotizacionPrecio.practiceId))
      .leftJoin(insurer, eq(insurer.id, cotizacionPrecio.insurerId))
      .where(eq(cotizacionPrecio.labId, labId))
      .orderBy(asc(insurer.name), asc(practice.name));

    const sectionMap = new Map<string, Array<{ practicaNombre: string; precio: string }>>();
    for (const row of rows) {
      const key = row.insurerName ?? '__particular__';
      if (!sectionMap.has(key)) sectionMap.set(key, []);
      sectionMap.get(key)!.push({ practicaNombre: row.practicaNombre, precio: row.cp.precio });
    }

    const sections: CatalogoPrecioSection[] = [];
    const particulares = sectionMap.get('__particular__');
    if (particulares) sections.push({ insurerName: 'Particular', items: particulares });
    for (const key of [...sectionMap.keys()].filter((k) => k !== '__particular__').sort()) {
      sections.push({ insurerName: key, items: sectionMap.get(key)! });
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
    } else {
      receptorNombre = detalle.empresaNombre ?? '—';
      receptorCuit = detalle.empresaCuit ?? null;
      receptorEmail = detalle.empresaEmail ?? null;
      receptorTelefono = detalle.empresaTelefono ?? null;
      receptorContacto = detalle.empresaContacto ?? null;
    }

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
      items: detalle.items.map((item) => ({
        practicaNombre: item.practicaNombre,
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
