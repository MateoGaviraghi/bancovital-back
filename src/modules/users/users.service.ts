import { type Session, USER_ROLES, type UserRole } from '@/auth/session';
import { TenantService } from '@/auth/tenant.service';
import { AppConfig } from '@/config';
import type { Db } from '@/db/client';
import { DATABASE, SUPABASE_ADMIN } from '@/db/database.module';
import { type User, user } from '@/db/schema';
import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { and, eq } from 'drizzle-orm';
import type { InviteUserDto } from './dto/invite-user.dto';

export interface AdminUser {
  id: string;
  email: string;
  role: UserRole | null;
  displayName: string | null;
  matricula: string | null;
  active: boolean;
  labId: number | null;
  createdAt: string;
  lastSignInAt: string | null;
}

const BAN_DURATION_FOREVER = '876000h';

@Injectable()
export class UsersService {
  constructor(
    @Inject(DATABASE) private readonly db: Db,
    @Inject(SUPABASE_ADMIN) private readonly admin: SupabaseClient,
    private readonly tenantService: TenantService,
    private readonly appConfig: AppConfig,
  ) {}

  async list(labId: number): Promise<AdminUser[]> {
    const projectRows = await this.db.select().from(user).where(eq(user.labId, labId));

    const userIds = new Set(projectRows.map((r) => r.id));

    const { data, error } = await this.admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) {
      throw new InternalServerErrorException(`listUsers fallo: ${error.message}`);
    }

    const projectById = new Map(projectRows.map((r) => [r.id, r]));

    return data.users
      .filter((u) => userIds.has(u.id))
      .map((u) => {
        const proj = projectById.get(u.id);
        const role = readRole(u.app_metadata);
        const userMeta = (u.user_metadata ?? {}) as { display_name?: unknown };
        const fallbackName =
          typeof userMeta.display_name === 'string' ? userMeta.display_name : null;
        return {
          id: u.id,
          email: u.email ?? '',
          role,
          displayName: proj?.displayName ?? fallbackName,
          matricula: proj?.matricula ?? null,
          active: proj ? proj.active : true,
          labId: proj?.labId ?? labId,
          createdAt: u.created_at ?? new Date(0).toISOString(),
          lastSignInAt: u.last_sign_in_at ?? null,
        };
      });
  }

  async invite(labId: number, dto: InviteUserDto): Promise<AdminUser> {
    const redirectTo = dto.redirectTo ?? `${this.appConfig.env.APP_URL}/auth/set-password`;
    const invite = await this.admin.auth.admin.inviteUserByEmail(dto.email, {
      data: dto.displayName ? { display_name: dto.displayName } : undefined,
      redirectTo,
    });
    if (invite.error || !invite.data.user) {
      throw new ConflictException(
        `No se pudo invitar a ${dto.email}: ${invite.error?.message ?? 'unknown'}`,
      );
    }

    const userId = invite.data.user.id;

    // Invariante: role 'super' opera cross-tenant => nunca queda atado a un lab.
    const effectiveLabId = dto.role === 'super' ? null : labId;

    const updated = await this.admin.auth.admin.updateUserById(userId, {
      app_metadata: { role: dto.role },
    });
    if (updated.error) {
      throw new InternalServerErrorException(`No se pudo asignar rol: ${updated.error.message}`);
    }

    const [row] = await this.db
      .insert(user)
      .values({
        id: userId,
        labId: effectiveLabId,
        email: dto.email,
        displayName: dto.displayName ?? null,
        role: dto.role,
        matricula: dto.role === 'bioquimico' ? (dto.matricula ?? null) : null,
        active: true,
      })
      .onConflictDoUpdate({
        target: user.id,
        set: {
          labId: effectiveLabId,
          email: dto.email,
          displayName: dto.displayName ?? null,
          role: dto.role,
          matricula: dto.role === 'bioquimico' ? (dto.matricula ?? null) : null,
          active: true,
        },
      })
      .returning();

    return {
      id: row.id,
      email: row.email,
      role: row.role,
      displayName: row.displayName,
      matricula: row.matricula,
      active: row.active,
      labId: row.labId,
      createdAt: row.createdAt.toISOString(),
      lastSignInAt: null,
    };
  }

  async setRole(labId: number, targetId: string, role: UserRole, current: Session): Promise<User> {
    if (!USER_ROLES.includes(role)) {
      throw new ConflictException(`Rol invalido: ${role}`);
    }
    if (targetId === current.userId && role !== 'admin') {
      throw new ConflictException('No podes cambiar tu propio rol a uno no-admin');
    }

    await this.ensureUserInLab(labId, targetId);

    const { error } = await this.admin.auth.admin.updateUserById(targetId, {
      app_metadata: { role },
    });
    if (error) {
      if (error.status === 404) throw new NotFoundException('Usuario no encontrado');
      throw new InternalServerErrorException(`No se pudo cambiar rol: ${error.message}`);
    }

    // Invariante: si se promueve a 'super', el row no puede quedar atado a un lab.
    const [row] = await this.db
      .update(user)
      .set(role === 'super' ? { role, labId: null } : { role })
      .where(and(eq(user.id, targetId), eq(user.labId, labId)))
      .returning();
    if (!row) {
      throw new NotFoundException('Usuario no tiene mirror en public.user');
    }

    this.tenantService.invalidate(targetId);
    return row;
  }

  async setActive(
    labId: number,
    targetId: string,
    active: boolean,
    current: Session,
  ): Promise<User> {
    if (targetId === current.userId && !active) {
      throw new ConflictException('No podes desactivar tu propia cuenta');
    }

    await this.ensureUserInLab(labId, targetId);

    const banDuration = active ? 'none' : BAN_DURATION_FOREVER;
    const { error } = await this.admin.auth.admin.updateUserById(targetId, {
      ban_duration: banDuration,
    } as Parameters<SupabaseClient['auth']['admin']['updateUserById']>[1]);
    if (error) {
      if (error.status === 404) throw new NotFoundException('Usuario no encontrado');
      throw new InternalServerErrorException(`No se pudo actualizar estado: ${error.message}`);
    }

    const [row] = await this.db
      .update(user)
      .set({ active })
      .where(and(eq(user.id, targetId), eq(user.labId, labId)))
      .returning();
    if (!row) {
      throw new NotFoundException('Usuario no tiene mirror en public.user');
    }

    this.tenantService.invalidate(targetId);
    return row;
  }

  async deleteUser(labId: number, targetId: string, current: Session): Promise<void> {
    if (targetId === current.userId) {
      throw new ConflictException('No podés eliminar tu propia cuenta');
    }
    await this.ensureUserInLab(labId, targetId);

    const { error } = await this.admin.auth.admin.deleteUser(targetId);
    if (error) {
      if (error.status === 404) throw new NotFoundException('Usuario no encontrado');
      throw new InternalServerErrorException(`No se pudo eliminar el usuario: ${error.message}`);
    }

    await this.db.delete(user).where(and(eq(user.id, targetId), eq(user.labId, labId)));
    this.tenantService.invalidate(targetId);
  }

  private async ensureUserInLab(labId: number, targetId: string): Promise<void> {
    const [row] = await this.db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.id, targetId), eq(user.labId, labId)))
      .limit(1);
    if (!row) throw new NotFoundException('Usuario no encontrado en este laboratorio');
  }
}

function readRole(appMetadata: unknown): UserRole | null {
  if (!appMetadata || typeof appMetadata !== 'object') return null;
  const candidate = (appMetadata as { role?: unknown }).role;
  if (typeof candidate !== 'string') return null;
  return (USER_ROLES as readonly string[]).includes(candidate) ? (candidate as UserRole) : null;
}
