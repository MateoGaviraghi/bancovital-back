import type { Db } from '@/db/client';
import { DATABASE } from '@/db/database.module';
import { muestraAgua, solicitanteAgua } from '@/db/schema';
import type { MuestraAgua } from '@/db/schema';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import type { CreateMuestraAguaDto } from './dto/create-muestra-agua.dto';
import type { UpdateMuestraAguaDto } from './dto/update-muestra-agua.dto';

export interface MuestraAguaWithSolicitante extends MuestraAgua {
  solicitante: { id: number; nombreApellido: string; razonSocial: string | null };
}

@Injectable()
export class MuestrasAguaService {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  async list(labId: number): Promise<MuestraAguaWithSolicitante[]> {
    const rows = await this.db
      .select({
        muestra: muestraAgua,
        solNombre: solicitanteAgua.nombreApellido,
        solRazon: solicitanteAgua.razonSocial,
      })
      .from(muestraAgua)
      .innerJoin(solicitanteAgua, eq(solicitanteAgua.id, muestraAgua.solicitanteId))
      .where(and(eq(muestraAgua.labId, labId), eq(solicitanteAgua.labId, labId)))
      .orderBy(desc(muestraAgua.createdAt));

    return rows.map((r) => ({
      ...r.muestra,
      solicitante: {
        id: r.muestra.solicitanteId,
        nombreApellido: r.solNombre,
        razonSocial: r.solRazon,
      },
    }));
  }

  async findById(labId: number, id: number): Promise<MuestraAgua> {
    const [row] = await this.db
      .select()
      .from(muestraAgua)
      .where(and(eq(muestraAgua.id, id), eq(muestraAgua.labId, labId)))
      .limit(1);
    if (!row) throw new NotFoundException(`Muestra ${id} no encontrada`);
    return row;
  }

  private async assertSolicitante(labId: number, solicitanteId: number): Promise<void> {
    const [row] = await this.db
      .select({ id: solicitanteAgua.id })
      .from(solicitanteAgua)
      .where(and(eq(solicitanteAgua.id, solicitanteId), eq(solicitanteAgua.labId, labId)))
      .limit(1);
    if (!row) throw new NotFoundException('Solicitante de agua no encontrado');
  }

  async create(labId: number, dto: CreateMuestraAguaDto): Promise<MuestraAgua> {
    await this.assertSolicitante(labId, dto.solicitanteId);
    const [row] = await this.db
      .insert(muestraAgua)
      .values({
        labId,
        solicitanteId: dto.solicitanteId,
        fechaToma: new Date(dto.fechaToma),
        fechaRecepcion: new Date(dto.fechaRecepcion),
        tipoMuestra: dto.tipoMuestra,
        lugarToma: dto.lugarToma ?? null,
        descripcionPunto: dto.descripcionPunto ?? null,
        direccionPunto: dto.direccionPunto ?? null,
        localidadPunto: dto.localidadPunto ?? null,
        motivoAnalisis: dto.motivoAnalisis,
        recipienteAdecuado: dto.recipienteAdecuado ?? false,
        recipienteEsteril: dto.recipienteEsteril ?? false,
        conservacionTransporte: dto.conservacionTransporte ?? null,
        temperaturaRecepcion: dto.temperaturaRecepcion?.toString() ?? null,
        volumenRecibido: dto.volumenRecibido ?? null,
        muestraApta: dto.muestraApta ?? true,
        observacionesRecepcion: dto.observacionesRecepcion ?? null,
        analisisFisicoquimico: dto.analisisFisicoquimico ?? false,
        analisisMicrobiologico: dto.analisisMicrobiologico ?? false,
        observaciones: dto.observaciones ?? null,
      })
      .returning();
    return row;
  }

  async update(labId: number, id: number, dto: UpdateMuestraAguaDto): Promise<MuestraAgua> {
    await this.findById(labId, id);
    if (dto.solicitanteId !== undefined) await this.assertSolicitante(labId, dto.solicitanteId);
    const [row] = await this.db
      .update(muestraAgua)
      .set({
        ...(dto.solicitanteId !== undefined && { solicitanteId: dto.solicitanteId }),
        ...(dto.fechaToma !== undefined && { fechaToma: new Date(dto.fechaToma) }),
        ...(dto.fechaRecepcion !== undefined && { fechaRecepcion: new Date(dto.fechaRecepcion) }),
        ...(dto.tipoMuestra !== undefined && { tipoMuestra: dto.tipoMuestra }),
        ...(dto.lugarToma !== undefined && { lugarToma: dto.lugarToma ?? null }),
        ...(dto.descripcionPunto !== undefined && { descripcionPunto: dto.descripcionPunto ?? null }),
        ...(dto.direccionPunto !== undefined && { direccionPunto: dto.direccionPunto ?? null }),
        ...(dto.localidadPunto !== undefined && { localidadPunto: dto.localidadPunto ?? null }),
        ...(dto.motivoAnalisis !== undefined && { motivoAnalisis: dto.motivoAnalisis }),
        ...(dto.recipienteAdecuado !== undefined && { recipienteAdecuado: dto.recipienteAdecuado }),
        ...(dto.recipienteEsteril !== undefined && { recipienteEsteril: dto.recipienteEsteril }),
        ...(dto.conservacionTransporte !== undefined && { conservacionTransporte: dto.conservacionTransporte ?? null }),
        ...(dto.temperaturaRecepcion !== undefined && { temperaturaRecepcion: dto.temperaturaRecepcion?.toString() ?? null }),
        ...(dto.volumenRecibido !== undefined && { volumenRecibido: dto.volumenRecibido ?? null }),
        ...(dto.muestraApta !== undefined && { muestraApta: dto.muestraApta }),
        ...(dto.observacionesRecepcion !== undefined && { observacionesRecepcion: dto.observacionesRecepcion ?? null }),
        ...(dto.analisisFisicoquimico !== undefined && { analisisFisicoquimico: dto.analisisFisicoquimico }),
        ...(dto.analisisMicrobiologico !== undefined && { analisisMicrobiologico: dto.analisisMicrobiologico }),
        ...(dto.observaciones !== undefined && { observaciones: dto.observaciones ?? null }),
        updatedAt: new Date(),
      })
      .where(and(eq(muestraAgua.id, id), eq(muestraAgua.labId, labId)))
      .returning();
    return row;
  }

  async remove(labId: number, id: number): Promise<void> {
    await this.findById(labId, id);
    await this.db
      .delete(muestraAgua)
      .where(and(eq(muestraAgua.id, id), eq(muestraAgua.labId, labId)));
  }
}
