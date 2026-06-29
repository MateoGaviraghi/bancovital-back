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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateSolicitanteAguaDto } from './dto/create-solicitante-agua.dto';
import { UpdateSolicitanteAguaDto } from './dto/update-solicitante-agua.dto';
import { SolicitantesAguaService } from './solicitantes-agua.service';

@ApiTags('solicitantes-agua')
@ApiBearerAuth()
@Controller('solicitantes-agua')
export class SolicitantesAguaController {
  constructor(private readonly svc: SolicitantesAguaService) {}

  @Get()
  @ApiOperation({ summary: 'Listar solicitantes de agua' })
  list(@CurrentUser() user: Session, @Query('search') search?: string) {
    return this.svc.list(requireLabId(user), search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de solicitante' })
  byId(@CurrentUser() user: Session, @Param('id', ParseIntPipe) id: number) {
    return this.svc.findById(requireLabId(user), id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear solicitante' })
  create(@CurrentUser() user: Session, @Body() dto: CreateSolicitanteAguaDto) {
    return this.svc.create(requireLabId(user), dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar solicitante' })
  update(@CurrentUser() user: Session, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSolicitanteAguaDto) {
    return this.svc.update(requireLabId(user), id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar solicitante (soft)' })
  remove(@CurrentUser() user: Session, @Param('id', ParseIntPipe) id: number) {
    return this.svc.softDelete(requireLabId(user), id);
  }
}
