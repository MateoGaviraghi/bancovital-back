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
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { UpsertUnidadValueDto } from './dto/upsert-unidad-value.dto';
import { UnidadesMedidaService } from './unidades-medida.service';

@ApiTags('unidades-medida')
@ApiBearerAuth()
@Controller('order-practices/:opId/unidades')
export class OrderPracticeUnidadesController {
  constructor(private readonly unidades: UnidadesMedidaService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar unidades aplicables a la línea + valor cargado (si existe)',
  })
  async list(@CurrentUser() user: Session, @Param('opId', ParseIntPipe) opId: number) {
    const rows = await this.unidades.listValuesForOrderPractice(requireLabId(user), opId);
    // Flatten to match the OrderPracticeUnidadItem shape the frontend expects
    return rows.map((r) => ({
      associationId: r.associationId,
      unidadId: r.unidad.id,
      nombre: r.unidad.nombre,
      simbolo: r.unidad.simbolo,
      sortOrder: r.sortOrder,
      value: r.value,
    }));
  }

  @Post()
  @Roles('admin', 'bioquimico')
  @ApiOperation({ summary: 'Upsert valor por unidad para esta línea de orden' })
  upsert(
    @CurrentUser() user: Session,
    @Param('opId', ParseIntPipe) opId: number,
    @Body() dto: UpsertUnidadValueDto,
  ) {
    return this.unidades.upsertValue(requireLabId(user), opId, dto, user.userId);
  }

  @Delete(':unidadId')
  @Roles('admin', 'bioquimico')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Borrar el valor cargado para una unidad en esta línea' })
  async deleteValue(
    @CurrentUser() user: Session,
    @Param('opId', ParseIntPipe) opId: number,
    @Param('unidadId', ParseIntPipe) unidadId: number,
  ): Promise<void> {
    await this.unidades.deleteValue(requireLabId(user), opId, unidadId);
  }
}
