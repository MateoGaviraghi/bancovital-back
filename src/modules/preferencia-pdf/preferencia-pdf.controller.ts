import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { requireLabId, type Session } from '@/auth/session';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
// WEBP no es soportado por @react-pdf/renderer, solo PNG y JPEG para el fondo
const ALLOWED_FONDO_MIME = ['image/png', 'image/jpeg'] as const;
import { UpdatePreferenciaPdfDto } from './dto/update-preferencia-pdf.dto';
import { PreferenciaPdfService } from './preferencia-pdf.service';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

function validateImage(file: UploadedImage | undefined): void {
  if (!file) throw new BadRequestException('Falta el archivo (campo "file").');
  if (!ALLOWED_FONDO_MIME.includes(file.mimetype as (typeof ALLOWED_FONDO_MIME)[number])) {
    throw new BadRequestException(`Formato no permitido: ${file.mimetype}. Use PNG o JPG.`);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new BadRequestException('La imagen supera el maximo de 10 MB.');
  }
}

@ApiTags('preferencia-pdf')
@ApiBearerAuth()
@Controller('preferencia-pdf')
export class PreferenciaPdfController {
  constructor(private readonly service: PreferenciaPdfService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener preferencias de PDF del laboratorio actual' })
  get(@CurrentUser() user: Session) {
    return this.service.get(requireLabId(user));
  }

  @Put()
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Actualizar configuracion de layout del PDF (campos, margenes). Crea el registro si no existe.',
  })
  upsert(@CurrentUser() user: Session, @Body() dto: UpdatePreferenciaPdfDto) {
    return this.service.upsert(requireLabId(user), dto);
  }

  @Post('fondo')
  @Roles('admin')
  @ApiOperation({ summary: 'Subir imagen de fondo del PDF (membrete, hoja institucional)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES } }))
  uploadFondo(@CurrentUser() user: Session, @UploadedFile() file: UploadedImage) {
    validateImage(file);
    return this.service.uploadFondo(requireLabId(user), file);
  }

  @Get('fondo/signed-url')
  @Roles('admin', 'bioquimico', 'recepcion')
  @ApiQuery({
    name: 'ttlSeconds',
    required: false,
    schema: { type: 'integer', default: 3600, minimum: 60, maximum: 86400 },
  })
  @ApiOperation({ summary: 'URL firmada temporal del fondo del PDF' })
  fondoSignedUrl(
    @CurrentUser() user: Session,
    @Query('ttlSeconds', new ParseIntPipe({ optional: true })) ttlSeconds = 3600,
  ) {
    const clamped = Math.min(Math.max(ttlSeconds, 60), 86400);
    return this.service.fondoSignedUrl(requireLabId(user), clamped);
  }
}
