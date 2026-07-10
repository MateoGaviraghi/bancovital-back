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
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PacientesAnimalesService } from './pacientes-animales.service';
import { CreatePacienteAnimalDto } from './dto/create-paciente-animal.dto';
import { UpdatePacienteAnimalDto } from './dto/update-paciente-animal.dto';

@ApiTags('pacientes-animales')
@ApiBearerAuth()
@Controller('pacientes-animales')
export class PacientesAnimalesController {
  constructor(private readonly pacientesAnimales: PacientesAnimalesService) {}

  @Get()
  @ApiOperation({ summary: 'Buscar pacientes animales por nombre' })
  search(
    @CurrentUser() user: Session,
    @Query('q') q = '',
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 50,
    @Query('propietarioId') rawPropietarioId?: string,
  ) {
    const propietarioId = rawPropietarioId ? Number(rawPropietarioId) : undefined;
    return this.pacientesAnimales.search(
      requireLabId(user),
      q.trim(),
      Math.min(Math.max(limit, 1), 200),
      propietarioId && !Number.isNaN(propietarioId) ? propietarioId : undefined,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de paciente animal por id' })
  byId(@CurrentUser() user: Session, @Param('id', ParseIntPipe) id: number) {
    return this.pacientesAnimales.byId(requireLabId(user), id);
  }

  @Post()
  @Roles('admin', 'recepcion', 'bioquimico')
  @ApiOperation({ summary: 'Crear paciente animal' })
  create(@Body() dto: CreatePacienteAnimalDto, @CurrentUser() user: Session) {
    return this.pacientesAnimales.create(dto, requireLabId(user), user.userId);
  }

  @Patch(':id')
  @Roles('admin', 'recepcion', 'bioquimico')
  @ApiOperation({ summary: 'Actualizar paciente animal' })
  update(
    @CurrentUser() user: Session,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePacienteAnimalDto,
  ) {
    return this.pacientesAnimales.update(requireLabId(user), id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Soft delete del paciente animal' })
  @ApiOperation({ summary: 'Soft delete (set deleted_at)' })
  async delete(@CurrentUser() user: Session, @Param('id', ParseIntPipe) id: number) {
    await this.pacientesAnimales.softDelete(requireLabId(user), id);
  }
}
