import type { Db } from '@/db/client';
import { DATABASE } from '@/db/database.module';
import { type LabPracticeConfig, labPracticeConfig } from '@/db/schema';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { UpdateLabPracticeConfigDto } from './dto/update-lab-practice-config.dto';

@Injectable()
export class LabPracticeConfigService {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  async get(labId: number, practiceId: number): Promise<LabPracticeConfig | null> {
    const [row] = await this.db
      .select()
      .from(labPracticeConfig)
      .where(and(eq(labPracticeConfig.labId, labId), eq(labPracticeConfig.practiceId, practiceId)))
      .limit(1);
    return row ?? null;
  }

  async upsert(
    labId: number,
    practiceId: number,
    dto: UpdateLabPracticeConfigDto,
  ): Promise<LabPracticeConfig> {
    const existing = await this.get(labId, practiceId);

    if (existing) {
      const set: Record<string, unknown> = { updatedAt: new Date() };
      if (dto.methodology !== undefined) set.methodology = dto.methodology?.trim() || null;
      if (dto.referenceValue !== undefined) set.referenceValue = dto.referenceValue?.trim() || null;
      if (dto.notes !== undefined) set.notes = dto.notes?.trim() || null;

      const [row] = await this.db
        .update(labPracticeConfig)
        .set(set)
        .where(eq(labPracticeConfig.id, existing.id))
        .returning();
      return row;
    }

    const [row] = await this.db
      .insert(labPracticeConfig)
      .values({
        labId,
        practiceId,
        methodology: dto.methodology?.trim() || null,
        referenceValue: dto.referenceValue?.trim() || null,
        notes: dto.notes?.trim() || null,
      })
      .returning();
    return row;
  }
}
