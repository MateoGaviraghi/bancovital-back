import type { Session } from '@/auth/session';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ExitImpersonationDto } from './dto/exit-impersonation.dto';
import { ImpersonationService } from './impersonation.service';

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
@Controller('super/impersonate')
@Roles('super')
export class ImpersonationController {
  constructor(private readonly impersonation: ImpersonationService) {}

  @Post('exit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Salir de la impersonation de un laboratorio (solo super)' })
  exit(@CurrentUser() user: Session, @Body() dto: ExitImpersonationDto, @Req() req: RequestMeta) {
    return this.impersonation.exit(dto.labId, {
      superUserId: user.userId,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
  }

  @Post(':labId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Entrar a impersonar un laboratorio como admin (solo super)' })
  enter(
    @CurrentUser() user: Session,
    @Param('labId', ParseIntPipe) labId: number,
    @Req() req: RequestMeta,
  ) {
    return this.impersonation.enter(labId, {
      superUserId: user.userId,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
  }
}
