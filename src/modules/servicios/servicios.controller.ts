import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { type Session, requireLabId } from '@/auth/session';
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CreateServicioDto } from './dto/create-servicio.dto';
import { SetActiveDto } from './dto/set-active.dto';
import { UpdateServicioDto } from './dto/update-servicio.dto';
import { ServiciosService } from './servicios.service';

function requireSuperImpersonating(session: Session): number {
  if (session.role !== 'super' && !session.impersonating) {
    throw new ForbiddenException('Solo superadmin puede gestionar servicios');
  }
  return requireLabId(session);
}

@ApiTags('servicios')
@ApiBearerAuth()
@Controller('servicios')
export class ServiciosController {
  constructor(private readonly servicios: ServiciosService) {}

  @Get()
  @ApiOperation({ summary: 'Listar servicios del laboratorio' })
  @ApiQuery({ name: 'all', required: false, type: Boolean, description: 'true para incluir inactivos' })
  list(@CurrentUser() user: Session, @Query('all') all?: string) {
    const labId = requireLabId(user);
    return all === 'true' ? this.servicios.listAll(labId) : this.servicios.list(labId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un servicio' })
  byId(@CurrentUser() user: Session, @Param('id', ParseIntPipe) id: number) {
    return this.servicios.findById(requireLabId(user), id);
  }

  @Post()
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear servicio (solo superadmin)' })
  create(@CurrentUser() user: Session, @Body() dto: CreateServicioDto) {
    return this.servicios.create(requireSuperImpersonating(user), dto);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Actualizar servicio (solo superadmin)' })
  update(
    @CurrentUser() user: Session,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateServicioDto,
  ) {
    return this.servicios.update(requireSuperImpersonating(user), id, dto);
  }

  @Patch(':id/active')
  @Roles('admin')
  @ApiOperation({ summary: 'Activar/desactivar servicio (solo superadmin)' })
  setActive(
    @CurrentUser() user: Session,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetActiveDto,
  ) {
    return this.servicios.setActive(requireSuperImpersonating(user), id, dto.activo);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar servicio (solo superadmin)' })
  remove(@CurrentUser() user: Session, @Param('id', ParseIntPipe) id: number) {
    return this.servicios.remove(requireSuperImpersonating(user), id);
  }

  @Post('seed-defaults')
  @Roles('admin')
  @ApiOperation({ summary: 'Crear servicios default (solo superadmin)' })
  seedDefaults(@CurrentUser() user: Session) {
    return this.servicios.seedDefaults(requireSuperImpersonating(user));
  }
}
