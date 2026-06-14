import { Roles } from '@/common/decorators/roles.decorator';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditQueryDto } from './dto/audit-query.dto';
import { SuperService } from './super.service';

@ApiTags('super')
@ApiBearerAuth()
@Controller('super')
@Roles('super')
export class SuperMetricsController {
  constructor(private readonly superService: SuperService) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Métricas agregadas de la plataforma (solo super)' })
  metrics() {
    return this.superService.metrics();
  }

  @Get('audit')
  @ApiOperation({ summary: 'Visor de auditoría paginado (solo super)' })
  audit(@Query() query: AuditQueryDto) {
    return this.superService.auditList({
      labId: query.labId,
      limit: query.limit,
      offset: query.offset,
    });
  }
}
