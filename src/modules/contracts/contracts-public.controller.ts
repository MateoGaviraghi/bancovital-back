import { Public } from '@/common/decorators/public.decorator';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { ContractsService } from './contracts.service';
import { SignContractDto, VerifyOtpDto } from './dto/contracts.dto';

@ApiTags('public')
@Controller('public/contracts')
@Public()
@UseGuards(ThrottlerGuard)
export class ContractsPublicController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get(':token')
  @ApiOperation({ summary: 'Obtener resumen de contrato por token (público)' })
  getByToken(@Param('token') token: string) {
    return this.contractsService.getByToken(token);
  }

  @Post(':token/otp/request')
  @HttpCode(HttpStatus.OK)
  @Throttle({ otp: { limit: 5, ttl: 15 * 60 * 1000 } })
  @ApiOperation({ summary: 'Solicitar OTP al email del firmante' })
  async requestOtp(@Param('token') token: string) {
    await this.contractsService.requestOtp(token);
    return { ok: true };
  }

  @Post(':token/otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verificar OTP' })
  async verifyOtp(@Param('token') token: string, @Body() dto: VerifyOtpDto) {
    await this.contractsService.verifyOtp(token, dto.codigo);
    return { ok: true };
  }

  @Post(':token/sign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Firmar contrato + alta automática del laboratorio' })
  sign(
    @Param('token') token: string,
    @Body() dto: SignContractDto,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    const forwarded = req.headers['x-forwarded-for'];
    const clientIp = Array.isArray(forwarded)
      ? forwarded[0]
      : typeof forwarded === 'string'
        ? forwarded.split(',')[0].trim()
        : ip;

    const userAgent = req.headers['user-agent'] ?? 'unknown';

    return this.contractsService.sign(
      token,
      {
        planId: dto.planId,
        firmaDataUrl: dto.firmaDataUrl,
        datosFacturacion: dto.datosFacturacion,
      },
      { ip: clientIp, userAgent },
    );
  }
}
