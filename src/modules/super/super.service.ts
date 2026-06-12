import type { Db } from '@/db/client';
import { DATABASE } from '@/db/database.module';
import { laboratorio } from '@/db/schema';
import { RESERVED_SLUGS } from '@/domain/slug/reserved-slugs';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { CreateLaboratorioDto, UpdateLaboratorioDto } from './dto/create-laboratorio.dto';

@Injectable()
export class SuperService {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  list() {
    return this.db.select().from(laboratorio).orderBy(laboratorio.legalName);
  }

  async findOne(id: number) {
    const [row] = await this.db.select().from(laboratorio).where(eq(laboratorio.id, id)).limit(1);
    if (!row) throw new NotFoundException(`Laboratorio ${id} no encontrado`);
    return row;
  }

  async create(dto: CreateLaboratorioDto) {
    this.assertSlugNotReserved(dto.slug);
    try {
      const [row] = await this.db
        .insert(laboratorio)
        .values({
          slug: dto.slug,
          legalName: dto.legalName,
          shortName: dto.shortName ?? null,
          cuit: dto.cuit ?? null,
          streetAddress: dto.streetAddress ?? null,
          city: dto.city ?? 'Santa Fe',
          province: dto.province ?? 'Santa Fe',
          phone: dto.phone ?? null,
          email: dto.email ?? null,
          signingProfessionalName: dto.signingProfessionalName ?? null,
          signingProfessionalMp: dto.signingProfessionalMp ?? null,
        })
        .returning();
      return row;
    } catch (err: unknown) {
      const pg = err as { code?: string };
      if (pg.code === '23505') throw new ConflictException(`El slug '${dto.slug}' ya existe`);
      throw err;
    }
  }

  async update(id: number, dto: UpdateLaboratorioDto) {
    if (dto.slug !== undefined) this.assertSlugNotReserved(dto.slug);
    await this.findOne(id);
    const patch = {
      ...dto,
      ...(dto.primaryColor !== undefined && dto.primaryColor !== null
        ? { primaryColor: dto.primaryColor.toLowerCase() }
        : {}),
      updatedAt: new Date(),
    };
    try {
      const [row] = await this.db
        .update(laboratorio)
        .set(patch)
        .where(eq(laboratorio.id, id))
        .returning();
      return row;
    } catch (err: unknown) {
      const pg = err as { code?: string };
      if (pg.code === '23505') throw new ConflictException(`El slug '${dto.slug}' ya existe`);
      throw err;
    }
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.db.delete(laboratorio).where(eq(laboratorio.id, id));
  }

  private assertSlugNotReserved(slug: string): void {
    if ((RESERVED_SLUGS as readonly string[]).includes(slug)) {
      throw new BadRequestException(
        `El slug '${slug}' está reservado por el sistema y no puede ser usado`,
      );
    }
  }
}
