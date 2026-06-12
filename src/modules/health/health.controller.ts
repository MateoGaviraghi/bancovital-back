import { Public } from '@/common/decorators/public.decorator';
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller()
export class HealthController {
  @Public()
  @Get('healthz')
  @ApiOkResponse({
    description: 'Liveness probe',
    schema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean', example: true },
        time: { type: 'string', example: '2026-05-15T12:34:56.000Z' },
      },
    },
  })
  health() {
    return { ok: true, time: new Date().toISOString() };
  }
}
