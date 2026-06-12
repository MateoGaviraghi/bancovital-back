import { Roles } from '@/common/decorators/roles.decorator';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ALLOWED_IMAGE_MIME } from '../lab-config/asset-storage';
import type { LabConfigService } from '../lab-config/lab-config.service';
import type { InviteUserDto } from '../users/dto/invite-user.dto';
import type { UsersService } from '../users/users.service';
import type { CreateLaboratorioDto, UpdateLaboratorioDto } from './dto/create-laboratorio.dto';
import type { SuperService } from './super.service';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

@ApiTags('super')
@ApiBearerAuth()
@Controller('super/labs')
@Roles('super')
export class SuperController {
  constructor(
    private readonly superService: SuperService,
    private readonly usersService: UsersService,
    private readonly labConfig: LabConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar todos los laboratorios (solo superusuario)' })
  list() {
    return this.superService.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un laboratorio' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.superService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear nuevo laboratorio (tenant)' })
  create(@Body() dto: CreateLaboratorioDto) {
    return this.superService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar datos de un laboratorio' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLaboratorioDto) {
    return this.superService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar laboratorio (irreversible)' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.superService.remove(id);
  }

  @Post(':id/logo')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @ApiOperation({ summary: 'Subir / reemplazar logo de un laboratorio (desde super admin)' })
  uploadLogo(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: { buffer: Buffer; mimetype: string; size: number } | undefined,
  ) {
    if (!file) throw new BadRequestException('Falta el archivo (campo "file").');
    if (!ALLOWED_IMAGE_MIME.includes(file.mimetype as (typeof ALLOWED_IMAGE_MIME)[number])) {
      throw new BadRequestException(`Formato no permitido: ${file.mimetype}. Use PNG, JPG o WEBP.`);
    }
    if (file.size > MAX_IMAGE_BYTES)
      throw new BadRequestException('La imagen supera el máximo de 5 MB.');
    return this.labConfig.uploadAsset(id, 'logo', { buffer: file.buffer, mimetype: file.mimetype });
  }

  @Post(':id/users/invite')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Invitar usuario a un laboratorio (desde super admin)' })
  inviteUser(@Param('id', ParseIntPipe) id: number, @Body() dto: InviteUserDto) {
    return this.usersService.invite(id, dto);
  }
}
