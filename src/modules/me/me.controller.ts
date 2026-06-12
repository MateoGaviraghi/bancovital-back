import type { Session } from '@/auth/session';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { MeService } from './me.service';

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get()
  @ApiOkResponse({
    description: 'Datos del usuario autenticado',
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'string', format: 'uuid' },
        email: { type: 'string', format: 'email' },
        role: { type: 'string', enum: ['admin', 'recepcion', 'bioquimico', 'super'] },
        labId: { type: 'number', nullable: true },
        labSlug: { type: 'string', nullable: true, example: 'lab-santa-fe' },
      },
    },
  })
  me(@CurrentUser() session: Session) {
    return this.meService.getMe(session);
  }
}
