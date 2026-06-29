import { type Session, requireLabId } from '@/auth/session';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateMuestraAguaDto } from './dto/create-muestra-agua.dto';
import { UpdateMuestraAguaDto } from './dto/update-muestra-agua.dto';
import { MuestrasAguaService } from './muestras-agua.service';

@ApiTags('muestras-agua')
@ApiBearerAuth()
@Controller('muestras-agua')
export class MuestrasAguaController {
  constructor(private readonly svc: MuestrasAguaService) {}

  @Get()
  @ApiOperation({ summary: 'Listar muestras de agua' })
  list(@CurrentUser() user: Session) {
    return this.svc.list(requireLabId(user));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de muestra' })
  byId(@CurrentUser() user: Session, @Param('id', ParseIntPipe) id: number) {
    return this.svc.findById(requireLabId(user), id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear muestra' })
  create(@CurrentUser() user: Session, @Body() dto: CreateMuestraAguaDto) {
    return this.svc.create(requireLabId(user), dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar muestra' })
  update(@CurrentUser() user: Session, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMuestraAguaDto) {
    return this.svc.update(requireLabId(user), id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar muestra' })
  remove(@CurrentUser() user: Session, @Param('id', ParseIntPipe) id: number) {
    return this.svc.remove(requireLabId(user), id);
  }
}
