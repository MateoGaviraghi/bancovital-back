import type { Session } from '@/auth/session';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
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
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type RequestMeta, clientIp, userAgent } from '../super/request-meta';
import { AnunciosService } from './anuncios.service';
import { CreateAnuncioDto, UpdateAnuncioDto } from './dto/anuncio.dto';

@ApiTags('super')
@ApiBearerAuth()
@Controller('super/announcements')
@Roles('super')
export class AnunciosSuperController {
  constructor(private readonly anuncios: AnunciosService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todos los anuncios (panel super)' })
  list() {
    return this.anuncios.listAll();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear anuncio (global o por lab)' })
  create(@Body() dto: CreateAnuncioDto, @CurrentUser() user: Session, @Req() req: RequestMeta) {
    return this.anuncios.create(dto, {
      actorId: user.userId,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar anuncio' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAnuncioDto) {
    return this.anuncios.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar (soft) anuncio' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: Session,
    @Req() req: RequestMeta,
  ) {
    await this.anuncios.remove(id, {
      actorId: user.userId,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
  }
}
