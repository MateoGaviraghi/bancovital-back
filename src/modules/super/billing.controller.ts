import type { Session } from '@/auth/session';
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
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { CreateMovimientoDto, SetMorosoDto } from './dto/movimiento.dto';
import { type RequestMeta, clientIp, userAgent } from './request-meta';

@ApiTags('super')
@ApiBearerAuth()
@Controller('super')
@Roles('super')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Post('labs/:id/movimientos')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar un movimiento (cargo/pago) en el estado de cuenta del lab' })
  create(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateMovimientoDto,
    @CurrentUser() user: Session,
    @Req() req: RequestMeta,
  ) {
    return this.billing.createMovimiento(id, dto, {
      actorId: user.userId,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
  }

  @Get('labs/:id/movimientos')
  @ApiOperation({ summary: 'Estado de cuenta del lab (movimientos + balance)' })
  estadoCuenta(@Param('id', ParseIntPipe) id: number) {
    return this.billing.getEstadoCuenta(id);
  }

  @Delete('movimientos/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar (soft) un movimiento — corrección' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: Session,
    @Req() req: RequestMeta,
  ) {
    await this.billing.removeMovimiento(id, {
      actorId: user.userId,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
  }

  @Patch('labs/:id/moroso')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar / desmarcar el lab como moroso' })
  setMoroso(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetMorosoDto,
    @CurrentUser() user: Session,
    @Req() req: RequestMeta,
  ) {
    return this.billing.setMoroso(id, dto.moroso, {
      actorId: user.userId,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
  }
}
