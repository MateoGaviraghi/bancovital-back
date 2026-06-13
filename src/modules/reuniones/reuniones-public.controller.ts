import { Public } from '@/common/decorators/public.decorator';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CreateReunionDto } from './dto/reuniones.dto';
import { ReunionesService } from './reuniones.service';

@ApiTags('public')
@Controller('public/bookings')
@Public()
@UseGuards(ThrottlerGuard)
export class ReunionesPublicController {
  constructor(private readonly reunionesService: ReunionesService) {}

  @Get('availability')
  @Throttle({ bookings: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Obtener slots disponibles para una fecha (YYYY-MM-DD)' })
  @ApiQuery({ name: 'date', required: true, example: '2025-03-10' })
  async getAvailability(@Query('date') date: string) {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('Parámetro date requerido en formato YYYY-MM-DD');
    }

    // Validar horizonte desde el controller para dar 400 claro
    const ahora = new Date();
    const fechaDate = new Date(date);
    if (Number.isNaN(fechaDate.getTime())) {
      throw new BadRequestException('date inválida');
    }

    const slots = await this.reunionesService.getDisponibilidad(date);
    return { date, slots };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ bookingsPost: { limit: 5, ttl: 10 * 60_000 } })
  @ApiOperation({ summary: 'Reservar una reunión con Nodo' })
  crear(@Body() dto: CreateReunionDto) {
    return this.reunionesService.crear(dto);
  }

  @Get('by-token/:token')
  @Throttle({ bookingsToken: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Obtener datos de una reunión por token (para confirmar/cancelar)' })
  @ApiParam({ name: 'token', description: 'Token único de la reunión (hex 64 chars)' })
  getByToken(@Param('token') token: string) {
    return this.reunionesService.getByToken(token);
  }

  @Post('by-token/:token/confirm')
  @HttpCode(HttpStatus.OK)
  @Throttle({ bookingsToken: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Confirmar asistencia desde el link del email' })
  @ApiParam({ name: 'token', description: 'Token único de la reunión' })
  confirmarAsistencia(@Param('token') token: string) {
    return this.reunionesService.confirmarAsistencia(token);
  }

  @Post('by-token/:token/cancel')
  @HttpCode(HttpStatus.OK)
  @Throttle({ bookingsToken: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Cancelar una reunión desde el link del email' })
  @ApiParam({ name: 'token', description: 'Token único de la reunión' })
  cancelarByToken(@Param('token') token: string) {
    return this.reunionesService.cancelarByToken(token);
  }
}
