import { type Session, requireLabId } from '@/auth/session';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import {
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
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type RequestMeta, clientIp, userAgent } from '../super/request-meta';
import { CreateSedeDto } from './dto/create-sede.dto';
import { UpdateSedeDto } from './dto/update-sede.dto';
import { SedesService } from './sedes.service';

@ApiTags('sedes')
@ApiBearerAuth()
@Controller('sedes')
export class SedesController {
  constructor(private readonly sedes: SedesService) {}

  @Get()
  @Roles('admin', 'recepcion', 'bioquimico')
  @ApiOperation({ summary: 'Listar sedes del laboratorio' })
  list(@CurrentUser() user: Session) {
    return this.sedes.list(requireLabId(user));
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Crear nueva sede' })
  create(@CurrentUser() user: Session, @Req() req: RequestMeta, @Body() dto: CreateSedeDto) {
    return this.sedes.create(dto, requireLabId(user), {
      actorId: user.userId,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Actualizar sede' })
  update(
    @CurrentUser() user: Session,
    @Req() req: RequestMeta,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSedeDto,
  ) {
    return this.sedes.update(requireLabId(user), id, dto, {
      actorId: user.userId,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Soft delete de la sede' })
  @ApiOperation({ summary: 'Soft delete (set deleted_at)' })
  async delete(
    @CurrentUser() user: Session,
    @Req() req: RequestMeta,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.sedes.softDelete(requireLabId(user), id, {
      actorId: user.userId,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
  }
}
