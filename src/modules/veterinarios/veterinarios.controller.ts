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
import { VeterinariosService } from './veterinarios.service';
import { CreateVeterinarioDto } from './dto/create-veterinario.dto';
import { UpdateVeterinarioDto } from './dto/update-veterinario.dto';

@ApiTags('veterinarios')
@ApiBearerAuth()
@Controller('veterinarios')
export class VeterinariosController {
  constructor(private readonly veterinarios: VeterinariosService) {}

  @Get()
  @ApiOperation({ summary: 'Buscar veterinarios por matricula o nombre' })
  search(
    @CurrentUser() user: Session,
    @Query('q') q = '',
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 50,
  ) {
    return this.veterinarios.search(requireLabId(user), q.trim(), Math.min(Math.max(limit, 1), 200));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de veterinario por id' })
  byId(@CurrentUser() user: Session, @Param('id', ParseIntPipe) id: number) {
    return this.veterinarios.byId(requireLabId(user), id);
  }

  @Post()
  @Roles('admin', 'recepcion', 'bioquimico')
  @ApiOperation({ summary: 'Crear veterinario' })
  create(@Body() dto: CreateVeterinarioDto, @CurrentUser() user: Session) {
    return this.veterinarios.create(dto, requireLabId(user), user.userId);
  }

  @Patch(':id')
  @Roles('admin', 'recepcion', 'bioquimico')
  @ApiOperation({ summary: 'Actualizar veterinario' })
  update(
    @CurrentUser() user: Session,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVeterinarioDto,
  ) {
    return this.veterinarios.update(requireLabId(user), id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Soft delete del veterinario' })
  @ApiOperation({ summary: 'Soft delete (set deleted_at)' })
  async delete(@CurrentUser() user: Session, @Param('id', ParseIntPipe) id: number) {
    await this.veterinarios.softDelete(requireLabId(user), id);
  }
}
