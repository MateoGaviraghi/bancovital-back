import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Session } from '@/auth/session';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  @Get()
  @ApiOkResponse({
    description: 'Datos del usuario autenticado',
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'string', format: 'uuid' },
        email: { type: 'string', format: 'email' },
        role: { type: 'string', enum: ['admin', 'recepcion', 'bioquimico'] },
      },
    },
  })
  me(@CurrentUser() session: Session): Session {
    return session;
  }
}
