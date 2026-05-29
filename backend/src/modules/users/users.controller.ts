import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentOrganization } from '../../common/decorators/current-organization.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CreateUserDto, ResetPasswordDto, UpdateUserDto } from './dto';
import { UsersService } from './users.service';

@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
@Controller('users')
export class UsersController {
  constructor(private service: UsersService) {}
  @Get('roles') roles() { return this.service.roles(); }
  @Post() @Permissions('users.manage') create(@Body() dto: CreateUserDto, @CurrentUser() user: any, @CurrentOrganization() org?: string) { return this.service.create(dto, user, org); }
  @Get() @Permissions('users.manage') list(@CurrentUser() user: any, @CurrentOrganization() org?: string, @Query('organizationId') organizationId?: string) { return this.service.list(user, user?.isSuperAdmin ? organizationId || org : org); }
  @Get(':id') @Permissions('users.manage') get(@Param('id') id: string, @CurrentUser() user: any, @CurrentOrganization() org?: string) { return this.service.get(id, user, org); }
  @Put(':id') @Permissions('users.manage') update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: any, @CurrentOrganization() org?: string) { return this.service.update(id, dto, user, org); }
  @Post(':id/reset-password') @Permissions('users.manage') resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto, @CurrentUser() user: any, @CurrentOrganization() org?: string) { return this.service.resetPassword(id, dto.password, user, org); }
  @Delete(':id') @Permissions('users.manage') remove(@Param('id') id: string, @CurrentUser() user: any, @CurrentOrganization() org?: string, @Query('organizationId') organizationId?: string) { return this.service.remove(id, user, user?.isSuperAdmin ? organizationId || org : org); }
}
