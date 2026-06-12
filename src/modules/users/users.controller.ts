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
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { InviteUserDto } from './dto/invite-user.dto';
import type { SetActiveDto } from './dto/set-active.dto';
import type { SetRoleDto } from './dto/set-role.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@Roles('admin')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Lista usuarios del laboratorio actual' })
  list(@CurrentUser() user: Session) {
    return this.users.list(requireLabId(user));
  }

  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Invita por email (magic link automatico). El usuario queda en este laboratorio.',
  })
  invite(@CurrentUser() user: Session, @Body() dto: InviteUserDto) {
    return this.users.invite(requireLabId(user), dto);
  }

  @Patch(':id/role')
  @ApiOperation({
    summary: 'Cambia el rol del usuario. Bloquea self-demotion.',
  })
  setRole(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: SetRoleDto,
    @CurrentUser() current: Session,
  ) {
    return this.users.setRole(requireLabId(current), id, dto.role, current);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Elimina permanentemente el usuario de Supabase y del lab.' })
  deleteUser(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() current: Session,
  ) {
    return this.users.deleteUser(requireLabId(current), id, current);
  }

  @Patch(':id/active')
  @ApiOperation({
    summary: 'Activa/desactiva (ban_duration en Supabase). Bloquea self-deactivation.',
  })
  setActive(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: SetActiveDto,
    @CurrentUser() current: Session,
  ) {
    return this.users.setActive(requireLabId(current), id, dto.active, current);
  }
}
