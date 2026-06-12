import type { Session } from '@/auth/session';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { CreateInsurerDto } from './dto/create-insurer.dto';
import type { SetUbValueDto } from './dto/set-ub-value.dto';
import type { SetActiveDto, UpdateInsurerDto } from './dto/update-insurer.dto';
import type { InsurersService } from './insurers.service';

@ApiTags('insurers')
@ApiBearerAuth()
@Controller('insurers')
export class InsurersController {
  constructor(private readonly insurers: InsurersService) {}

  @Get()
  @ApiOperation({ summary: 'Listar obras sociales (catalogo global)' })
  list(@Query('onlyActive', new ParseBoolPipe({ optional: true })) onlyActive?: boolean) {
    return this.insurers.list(onlyActive ?? false);
  }

  @Get('with-ub')
  @ApiOperation({ summary: 'Listar obras sociales con su UB vigente (global)' })
  listWithUb() {
    return this.insurers.listWithCurrentUb();
  }

  @Get(':id')
  byId(@Param('id', ParseIntPipe) id: number) {
    return this.insurers.byId(id);
  }

  @Get(':id/ub-history')
  @ApiOperation({ summary: 'Historico de UB de la obra social (global, DESC por validFrom)' })
  ubHistory(@Param('id', ParseIntPipe) id: number) {
    return this.insurers.ubHistory(id);
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateInsurerDto) {
    return this.insurers.create(dto);
  }

  @Patch(':id')
  @Roles('admin')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateInsurerDto) {
    return this.insurers.update(id, dto);
  }

  @Patch(':id/active')
  @Roles('admin')
  setActive(@Param('id', ParseIntPipe) id: number, @Body() dto: SetActiveDto) {
    return this.insurers.setActive(id, dto.active);
  }

  @Post('ub-values')
  @Roles('admin')
  @ApiOperation({
    summary: 'Setear nuevo valor UB global para una obra social. Cierra el actual en transaccion.',
  })
  setUbValue(@Body() dto: SetUbValueDto, @CurrentUser() user: Session) {
    return this.insurers.setUbValue(dto, user.userId);
  }
}
