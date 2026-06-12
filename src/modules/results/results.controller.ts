import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { requireLabId, type Session } from '@/auth/session';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { UpsertResultDto } from './dto/upsert-result.dto';
import { ResultsService } from './results.service';

@ApiTags('results')
@ApiBearerAuth()
@Controller('results')
export class ResultsController {
  constructor(private readonly results: ResultsService) {}

  @Post()
  @Roles('admin', 'recepcion', 'bioquimico')
  @ApiOperation({
    summary: 'Upsert de resultado (calcula flag automaticamente si valueNumeric)',
  })
  upsert(@Body() dto: UpsertResultDto, @CurrentUser() user: Session) {
    return this.results.upsert(requireLabId(user), dto, user.userId);
  }
}
