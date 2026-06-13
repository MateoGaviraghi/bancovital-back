import { Roles } from '@/common/decorators/roles.decorator';
import { ConsumoService } from '@/modules/consumo/consumo.service';
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
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreatePlanDto, SetSubscriptionDto, UpdatePlanDto } from './dto/plan.dto';
import { PlansService } from './plans.service';

@ApiTags('super')
@ApiBearerAuth()
@Roles('super')
@Controller('super')
export class PlansController {
  constructor(
    private readonly plans: PlansService,
    private readonly consumo: ConsumoService,
  ) {}

  // ─── Plans CRUD ───────────────────────────────────────────────

  @Get('plans')
  @ApiOperation({ summary: 'Listar todos los planes (sin borrados)' })
  list() {
    return this.plans.list();
  }

  @Post('plans')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear plan' })
  create(@Body() dto: CreatePlanDto) {
    return this.plans.create(dto);
  }

  @Patch('plans/:id')
  @ApiOperation({ summary: 'Actualizar plan' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePlanDto) {
    return this.plans.update(id, dto);
  }

  @Delete('plans/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete de plan (409 si tiene suscripciones activas)' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.plans.remove(id);
  }

  // ─── Suscripciones ────────────────────────────────────────────

  @Put('labs/:id/subscription')
  @ApiOperation({ summary: 'Asignar/cambiar plan de un laboratorio' })
  setSubscription(@Param('id', ParseIntPipe) labId: number, @Body() dto: SetSubscriptionDto) {
    return this.plans.setSubscription(labId, dto);
  }

  @Delete('labs/:id/subscription')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancelar suscripción activa del laboratorio' })
  async cancelSubscription(@Param('id', ParseIntPipe) labId: number) {
    await this.plans.cancelSubscription(labId);
  }

  // ─── Consumo super ────────────────────────────────────────────

  @Get('consumo')
  @ApiOperation({ summary: 'Resumen de consumo de todos los labs activos' })
  consumoResumen() {
    return this.consumo.getConsumoResumen();
  }
}
