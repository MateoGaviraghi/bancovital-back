import { Public } from '@/common/decorators/public.decorator';
import { type RequestMeta, clientIp, userAgent } from '@/modules/super/request-meta';
import { Body, Controller, Get, Param, Post, Req, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
// Import de VALOR: el DTO va en @Body() y debe existir en runtime para el ValidationPipe.
import { DownloadInformeDto } from './dto/download-informe.dto';
import { PublicReportsService } from './public-reports.service';

/**
 * Portal del paciente (F7). Acceso PÚBLICO al informe vía el token del QR + DNI.
 * Sin auth (@Public) y rate-limitado (ThrottlerGuard).
 */
@ApiTags('public-informe')
@Public()
@UseGuards(ThrottlerGuard)
@Controller('public/informe')
export class PublicReportsController {
  constructor(private readonly service: PublicReportsService) {}

  @Get(':token')
  @Throttle({ publicInforme: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Metadata del informe para el portal del paciente (sin PII)' })
  getMeta(@Param('token') token: string) {
    return this.service.getMeta(token);
  }

  @Post(':token/descargar')
  @Throttle({ publicInformeDownload: { limit: 5, ttl: 10 * 60_000 } })
  @ApiOperation({ summary: 'Valida el DNI y descarga el PDF del informe' })
  async download(
    @Param('token') token: string,
    @Body() dto: DownloadInformeDto,
    @Req() req: RequestMeta,
  ): Promise<StreamableFile> {
    const { buffer, filename } = await this.service.download(token, dto.dni, {
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `inline; filename="${filename}"`,
    });
  }
}
