import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { DashboardsController } from './dashboards.controller';
import { DashboardsService } from './dashboards.service';
@Module({ imports: [AuditLogsModule], controllers: [DashboardsController], providers: [DashboardsService] })
export class DashboardsModule {}
