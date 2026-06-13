import { Roles } from '@/common/decorators/roles.decorator';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/contracts.dto';

@ApiTags('super')
@ApiBearerAuth()
@Controller('super/contracts')
@Roles('super')
export class ContractsSuperController {
  constructor(private readonly contractsService: ContractsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear contrato y generar PDF original' })
  create(@Body() dto: CreateContractDto) {
    return this.contractsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar contratos (resumen)' })
  list() {
    return this.contractsService.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de contrato con URLs firmadas' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.contractsService.findOne(id);
  }

  @Post(':id/resend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reenviar contrato (nuevo token + expiración)' })
  resend(@Param('id', ParseIntPipe) id: number) {
    return this.contractsService.resend(id);
  }

  @Post(':id/anular')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Anular contrato (no si ya firmado)' })
  anular(@Param('id', ParseIntPipe) id: number) {
    return this.contractsService.anular(id);
  }
}
