import { type Session, requireLabId } from '@/auth/session';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { ResultsService } from '@/modules/results/results.service';
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
import type { CancelOrderDto } from './dto/cancel-order.dto';
import type { CreateOrderDto } from './dto/create-order.dto';
import type { ListOrdersDto } from './dto/list-orders.dto';
import type { UpdateOrderDto } from './dto/update-order.dto';
import type { OrdersService } from './orders.service';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly results: ResultsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar ordenes con filtros' })
  list(@CurrentUser() user: Session, @Query() filters: ListOrdersDto) {
    return this.orders.list(requireLabId(user), filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de orden con paciente + obra social' })
  byId(@CurrentUser() user: Session, @Param('id', ParseIntPipe) id: number) {
    return this.orders.byId(requireLabId(user), id);
  }

  @Get(':id/lines')
  @ApiOperation({ summary: 'Lineas de la orden (snapshots inmutables)' })
  lines(@CurrentUser() user: Session, @Param('id', ParseIntPipe) id: number) {
    return this.orders.lines(requireLabId(user), id);
  }

  @Get(':id/results')
  @ApiOperation({
    summary: 'Lineas con resultados hidratados (incluye rango aplicable al paciente)',
  })
  resultsByOrder(@CurrentUser() user: Session, @Param('id', ParseIntPipe) id: number) {
    return this.results.byOrder(requireLabId(user), id);
  }

  @Post()
  @Roles('admin', 'recepcion', 'bioquimico')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear orden (transaccion: resolveUBs -> pricing -> snapshots)' })
  create(@Body() dto: CreateOrderDto, @CurrentUser() user: Session) {
    return this.orders.create(requireLabId(user), dto, user.userId);
  }

  @Patch(':id')
  @Roles('admin', 'recepcion', 'bioquimico')
  @ApiOperation({ summary: 'Editar orden en borrador (recalcula pricing si cambian practicas)' })
  update(
    @CurrentUser() user: Session,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderDto,
  ) {
    return this.orders.update(requireLabId(user), id, dto);
  }

  @Patch(':id/confirm')
  @Roles('admin', 'recepcion', 'bioquimico')
  @ApiOperation({ summary: 'borrador -> confirmada' })
  confirm(@CurrentUser() user: Session, @Param('id', ParseIntPipe) id: number) {
    return this.orders.confirm(requireLabId(user), id);
  }

  @Patch(':id/start')
  @Roles('admin', 'recepcion', 'bioquimico')
  @ApiOperation({ summary: 'confirmada -> en_proceso (bio comienza a procesar)' })
  start(@CurrentUser() user: Session, @Param('id', ParseIntPipe) id: number) {
    return this.orders.start(requireLabId(user), id);
  }

  @Patch(':id/finalize')
  @Roles('admin', 'recepcion', 'bioquimico')
  @ApiOperation({ summary: 'en_proceso -> resultados_cargados' })
  finalize(@CurrentUser() user: Session, @Param('id', ParseIntPipe) id: number) {
    return this.orders.finalize(requireLabId(user), id);
  }

  @Patch(':id/revert')
  @Roles('admin')
  @ApiOperation({
    summary:
      'Revertir a borrador (solo admin): confirmada / en_proceso / resultados_cargados / emitida -> borrador',
  })
  revert(@CurrentUser() user: Session, @Param('id', ParseIntPipe) id: number) {
    return this.orders.revertToBorrador(requireLabId(user), id);
  }

  @Patch(':id/cancel')
  @Roles('admin')
  @ApiOperation({ summary: 'cualquier estado no terminal -> anulada' })
  cancel(
    @CurrentUser() user: Session,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelOrderDto,
  ) {
    return this.orders.cancel(requireLabId(user), id, dto);
  }
}
