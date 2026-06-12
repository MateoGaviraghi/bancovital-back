import { Roles } from '@/common/decorators/roles.decorator';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { CatalogQueryDto } from './dto/catalog-query.dto';
import type { CreatePracticeDto } from './dto/create-practice.dto';
import type { UpdatePracticeDto } from './dto/update-practice.dto';
import { PracticesService } from './practices.service';

@ApiTags('practices')
@ApiBearerAuth()
@Controller('practices')
export class PracticesController {
  constructor(private readonly practices: PracticesService) {}

  @Get()
  @ApiOperation({ summary: 'Buscar practicas por nombre o codigo NBU' })
  search(
    @Query('q') q = '',
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 50,
    @Query('section') section?: string,
  ) {
    return this.practices.search(
      q.trim(),
      Math.min(Math.max(limit, 1), 500),
      section?.trim() || undefined,
    );
  }

  @Get('catalog')
  @ApiOperation({
    summary: 'Catalogo paginado (activas + inactivas) con filtros y total',
  })
  catalog(@Query() query: CatalogQueryDto) {
    return this.practices.catalog(query);
  }

  @Get('bulk')
  @ApiOperation({ summary: 'Lookup multiple por ids ("?ids=1,2,3")' })
  byIds(@Query('ids') ids = '') {
    const parsed = ids
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const n = Number(s);
        if (!Number.isInteger(n) || n <= 0) {
          throw new BadRequestException(`Id invalido: ${s}`);
        }
        return n;
      });
    return this.practices.byIds(parsed);
  }

  @Get('by-nbu/:code')
  @ApiOperation({ summary: 'Detalle de practica por codigo NBU' })
  byNbuCode(@Param('code') code: string) {
    return this.practices.byNbuCode(code);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de practica por id' })
  async byId(@Param('id', ParseIntPipe) id: number) {
    const [row] = await this.practices.byIds([id]);
    if (!row) throw new NotFoundException(`No existe la practica ${id}`);
    return row;
  }

  @Post()
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear práctica manualmente' })
  create(@Body() dto: CreatePracticeDto) {
    return this.practices.create(dto);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Actualizar práctica (campos parciales)' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePracticeDto) {
    return this.practices.update(id, dto);
  }
}
