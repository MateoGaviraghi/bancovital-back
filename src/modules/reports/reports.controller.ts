import { Controller, Get, Header, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { requireLabId, type Session } from '@/auth/session';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post(':orderId/emit')
  @Roles('admin', 'recepcion', 'bioquimico')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Renderiza PDF, sube a Storage y transiciona la orden a "emitida"',
  })
  emit(@Param('orderId', ParseIntPipe) orderId: number, @CurrentUser() user: Session) {
    return this.reports.emit(requireLabId(user), orderId, user.userId);
  }

  @Get(':orderId/signed-url')
  @Roles('admin', 'bioquimico', 'recepcion')
  @ApiQuery({ name: 'ttlSeconds', required: false, schema: { type: 'integer', default: 900, minimum: 60, maximum: 86400 } })
  @ApiOperation({
    summary: 'URL firmada del PDF (self-healing: regenera si el blob falta)',
  })
  signedUrl(
    @Param('orderId', ParseIntPipe) orderId: number,
    @CurrentUser() user: Session,
    @Query('ttlSeconds', new ParseIntPipe({ optional: true })) ttlSeconds = 900,
  ) {
    const clamped = Math.min(Math.max(ttlSeconds, 60), 86400);
    return this.reports.signedUrl(requireLabId(user), orderId, clamped);
  }

  @Post(':orderId/regenerate')
  @Roles('admin', 'bioquimico', 'recepcion')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Regenera el PDF de UNA orden con los datos actuales del laboratorio (resetea "stale")',
  })
  regenerateOne(@Param('orderId', ParseIntPipe) orderId: number, @CurrentUser() user: Session) {
    return this.reports.regenerateOne(requireLabId(user), orderId);
  }

  @Post('regenerate-all')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Regenera todos los PDFs de ordenes emitidas de este laboratorio.',
  })
  regenerateAll(@CurrentUser() user: Session) {
    return this.reports.regenerateAll(requireLabId(user));
  }

  @Get(':orderId/ficha')
  @Roles('admin', 'bioquimico', 'recepcion')
  @Header('Content-Type', 'application/pdf')
  @ApiOperation({ summary: 'Genera y descarga la ficha de trabajo de la orden (sin resultados)' })
  async ficha(
    @Param('orderId', ParseIntPipe) orderId: number,
    @CurrentUser() user: Session,
  ): Promise<StreamableFile> {
    const labId = requireLabId(user);
    const buffer = await this.reports.ficha(labId, orderId);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="ficha-${orderId}.pdf"`,
    });
  }
}
