import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentOrganization } from '../../common/decorators/current-organization.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { AuditLogsService } from './audit-logs.service';

@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private service: AuditLogsService) {}
  @Get() @Permissions('audit.view') list(@CurrentOrganization() organizationId?: string, @Query('limit') limit?: string) {
    return this.service.list(organizationId, limit ? Number(limit) : undefined);
  }
}
