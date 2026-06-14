import type { Session } from '@/auth/session';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AnunciosService } from './anuncios.service';

@ApiTags('announcements')
@ApiBearerAuth()
@Controller('announcements')
export class AnunciosController {
  constructor(private readonly anuncios: AnunciosService) {}

  @Get()
  @Roles('admin', 'recepcion', 'bioquimico', 'super')
  @ApiOperation({
    summary: 'Anuncios activos y vigentes para el usuario actual (scopeado por lab)',
  })
  forCaller(@CurrentUser() user: Session) {
    // Scope por labId de la sesión: lab → globales + propios; super (labId null) → solo globales.
    return this.anuncios.forCaller(user.labId);
  }
}
