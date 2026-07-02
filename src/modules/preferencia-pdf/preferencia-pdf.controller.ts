import { type Session, requireLabId } from '@/auth/session';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

// WEBP no es soportado por @react-pdf/renderer; solo PNG y JPEG para el fondo.
const ALLOWED_FONDO_MIME = ['image/png', 'image/jpeg'] as const;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

import { sniffImageMime } from '@/modules/lab-config/asset-storage';
import { CreatePreferenciaPdfDto } from './dto/create-preferencia-pdf.dto';
import { UpdatePreferenciaPdfDto } from './dto/update-preferencia-pdf.dto';
import { PreferenciaPdfService } from './preferencia-pdf.service';

interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

function validateImage(file: UploadedImage | undefined): UploadedImage {
  if (!file) throw new BadRequestException('Falta el archivo (campo "file").');
  if (file.size > MAX_IMAGE_BYTES) {
    throw new BadRequestException('La imagen supera el máximo de 10 MB.');
  }
  // Sniffear magic bytes en vez de confiar en el Content-Type del cliente.
  const detected = sniffImageMime(file.buffer);
  if (!detected || !ALLOWED_FONDO_MIME.includes(detected as (typeof ALLOWED_FONDO_MIME)[number])) {
    throw new BadRequestException('Formato no permitido. Use PNG o JPG.');
  }
  // Descartar el mimetype declarado: usar el tipo real detectado aguas abajo.
  return { ...file, mimetype: detected };
}

@ApiTags('preferencia-pdf')
@ApiBearerAuth()
@Controller('preferencia-pdf')
export class PreferenciaPdfController {
  constructor(private readonly service: PreferenciaPdfService) {}

  // ── Colección ──────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Listar todos los formatos de PDF del laboratorio' })
  list(@CurrentUser() user: Session) {
    return this.service.list(requireLabId(user));
  }

  @Post()
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear un nuevo formato de PDF' })
  create(@CurrentUser() user: Session, @Body() dto: CreatePreferenciaPdfDto) {
    return this.service.create(requireLabId(user), dto);
  }

  // ── Recurso individual ─────────────────────────────────────────────────────

  @Get(':id')
  @ApiParam({ name: 'id', type: Number })
  @ApiOperation({ summary: 'Obtener un formato de PDF por ID' })
  findById(
    @CurrentUser() user: Session,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.findById(requireLabId(user), id);
  }

  @Put(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', type: Number })
  @ApiOperation({ summary: 'Actualizar layout, márgenes y nombre de un formato' })
  update(
    @CurrentUser() user: Session,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePreferenciaPdfDto,
  ) {
    return this.service.update(requireLabId(user), id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', type: Number })
  @ApiOperation({ summary: 'Eliminar un formato de PDF (soft delete)' })
  async softDelete(
    @CurrentUser() user: Session,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.service.softDelete(requireLabId(user), id);
  }

  // ── Imagen de fondo ────────────────────────────────────────────────────────

  @Post(':id/fondo')
  @Roles('admin')
  @ApiParam({ name: 'id', type: Number })
  @ApiOperation({ summary: 'Subir imagen de fondo (marca de agua / membrete) para un formato' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES } }))
  uploadFondo(
    @CurrentUser() user: Session,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: UploadedImage,
  ) {
    const validated = validateImage(file);
    return this.service.uploadFondo(requireLabId(user), id, validated);
  }

  @Delete(':id/fondo')
  @Roles('admin')
  @ApiParam({ name: 'id', type: Number })
  @ApiOperation({ summary: 'Quitar la imagen de fondo de un formato' })
  removeFondo(
    @CurrentUser() user: Session,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.removeFondo(requireLabId(user), id);
  }

  @Get(':id/fondo/signed-url')
  @Roles('admin', 'bioquimico', 'recepcion')
  @ApiParam({ name: 'id', type: Number })
  @ApiQuery({
    name: 'ttlSeconds',
    required: false,
    schema: { type: 'integer', default: 3600, minimum: 60, maximum: 86400 },
  })
  @ApiOperation({ summary: 'URL firmada temporal de la imagen de fondo de un formato' })
  fondoSignedUrl(
    @CurrentUser() user: Session,
    @Param('id', ParseIntPipe) id: number,
    @Query('ttlSeconds', new ParseIntPipe({ optional: true })) ttlSeconds = 3600,
  ) {
    const clamped = Math.min(Math.max(ttlSeconds, 60), 86400);
    return this.service.fondoSignedUrl(requireLabId(user), id, clamped);
  }

  // ── Preview ────────────────────────────────────────────────────────────────

  @Get(':id/preview')
  @Roles('admin')
  @Header('Content-Type', 'application/pdf')
  @ApiParam({ name: 'id', type: Number })
  @ApiOperation({ summary: 'Vista previa PDF de muestra con el formato indicado' })
  async preview(
    @CurrentUser() user: Session,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<StreamableFile> {
    const buffer = await this.service.renderSample(requireLabId(user), id);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: 'inline; filename="preview-informe.pdf"',
    });
  }
}
