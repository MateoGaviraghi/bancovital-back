import type { Db } from '@/db/client';
import { DATABASE } from '@/db/database.module';
import { order, servicio } from '@/db/schema';
import type { NewServicio, Servicio } from '@/db/schema';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { CreateServicioDto } from './dto/create-servicio.dto';
import type { UpdateServicioDto } from './dto/update-servicio.dto';

function slugify(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class ServiciosService {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  async list(labId: number): Promise<Servicio[]> {
    return this.db
      .select()
      .from(servicio)
      .where(and(eq(servicio.labId, labId), eq(servicio.activo, true)))
      .orderBy(asc(servicio.orden), asc(servicio.id));
  }

  async listAll(labId: number): Promise<Servicio[]> {
    return this.db
      .select()
      .from(servicio)
      .where(eq(servicio.labId, labId))
      .orderBy(asc(servicio.orden), asc(servicio.id));
  }

  async findById(labId: number, id: number): Promise<Servicio> {
    const [row] = await this.db
      .select()
      .from(servicio)
      .where(and(eq(servicio.id, id), eq(servicio.labId, labId)))
      .limit(1);
    if (!row) throw new NotFoundException(`Servicio ${id} no encontrado`);
    return row;
  }

  async create(labId: number, dto: CreateServicioDto): Promise<Servicio> {
    const slug = dto.slug || slugify(dto.nombre);

    const [existing] = await this.db
      .select({ id: servicio.id })
      .from(servicio)
      .where(and(eq(servicio.labId, labId), eq(servicio.slug, slug)))
      .limit(1);
    if (existing) {
      throw new ConflictException(`Ya existe un servicio con slug "${slug}" en este laboratorio`);
    }

    const values: NewServicio = {
      labId,
      nombre: dto.nombre,
      slug,
      icono: dto.icono ?? null,
      orden: dto.orden ?? 0,
      usaPacienteHumano: dto.usaPacienteHumano ?? false,
      usaPacienteAnimal: dto.usaPacienteAnimal ?? false,
      usaMedico: dto.usaMedico ?? false,
      usaVeterinario: dto.usaVeterinario ?? false,
      usaPropietario: dto.usaPropietario ?? false,
      usaSolicitanteAgua: dto.usaSolicitanteAgua ?? false,
      usaMuestraAgua: dto.usaMuestraAgua ?? false,
      formConfig: dto.formConfig ?? null,
    };
    const [row] = await this.db.insert(servicio).values(values).returning();
    return row;
  }

  async update(labId: number, id: number, dto: UpdateServicioDto): Promise<Servicio> {
    await this.findById(labId, id);

    if (dto.slug) {
      const [dup] = await this.db
        .select({ id: servicio.id })
        .from(servicio)
        .where(
          and(
            eq(servicio.labId, labId),
            eq(servicio.slug, dto.slug),
            sql`${servicio.id} != ${id}`,
          ),
        )
        .limit(1);
      if (dup) {
        throw new ConflictException(`Ya existe un servicio con slug "${dto.slug}"`);
      }
    }

    const [row] = await this.db
      .update(servicio)
      .set({
        ...(dto.nombre !== undefined && { nombre: dto.nombre }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.icono !== undefined && { icono: dto.icono }),
        ...(dto.orden !== undefined && { orden: dto.orden }),
        ...(dto.usaPacienteHumano !== undefined && { usaPacienteHumano: dto.usaPacienteHumano }),
        ...(dto.usaPacienteAnimal !== undefined && { usaPacienteAnimal: dto.usaPacienteAnimal }),
        ...(dto.usaMedico !== undefined && { usaMedico: dto.usaMedico }),
        ...(dto.usaVeterinario !== undefined && { usaVeterinario: dto.usaVeterinario }),
        ...(dto.usaPropietario !== undefined && { usaPropietario: dto.usaPropietario }),
        ...(dto.usaSolicitanteAgua !== undefined && { usaSolicitanteAgua: dto.usaSolicitanteAgua }),
        ...(dto.usaMuestraAgua !== undefined && { usaMuestraAgua: dto.usaMuestraAgua }),
        ...(dto.formConfig !== undefined && { formConfig: dto.formConfig }),
        updatedAt: new Date(),
      })
      .where(and(eq(servicio.id, id), eq(servicio.labId, labId)))
      .returning();
    return row;
  }

  async setActive(labId: number, id: number, activo: boolean): Promise<Servicio> {
    await this.findById(labId, id);
    const [row] = await this.db
      .update(servicio)
      .set({ activo, updatedAt: new Date() })
      .where(and(eq(servicio.id, id), eq(servicio.labId, labId)))
      .returning();
    return row;
  }

  async remove(labId: number, id: number): Promise<void> {
    await this.findById(labId, id);

    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(order)
      .where(eq(order.servicioId, id));
    if (count > 0) {
      throw new ConflictException(
        `No se puede eliminar: hay ${count} orden(es) asociada(s) a este servicio. Desactivalo en su lugar.`,
      );
    }

    await this.db
      .delete(servicio)
      .where(and(eq(servicio.id, id), eq(servicio.labId, labId)));
  }

  async seedDefaults(labId: number): Promise<Servicio[]> {
    const defaults: Array<Omit<NewServicio, 'labId'>> = [
      {
        nombre: 'Humana',
        slug: 'humana',
        icono: 'stethoscope',
        orden: 0,
        usaPacienteHumano: true,
        usaMedico: true,
      },
      {
        nombre: 'Veterinaria',
        slug: 'veterinaria',
        icono: 'paw-print',
        orden: 1,
        usaPacienteAnimal: true,
        usaVeterinario: true,
        usaPropietario: true,
      },
      {
        nombre: 'Agua y efluentes',
        slug: 'agua-efluentes',
        icono: 'droplets',
        orden: 2,
        usaSolicitanteAgua: true,
        usaMuestraAgua: true,
      },
    ];

    const results: Servicio[] = [];
    for (const d of defaults) {
      const [existing] = await this.db
        .select()
        .from(servicio)
        .where(and(eq(servicio.labId, labId), eq(servicio.slug, d.slug!)))
        .limit(1);
      if (existing) {
        results.push(existing);
      } else {
        const [row] = await this.db
          .insert(servicio)
          .values({ ...d, labId })
          .returning();
        results.push(row);
      }
    }
    return results;
  }
}
