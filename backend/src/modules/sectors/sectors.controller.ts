import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentOrganization } from '../../common/decorators/current-organization.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CreateSectorDto, UpdateSectorDto } from './dto';
import { SectorsService } from './sectors.service';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('sectors')
export class SectorsController {
  constructor(private service: SectorsService) {}

  @Get()
  list(@CurrentUser() user: any, @CurrentOrganization() org?: string, @Query('organizationId') organizationId?: string) { return this.service.list(user, user?.isSuperAdmin ? organizationId || org : org); }

  @Post()
  create(@Body() dto: CreateSectorDto, @CurrentUser() user: any, @CurrentOrganization() org?: string) { return this.service.create(dto, user, org); }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSectorDto, @CurrentUser() user: any, @CurrentOrganization() org?: string) { return this.service.update(id, dto, user, org); }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any, @CurrentOrganization() org?: string) { return this.service.remove(id, user, org); }
}
