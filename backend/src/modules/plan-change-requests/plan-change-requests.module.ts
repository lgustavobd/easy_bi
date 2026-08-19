import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PlanChangeRequestsController } from './plan-change-requests.controller';
import { PlanChangeRequestsService } from './plan-change-requests.service';

@Module({
  imports: [AuditLogsModule, NotificationsModule],
  controllers: [PlanChangeRequestsController],
  providers: [PlanChangeRequestsService]
})
export class PlanChangeRequestsModule {}
