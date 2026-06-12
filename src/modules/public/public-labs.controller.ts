import { Public } from '@/common/decorators/public.decorator';
import { Controller, Get, Header, Param, UseGuards } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { PublicLabsService } from './public-labs.service';

@ApiTags('public')
@Controller('public/labs')
@Public()
export class PublicLabsController {
  constructor(private readonly publicLabsService: PublicLabsService) {}

  @Get(':slug/branding')
  @UseGuards(ThrottlerGuard)
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOperation({ summary: 'Branding público de un laboratorio por slug (sin auth)' })
  @ApiOkResponse({
    description: 'Datos de branding del laboratorio',
    schema: {
      type: 'object',
      properties: {
        slug: { type: 'string', example: 'lab-santa-fe' },
        name: { type: 'string', example: 'Lab Santa Fe' },
        shortName: { type: 'string', nullable: true, example: 'Lab SF' },
        logoUrl: { type: 'string', nullable: true, example: 'https://...' },
        primaryColor: { type: 'string', nullable: true, example: '#3a7bd5' },
        tagline: { type: 'string', nullable: true, example: 'Resultados en los que confías' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Not found' })
  getBranding(@Param('slug') slug: string) {
    return this.publicLabsService.getBranding(slug);
  }
}
