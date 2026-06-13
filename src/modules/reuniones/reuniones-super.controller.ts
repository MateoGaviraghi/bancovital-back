import { Roles } from '@/common/decorators/roles.decorator';
import { Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReunionesService } from './reuniones.service';

@ApiTags('super')
@ApiBearerAuth()
@Controller('super/bookings')
@Roles('super')
export class ReunionesSuperController {
  constructor(private readonly reunionesService: ReunionesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar reuniones (panel super)' })
  listar() {
    return this.reunionesService.listar();
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelar una reunión' })
  cancelar(@Param('id', ParseIntPipe) id: number) {
    return this.reunionesService.cancelar(id);
  }
}
