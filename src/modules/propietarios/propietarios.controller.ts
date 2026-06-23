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
import { PropietariosService } from './propietarios.service';
import { CreatePropietarioDto } from './dto/create-propietario.dto';
import { UpdatePropietarioDto } from './dto/update-propietario.dto';

@ApiTags('propietarios')
@ApiBearerAuth()
@Controller('propietarios')
export class PropietariosController {
  constructor(private readonly propietarios: PropietariosService) {}

  @Get()
  @ApiOperation({ summary: 'Buscar propietarios por DNI o nombre' })
  search(
    @CurrentUser() user: Session,
    @Query('q') q = '',
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 50,
  ) {
    return this.propietarios.search(requireLabId(user), q.trim(), Math.min(Math.max(limit, 1), 200));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de propietario por id' })
  byId(@CurrentUser() user: Session, @Param('id', ParseIntPipe) id: number) {
    return this.propietarios.byId(requireLabId(user), id);
  }

  @Post()
  @Roles('admin', 'recepcion', 'bioquimico')
  @ApiOperation({ summary: 'Crear propietario' })
  create(@Body() dto: CreatePropietarioDto, @CurrentUser() user: Session) {
    return this.propietarios.create(dto, requireLabId(user), user.userId);
  }

  @Patch(':id')
  @Roles('admin', 'recepcion', 'bioquimico')
  @ApiOperation({ summary: 'Actualizar propietario' })
  update(
    @CurrentUser() user: Session,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePropietarioDto,
  ) {
    return this.propietarios.update(requireLabId(user), id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Soft delete del propietario' })
  @ApiOperation({ summary: 'Soft delete (set deleted_at)' })
  async delete(@CurrentUser() user: Session, @Param('id', ParseIntPipe) id: number) {
    await this.propietarios.softDelete(requireLabId(user), id);
  }
}
