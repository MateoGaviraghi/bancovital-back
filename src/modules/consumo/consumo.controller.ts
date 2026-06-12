import { type Session, requireLabId } from '@/auth/session';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConsumoService } from './consumo.service';

@ApiTags('consumo')
@ApiBearerAuth()
@Controller('consumo')
export class ConsumoController {
  constructor(private readonly consumoService: ConsumoService) {}

  @Get()
  @Roles('admin', 'recepcion', 'bioquimico')
  @ApiOperation({ summary: 'Ciclo de consumo actual del laboratorio de la sesión' })
  getConsumo(@CurrentUser() user: Session) {
    const labId = requireLabId(user);
    return this.consumoService.getConsumo(labId);
  }
}
