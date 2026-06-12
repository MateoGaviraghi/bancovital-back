import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { requireLabId, type Session } from '@/auth/session';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { CreateUnidadMedidaDto } from './dto/create-unidad-medida.dto';
import { ListUnidadesMedidaDto } from './dto/list-unidades-medida.dto';
import { UpdateUnidadMedidaDto } from './dto/update-unidad-medida.dto';
import { UnidadesMedidaService } from './unidades-medida.service';

@ApiTags('unidades-medida')
@ApiBearerAuth()
@Controller('unidades-medida')
export class UnidadesMedidaController {
  constructor(private readonly unidades: UnidadesMedidaService) {}

  @Get()
  @ApiOperation({ summary: 'Buscar unidades por nombre (select del front)' })
  search(
    @CurrentUser() user: Session,
    @Query('q') q = '',
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 50,
  ) {
    return this.unidades.search(requireLabId(user), q.trim(), limit);
  }

  @Get('catalog')
  @ApiOperation({ summary: 'Listado paginado para administración' })
  catalog(@CurrentUser() user: Session, @Query() query: ListUnidadesMedidaDto) {
    return this.unidades.catalog(requireLabId(user), query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle por id' })
  byId(@CurrentUser() user: Session, @Param('id', ParseIntPipe) id: number) {
    return this.unidades.byId(requireLabId(user), id);
  }

  @Post()
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear unidad (uso desde el modal del "+" del front)' })
  create(@CurrentUser() user: Session, @Body() dto: CreateUnidadMedidaDto) {
    return this.unidades.create(requireLabId(user), dto, user.userId);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Renombrar / actualizar símbolo' })
  update(
    @CurrentUser() user: Session,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUnidadMedidaDto,
  ) {
    return this.unidades.update(requireLabId(user), id, dto);
  }

  @Patch(':id/deactivate')
  @Roles('admin')
  @ApiOperation({
    summary: 'Soft-delete. Falla si la unidad está asociada a alguna práctica.',
  })
  deactivate(@CurrentUser() user: Session, @Param('id', ParseIntPipe) id: number) {
    return this.unidades.deactivate(requireLabId(user), id);
  }
}
