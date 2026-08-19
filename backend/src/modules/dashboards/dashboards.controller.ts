import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentOrganization } from '../../common/decorators/current-organization.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CreateDashboardDto, DashboardDataPreviewBatchDto, DashboardDataPreviewDto, FilterOptionsDto, UpdateDashboardDto, WidgetDto } from './dto';
import { DashboardsService } from './dashboards.service';

@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
@Controller('dashboards')
export class DashboardsController {
  constructor(private service: DashboardsService) {}

  @Post()
  @Permissions('dashboard.create')
  create(@Body() dto: CreateDashboardDto, @CurrentOrganization() org: string, @CurrentUser() user: any) {
    return this.service.create(dto, org, user);
  }

  @Get()
  @Permissions('dashboard.view')
  list(@CurrentOrganization() org: string, @CurrentUser() user: any, @Query('summary') summary?: string) {
    return this.service.list(org, user, summary === 'true');
  }

  @Post('data-preview')
  @Permissions('dashboard.view')
  previewData(@Body() dto: DashboardDataPreviewDto, @CurrentOrganization() org: string, @CurrentUser() user: any) {
    return this.service.previewData(dto, org, user);
  }

  @Post('data-preview-batch')
  @Permissions('dashboard.view')
  previewDataBatch(@Body() dto: DashboardDataPreviewBatchDto, @CurrentOrganization() org: string, @CurrentUser() user: any) {
    return this.service.previewDataBatch(dto, org, user);
  }

  @Post('filter-options')
  @Permissions('dashboard.view')
  filterOptions(@Body() dto: FilterOptionsDto, @CurrentOrganization() org: string, @CurrentUser() user: any) {
    return this.service.filterOptions(dto, org, user);
  }

  @Get('widgets/:widgetId/data')
  @Permissions('dashboard.view')
  widgetData(@Param('widgetId') widgetId: string, @CurrentOrganization() org: string, @CurrentUser() user: any, @Query('filters') filters?: string) {
    let parsedFilters: any[] = [];
    try {
      parsedFilters = filters ? JSON.parse(filters) : [];
    } catch {
      parsedFilters = [];
    }
    return this.service.widgetData(widgetId, org, user, parsedFilters);
  }

  @Get(':id')
  @Permissions('dashboard.view')
  get(@Param('id') id: string, @CurrentOrganization() org: string, @CurrentUser() user: any) {
    return this.service.get(id, org, user);
  }

  @Put(':id')
  @Permissions('dashboard.edit')
  update(@Param('id') id: string, @Body() dto: UpdateDashboardDto, @CurrentOrganization() org: string, @CurrentUser() user: any) {
    return this.service.update(id, dto, org, user);
  }

  @Delete(':id')
  @Permissions('dashboard.delete')
  remove(@Param('id') id: string, @CurrentOrganization() org: string, @CurrentUser() user: any) {
    return this.service.remove(id, org, user);
  }

  @Post(':id/publish')
  @Permissions('dashboard.edit')
  publish(@Param('id') id: string, @CurrentOrganization() org: string, @CurrentUser() user: any) {
    return this.service.publish(id, org, user);
  }

  @Post(':id/duplicate')
  @Permissions('dashboard.create')
  duplicate(@Param('id') id: string, @CurrentOrganization() org: string, @CurrentUser() user: any) {
    return this.service.duplicate(id, org, user);
  }

  @Post(':id/widgets')
  @Permissions('dashboard.edit')
  addWidget(@Param('id') id: string, @Body() dto: WidgetDto, @CurrentOrganization() org: string, @CurrentUser() user: any) {
    return this.service.addWidget(id, dto, org, user);
  }

  @Put(':id/widgets/:widgetId')
  @Permissions('dashboard.edit')
  updateWidget(@Param('id') id: string, @Param('widgetId') widgetId: string, @Body() dto: Partial<WidgetDto>, @CurrentOrganization() org: string, @CurrentUser() user: any) {
    return this.service.updateWidget(id, widgetId, dto, org, user);
  }

  @Delete(':id/widgets/:widgetId')
  @Permissions('dashboard.edit')
  removeWidget(@Param('id') id: string, @Param('widgetId') widgetId: string, @CurrentOrganization() org: string, @CurrentUser() user: any) {
    return this.service.removeWidget(id, widgetId, org, user);
  }
}
