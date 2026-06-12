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
import type { AssociateUnidadDto } from './dto/associate-unidad.dto';
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
}
