import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { CurrentOrganization } from '../../common/decorators/current-organization.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ImportTemplateDto } from './dto';
import { ImportTemplatesService } from './import-templates.service';

@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
@Controller('import-templates')
export class ImportTemplatesController {
  constructor(private service: ImportTemplatesService) {}
  @Post() @Permissions('dataset.upload') create(@Body() dto: ImportTemplateDto, @CurrentOrganization() org: string, @CurrentUser() user: any) { return this.service.create(dto, org, user); }
  @Get() @Permissions('dashboard.view') list(@CurrentOrganization() org: string, @CurrentUser() user: any) { return this.service.list(org, user); }
  @Get(':id') @Permissions('dashboard.view') get(@Param('id') id: string, @CurrentOrganization() org: string, @CurrentUser() user: any) { return this.service.get(id, org, user); }
  @Put(':id') @Permissions('dataset.upload') update(@Param('id') id: string, @Body() dto: Partial<ImportTemplateDto>, @CurrentOrganization() org: string, @CurrentUser() user: any) { return this.service.update(id, dto, org, user); }
  @Delete(':id') @Permissions('dataset.upload') remove(@Param('id') id: string, @CurrentOrganization() org: string, @CurrentUser() user: any) { return this.service.remove(id, org, user); }
}
