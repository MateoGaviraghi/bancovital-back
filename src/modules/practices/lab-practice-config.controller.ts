import { type Session, requireLabId } from '@/auth/session';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Body, Controller, Get, Param, ParseIntPipe, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LabPracticeConfigService } from './lab-practice-config.service';
import { UpdateLabPracticeConfigDto } from './dto/update-lab-practice-config.dto';

@ApiTags('lab-practice-config')
@ApiBearerAuth()
@Controller('lab-practice-config')
export class LabPracticeConfigController {
  constructor(private readonly service: LabPracticeConfigService) {}

  @Get(':practiceId')
  @ApiOperation({ summary: 'Obtener config del lab para una práctica' })
  get(
    @CurrentUser() user: Session,
    @Param('practiceId', ParseIntPipe) practiceId: number,
  ) {
    return this.service.get(requireLabId(user), practiceId);
  }

  @Put(':practiceId')
  @Roles('admin')
  @ApiOperation({ summary: 'Upsert config del lab para una práctica' })
  upsert(
    @CurrentUser() user: Session,
    @Param('practiceId', ParseIntPipe) practiceId: number,
    @Body() dto: UpdateLabPracticeConfigDto,
  ) {
    return this.service.upsert(requireLabId(user), practiceId, dto);
  }
}
