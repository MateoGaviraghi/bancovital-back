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
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AssociateUnidadDto } from './dto/associate-unidad.dto';
import { UpdateAssociationDto } from './dto/update-association.dto';
import { UpsertUnidadRefEspecieDto } from './dto/upsert-unidad-ref-especie.dto';
import { UnidadesMedidaService } from './unidades-medida.service';

@ApiTags('unidades-medida')
@ApiBearerAuth()
@Controller('practices/:practiceId/unidades')
export class PracticeUnidadesController {
  constructor(private readonly unidades: UnidadesMedidaService) {}

  @Get()
  @ApiOperation({ summary: 'Unidades configuradas para esta práctica en el lab' })
  list(@CurrentUser() user: Session, @Param('practiceId', ParseIntPipe) practiceId: number) {
    return this.unidades.listForPractice(requireLabId(user), practiceId);
  }

  @Post()
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Asociar una unidad existente a esta práctica' })
  associate(
    @CurrentUser() user: Session,
    @Param('practiceId', ParseIntPipe) practiceId: number,
    @Body() dto: AssociateUnidadDto,
  ) {
    return this.unidades.associate(requireLabId(user), practiceId, dto);
  }

  @Patch(':unidadId')
  @Roles('admin')
  @ApiOperation({ summary: 'Actualizar rangos de referencia de una unidad asociada' })
  updateRef(
    @CurrentUser() user: Session,
    @Param('practiceId', ParseIntPipe) practiceId: number,
    @Param('unidadId', ParseIntPipe) unidadId: number,
    @Body() dto: UpdateAssociationDto,
  ) {
    return this.unidades.updateAssociation(requireLabId(user), practiceId, unidadId, dto);
  }

  @Delete(':unidadId')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Desasociar (restrict si hay valores cargados en órdenes existentes)',
  })
  async dissociate(
    @CurrentUser() user: Session,
    @Param('practiceId', ParseIntPipe) practiceId: number,
    @Param('unidadId', ParseIntPipe) unidadId: number,
  ): Promise<void> {
    await this.unidades.dissociate(requireLabId(user), practiceId, unidadId);
  }

  // ── Valores de referencia por especie para la unidad ──────────────

  @Get(':unidadId/ref-especie')
  @ApiOperation({ summary: 'Refs por especie para esta unidad en la práctica' })
  listRefEspecie(
    @CurrentUser() user: Session,
    @Param('practiceId', ParseIntPipe) practiceId: number,
    @Param('unidadId', ParseIntPipe) unidadId: number,
  ) {
    return this.unidades.listRefEspecie(requireLabId(user), practiceId, unidadId);
  }

  @Post(':unidadId/ref-especie')
  @Roles('admin')
  @ApiOperation({ summary: 'Crear o actualizar ref por especie para esta unidad' })
  upsertRefEspecie(
    @CurrentUser() user: Session,
    @Param('practiceId', ParseIntPipe) practiceId: number,
    @Param('unidadId', ParseIntPipe) unidadId: number,
    @Body() dto: UpsertUnidadRefEspecieDto,
  ) {
    return this.unidades.upsertRefEspecie(requireLabId(user), practiceId, unidadId, dto.especieId, dto);
  }

  @Delete(':unidadId/ref-especie/:especieId')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Referencia por especie eliminada' })
  @ApiOperation({ summary: 'Eliminar ref por especie para esta unidad' })
  async deleteRefEspecie(
    @CurrentUser() user: Session,
    @Param('practiceId', ParseIntPipe) practiceId: number,
    @Param('unidadId', ParseIntPipe) unidadId: number,
    @Param('especieId', ParseIntPipe) especieId: number,
  ) {
    await this.unidades.deleteRefEspecie(requireLabId(user), practiceId, unidadId, especieId);
  }
}
