import { Roles } from '@/common/decorators/roles.decorator';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EspeciesService } from './especies.service';
import { CreateEspecieDto } from './dto/create-especie.dto';
import { UpdateEspecieDto } from './dto/update-especie.dto';
import { CreateRazaDto } from './dto/create-raza.dto';
import { UpdateRazaDto } from './dto/update-raza.dto';
import { SetActiveDto } from './dto/set-active.dto';

@ApiTags('especies')
@ApiBearerAuth()
@Controller('especies')
export class EspeciesController {
  constructor(private readonly especies: EspeciesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todas las especies activas' })
  list() {
    return this.especies.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de especie por id' })
  byId(@Param('id', ParseIntPipe) id: number) {
    return this.especies.byId(id);
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Crear especie' })
  create(@Body() dto: CreateEspecieDto) {
    return this.especies.create(dto);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Actualizar especie' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEspecieDto) {
    return this.especies.update(id, dto);
  }

  @Patch(':id/active')
  @Roles('admin')
  @ApiOperation({ summary: 'Activar/desactivar especie' })
  setActive(@Param('id', ParseIntPipe) id: number, @Body() dto: SetActiveDto) {
    return this.especies.setActive(id, dto.active);
  }

  @Get(':especieId/razas')
  @ApiOperation({ summary: 'Listar razas de una especie' })
  razasByEspecie(@Param('especieId', ParseIntPipe) especieId: number) {
    return this.especies.razasByEspecie(especieId);
  }

  @Post(':especieId/razas')
  @Roles('admin')
  @ApiOperation({ summary: 'Crear raza para una especie' })
  createRaza(@Param('especieId', ParseIntPipe) especieId: number, @Body() dto: CreateRazaDto) {
    return this.especies.createRaza(especieId, dto);
  }

  @Patch('razas/:razaId')
  @Roles('admin')
  @ApiOperation({ summary: 'Actualizar raza' })
  updateRaza(@Param('razaId', ParseIntPipe) razaId: number, @Body() dto: UpdateRazaDto) {
    return this.especies.updateRaza(razaId, dto);
  }

  @Patch('razas/:razaId/active')
  @Roles('admin')
  @ApiOperation({ summary: 'Activar/desactivar raza' })
  setRazaActive(@Param('razaId', ParseIntPipe) razaId: number, @Body() dto: SetActiveDto) {
    return this.especies.setRazaActive(razaId, dto.active);
  }
}
