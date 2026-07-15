import { type Session, requireLabId } from '@/auth/session';
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
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { renderCotizacionPdf } from '@/pdf/render';
import { CotizacionesService } from './cotizaciones.service';
import { CreateCotizacionDto } from './dto/create-cotizacion.dto';
import { ListCotizacionesDto } from './dto/list-cotizaciones.dto';
import { UpdateCotizacionDto } from './dto/update-cotizacion.dto';

@ApiBearerAuth()
@ApiTags('cotizaciones')
@Controller('cotizaciones')
export class CotizacionesController {
  constructor(private readonly svc: CotizacionesService) {}

  // ─── Lista ──────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Listar cotizaciones del lab' })
  async list(@CurrentUser() session: Session, @Query() dto: ListCotizacionesDto) {
    const labId = requireLabId(session);
    return this.svc.list(labId, dto);
  }

  // ─── Catálogo de precios (PDF nomenclador UB × OS) ──────────────────────────

  @Get('precios/pdf')
  @ApiOperation({ summary: 'Descargar catálogo de aranceles en PDF (UB × valor OS)' })
  async catalogoPdf(@CurrentUser() session: Session, @Res() res: Response) {
    const labId = requireLabId(session);
    const buffer = await this.svc.getCatalogPdfBuffer(labId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="catalogo-precios.pdf"',
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('precios/practica/:practiceId')
  @ApiOperation({ summary: 'Precio UB × valorUB de una práctica para la obra social indicada' })
  async precioParaPractica(
    @CurrentUser() session: Session,
    @Param('practiceId', ParseIntPipe) practiceId: number,
    @Query('insurerId') insurerId?: string,
  ) {
    const insId = insurerId ? Number(insurerId) : null;
    return this.svc.precioParaPracticaConInfo(practiceId, insId);
  }

  // ─── Detalle ────────────────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Obtener cotización por ID' })
  async byId(@CurrentUser() session: Session, @Param('id', ParseIntPipe) id: number) {
    const labId = requireLabId(session);
    return this.svc.byId(labId, id);
  }

  // ─── Crear ──────────────────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('admin', 'recepcion')
  @ApiOperation({ summary: 'Crear cotización' })
  async create(@CurrentUser() session: Session, @Body() dto: CreateCotizacionDto) {
    const labId = requireLabId(session);
    return this.svc.create(labId, session.userId, dto);
  }

  // ─── Actualizar estado / observaciones ─────────────────────────────────────

  @Patch(':id')
  @Roles('admin', 'recepcion')
  @ApiOperation({ summary: 'Actualizar estado u observaciones de la cotización' })
  async update(
    @CurrentUser() session: Session,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCotizacionDto,
  ) {
    const labId = requireLabId(session);
    return this.svc.update(labId, id, dto);
  }

  // ─── Eliminar (soft) ────────────────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('admin')
  @ApiOperation({ summary: 'Eliminar cotización (soft delete)' })
  async remove(@CurrentUser() session: Session, @Param('id', ParseIntPipe) id: number) {
    const labId = requireLabId(session);
    await this.svc.remove(labId, id);
  }

  // ─── PDF ────────────────────────────────────────────────────────────────────

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Descargar cotización en PDF' })
  async pdf(
    @CurrentUser() session: Session,
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const labId = requireLabId(session);
    const pdfData = await this.svc.buildPdfData(labId, id);
    const buffer = await renderCotizacionPdf(pdfData);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="cotizacion-${id}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
