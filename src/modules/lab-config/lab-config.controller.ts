import { type Session, requireLabId } from '@/auth/session';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { type RequestMeta, clientIp, userAgent } from '@/modules/super/request-meta';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
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
import { sniffImageMime } from './asset-storage';
// Import de VALOR: el DTO va en @Body() y debe existir en runtime para el ValidationPipe.
import { UpdateLabConfigDto } from './dto/update-lab-config.dto';
import { type LabConfigAuditCtx, LabConfigService } from './lab-config.service';

function auditCtx(user: Session, req: RequestMeta): LabConfigAuditCtx {
  return { actorId: user.userId, ip: clientIp(req), userAgent: userAgent(req) };
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

/**
 * Validates an uploaded image by SNIFFING magic bytes (not the client-supplied
 * Content-Type header, which is spoofable). Returns the file with `mimetype`
 * normalized to the detected type so extension/contentType are derived from the
 * real format downstream.
 */
function validateImage(file: UploadedImage | undefined): UploadedImage {
  if (!file) {
    throw new BadRequestException('Falta el archivo (campo "file").');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new BadRequestException('La imagen supera el maximo de 5 MB.');
  }
  const detected = sniffImageMime(file.buffer);
  if (!detected) {
    throw new BadRequestException('Formato no permitido. Use PNG, JPG o WEBP.');
  }
  return { ...file, mimetype: detected };
}

const FILE_BODY_SCHEMA = {
  schema: {
    type: 'object',
    properties: { file: { type: 'string', format: 'binary' } },
    required: ['file'],
  },
};

@ApiTags('lab-config')
@ApiBearerAuth()
@Controller('lab-config')
export class LabConfigController {
  constructor(private readonly labConfig: LabConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Configuracion del laboratorio' })
  get(@CurrentUser() user: Session) {
    return this.labConfig.get(requireLabId(user));
  }

  @Get('logo/signed-url')
  @Roles('admin', 'bioquimico', 'recepcion')
  @ApiQuery({
    name: 'ttlSeconds',
    required: false,
    schema: { type: 'integer', default: 3600, minimum: 60, maximum: 86400 },
  })
  @ApiOperation({ summary: 'URL firmada temporal del logo (para mostrarlo en el front)' })
  logoSignedUrl(
    @CurrentUser() user: Session,
    @Query('ttlSeconds', new ParseIntPipe({ optional: true })) ttlSeconds = 3600,
  ) {
    const clamped = Math.min(Math.max(ttlSeconds, 60), 86400);
    return this.labConfig.assetSignedUrl(requireLabId(user), 'logo', clamped);
  }

  @Get('signature/signed-url')
  @Roles('admin', 'bioquimico', 'recepcion')
  @ApiQuery({
    name: 'ttlSeconds',
    required: false,
    schema: { type: 'integer', default: 3600, minimum: 60, maximum: 86400 },
  })
  @ApiOperation({ summary: 'URL firmada temporal de la firma del profesional' })
  signatureSignedUrl(
    @CurrentUser() user: Session,
    @Query('ttlSeconds', new ParseIntPipe({ optional: true })) ttlSeconds = 3600,
  ) {
    const clamped = Math.min(Math.max(ttlSeconds, 60), 86400);
    return this.labConfig.assetSignedUrl(requireLabId(user), 'signature', clamped);
  }

  @Patch()
  @Roles('admin')
  @ApiOperation({ summary: 'Actualizar configuracion del laboratorio' })
  update(@CurrentUser() user: Session, @Req() req: RequestMeta, @Body() dto: UpdateLabConfigDto) {
    return this.labConfig.update(requireLabId(user), dto, auditCtx(user, req));
  }

  @Post('logo')
  @Roles('admin')
  @ApiOperation({ summary: 'Subir logo del laboratorio (PNG/JPG/WEBP, max 5MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody(FILE_BODY_SCHEMA)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES } }))
  uploadLogo(
    @CurrentUser() user: Session,
    @Req() req: RequestMeta,
    @UploadedFile() file: UploadedImage,
  ) {
    const validated = validateImage(file);
    return this.labConfig.uploadAsset(requireLabId(user), 'logo', validated, auditCtx(user, req));
  }

  @Post('signature')
  @Roles('admin')
  @ApiOperation({
    summary: 'Subir firma del profesional (PNG/JPG/WEBP, max 5MB)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody(FILE_BODY_SCHEMA)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES } }))
  uploadSignature(
    @CurrentUser() user: Session,
    @Req() req: RequestMeta,
    @UploadedFile() file: UploadedImage,
  ) {
    const validated = validateImage(file);
    return this.labConfig.uploadAsset(
      requireLabId(user),
      'signature',
      validated,
      auditCtx(user, req),
    );
  }
}
