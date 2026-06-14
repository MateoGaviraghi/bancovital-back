import type { Session } from '@/auth/session';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { sniffImageMime } from '../lab-config/asset-storage';
import { LabConfigService } from '../lab-config/lab-config.service';
import { InviteUserDto } from '../users/dto/invite-user.dto';
import { UsersService } from '../users/users.service';
import { CreateLaboratorioDto, UpdateLaboratorioDto } from './dto/create-laboratorio.dto';
import { SuperService } from './super.service';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

interface RequestMeta {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}

function clientIp(req: RequestMeta): string | null {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) {
    const first = Array.isArray(fwd) ? fwd[0] : fwd.split(',')[0];
    if (first) return first.trim();
  }
  return req.ip ?? req.socket?.remoteAddress ?? null;
}

function userAgent(req: RequestMeta): string | null {
  const ua = req.headers['user-agent'];
  if (!ua) return null;
  return Array.isArray(ua) ? (ua[0] ?? null) : ua;
}

@ApiTags('super')
@ApiBearerAuth()
@Controller('super/labs')
@Roles('super')
export class SuperController {
  constructor(
    private readonly superService: SuperService,
    private readonly usersService: UsersService,
    private readonly labConfig: LabConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar todos los laboratorios (solo superusuario)' })
  list() {
    return this.superService.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un laboratorio' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.superService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear nuevo laboratorio (tenant)' })
  create(@Body() dto: CreateLaboratorioDto) {
    return this.superService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar datos de un laboratorio' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLaboratorioDto) {
    return this.superService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Desactivar laboratorio (soft-delete, reversible)' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: Session,
    @Req() req: RequestMeta,
  ) {
    return this.superService.remove(id, {
      actorId: user.userId,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
  }

  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspender laboratorio (estado=suspendido, reversible)' })
  async suspend(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: Session,
    @Req() req: RequestMeta,
  ) {
    return this.superService.suspend(id, {
      actorId: user.userId,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
  }

  @Post(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reactivar laboratorio previamente desactivado' })
  async reactivate(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: Session,
    @Req() req: RequestMeta,
  ) {
    return this.superService.reactivate(id, {
      actorId: user.userId,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
  }

  @Delete(':id/purge')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Borrado físico total de un laboratorio desactivado (irreversible)' })
  async purge(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: Session,
    @Req() req: RequestMeta,
  ) {
    await this.superService.purge(id, {
      actorId: user.userId,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
  }

  @Get(':id/export')
  @ApiOperation({ summary: 'Exportar todos los datos de un laboratorio (backup / offboarding)' })
  async exportLab(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: Session,
    @Req() req: RequestMeta,
  ) {
    return this.superService.exportLab(id, {
      actorId: user.userId,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
  }

  @Post(':id/logo')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @ApiOperation({ summary: 'Subir / reemplazar logo de un laboratorio (desde super admin)' })
  uploadLogo(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: { buffer: Buffer; mimetype: string; size: number } | undefined,
  ) {
    if (!file) throw new BadRequestException('Falta el archivo (campo "file").');
    if (file.size > MAX_IMAGE_BYTES)
      throw new BadRequestException('La imagen supera el máximo de 5 MB.');
    const detected = sniffImageMime(file.buffer);
    if (!detected) {
      throw new BadRequestException('Formato no permitido. Use PNG, JPG o WEBP.');
    }
    return this.labConfig.uploadAsset(id, 'logo', { buffer: file.buffer, mimetype: detected });
  }

  @Post(':id/users/invite')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Invitar usuario a un laboratorio (desde super admin)' })
  inviteUser(@Param('id', ParseIntPipe) id: number, @Body() dto: InviteUserDto) {
    return this.usersService.invite(id, dto);
  }
}
