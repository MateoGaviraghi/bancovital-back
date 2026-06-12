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
import { requireLabId, type Session } from '@/auth/session';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { DoctorsService } from './doctors.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';

@ApiTags('doctors')
@ApiBearerAuth()
@Controller('doctors')
export class DoctorsController {
  constructor(private readonly doctors: DoctorsService) {}

  @Get()
  @ApiOperation({ summary: 'Buscar medicos derivantes por matricula o nombre' })
  search(
    @CurrentUser() user: Session,
    @Query('q') q = '',
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 50,
  ) {
    return this.doctors.search(requireLabId(user), q.trim(), Math.min(Math.max(limit, 1), 200));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de medico por id' })
  byId(@CurrentUser() user: Session, @Param('id', ParseIntPipe) id: number) {
    return this.doctors.byId(requireLabId(user), id);
  }

  @Post()
  @Roles('admin', 'recepcion')
  @ApiOperation({ summary: 'Crear medico derivante' })
  create(@Body() dto: CreateDoctorDto, @CurrentUser() user: Session) {
    return this.doctors.create(dto, requireLabId(user), user.userId);
  }

  @Patch(':id')
  @Roles('admin', 'recepcion')
  @ApiOperation({ summary: 'Actualizar medico' })
  update(
    @CurrentUser() user: Session,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDoctorDto,
  ) {
    return this.doctors.update(requireLabId(user), id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Soft delete del medico' })
  @ApiOperation({ summary: 'Soft delete (set deleted_at)' })
  async delete(@CurrentUser() user: Session, @Param('id', ParseIntPipe) id: number) {
    await this.doctors.softDelete(requireLabId(user), id);
  }
}
