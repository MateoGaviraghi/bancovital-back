import { type Session, requireLabId } from '@/auth/session';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { PatientsService } from './patients.service';

@ApiTags('patients')
@ApiBearerAuth()
@Controller('patients')
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  @Get()
  @ApiOperation({ summary: 'Buscar pacientes por DNI, nombre o apellido' })
  @ApiOkResponse({ description: 'Pacientes que matchean' })
  search(
    @CurrentUser() user: Session,
    @Query('q') q = '',
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 50,
  ) {
    return this.patients.search(requireLabId(user), q.trim(), Math.min(Math.max(limit, 1), 200));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de paciente por id' })
  byId(@CurrentUser() user: Session, @Param('id', ParseIntPipe) id: number) {
    return this.patients.byId(requireLabId(user), id);
  }

  @Post()
  @Roles('admin', 'recepcion', 'bioquimico')
  @ApiOperation({ summary: 'Crear paciente nuevo' })
  create(@Body() dto: CreatePatientDto, @CurrentUser() user: Session) {
    return this.patients.create(dto, requireLabId(user), user.userId);
  }

  @Patch(':id')
  @Roles('admin', 'recepcion', 'bioquimico')
  @ApiOperation({ summary: 'Actualizar paciente existente' })
  update(
    @CurrentUser() user: Session,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePatientDto,
  ) {
    return this.patients.update(requireLabId(user), id, dto);
  }
}
